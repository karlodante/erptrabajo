"""
Servicio de generación de alertas.

Se invoca de dos maneras:
    1. **On-demand**  → endpoint ``POST /alertas/evaluar`` (disparado manual o
                        desde el botón "actualizar" del dashboard).
    2. **Programado** → APScheduler cada N minutos (definido en
                        ``Settings.ALERTAS_CRON_SEGUNDOS``).

Tipos de alerta:
    - stock_bajo             → v_stock_productos.stock_total ≤ producto.stock_minimo
    - vencimiento_proximo    → lote.fecha_vencimiento ≤ HOY + ALERTA_VENCIMIENTO_DIAS
    - lote_vencido           → lote.fecha_vencimiento < HOY  (estado todavía "activo")
    - stock_negativo         → lotes.cantidad_actual < 0   (seguridad)

**Idempotencia**: antes de crear una nueva alerta se verifica que no exista
otra ``leida=false`` para el mismo ``(tipo, producto_id, lote_id)``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import (
    Alerta,
    EstadoLote,
    Lote,
    Producto,
    RolUsuario,
    SeveridadAlerta,
    TipoAlerta,
    Usuario,
)


@dataclass
class ResultadoEvaluacion:
    nuevas: int = 0
    preexistentes_sin_leer: int = 0
    total_sistema: int = 0


# =====================================================================
# Helpers de escritura idempotente
# =====================================================================

async def _upsert_alerta(
    db: AsyncSession,
    tipo: TipoAlerta,
    severidad: SeveridadAlerta,
    mensaje: str,
    *,
    producto_id: Optional[int] = None,
    lote_id: Optional[int] = None,
) -> bool:
    """Crea una alerta sólo si no existe otra con mismo tipo + refs SIN LEER.

    :returns: ``True`` si se creó una nueva.
    """
    same_key = [Alerta.tipo == tipo, Alerta.leida.is_(False)]
    if producto_id is not None:
        same_key.append(Alerta.producto_id == producto_id)
    else:
        same_key.append(Alerta.producto_id.is_(None))
    if lote_id is not None:
        same_key.append(Alerta.lote_id == lote_id)
    else:
        same_key.append(Alerta.lote_id.is_(None))

    exist = await db.execute(select(func.count()).select_from(Alerta).where(and_(*same_key)))
    if int(exist.scalar_one() or 0) > 0:
        return False

    stmt = insert(Alerta).values(
        tipo=tipo,
        severidad=severidad,
        producto_id=producto_id,
        lote_id=lote_id,
        mensaje=mensaje,
        fecha_generacion=func.now(),
        leida=False,
    )
    await db.execute(stmt)
    return True


# =====================================================================
# 1. Stock bajo
# =====================================================================

async def _evaluar_stock_bajo(db: AsyncSession) -> int:
    settings = get_settings()
    umbral_default = settings.ALERTA_STOCK_UMBRAL

    q = (
        select(Producto.id, Producto.nombre, Producto.stock_minimo,
               func.coalesce(func.sum(Lote.cantidad_actual), 0).label("stock"))
        .select_from(Producto)
        .outerjoin(
            Lote,
            and_(
                Lote.producto_id == Producto.id,
                Lote.estado == EstadoLote.ACTIVO,
                Lote.cantidad_actual > 0,
            ),
        )
        .where(Producto.activo.is_(True))
        .group_by(Producto.id, Producto.nombre, Producto.stock_minimo)
        .having(
            func.coalesce(func.sum(Lote.cantidad_actual), 0)
            <= func.coalesce(Producto.stock_minimo, umbral_default)
        )
    )
    rows = (await db.execute(q)).all()

    nuevas = 0
    for pid, nombre, minimo, stock in rows:
        msg = (
            f"Stock bajo en '{nombre}': quedan {stock} unidad(es). "
            f"Mínimo configurado: {minimo if minimo else umbral_default}."
        )
        if await _upsert_alerta(
            db,
            TipoAlerta.STOCK_BAJO,
            SeveridadAlerta.WARNING if int(stock) > 0 else SeveridadAlerta.CRITICAL,
            msg,
            producto_id=int(pid),
        ):
            nuevas += 1
    return nuevas


# =====================================================================
# 2. Vencimiento próximo (≤ N días)
# =====================================================================

async def _evaluar_vencimiento_proximo(db: AsyncSession) -> int:
    settings = get_settings()
    limite = date.today() + timedelta(days=settings.ALERTA_VENCIMIENTO_DIAS)

    q = (
        select(Lote.id, Lote.producto_id, Lote.fecha_vencimiento, Lote.cantidad_actual,
               Producto.nombre)
        .join(Producto, Producto.id == Lote.producto_id)
        .where(
            Lote.estado == EstadoLote.ACTIVO,
            Lote.cantidad_actual > 0,
            Lote.fecha_vencimiento > date.today(),
            Lote.fecha_vencimiento <= limite,
        )
    )
    rows = (await db.execute(q)).all()

    nuevas = 0
    for lid, pid, fv, cant, nombre in rows:
        dias = (fv - date.today()).days
        msg = (
            f"Lote vence en {dias} día(s): '{nombre}' "
            f"(vence {fv.isoformat()}, stock: {cant})."
        )
        if await _upsert_alerta(
            db,
            TipoAlerta.VENCIMIENTO_PROXIMO,
            SeveridadAlerta.WARNING if dias > 2 else SeveridadAlerta.CRITICAL,
            msg,
            producto_id=int(pid),
            lote_id=int(lid),
        ):
            nuevas += 1
    return nuevas


# =====================================================================
# 3. Lotes ya vencidos
# =====================================================================

async def _evaluar_lotes_vencidos(db: AsyncSession) -> int:
    q = (
        select(Lote.id, Lote.producto_id, Lote.fecha_vencimiento, Lote.cantidad_actual,
               Producto.nombre)
        .join(Producto, Producto.id == Lote.producto_id)
        .where(
            Lote.estado == EstadoLote.ACTIVO,
            Lote.fecha_vencimiento < date.today(),
        )
    )
    rows = (await db.execute(q)).all()

    nuevas = 0
    for lid, pid, fv, cant, nombre in rows:
        msg = (
            f"🚨 Lote VENCIDO: '{nombre}' vencido el {fv.isoformat()}. "
            f"Quedan {cant} unidad(es) sin procesar. Dar de baja por merma."
        )
        if await _upsert_alerta(
            db,
            TipoAlerta.LOTE_VENCIDO,
            SeveridadAlerta.CRITICAL,
            msg,
            producto_id=int(pid),
            lote_id=int(lid),
        ):
            nuevas += 1
    return nuevas


# =====================================================================
# 4. Stock negativo (seguridad — no debería ocurrir)
# =====================================================================

async def _evaluar_stock_negativo(db: AsyncSession) -> int:
    q = (
        select(Lote.id, Lote.producto_id, Lote.cantidad_actual, Producto.nombre)
        .join(Producto, Producto.id == Lote.producto_id)
        .where(Lote.cantidad_actual < 0)
    )
    rows = (await db.execute(q)).all()

    nuevas = 0
    for lid, pid, cant, nombre in rows:
        msg = f"⚠ Stock NEGATIVO detectado: '{nombre}', lote #{lid} ({cant})."
        if await _upsert_alerta(
            db,
            TipoAlerta.STOCK_NEGATIVO,
            SeveridadAlerta.CRITICAL,
            msg,
            producto_id=int(pid),
            lote_id=int(lid),
        ):
            nuevas += 1
    return nuevas


# =====================================================================
# API pública
# =====================================================================

async def evaluar_todas(db: AsyncSession) -> ResultadoEvaluacion:
    """Ejecuta todas las comprobaciones y devuelve un resumen.

    Hace ``db.commit()`` al final.
    """
    nuevas = 0
    nuevas += await _evaluar_stock_bajo(db)
    nuevas += await _evaluar_vencimiento_proximo(db)
    nuevas += await _evaluar_lotes_vencidos(db)
    nuevas += await _evaluar_stock_negativo(db)

    await db.commit()

    tot = await db.execute(select(func.count()).select_from(Alerta))
    total = int(tot.scalar_one() or 0)

    sl = await db.execute(
        select(func.count()).select_from(Alerta).where(Alerta.leida.is_(False))
    )
    sin_leer = int(sl.scalar_one() or 0) - nuevas  # sin leer preexistentes

    return ResultadoEvaluacion(
        nuevas=nuevas,
        preexistentes_sin_leer=sin_leer,
        total_sistema=total,
    )


async def marcar_leida(
    db: AsyncSession,
    alerta_id: int,
    usuario: Usuario,
    *,
    valor: bool = True,
) -> Optional[Alerta]:
    alerta = await db.get(Alerta, alerta_id)
    if alerta is None:
        return None
    alerta.leida = valor
    alerta.usuario_leyo_id = usuario.id if valor else None
    alerta.fecha_vista = datetime.now().astimezone() if valor else None
    await db.commit()
    await db.refresh(alerta)
    return alerta


async def marcar_todas_leidas(db: AsyncSession, usuario: Usuario) -> int:
    q = (
        Alerta.__table__.update()
        .where(Alerta.leida.is_(False))
        .values(
            leida=True,
            usuario_leyo_id=usuario.id,
            fecha_vista=func.now(),
        )
    )
    result = await db.execute(q)
    await db.commit()
    return int(getattr(result, "rowcount", 0) or 0)


__all__ = [
    "ResultadoEvaluacion",
    "evaluar_todas",
    "marcar_leida",
    "marcar_todas_leidas",
]

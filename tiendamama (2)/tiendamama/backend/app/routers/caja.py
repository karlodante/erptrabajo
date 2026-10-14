"""
Router de caja: arqueos + movimientos (ingresos/egresos).
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import (
    ArqueoCaja,
    CategoriaMovimiento,
    EstadoArqueo,
    FormaPago,
    MovimientoCaja,
    RolUsuario,
    TipoMovimientoCaja,
    Usuario,
    Venta,
    VentaPago,
)
from ..schemas import (
    ArqueoAbrir,
    ArqueoCerrar,
    ArqueoOut,
    ArqueoTotales,
    MovimientoCajaCreate,
    MovimientoCajaOut,
)
from ..security import get_current_user, require_role


router = APIRouter()


# =====================================================================
# Helpers
# =====================================================================
async def _existe_arqueo_abierto(db: AsyncSession) -> Optional[ArqueoCaja]:
    r = await db.execute(
        select(ArqueoCaja).where(ArqueoCaja.estado == EstadoArqueo.ABIERTO).limit(1)
    )
    return r.scalar_one_or_none()


async def _calcular_suma_efectivo_ventas(
    db: AsyncSession, desde: datetime, hasta: datetime
) -> Decimal:
    q = (
        select(func.coalesce(func.sum(VentaPago.monto), Decimal("0.00")))
        .select_from(Venta)
        .join(VentaPago, VentaPago.venta_id == Venta.id)
        .where(
            Venta.fecha_hora >= desde,
            Venta.fecha_hora <= hasta,
            Venta.estado != "anulada",
            VentaPago.forma_pago == FormaPago.EFECTIVO,
        )
    )
    r = await db.execute(q)
    return Decimal(str(r.scalar_one() or 0))


async def _calcular_ingresos_egresos_manuales(
    db: AsyncSession, arqueo_id: int
) -> tuple[Decimal, Decimal]:
    q = select(
        MovimientoCaja.tipo,
        func.sum(MovimientoCaja.monto).label("m"),
    ).where(MovimientoCaja.arqueo_id == arqueo_id).group_by(MovimientoCaja.tipo)
    r = await db.execute(q)
    ing = Decimal("0.00")
    egr = Decimal("0.00")
    for tipo, m in r.all():
        if tipo == TipoMovimientoCaja.INGRESO:
            ing += Decimal(str(m or 0))
        else:
            egr += Decimal(str(m or 0))
    return ing, egr


# =====================================================================
# Arqueos
# =====================================================================
@router.get("", response_model=list[ArqueoOut],
            summary="Listar arqueos de caja")
async def listar_arqueos(
    fecha_desde: Optional[date] = Query(None, alias="fechaDesde"),
    fecha_hasta: Optional[date] = Query(None, alias="fechaHasta"),
    solo_abiertos: bool = Query(False, alias="soloAbiertos"),
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    q = select(ArqueoCaja)
    filters = []
    if fecha_desde:
        filters.append(ArqueoCaja.fecha >= fecha_desde)
    if fecha_hasta:
        filters.append(ArqueoCaja.fecha <= fecha_hasta)
    if solo_abiertos:
        filters.append(ArqueoCaja.estado == EstadoArqueo.ABIERTO)
    if filters:
        q = q.where(and_(*filters))
    q = q.order_by(ArqueoCaja.fecha.desc(), ArqueoCaja.hora_apertura.desc())
    r = await db.execute(q)
    return r.scalars().all()


@router.get("/abierto", response_model=Optional[ArqueoOut],
            summary="Arqueo abierto actual (si existe)")
async def arqueo_abierto_actual(db: AsyncSession = Depends(get_session),
                                _: Usuario = Depends(get_current_user)):
    return await _existe_arqueo_abierto(db)


@router.get("/{arqueo_id}/totales", response_model=ArqueoTotales,
            summary="Totales de un arqueo: ventas en efectivo, ingresos, egresos")
async def arqueo_totales(arqueo_id: int, db: AsyncSession = Depends(get_session),
                         _: Usuario = Depends(get_current_user)):
    a = await db.get(ArqueoCaja, arqueo_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Arqueo no encontrado.")

    hasta = a.hora_cierre or datetime.now().astimezone()
    efectivo = await _calcular_suma_efectivo_ventas(db, a.hora_apertura, hasta)
    ing, egr = await _calcular_ingresos_egresos_manuales(db, a.id)
    saldo_esperado = (a.monto_inicial + efectivo + ing - egr).quantize(Decimal("0.01"))

    return ArqueoTotales(
        arqueo=a,
        total_ventas_efectivo=efectivo.quantize(Decimal("0.01")),
        total_ingresos=ing.quantize(Decimal("0.01")),
        total_egresos=egr.quantize(Decimal("0.01")),
        saldo_esperado=saldo_esperado,
    )


@router.post("/abrir", response_model=ArqueoOut, status_code=status.HTTP_201_CREATED,
             summary="Abrir arqueo de caja (fondo inicial)",
             dependencies=[Depends(require_role(RolUsuario.CAJERO,
                                                RolUsuario.ADMINISTRADOR))])
async def abrir_arqueo(payload: ArqueoAbrir,
                       current: Usuario = Depends(get_current_user),
                       db: AsyncSession = Depends(get_session)):
    existente = await _existe_arqueo_abierto(db)
    if existente is not None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Ya existe un arqueo ABIERTO. Ciérrelo primero.")
    a = ArqueoCaja(
        fecha=payload.fecha or date.today(),
        monto_inicial=payload.monto_inicial,
        usuario_apertura_id=current.id,
    )
    # Agregar movimiento de FONDO INICIAL (opcional: mejora trazabilidad)
    db.add(a)
    await db.flush()
    mc = MovimientoCaja(
        arqueo_id=a.id,
        tipo=TipoMovimientoCaja.INGRESO,
        categoria=CategoriaMovimiento.FONDO_INICIAL,
        monto=payload.monto_inicial,
        motivo="Fondo inicial de caja",
        usuario_id=current.id,
    )
    db.add(mc)
    await db.commit()
    await db.refresh(a)
    return a


@router.post("/{arqueo_id}/cerrar", response_model=ArqueoOut,
             summary="Cerrar arqueo de caja (calcula diferencia automáticamente)",
             dependencies=[Depends(require_role(RolUsuario.CAJERO,
                                                RolUsuario.ADMINISTRADOR))])
async def cerrar_arqueo(arqueo_id: int,
                        payload: ArqueoCerrar,
                        current: Usuario = Depends(get_current_user),
                        db: AsyncSession = Depends(get_session)):
    a = await db.get(ArqueoCaja, arqueo_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Arqueo no encontrado.")
    if a.estado == EstadoArqueo.CERRADO:
        raise HTTPException(status.HTTP_409_CONFLICT, "El arqueo ya está cerrado.")

    # Totales
    hasta = datetime.now().astimezone()
    efectivo = await _calcular_suma_efectivo_ventas(db, a.hora_apertura, hasta)
    ing, egr = await _calcular_ingresos_egresos_manuales(db, a.id)
    # Fondo inicial ya contado en ingresos → lo restamos del cálculo de efectivo esperado
    fondo = a.monto_inicial
    esperado = (fondo + efectivo + ing - egr - fondo).quantize(Decimal("0.01"))
    monto_esperado_total = (fondo + efectivo + ing - egr).quantize(Decimal("0.01"))
    diferencia = (payload.monto_efectivo_contado - monto_esperado_total).quantize(Decimal("0.01"))

    a.usuario_cierre_id = current.id
    a.hora_cierre = hasta
    a.monto_efectivo_contado = payload.monto_efectivo_contado
    a.monto_esperado = monto_esperado_total
    a.diferencia = diferencia
    a.estado = EstadoArqueo.CERRADO
    if payload.observaciones:
        a.observaciones = payload.observaciones
    await db.commit()
    await db.refresh(a)
    return a


# =====================================================================
# Movimientos de caja (ingresos / egresos)
# =====================================================================
@router.get("/movimientos", response_model=list[MovimientoCajaOut],
            summary="Movimientos manuales de caja (ingresos/egresos)")
async def listar_movimientos(
    arqueo_id: Optional[int] = None,
    tipo: Optional[TipoMovimientoCaja] = None,
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    q = select(MovimientoCaja).order_by(MovimientoCaja.fecha_hora.desc())
    if arqueo_id:
        q = q.where(MovimientoCaja.arqueo_id == arqueo_id)
    if tipo:
        q = q.where(MovimientoCaja.tipo == tipo)
    r = await db.execute(q)
    return r.scalars().all()


@router.post("/movimientos", response_model=MovimientoCajaOut,
             status_code=status.HTTP_201_CREATED,
             summary="Ingreso/egreso manual (requiere arqueo abierto)",
             dependencies=[Depends(require_role(RolUsuario.CAJERO,
                                                RolUsuario.ADMINISTRADOR))])
async def nuevo_movimiento(payload: MovimientoCajaCreate,
                           current: Usuario = Depends(get_current_user),
                           db: AsyncSession = Depends(get_session)):
    arqueo = await _existe_arqueo_abierto(db)
    if arqueo is None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Debe haber un arqueo abierto para registrar movimientos.")
    m = MovimientoCaja(
        arqueo_id=arqueo.id,
        tipo=payload.tipo,
        categoria=payload.categoria,
        monto=payload.monto,
        motivo=payload.motivo,
        usuario_id=current.id,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m

"""
Servicio PEPS — «Primero en Expirar, Primero en Salir».

Dado un ``producto_id`` y una ``cantidad`` a descontar, el servicio busca los
lotes **activos** con stock positivo del producto, los ordena por
``fecha_vencimiento ASC`` y descuenta de ellos en orden, consumiendo tantos
lotes como sea necesario hasta cubrir la cantidad pedida.

También aplica la lógica de **precio por volumen** (precios_volumen) y
**combos** (combos_promociones) para calcular el precio unitario aplicado.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    ComboDetalle,
    ComboPromocion,
    EstadoLote,
    Lote,
    PrecioVolumen,
    Producto,
)


# =====================================================================
# Tipos de retorno
# =====================================================================

@dataclass
class LoteConsumido:
    """Unidad mínima de consumo: cuánto se descuenta de un lote concreto."""
    lote_id:    int
    cantidad:   int
    costo_unit: Decimal


@dataclass
class ItemResultadoPEPS:
    """Resultado completo para UN renglón de una venta."""
    producto_id:              int
    cantidad:                 int
    precio_unitario_aplicado: Decimal
    descuento_unitario:       Decimal
    subtotal:                 Decimal
    lotes_consumidos:         list[LoteConsumido]
    combo_id:                 Optional[int] = None


class StockInsuficienteError(HTTPException):
    """Levantado cuando la suma de ``cantidad_actual`` no cubre lo pedido."""

    def __init__(self, producto_id: int, faltante: int, nombre: str = ""):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "stock_insuficiente",
                "message": (
                    f"Stock insuficiente para producto #{producto_id}"
                    f" ({nombre}). Faltan {faltante} unidad(es)."
                ),
                "producto_id": producto_id,
                "faltante": faltante,
            },
        )


# =====================================================================
# Funciones públicas
# =====================================================================

async def calcular_stock_disponible(
    db: AsyncSession,
    producto_id: int,
) -> int:
    """Suma ``cantidad_actual`` de todos los lotes ``activo`` con stock > 0."""
    q = (
        select(func.coalesce(func.sum(Lote.cantidad_actual), 0))
        .where(
            Lote.producto_id == producto_id,
            Lote.estado == EstadoLote.ACTIVO,
            Lote.cantidad_actual > 0,
        )
    )
    result = await db.execute(q)
    return int(result.scalar_one() or 0)


async def descontar_peps(
    db: AsyncSession,
    producto_id: int,
    cantidad: int,
    *,
    precio_sugerido: Optional[Decimal] = None,
    combo_id: Optional[int] = None,
) -> ItemResultadoPEPS:
    """
    Calcula y aplica el descuento PEPS sobre los lotes de ``producto_id``.

    **NO** hace ``db.commit()`` — es responsabilidad del llamador
    (típicamente dentro de una transacción junto con la creación de la venta).

    :param db:            sesión SQLAlchemy async
    :param producto_id:   producto a descontar
    :param cantidad:      unidades a consumir (>= 1)
    :param precio_sugerido: si viene ``None`` se resuelve por lógica
                            ``precio_volumen`` / ``producto.precio_unitario``
    :param combo_id:      si viene seteado, el renglón pertenece a un combo
    :returns:             :class:`ItemResultadoPEPS`
    :raises StockInsuficienteError: si no hay stock suficiente
    """
    if cantidad <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "cantidad_invalida", "message": "Cantidad debe ser ≥ 1"},
        )

    # 1. Traer lotes ordenados PEPS: fecha_vencimiento ASC, cantidad_actual > 0
    q_lotes = (
        select(Lote)
        .where(
            Lote.producto_id == producto_id,
            Lote.estado == EstadoLote.ACTIVO,
            Lote.cantidad_actual > 0,
        )
        .order_by(Lote.fecha_vencimiento.asc(), Lote.fecha_ingreso.asc(), Lote.id.asc())
    )
    result = await db.execute(q_lotes)
    lotes: list[Lote] = list(result.scalars().all())

    stock_total = sum(l.cantidad_actual for l in lotes)
    if stock_total < cantidad:
        faltante = cantidad - stock_total
        nombre = ""
        p_res = await db.execute(
            select(Producto.nombre).where(Producto.id == producto_id)
        )
        p_nombre = p_res.scalar_one_or_none()
        if p_nombre:
            nombre = p_nombre
        raise StockInsuficienteError(producto_id, faltante, nombre)

    # 2. Descontar de los lotes en orden PEPS
    consumos: list[LoteConsumido] = []
    pendiente = cantidad

    for lote in lotes:
        if pendiente <= 0:
            break
        tomar = min(pendiente, lote.cantidad_actual)
        lote.cantidad_actual -= tomar
        pendiente -= tomar
        consumos.append(
            LoteConsumido(
                lote_id=lote.id,
                cantidad=tomar,
                costo_unit=Decimal(str(lote.costo_unitario)),
            )
        )
        # Si agotamos el lote, marcamos su estado
        if lote.cantidad_actual == 0:
            lote.estado = EstadoLote.AGOTADO

    # 3. Resolver precio aplicado
    precio_unit = precio_sugerido
    if precio_unit is None:
        precio_unit = await _resolver_precio_unitario(db, producto_id, cantidad)

    descuento = Decimal("0.00")
    if combo_id is not None:
        descuento = await _descuento_por_combo(db, combo_id, producto_id, precio_unit)

    subtotal = (precio_unit - descuento) * cantidad
    subtotal = subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    precio_unit = precio_unit.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    descuento   = descuento.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return ItemResultadoPEPS(
        producto_id=producto_id,
        cantidad=cantidad,
        precio_unitario_aplicado=precio_unit,
        descuento_unitario=descuento,
        subtotal=subtotal,
        lotes_consumidos=consumos,
        combo_id=combo_id,
    )


async def revertir_descuento_peps(
    db: AsyncSession,
    producto_id: int,
    lotes_consumidos: Iterable[LoteConsumido],
) -> None:
    """Rollback: devuelve stock a los lotes indicados.
    Útil al anular una venta.
    """
    for c in lotes_consumidos:
        lote = await db.get(Lote, c.lote_id)
        if lote is None:
            continue
        lote.cantidad_actual += c.cantidad
        if lote.estado == EstadoLote.AGOTADO and lote.cantidad_actual > 0:
            lote.estado = EstadoLote.ACTIVO


# =====================================================================
# Helpers internos
# =====================================================================

async def _resolver_precio_unitario(
    db: AsyncSession,
    producto_id: int,
    cantidad: int,
) -> Decimal:
    """Devuelve el precio que corresponda según ``precios_volumen``.

    Regla: de todos los ``precios_volumen`` del producto con
    ``cantidad_minima <= cantidad``, elegimos el de ``cantidad_minima`` MÁS
    ALTO (el precio más bajo). Si no hay ninguno, devuelve
    ``producto.precio_unitario``.
    """
    q_pv = (
        select(PrecioVolumen)
        .where(
            PrecioVolumen.producto_id == producto_id,
            PrecioVolumen.activo.is_(True),
            PrecioVolumen.cantidad_minima <= cantidad,
        )
        .order_by(PrecioVolumen.cantidad_minima.desc())
        .limit(1)
    )
    r = await db.execute(q_pv)
    pv = r.scalar_one_or_none()
    if pv is not None:
        return Decimal(str(pv.precio_especial))

    q_p = select(Producto.precio_unitario).where(Producto.id == producto_id)
    r2 = await db.execute(q_p)
    base = r2.scalar_one_or_none()
    if base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "producto_no_encontrado"},
        )
    return Decimal(str(base))


async def _descuento_por_combo(
    db: AsyncSession,
    combo_id: int,
    producto_id: int,
    precio_normal: Decimal,
) -> Decimal:
    """Calcula cuánto se descuenta por renglón cuando el ítem está en un combo
    activo y vigente."""
    today = date.today()
    q = (
        select(ComboPromocion, ComboDetalle)
        .join(ComboDetalle, ComboDetalle.combo_id == ComboPromocion.id)
        .where(
            ComboPromocion.id == combo_id,
            ComboPromocion.activo.is_(True),
            ComboPromocion.fecha_inicio <= today,
            (ComboPromocion.fecha_fin.is_(None) | (ComboPromocion.fecha_fin >= today)),
            ComboDetalle.producto_id == producto_id,
        )
    )
    r = await db.execute(q)
    row = r.one_or_none()
    if row is None:
        return Decimal("0.00")

    combo: ComboPromocion = row[0]
    if combo.tipo == "descuento_porcentual":
        return (precio_normal * Decimal(str(combo.valor or 0)) / Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    if combo.tipo == "precio_fijo":
        # Descuento por ítem = normal - valor_fijo / total_productos
        q_n = (
            select(func.count())
            .select_from(ComboDetalle)
            .where(ComboDetalle.combo_id == combo.id)
        )
        rn = await db.execute(q_n)
        n = int(rn.scalar_one() or 1)
        total_ahorro = (precio_normal * n) - Decimal(str(combo.valor or 0))
        if total_ahorro <= 0:
            return Decimal("0.00")
        return (total_ahorro / Decimal(n)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Tipo "combo" simple → 10%
    return (precio_normal * Decimal("0.10")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


__all__ = [
    "LoteConsumido",
    "ItemResultadoPEPS",
    "StockInsuficienteError",
    "calcular_stock_disponible",
    "descontar_peps",
    "revertir_descuento_peps",
]

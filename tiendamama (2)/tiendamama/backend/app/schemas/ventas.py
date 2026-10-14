"""
Schemas de ventas, pagos, detalle de ventas.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import Field

from ..models import EstadoVenta, FormaPago
from .common import BaseSchema


# ---------------------------------------------------------------------------
# Pago (pago mixto)
# ---------------------------------------------------------------------------
class PagoOut(BaseSchema):
    id:         int
    forma_pago: FormaPago
    monto:      Decimal


class PagoCreate(BaseSchema):
    forma_pago: FormaPago
    monto:      Decimal = Field(..., gt=0)


# ---------------------------------------------------------------------------
# Detalle de venta
# ---------------------------------------------------------------------------
class DetalleVentaOut(BaseSchema):
    id:                       int
    producto_id:              int
    producto_nombre:          Optional[str] = None
    lote_id:                  Optional[int] = None
    combo_id:                 Optional[int] = None
    cantidad:                 int
    precio_unitario_aplicado: Decimal
    descuento_unitario:       Decimal
    subtotal:                 Decimal


class DetalleVentaCreate(BaseSchema):
    """Un renglón de la venta. El servicio PEPS resuelve el ``lote_id`` y
    ``precio_unitario_aplicado`` en base a precios_volumen / combos."""

    producto_id: int
    cantidad:    int = Field(..., ge=1)
    combo_id:    Optional[int] = None   # opcional — enlaza a combo_promociones


# ---------------------------------------------------------------------------
# Venta completa
# ---------------------------------------------------------------------------
class VentaBase(BaseSchema):
    cliente_id:      Optional[int] = None
    observaciones: Optional[str]   = None


class VentaOut(VentaBase):
    id:                 int
    numero_comprobante: int
    fecha_hora:         datetime
    usuario_id:         int
    subtotal:           Decimal
    descuento_total:    Decimal
    total:              Decimal
    estado:             EstadoVenta
    sincronizado_dolibarr: bool          = False
    dolibarr_factura_id:   Optional[int] = None

    pagos:          list[PagoOut]        = Field(default_factory=list)
    detalle_ventas: list[DetalleVentaOut] = Field(default_factory=list)


class VentaCreate(VentaBase):
    """Request principal: caja rápida. El backend calcula subtotal / total
    y aplica PEPS + precios_volumen + combos."""

    items: list[DetalleVentaCreate] = Field(..., min_length=1)
    pagos: list[PagoCreate]         = Field(default_factory=list)
    estado: EstadoVenta = EstadoVenta.PAGADA


class VentaUpdate(BaseSchema):
    estado:        Optional[EstadoVenta]   = None
    cliente_id:    Optional[int]           = None
    observaciones: Optional[str]           = None


__all__ = [
    "PagoOut", "PagoCreate",
    "DetalleVentaOut", "DetalleVentaCreate",
    "VentaOut", "VentaCreate", "VentaUpdate",
]

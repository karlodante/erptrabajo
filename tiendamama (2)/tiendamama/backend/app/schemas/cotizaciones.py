"""
Schemas de cotizaciones mayoristas y detalle.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import Field

from ..models import EstadoCotizacion
from .common import BaseSchema


# ---------------------------------------------------------------------------
# Detalle
# ---------------------------------------------------------------------------
class DetalleCotizacionOut(BaseSchema):
    id:              int
    producto_id:     int
    producto_nombre: Optional[str] = None
    cantidad:        int
    precio_acordado: Decimal
    subtotal:        Decimal


class DetalleCotizacionCreate(BaseSchema):
    producto_id:     int
    cantidad:        int = Field(..., ge=1)
    precio_acordado: Decimal = Field(..., ge=0)


# ---------------------------------------------------------------------------
# Cotización
# ---------------------------------------------------------------------------
class CotizacionBase(BaseSchema):
    validez_hasta:    date
    cliente_id:       int
    stock_reservado:  bool            = False
    observaciones:    Optional[str]   = None


class CotizacionOut(CotizacionBase):
    id:                 int
    numero_cotizacion:  str
    fecha_hora:         datetime
    usuario_id:         int
    subtotal:           Decimal
    descuento_total:    Decimal
    total:              Decimal
    estado:             EstadoCotizacion
    created_at:         datetime

    detalle_cotizacion: list[DetalleCotizacionOut] = Field(default_factory=list)


class CotizacionCreate(BaseSchema):
    validez_hasta:    date
    cliente_id:       int
    items:            list[DetalleCotizacionCreate] = Field(..., min_length=1)
    descuento_total:  Decimal = Field(Decimal("0.00"), ge=0)
    stock_reservado:  bool    = False
    observaciones:    Optional[str] = None


class CotizacionUpdate(BaseSchema):
    validez_hasta:   Optional[date]   = None
    estado:          Optional[EstadoCotizacion] = None
    stock_reservado: Optional[bool]   = None
    observaciones:   Optional[str]    = None
    descuento_total: Optional[Decimal] = Field(None, ge=0)


__all__ = [
    "DetalleCotizacionOut", "DetalleCotizacionCreate",
    "CotizacionOut", "CotizacionCreate", "CotizacionUpdate",
]

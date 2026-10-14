"""
Schemas de lotes y mermas.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import Field

from ..models import EstadoLote, MotivoMerma
from .common import BaseSchema


# ---------------------------------------------------------------------------
# Lotes
# ---------------------------------------------------------------------------
class LoteBase(BaseSchema):
    producto_id:      int
    proveedor_id:  Optional[int] = None
    numero_lote:   Optional[str] = Field(None, max_length=100)
    cantidad_inicial: int = Field(..., ge=1)
    costo_unitario:   Decimal = Field(0, ge=0, max_digits=12, decimal_places=4)
    fecha_ingreso:    datetime = Field(default_factory=lambda: datetime.now().astimezone())
    fecha_vencimiento: date


class LoteOut(LoteBase):
    id:              int
    cantidad_actual: int
    estado:          EstadoLote
    created_at:      datetime


class LoteCreate(BaseSchema):
    producto_id:       int
    proveedor_id:      Optional[int] = None
    numero_lote:       Optional[str] = Field(None, max_length=100)
    cantidad_inicial:  int = Field(..., ge=1)
    costo_unitario:    Decimal = Field(0, ge=0, max_digits=12, decimal_places=4)
    fecha_ingreso:     Optional[datetime] = None
    fecha_vencimiento: date


class LoteUpdate(BaseSchema):
    proveedor_id:       Optional[int] = None
    numero_lote:        Optional[str] = Field(None, max_length=100)
    costo_unitario:     Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=4)
    fecha_vencimiento:  Optional[date] = None
    estado:             Optional[EstadoLote] = None


# ---------------------------------------------------------------------------
# Mermas
# ---------------------------------------------------------------------------
class MermaBase(BaseSchema):
    producto_id:   int
    lote_id:     Optional[int] = None
    cantidad:    int = Field(..., ge=1)
    motivo:      MotivoMerma
    fecha_hora:    datetime = Field(default_factory=lambda: datetime.now().astimezone())
    observaciones: Optional[str] = None


class MermaOut(MermaBase):
    id:         int
    usuario_id: int


class MermaCreate(BaseSchema):
    producto_id:   int
    lote_id:       Optional[int] = None
    cantidad:      int = Field(..., ge=1)
    motivo:        MotivoMerma
    observaciones: Optional[str] = None


__all__ = [
    "LoteOut", "LoteCreate", "LoteUpdate",
    "MermaOut", "MermaCreate",
]

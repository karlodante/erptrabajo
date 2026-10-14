"""
Schemas de proveedores y alertas.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import EmailStr, Field

from ..models import (
    EstadoPedidoSugerido,
    SeveridadAlerta,
    TipoAlerta,
)
from .common import BaseSchema


# ---------------------------------------------------------------------------
# Proveedores
# ---------------------------------------------------------------------------
class ProveedorBase(BaseSchema):
    nombre:    str = Field(..., min_length=2, max_length=150)
    cuit:      Optional[str] = Field(None, max_length=13)
    contacto:  Optional[str] = Field(None, max_length=150)
    telefono:  Optional[str] = Field(None, max_length=30)
    email:     Optional[str] = Field(None, max_length=150)
    direccion: Optional[str] = None
    activo:    bool = True


class ProveedorOut(ProveedorBase):
    id:         int
    created_at: datetime


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorUpdate(BaseSchema):
    nombre:    Optional[str] = Field(None, min_length=2, max_length=150)
    cuit:      Optional[str] = Field(None, max_length=13)
    contacto:  Optional[str] = Field(None, max_length=150)
    telefono:  Optional[str] = Field(None, max_length=30)
    email:     Optional[str] = Field(None, max_length=150)
    direccion: Optional[str] = None
    activo:    Optional[bool] = None


# ---------------------------------------------------------------------------
# Pedidos sugeridos (mínimo esquema para extender luego)
# ---------------------------------------------------------------------------
class PedidoSugeridoDetalleOut(BaseSchema):
    id:                 int
    producto_id:        int
    cantidad_sugerida:  int
    cantidad_aprobada:  Optional[int] = None


class PedidoSugeridoOut(BaseSchema):
    id:                 int
    proveedor_id:       Optional[int] = None
    fecha_generacion:   datetime
    estado:             EstadoPedidoSugerido
    usuario_id:         Optional[int] = None
    observaciones:      Optional[str] = None
    detalles:           list[PedidoSugeridoDetalleOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Alertas
# ---------------------------------------------------------------------------
class AlertaOut(BaseSchema):
    id:               int
    tipo:             TipoAlerta
    severidad:        SeveridadAlerta
    producto_id:      Optional[int]   = None
    lote_id:          Optional[int]   = None
    mensaje:          str
    fecha_generacion: datetime
    leida:            bool
    usuario_leyo_id:  Optional[int]   = None
    fecha_vista:      Optional[datetime] = None


class AlertaMarcarLeida(BaseSchema):
    leida: bool = True


class ResumenAlertas(BaseSchema):
    total_sin_leer:         int = 0
    stock_bajo:             int = 0
    vencimiento_proximo:    int = 0
    lotes_vencidos:         int = 0
    stock_negativo:         int = 0
    criticas:               int = 0


__all__ = [
    "ProveedorOut", "ProveedorCreate", "ProveedorUpdate",
    "PedidoSugeridoOut", "PedidoSugeridoDetalleOut",
    "AlertaOut", "AlertaMarcarLeida", "ResumenAlertas",
]

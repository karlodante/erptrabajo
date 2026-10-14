"""
Schemas de Productos + categorías.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import Field

from ..models import UnidadMedida
from .common import BaseSchema


# ---------------------------------------------------------------------------
# Categorías
# ---------------------------------------------------------------------------
class CategoriaBase(BaseSchema):
    nombre:      str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = None
    activo:    bool = True


class CategoriaOut(CategoriaBase):
    id:         int
    created_at: datetime


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseSchema):
    nombre:      Optional[str] = Field(None, min_length=2, max_length=100)
    descripcion: Optional[str] = None
    activo:    Optional[bool] = None


# ---------------------------------------------------------------------------
# Precios por volumen (anidados dentro de producto)
# ---------------------------------------------------------------------------
class PrecioVolumenOut(BaseSchema):
    id:              int
    cantidad_minima: int
    precio_especial: Decimal
    activo:          bool


class PrecioVolumenCreate(BaseSchema):
    cantidad_minima: int = Field(..., ge=1)
    precio_especial: Decimal = Field(..., gt=0)
    activo:          bool = True


class PrecioVolumenUpdate(BaseSchema):
    cantidad_minima: Optional[int] = Field(None, ge=1)
    precio_especial: Optional[Decimal] = Field(None, gt=0)
    activo:          Optional[bool] = None


# ---------------------------------------------------------------------------
# Productos
# ---------------------------------------------------------------------------
class ProductoBase(BaseSchema):
    sku:            str = Field(..., min_length=2, max_length=50)
    codigo_barras:  Optional[str] = Field(None, max_length=50)
    nombre:         str = Field(..., min_length=2, max_length=200)
    categoria_id:   int
    unidad_medida: UnidadMedida = UnidadMedida.UNIDAD
    precio_unitario: Decimal = Field(..., gt=0)
    stock_minimo: int = Field(5, ge=0)
    activo:       bool = True


class ProductoOut(ProductoBase):
    id:                int
    creado_por:        Optional[int] = None
    created_at:        datetime


class ProductoListado(ProductoOut):
    """Vista extendida usada en el listado (con stock calculado)."""
    stock_total:       int = 0
    proximo_vencimiento: Optional[datetime] = None
    estado:            str = "ok"


class ProductoCreate(ProductoBase):
    precios_volumen: list[PrecioVolumenCreate] = Field(default_factory=list)


class ProductoUpdate(BaseSchema):
    sku:            Optional[str] = Field(None, min_length=2, max_length=50)
    codigo_barras:  Optional[str] = Field(None, max_length=50)
    nombre:         Optional[str] = Field(None, min_length=2, max_length=200)
    categoria_id:   Optional[int] = None
    unidad_medida:  Optional[UnidadMedida] = None
    precio_unitario: Optional[Decimal] = Field(None, gt=0)
    stock_minimo:   Optional[int] = Field(None, ge=0)
    activo:         Optional[bool] = None


__all__ = [
    "CategoriaOut", "CategoriaCreate", "CategoriaUpdate",
    "PrecioVolumenOut", "PrecioVolumenCreate", "PrecioVolumenUpdate",
    "ProductoOut", "ProductoListado", "ProductoCreate", "ProductoUpdate",
]

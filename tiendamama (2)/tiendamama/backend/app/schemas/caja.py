"""
Schemas de arqueos y movimientos de caja.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import Field

from ..models import (
    CategoriaMovimiento,
    EstadoArqueo,
    TipoMovimientoCaja,
)
from .common import BaseSchema


# ---------------------------------------------------------------------------
# Arqueos
# ---------------------------------------------------------------------------
class ArqueoBase(BaseSchema):
    monto_inicial: Decimal = Field(..., ge=0)
    fecha:         date    = Field(default_factory=lambda: date.today())


class ArqueoOut(ArqueoBase):
    id:                   int
    usuario_apertura_id:  int
    usuario_cierre_id:    Optional[int] = None
    hora_apertura:        datetime
    hora_cierre:          Optional[datetime] = None
    monto_efectivo_contado: Optional[Decimal] = None
    monto_esperado:       Optional[Decimal] = None
    diferencia:           Optional[Decimal] = None
    estado:               EstadoArqueo
    observaciones:        Optional[str] = None
    created_at:           datetime


class ArqueoAbrir(BaseSchema):
    monto_inicial: Decimal = Field(..., ge=0)
    fecha:         Optional[date] = None


class ArqueoCerrar(BaseSchema):
    monto_efectivo_contado: Decimal = Field(..., ge=0)
    observaciones:          Optional[str] = None


# ---------------------------------------------------------------------------
# Movimientos (ingresos / egresos)
# ---------------------------------------------------------------------------
class MovimientoCajaOut(BaseSchema):
    id:         int
    arqueo_id:  int
    tipo:       TipoMovimientoCaja
    categoria:  CategoriaMovimiento
    monto:      Decimal
    motivo:     Optional[str] = None
    fecha_hora: datetime
    usuario_id: int


class MovimientoCajaCreate(BaseSchema):
    """Sólo válido si hay un arqueo ABIERTO."""
    tipo:      TipoMovimientoCaja
    categoria: CategoriaMovimiento = CategoriaMovimiento.OTRO
    monto:     Decimal = Field(..., gt=0)
    motivo:    Optional[str] = None


# ---------------------------------------------------------------------------
# Totales del arqueo (response composé)
# ---------------------------------------------------------------------------
class ArqueoTotales(BaseSchema):
    arqueo:                ArqueoOut
    total_ventas_efectivo: Decimal
    total_ingresos:        Decimal
    total_egresos:         Decimal
    saldo_esperado:        Decimal


__all__ = [
    "ArqueoOut", "ArqueoAbrir", "ArqueoCerrar", "ArqueoTotales",
    "MovimientoCajaOut", "MovimientoCajaCreate",
]

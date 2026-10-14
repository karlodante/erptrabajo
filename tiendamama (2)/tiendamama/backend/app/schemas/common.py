"""
Schemas Pydantic — esquemas reutilizables (listas paginadas, enums exportados, etc.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field


T = TypeVar("T")


class BaseSchema(BaseModel):
    """Base común para todos los schemas: orm-mode / from_attributes."""
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


# ---------------------------------------------------------------------------
# Respuesta paginada genérica
# ---------------------------------------------------------------------------
class Paged(BaseSchema, Generic[T]):
    items:       List[T]
    page:        int = Field(..., ge=1)
    per_page:    int = Field(..., ge=1, le=200)
    total:       int = Field(..., ge=0)
    total_pages: int = Field(..., ge=0)


# ---------------------------------------------------------------------------
# Mensajes simples
# ---------------------------------------------------------------------------
class Message(BaseSchema):
    detail: str
    code: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now().astimezone())


class Token(BaseSchema):
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int
    usuario:    Any  # UsuarioOut


__all__ = ["BaseSchema", "Paged", "Message", "Token"]

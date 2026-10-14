"""
Schemas de autenticación + usuarios.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import Field, field_validator

from ..models import RolUsuario
from .common import BaseSchema


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
class LoginRequest(BaseSchema):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=4, max_length=128)


# ---------------------------------------------------------------------------
# Usuarios
# ---------------------------------------------------------------------------
class UsuarioOut(BaseSchema):
    id:               int
    username:         str
    nombre_completo:  str
    rol:              RolUsuario
    activo:           bool
    created_at:       datetime


class UsuarioCreate(BaseSchema):
    username:         str = Field(..., min_length=2, max_length=50)
    password:       str = Field(..., min_length=4, max_length=128)
    nombre_completo: str = Field(..., min_length=2, max_length=150)
    rol:            RolUsuario = RolUsuario.CAJERO
    activo:         bool = True


class UsuarioUpdate(BaseSchema):
    nombre_completo: Optional[str] = Field(None, min_length=2, max_length=150)
    password:       Optional[str] = Field(None, min_length=4, max_length=128)
    rol:            Optional[RolUsuario] = None
    activo:         Optional[bool] = None


class ChangePassword(BaseSchema):
    old_password: str = Field(..., min_length=4)
    new_password: str = Field(..., min_length=4)

    @field_validator("new_password")
    @classmethod
    def _pw_different(cls, v: str, info) -> str:  # noqa: D401
        old = info.data.get("old_password")
        if old and v == old:
            raise ValueError("La nueva contraseña debe ser distinta.")
        return v


__all__ = [
    "LoginRequest",
    "UsuarioOut",
    "UsuarioCreate",
    "UsuarioUpdate",
    "ChangePassword",
]

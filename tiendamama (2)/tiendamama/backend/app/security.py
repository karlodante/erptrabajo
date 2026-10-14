"""
Autenticación simple: JWT HS256 con roles.

- ``create_access_token``   → genera token con claims: sub (usuario.id), username, rol
- ``get_current_user``      → depende FastAPI: valida token, devuelve objeto Usuario
- ``require_role``          → factory de dependencias: chequea que el usuario
                               tenga AL MENOS uno de los roles pedidos.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Iterable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import get_session
from .models import RolUsuario, Usuario


pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ---------------------------------------------------------------------------
# Helpers de hash de contraseña
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hash_: str) -> bool:
    try:
        return pwd_ctx.verify(plain, hash_)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
def create_access_token(
    user: Usuario,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict] = None,
) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )

    claims = {
        "sub": str(user.id),
        "username": user.username,
        "rol": user.rol.value if isinstance(user.rol, RolUsuario) else user.rol,
        "exp": expire,
        "iat": datetime.now(UTC),
    }
    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(claims, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# Dependencias FastAPI
# ---------------------------------------------------------------------------
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
) -> Usuario:
    """Valida JWT y devuelve el ``Usuario`` dueño del token.

    :raises HTTPException 401: si el token es inválido o el usuario no existe / está inactivo.
    """
    settings = get_settings()
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas o expiradas.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exc
        user_id = int(user_id_raw)
    except (JWTError, ValueError, TypeError):
        raise credentials_exc from None

    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user: Optional[Usuario] = result.scalar_one_or_none()

    if user is None or not user.activo:
        raise credentials_exc

    return user


def require_role(*allowed: RolUsuario | str):
    """Dependencia-factory: valida que el usuario actual tenga uno de los ``allowed``.

    Uso::

        @router.delete("/{id}")
        async def borrar(_: Usuario = Depends(require_role(RolUsuario.ADMINISTRADOR))):
            ...
    """
    allowed_values = {
        r.value if isinstance(r, RolUsuario) else r for r in allowed
    }

    async def _check(user: Usuario = Depends(get_current_user)) -> Usuario:
        user_rol = user.rol.value if isinstance(user.rol, RolUsuario) else user.rol
        if user_rol not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso insuficiente. Se requiere uno de: {sorted(allowed_values)}",
            )
        return user

    return _check


__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "oauth2_scheme",
    "get_current_user",
    "require_role",
]

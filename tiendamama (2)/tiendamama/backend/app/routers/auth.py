"""
Router de autenticación: login, listado de usuarios, cambio de contraseña.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_session
from ..models import RolUsuario, Usuario
from ..schemas import (
    ChangePassword,
    Message,
    Token,
    UsuarioCreate,
    UsuarioOut,
    UsuarioUpdate,
)
from ..security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_role,
    verify_password,
)


router = APIRouter()


# =====================================================================
# LOGIN (OAuth2 compatible)
# =====================================================================
@router.post("/login", response_model=Token, summary="Obtener token JWT")
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_session),
):
    q = select(Usuario).where(
        (Usuario.username == form.username.lower().strip()) & Usuario.activo.is_(True)
    )
    r = await db.execute(q)
    user: Optional[Usuario] = r.scalar_one_or_none()
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    token = create_access_token(
        user, expires_delta=timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        usuario=UsuarioOut.model_validate(user),
    )


# =====================================================================
# MÉ (usuario autenticado)
# =====================================================================
@router.get("/me", response_model=UsuarioOut, summary="Perfil del usuario actual")
async def me(current: Usuario = Depends(get_current_user)):
    return current


@router.post("/me/cambiar-password", response_model=Message,
             summary="Cambiar contraseña del usuario autenticado")
async def cambiar_password(
    payload: ChangePassword,
    current: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    if not verify_password(payload.old_password, current.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail="Contraseña actual incorrecta.")
    current.password_hash = hash_password(payload.new_password)
    await db.commit()
    return Message(detail="Contraseña actualizada.")


# =====================================================================
# CRUD de usuarios (sólo administrador)
# =====================================================================
@router.get("/usuarios", response_model=list[UsuarioOut],
            summary="Listar todos los usuarios",
            dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR))])
async def listar_usuarios(db: AsyncSession = Depends(get_session)):
    r = await db.execute(select(Usuario).order_by(Usuario.nombre_completo.asc()))
    return r.scalars().all()


@router.post("/usuarios", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED,
             summary="Crear nuevo usuario",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR))])
async def crear_usuario(payload: UsuarioCreate, db: AsyncSession = Depends(get_session)):
    q = select(Usuario.id).where(Usuario.username == payload.username.lower().strip())
    r = await db.execute(q)
    if r.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Username ya existe.")

    u = Usuario(
        username=payload.username.lower().strip(),
        password_hash=hash_password(payload.password),
        nombre_completo=payload.nombre_completo,
        rol=payload.rol,
        activo=payload.activo,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@router.patch("/usuarios/{user_id}", response_model=UsuarioOut,
              summary="Modificar usuario",
              dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR))])
async def modificar_usuario(
    user_id: int,
    payload: UsuarioUpdate,
    db: AsyncSession = Depends(get_session),
):
    u = await db.get(Usuario, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        data["password_hash"] = hash_password(data.pop("password"))
    for k, v in data.items():
        setattr(u, k, v)
    await db.commit()
    await db.refresh(u)
    return u

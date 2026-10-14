"""
Router de proveedores.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Proveedor, RolUsuario, Usuario
from ..schemas import ProveedorCreate, ProveedorOut, ProveedorUpdate
from ..security import get_current_user, require_role


router = APIRouter()


@router.get("", response_model=list[ProveedorOut],
            summary="Listar proveedores (búsqueda por nombre/contacto)")
async def listar_proveedores(
    q: Optional[str] = None,
    solo_activos: bool = Query(True, alias="soloActivos"),
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    stmt = select(Proveedor)
    if solo_activos:
        stmt = stmt.where(Proveedor.activo.is_(True))
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Proveedor.nombre).like(like),
                func.lower(Proveedor.contacto).like(like),
                func.lower(Proveedor.telefono).like(like),
                func.lower(Proveedor.email).like(like),
            )
        )
    stmt = stmt.order_by(Proveedor.nombre.asc())
    r = await db.execute(stmt)
    return r.scalars().all()


@router.get("/{prov_id}", response_model=ProveedorOut)
async def proveedor_por_id(prov_id: int, db: AsyncSession = Depends(get_session),
                           _: Usuario = Depends(get_current_user)):
    p = await db.get(Proveedor, prov_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proveedor no encontrado.")
    return p


@router.post("", response_model=ProveedorOut,
             status_code=status.HTTP_201_CREATED,
             summary="Crear proveedor",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                RolUsuario.REPOSITOR))])
async def crear_proveedor(payload: ProveedorCreate,
                          db: AsyncSession = Depends(get_session)):
    ex = await db.execute(
        select(Proveedor.id).where(func.lower(Proveedor.nombre) == payload.nombre.lower())
    )
    if ex.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Proveedor ya existe con ese nombre.")
    p = Proveedor(**payload.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


@router.patch("/{prov_id}", response_model=ProveedorOut,
              summary="Modificar proveedor",
              dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                 RolUsuario.REPOSITOR))])
async def modificar_proveedor(prov_id: int, payload: ProveedorUpdate,
                              db: AsyncSession = Depends(get_session)):
    p = await db.get(Proveedor, prov_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proveedor no encontrado.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p

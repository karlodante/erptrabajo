"""
Router de lotes y mermas.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import (
    EstadoLote,
    Lote,
    Merma,
    MotivoMerma,
    Producto,
    RolUsuario,
    Usuario,
)
from ..schemas import LoteCreate, LoteOut, LoteUpdate, MermaCreate, MermaOut
from ..security import get_current_user, require_role
from ..services import peps as peps_service


router = APIRouter()


# =====================================================================
# LOTES
# =====================================================================
@router.get("", response_model=list[LoteOut],
            summary="Listar lotes (filtros por producto, estado, vencimiento)")
async def listar_lotes(
    producto_id: Optional[int] = Query(None),
    solo_activos: bool = Query(False, alias="soloActivos"),
    a_vencer_en_dias: Optional[int] = Query(
        None, alias="aVencerEnDias",
        description="Mostrar sólo lotes que vencen en ≤ N días",
    ),
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    q = select(Lote)
    filters = []
    if producto_id:
        filters.append(Lote.producto_id == producto_id)
    if solo_activos:
        filters.append(and_(Lote.estado == EstadoLote.ACTIVO, Lote.cantidad_actual > 0))
    if a_vencer_en_dias is not None:
        filters.append(
            Lote.fecha_vencimiento
            <= date.today() + __import__("datetime").timedelta(days=a_vencer_en_dias)
        )
    if filters:
        q = q.where(and_(*filters))
    q = q.order_by(Lote.fecha_vencimiento.asc(), Lote.fecha_ingreso.asc())
    r = await db.execute(q)
    return r.scalars().all()


@router.get("/{lote_id}", response_model=LoteOut)
async def lote_por_id(lote_id: int, db: AsyncSession = Depends(get_session),
                      _: Usuario = Depends(get_current_user)):
    l = await db.get(Lote, lote_id)
    if l is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lote no encontrado.")
    return l


@router.post("", response_model=LoteOut, status_code=status.HTTP_201_CREATED,
             summary="Ingresar lote nuevo (entrada de mercadería)",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                RolUsuario.REPOSITOR))])
async def crear_lote(payload: LoteCreate, db: AsyncSession = Depends(get_session)):
    p = await db.get(Producto, payload.producto_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado.")

    data = payload.model_dump(exclude_unset=True)
    if "cantidad_actual" not in data:
        data["cantidad_actual"] = payload.cantidad_inicial
    l = Lote(**data)
    db.add(l)
    await db.commit()
    await db.refresh(l)
    return l


@router.patch("/{lote_id}", response_model=LoteOut,
              dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                 RolUsuario.REPOSITOR))])
async def modificar_lote(lote_id: int, payload: LoteUpdate,
                         db: AsyncSession = Depends(get_session)):
    l = await db.get(Lote, lote_id)
    if l is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lote no encontrado.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(l, k, v)
    if l.cantidad_actual == 0 and l.estado == EstadoLote.ACTIVO:
        l.estado = EstadoLote.AGOTADO
    await db.commit()
    await db.refresh(l)
    return l


# =====================================================================
# MERMAS
# =====================================================================
@router.get("/mermas", response_model=list[MermaOut],
            tags=["Mermas"],
            summary="Listar mermas")
async def listar_mermas(
    producto_id: Optional[int] = None,
    motivo: Optional[MotivoMerma] = None,
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    q = select(Merma).order_by(Merma.fecha_hora.desc())
    if producto_id:
        q = q.where(Merma.producto_id == producto_id)
    if motivo:
        q = q.where(Merma.motivo == motivo)
    r = await db.execute(q)
    return r.scalars().all()


@router.post("/mermas", response_model=MermaOut, status_code=status.HTTP_201_CREATED,
             tags=["Mermas"],
             summary="Registrar merma (descuenta stock del lote automáticamente)",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                RolUsuario.REPOSITOR))])
async def crear_merma(
    payload: MermaCreate,
    current: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    p = await db.get(Producto, payload.producto_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado.")

    lote_id = payload.lote_id
    lotes_consumidos: list[peps_service.LoteConsumido] = []
    if lote_id is None:
        # Automático PEPS
        res = await peps_service.descontar_peps(
            db, payload.producto_id, payload.cantidad,
        )
        lotes_consumidos = res.lotes_consumidos
        lote_id = lotes_consumidos[0].lote_id if lotes_consumidos else None
    else:
        # Manual: descontar de un lote concreto
        lote = await db.get(Lote, lote_id)
        if lote is None or lote.producto_id != payload.producto_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lote inválido.")
        if lote.cantidad_actual < payload.cantidad:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"Stock insuficiente en lote #{lote_id}.")
        lote.cantidad_actual -= payload.cantidad
        if lote.cantidad_actual == 0:
            lote.estado = EstadoLote.AGOTADO
        if payload.motivo == MotivoMerma.VENCIDO and lote.estado != EstadoLote.AGOTADO:
            lote.estado = EstadoLote.VENCIDO
        if payload.motivo == MotivoMerma.DANADO and lote.estado != EstadoLote.AGOTADO:
            lote.estado = EstadoLote.MERMADO

    m = Merma(
        producto_id=payload.producto_id,
        lote_id=lote_id,
        cantidad=payload.cantidad,
        motivo=payload.motivo,
        usuario_id=current.id,
        observaciones=payload.observaciones,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m

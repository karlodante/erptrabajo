"""
Router de cotizaciones para venta mayorista.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import (
    Cliente,
    CotizacionMayorista,
    DetalleCotizacion,
    EstadoCotizacion,
    Producto,
    RolUsuario,
    Usuario,
)
from ..schemas import (
    CotizacionCreate,
    CotizacionOut,
    CotizacionUpdate,
    DetalleCotizacionOut,
    Paged,
)
from ..security import get_current_user, require_role


router = APIRouter()


async def _cotizacion_to_out(db: AsyncSession, c: CotizacionMayorista) -> CotizacionOut:
    r = await db.execute(
        select(DetalleCotizacion, Producto.nombre)
        .join(Producto, Producto.id == DetalleCotizacion.producto_id)
        .where(DetalleCotizacion.cotizacion_id == c.id)
        .order_by(DetalleCotizacion.id.asc())
    )
    detalles: list[DetalleCotizacionOut] = []
    for dc, pname in r.all():
        d = DetalleCotizacionOut.model_validate(dc)
        d.producto_nombre = pname
        detalles.append(d)
    out = CotizacionOut.model_validate(c)
    out.detalle_cotizacion = detalles
    return out


def _nuevo_numero_cotizacion() -> str:
    """COT-YYYYMMDD-HHMMSSmmm (ej: COT-20260923-153245012)"""
    now = datetime.now()
    return now.strftime("COT-%Y%m%d-%H%M%S%f")[:-3]


@router.get("", response_model=Paged[CotizacionOut],
            summary="Listar cotizaciones mayoristas (paginado)")
async def listar_cotizaciones(
    cliente_id: Optional[int] = None,
    estado: Optional[EstadoCotizacion] = None,
    vencidas: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    q = select(CotizacionMayorista)
    filters = []
    if cliente_id:
        filters.append(CotizacionMayorista.cliente_id == cliente_id)
    if estado:
        filters.append(CotizacionMayorista.estado == estado)
    if vencidas is True:
        filters.append(CotizacionMayorista.validez_hasta < date.today())
    elif vencidas is False:
        filters.append(CotizacionMayorista.validez_hasta >= date.today())
    if filters:
        q = q.where(and_(*filters))

    cnt = select(func.count()).select_from(q.subquery())
    total = int((await db.execute(cnt)).scalar_one() or 0)
    q = q.order_by(CotizacionMayorista.fecha_hora.desc()).limit(per_page).offset((page - 1) * per_page)
    rows = (await db.execute(q)).scalars().all()

    items = [await _cotizacion_to_out(db, c) for c in rows]
    total_pages = (total + per_page - 1) // per_page if total else 0
    return Paged(items=items, page=page, per_page=per_page,
                 total=total, total_pages=total_pages)


@router.get("/{cot_id}", response_model=CotizacionOut)
async def cotizacion_por_id(cot_id: int,
                            db: AsyncSession = Depends(get_session),
                            _: Usuario = Depends(get_current_user)):
    c = await db.get(CotizacionMayorista, cot_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cotización no encontrada.")
    return await _cotizacion_to_out(db, c)


@router.post("", response_model=CotizacionOut,
             status_code=status.HTTP_201_CREATED,
             summary="Crear nueva cotización mayorista",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                RolUsuario.VENDEDOR_MAYORISTA))])
async def crear_cotizacion(payload: CotizacionCreate,
                           current: Usuario = Depends(get_current_user),
                           db: AsyncSession = Depends(get_session)):
    cliente = await db.get(Cliente, payload.cliente_id)
    if cliente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente no encontrado.")

    ids = {i.producto_id for i in payload.items}
    pr = await db.execute(
        select(Producto.id, Producto.activo).where(Producto.id.in_(ids))
    )
    mapa = {pid: act for pid, act in pr.all()}
    faltan = [pid for pid in ids if pid not in mapa]
    if faltan:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Producto(s) inexistente(s): {faltan}")
    inactivos = [pid for pid, act in mapa.items() if not act]
    if inactivos:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Producto(s) inactivo(s): {inactivos}")

    subtotal = Decimal("0.00")
    for i in payload.items:
        subtotal += (Decimal(str(i.precio_acordado)) * i.cantidad)
    subtotal = subtotal.quantize(Decimal("0.01"))
    descuento = Decimal(str(payload.descuento_total)).quantize(Decimal("0.01"))
    total = (subtotal - descuento).quantize(Decimal("0.01"))
    if total < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Descuento excede el subtotal.")

    c = CotizacionMayorista(
        numero_cotizacion=_nuevo_numero_cotizacion(),
        validez_hasta=payload.validez_hasta,
        cliente_id=payload.cliente_id,
        usuario_id=current.id,
        subtotal=subtotal,
        descuento_total=descuento,
        total=total,
        stock_reservado=payload.stock_reservado,
        observaciones=payload.observaciones,
    )
    db.add(c)
    await db.flush()

    for i in payload.items:
        sub = (Decimal(str(i.precio_acordado)) * i.cantidad).quantize(Decimal("0.01"))
        db.add(DetalleCotizacion(
            cotizacion_id=c.id,
            producto_id=i.producto_id,
            cantidad=i.cantidad,
            precio_acordado=i.precio_acordado,
            subtotal=sub,
        ))
    await db.commit()
    await db.refresh(c)
    return await _cotizacion_to_out(db, c)


@router.patch("/{cot_id}", response_model=CotizacionOut,
              summary="Modificar estado / validez / observaciones",
              dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                 RolUsuario.VENDEDOR_MAYORISTA))])
async def modificar_cotizacion(cot_id: int, payload: CotizacionUpdate,
                               db: AsyncSession = Depends(get_session)):
    c = await db.get(CotizacionMayorista, cot_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cotización no encontrada.")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
        if k == "descuento_total":
            nuevo_sub = c.subtotal
            nuevo_desc = Decimal(str(v))
            if nuevo_desc > nuevo_sub:
                await db.rollback()
                raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                    "Descuento excede el subtotal.")
            c.total = (nuevo_sub - nuevo_desc).quantize(Decimal("0.01"))
    await db.commit()
    await db.refresh(c)
    return await _cotizacion_to_out(db, c)


@router.post("/{cot_id}/confirmar", response_model=CotizacionOut,
             summary="Marcar cotización como confirmada (paso previo a generar la venta)",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                RolUsuario.VENDEDOR_MAYORISTA))])
async def confirmar_cotizacion(cot_id: int, db: AsyncSession = Depends(get_session)):
    c = await db.get(CotizacionMayorista, cot_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cotización no encontrada.")
    if c.validez_hasta < date.today():
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Cotización vencida — no se puede confirmar.")
    c.estado = EstadoCotizacion.CONFIRMADA
    await db.commit()
    await db.refresh(c)
    return await _cotizacion_to_out(db, c)

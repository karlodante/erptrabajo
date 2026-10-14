"""
Router de ventas / punto de venta / caja rápida.

Flujo principal:
    1. Escanear código → ``GET /productos/por-codigo/{codigo}``
    2. Cargar items y pagos → ``POST /ventas`` → backend aplica PEPS
       y devuelve la venta confirmada + comprobante.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import (
    DetalleVenta,
    EstadoVenta,
    Producto,
    RolUsuario,
    Usuario,
    Venta,
    VentaPago,
)
from ..schemas import (
    DetalleVentaOut,
    Paged,
    VentaCreate,
    VentaOut,
    VentaUpdate,
)
from ..security import get_current_user, require_role
from ..services import peps as peps_service

router = APIRouter()


# =====================================================================
# Helpers para armar la respuesta
# =====================================================================
async def _venta_to_out(db: AsyncSession, v: Venta) -> VentaOut:
    r1 = await db.execute(
        select(DetalleVenta, Producto.nombre)
        .join(Producto, Producto.id == DetalleVenta.producto_id)
        .where(DetalleVenta.venta_id == v.id)
        .order_by(DetalleVenta.id.asc())
    )
    detalles: list[DetalleVentaOut] = []
    for dv, pname in r1.all():
        d = DetalleVentaOut.model_validate(dv)
        d.producto_nombre = pname
        detalles.append(d)

    r2 = await db.execute(
        select(VentaPago).where(VentaPago.venta_id == v.id).order_by(VentaPago.id.asc())
    )
    pagos = list(r2.scalars().all())

    out = VentaOut.model_validate(v)
    out.detalle_ventas = detalles
    out.pagos = pagos  # type: ignore[assignment]
    return out


# =====================================================================
# CRUD de ventas
# =====================================================================
@router.get("", response_model=Paged[VentaOut],
            summary="Listar / buscar ventas (paginado)")
async def listar_ventas(
    fecha_desde: Optional[datetime] = Query(None, alias="fechaDesde"),
    fecha_hasta: Optional[datetime] = Query(None, alias="fechaHasta"),
    cliente_id: Optional[int] = Query(None),
    cajero_id: Optional[int] = Query(None),
    estado: Optional[EstadoVenta] = None,
    q: Optional[str] = Query(None, description="Busca por #comprobante o observaciones"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    q_stmt = select(Venta)
    filters = []
    if fecha_desde:
        filters.append(Venta.fecha_hora >= fecha_desde)
    if fecha_hasta:
        filters.append(Venta.fecha_hora <= fecha_hasta)
    if cliente_id:
        filters.append(Venta.cliente_id == cliente_id)
    if cajero_id:
        filters.append(Venta.usuario_id == cajero_id)
    if estado:
        filters.append(Venta.estado == estado)
    if q:
        try:
            nro = int(q.strip())
            filters.append(or_(Venta.numero_comprobante == nro,
                               Venta.observaciones.ilike(f"%{q}%")))
        except ValueError:
            filters.append(Venta.observaciones.ilike(f"%{q}%"))
    if filters:
        q_stmt = q_stmt.where(and_(*filters))

    count_q = select(func.count()).select_from(q_stmt.subquery())
    total = int((await db.execute(count_q)).scalar_one() or 0)

    q_stmt = (
        q_stmt.order_by(Venta.fecha_hora.desc())
        .limit(per_page).offset((page - 1) * per_page)
    )
    rows = (await db.execute(q_stmt)).scalars().all()

    items = [await _venta_to_out(db, v) for v in rows]
    total_pages = (total + per_page - 1) // per_page if total else 0
    return Paged(items=items, page=page, per_page=per_page,
                 total=total, total_pages=total_pages)


@router.get("/{venta_id}", response_model=VentaOut)
async def venta_por_id(venta_id: int, db: AsyncSession = Depends(get_session),
                       _: Usuario = Depends(get_current_user)):
    v = await db.get(Venta, venta_id)
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venta no encontrada.")
    return await _venta_to_out(db, v)


@router.post("", response_model=VentaOut, status_code=status.HTTP_201_CREATED,
             summary="Crear venta (PUNTO DE VENTA / CAJA RÁPIDA). Aplica PEPS.")
async def crear_venta(
    payload: VentaCreate,
    current: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Punto de entrada principal de la caja:

    - Valida todos los productos.
    - Aplica PEPS por cada ítem descontando lotes viejos primero.
    - Calcula subtotal / descuento / total.
    - Registra pagos (mixto permitido).
    """

    # --- 1. Validación rápida: que todos los productos existan y estén activos
    ids = {i.producto_id for i in payload.items}
    r = await db.execute(
        select(Producto.id, Producto.nombre, Producto.activo)
        .where(Producto.id.in_(ids))
    )
    productos_map: dict[int, tuple[str, bool]] = {
        pid: (pname, act) for pid, pname, act in r.all()
    }
    faltan = [pid for pid in ids if pid not in productos_map]
    if faltan:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=f"Producto(s) inexistente(s): {faltan}")
    inactivos = [pid for pid, (_n, act) in productos_map.items() if not act]
    if inactivos:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail=f"Producto(s) inactivo(s): {inactivos}")

    # --- 2. Aplicar PEPS a cada ítem, obtener precio, acumular totales
    subtotal_total = Decimal("0.00")
    descuento_total = Decimal("0.00")
    detalles_creados: list[DetalleVenta] = []

    for item in payload.items:
        try:
            res = await peps_service.descontar_peps(
                db, item.producto_id, item.cantidad, combo_id=item.combo_id,
            )
        except peps_service.StockInsuficienteError as e:
            await db.rollback()
            raise e

        dv = DetalleVenta(
            producto_id=res.producto_id,
            lote_id=res.lotes_consumidos[0].lote_id if res.lotes_consumidos else None,
            combo_id=res.combo_id,
            cantidad=res.cantidad,
            precio_unitario_aplicado=res.precio_unitario_aplicado,
            descuento_unitario=res.descuento_unitario,
            subtotal=res.subtotal,
        )
        detalles_creados.append(dv)
        subtotal_total += res.precio_unitario_aplicado * res.cantidad
        descuento_total += res.descuento_unitario * res.cantidad

    subtotal_total = subtotal_total.quantize(Decimal("0.01"))
    descuento_total = descuento_total.quantize(Decimal("0.01"))
    total = (subtotal_total - descuento_total).quantize(Decimal("0.01"))

    # --- 3. Validar pagos
    pagos_sum = Decimal("0.00")
    for p in payload.pagos:
        pagos_sum += p.monto
    if payload.estado == EstadoVenta.PAGADA and abs(pagos_sum - total) > Decimal("0.05"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=(
                f"La suma de pagos ({pagos_sum}) no coincide con el total ({total})."
            ),
        )

    # --- 4. Crear venta + detalles + pagos
    venta = Venta(
        cliente_id=payload.cliente_id,
        usuario_id=current.id,
        subtotal=subtotal_total,
        descuento_total=descuento_total,
        total=total,
        estado=payload.estado,
        observaciones=payload.observaciones,
    )
    db.add(venta)
    await db.flush()

    for dv in detalles_creados:
        dv.venta_id = venta.id
    db.add_all(detalles_creados)

    for p in payload.pagos:
        db.add(VentaPago(venta_id=venta.id, forma_pago=p.forma_pago, monto=p.monto))

    await db.commit()
    await db.refresh(venta)

    return await _venta_to_out(db, venta)


@router.patch("/{venta_id}", response_model=VentaOut,
              summary="Modificar estado / cliente / obs de una venta")
async def modificar_venta(
    venta_id: int,
    payload: VentaUpdate,
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(require_role(RolUsuario.ADMINISTRADOR)),
):
    v = await db.get(Venta, venta_id)
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venta no encontrada.")
    for k, vv in payload.model_dump(exclude_unset=True).items():
        setattr(v, k, vv)
    await db.commit()
    await db.refresh(v)
    return await _venta_to_out(db, v)


@router.post("/{venta_id}/anular", response_model=VentaOut,
             summary="Anular venta (rollback PEPS de stock)",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR))])
async def anular_venta(venta_id: int,
                       db: AsyncSession = Depends(get_session)):
    """Sólo ADMIN. Devuelve stock a los lotes y pasa a ANULADA."""
    v = await db.get(Venta, venta_id)
    if v is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venta no encontrada.")
    if v.estado == EstadoVenta.ANULADA:
        return await _venta_to_out(db, v)

    # Revertir PEPS: agrupar consumo por (producto_id, lote_id)
    r = await db.execute(
        select(DetalleVenta.producto_id, DetalleVenta.lote_id,
               func.sum(DetalleVenta.cantidad).label("cant"))
        .where(DetalleVenta.venta_id == v.id)
        .group_by(DetalleVenta.producto_id, DetalleVenta.lote_id)
    )
    for pid, lid, cant in r.all():
        if lid is None:
            continue
        lotes_consumidos = [peps_service.LoteConsumido(lote_id=lid, cantidad=int(cant or 0),
                                                        costo_unit=Decimal("0"))]
        await peps_service.revertir_descuento_peps(db, pid, lotes_consumidos)

    v.estado = EstadoVenta.ANULADA
    await db.commit()
    await db.refresh(v)
    return await _venta_to_out(db, v)

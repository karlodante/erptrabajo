"""
Router Productos + Categorías + Precios Volumen.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import (
    Categoria,
    EstadoLote,
    Lote,
    PrecioVolumen,
    Producto,
    RolUsuario,
    Usuario,
)
from ..schemas import (
    CategoriaCreate,
    CategoriaOut,
    CategoriaUpdate,
    Paged,
    PrecioVolumenCreate,
    PrecioVolumenOut,
    PrecioVolumenUpdate,
    ProductoCreate,
    ProductoListado,
    ProductoOut,
    ProductoUpdate,
)
from ..security import get_current_user, require_role


router = APIRouter()


# =====================================================================
# Categorías
# =====================================================================
@router.get("/categorias", response_model=list[CategoriaOut],
            summary="Listar categorías (todas o sólo activas)")
async def listar_categorias(
    solo_activos: bool = Query(True, alias="soloActivos"),
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    q = select(Categoria)
    if solo_activos:
        q = q.where(Categoria.activo.is_(True))
    q = q.order_by(Categoria.nombre.asc())
    r = await db.execute(q)
    return r.scalars().all()


@router.post("/categorias", response_model=CategoriaOut,
             status_code=status.HTTP_201_CREATED,
             summary="Crear categoría",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                RolUsuario.REPOSITOR))])
async def crear_categoria(payload: CategoriaCreate,
                          db: AsyncSession = Depends(get_session)):
    ex = await db.execute(
        select(Categoria.id).where(func.lower(Categoria.nombre) == payload.nombre.lower())
    )
    if ex.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Categoría ya existe.")
    c = Categoria(**payload.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@router.patch("/categorias/{cat_id}", response_model=CategoriaOut,
              summary="Modificar categoría",
              dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                 RolUsuario.REPOSITOR))])
async def modificar_categoria(cat_id: int, payload: CategoriaUpdate,
                              db: AsyncSession = Depends(get_session)):
    c = await db.get(Categoria, cat_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoría no encontrada.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return c


# =====================================================================
# Productos — búsqueda, CRUD
# =====================================================================
@router.get("", response_model=Paged[ProductoListado],
            summary="Listar / buscar productos con stock calculado")
async def listar_productos(
    q: Optional[str] = Query(None, description="Busca en SKU, código barras, nombre"),
    categoria_id: Optional[int] = None,
    solo_activos: bool = Query(True, alias="soloActivos"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    """Vista extendida que cruza ``productos`` + ``lotes`` para traer stock."""
    stmt = (
        select(
            Producto,
            func.coalesce(func.sum(Lote.cantidad_actual), 0).label("stock_total"),
            func.min(Lote.fecha_vencimiento).label("proximo_vencimiento"),
        )
        .select_from(Producto)
        .outerjoin(
            Lote,
            and_(
                Lote.producto_id == Producto.id,
                Lote.estado == EstadoLote.ACTIVO,
                Lote.cantidad_actual > 0,
            ),
        )
    )

    filters = []
    if solo_activos:
        filters.append(Producto.activo.is_(True))
    if categoria_id:
        filters.append(Producto.categoria_id == categoria_id)
    if q:
        like = f"%{q.strip().lower()}%"
        filters.append(
            or_(
                func.lower(Producto.sku).like(like),
                func.lower(Producto.codigo_barras).like(like),
                func.lower(Producto.nombre).like(like),
            )
        )
    stmt = stmt.where(and_(*filters)).group_by(Producto.id)

    # total count
    count_q = select(func.count("*")).select_from(stmt.subquery())
    total = int((await db.execute(count_q)).scalar_one() or 0)

    stmt = stmt.order_by(Producto.nombre.asc()).limit(per_page).offset((page - 1) * per_page)
    rows = (await db.execute(stmt)).all()

    items: list[ProductoListado] = []
    for prod, stock, prox_vto in rows:
        data = ProductoListado.model_validate(prod)
        data.stock_total = int(stock or 0)
        data.proximo_vencimiento = prox_vto
        if data.stock_total <= data.stock_minimo:
            data.estado = "stock_bajo"
        elif prox_vto and prox_vto <= date.today() + __import__("datetime").timedelta(days=5):
            data.estado = "vencimiento_proximo"
        items.append(data)

    total_pages = (total + per_page - 1) // per_page if total else 0
    return Paged(items=items, page=page, per_page=per_page,
                 total=total, total_pages=total_pages)


@router.get("/por-codigo/{codigo}", response_model=ProductoListado,
            summary="Buscar producto exacto por código de barras (lector) o SKU")
async def producto_por_codigo(codigo: str,
                              db: AsyncSession = Depends(get_session),
                              _: Usuario = Depends(get_current_user)):
    """Usado por la caja rápida al escanear."""
    stmt = (
        select(
            Producto,
            func.coalesce(func.sum(Lote.cantidad_actual), 0).label("stock"),
            func.min(Lote.fecha_vencimiento).label("vto"),
        )
        .select_from(Producto)
        .outerjoin(
            Lote,
            and_(
                Lote.producto_id == Producto.id,
                Lote.estado == EstadoLote.ACTIVO,
                Lote.cantidad_actual > 0,
            ),
        )
        .where(
            Producto.activo.is_(True),
            or_(Producto.codigo_barras == codigo, Producto.sku == codigo),
        )
        .group_by(Producto.id)
        .limit(1)
    )
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado.")
    prod, stock, vto = row
    out = ProductoListado.model_validate(prod)
    out.stock_total = int(stock or 0)
    out.proximo_vencimiento = vto
    if out.stock_total <= out.stock_minimo:
        out.estado = "stock_bajo"
    return out


@router.get("/{prod_id}", response_model=ProductoOut, summary="Producto por id")
async def producto_por_id(prod_id: int, db: AsyncSession = Depends(get_session),
                          _: Usuario = Depends(get_current_user)):
    p = await db.get(Producto, prod_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado.")
    return p


@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED,
             summary="Crear producto + precios_volumen anidados",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                RolUsuario.REPOSITOR))])
async def crear_producto(payload: ProductoCreate,
                         current: Usuario = Depends(get_current_user),
                         db: AsyncSession = Depends(get_session)):
    ex = await db.execute(
        select(Producto.id).where(
            or_(Producto.sku == payload.sku,
                (payload.codigo_barras is not None) and (Producto.codigo_barras == payload.codigo_barras))
        )
    )
    if ex.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "SKU o código de barras ya registrado.")

    data = payload.model_dump(exclude={"precios_volumen"})
    p = Producto(**data, creado_por=current.id)
    db.add(p)
    await db.flush()

    for pv in payload.precios_volumen:
        db.add(PrecioVolumen(producto_id=p.id, **pv.model_dump()))

    await db.commit()
    await db.refresh(p)
    return p


@router.patch("/{prod_id}", response_model=ProductoOut,
              summary="Modificar producto",
              dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR,
                                                 RolUsuario.REPOSITOR))])
async def modificar_producto(prod_id: int, payload: ProductoUpdate,
                             db: AsyncSession = Depends(get_session)):
    p = await db.get(Producto, prod_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p


# =====================================================================
# Precios por volumen
# =====================================================================
@router.get("/{prod_id}/precios-volumen", response_model=list[PrecioVolumenOut])
async def listar_precios_volumen(prod_id: int, db: AsyncSession = Depends(get_session),
                                 _: Usuario = Depends(get_current_user)):
    p = await db.get(Producto, prod_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado.")
    r = await db.execute(
        select(PrecioVolumen)
        .where(PrecioVolumen.producto_id == prod_id)
        .order_by(PrecioVolumen.cantidad_minima.asc())
    )
    return r.scalars().all()


@router.post("/{prod_id}/precios-volumen", response_model=PrecioVolumenOut,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR))])
async def agregar_precio_volumen(prod_id: int, payload: PrecioVolumenCreate,
                                 db: AsyncSession = Depends(get_session)):
    p = await db.get(Producto, prod_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado.")
    pv = PrecioVolumen(producto_id=prod_id, **payload.model_dump())
    db.add(pv)
    try:
        await db.commit()
    except Exception as e:  # noqa: BLE001 (unique constraint)
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Ya existe ese tramo de cantidad.") from e
    await db.refresh(pv)
    return pv


@router.patch("/{prod_id}/precios-volumen/{pv_id}", response_model=PrecioVolumenOut,
              dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR))])
async def modificar_precio_volumen(prod_id: int, pv_id: int,
                                   payload: PrecioVolumenUpdate,
                                   db: AsyncSession = Depends(get_session)):
    pv = await db.get(PrecioVolumen, pv_id)
    if pv is None or pv.producto_id != prod_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Precio de volumen no encontrado.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(pv, k, v)
    await db.commit()
    await db.refresh(pv)
    return pv

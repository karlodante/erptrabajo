"""
Integración con Dolibarr ERP (API REST) usando ``httpx.AsyncClient``.

- Dolibarr → POS: :func:`sincronizar_productos_dolibarr` (catálogo, precio, IVA y stock).
- POS → Dolibarr: :func:`enviar_venta_a_dolibarr` (factura + movimientos de stock).
- Modo offline:   la venta local nunca depende de Dolibarr; si falla queda con
  ``sincronizado_dolibarr = False`` y :func:`reintentar_ventas_pendientes`
  la reenvía (endpoint o bucle cada ``DOLIBARR_RETRY_SECONDS``).

Cada paso remoto se persiste apenas termina (``dolibarr_factura_id``,
``dolibarr_factura_validada``, ``DetalleVenta.dolibarr_movimiento_id``), así un
reintento continúa donde quedó sin duplicar facturas ni movimientos de stock.

Stock: el POS maneja stock por lotes (PEPS, con vencimiento). La sincronización
NO modifica lotes; guarda el stock de Dolibarr en ``Producto.dolibarr_stock`` y
reporta las diferencias contra la suma de ``Lote.cantidad_actual``.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Optional

import httpx
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.orm import selectinload

from ..config import DolibarrSettings, get_dolibarr_settings
from ..database import AsyncSessionLocal
from ..models import (
    Categoria,
    DetalleVenta,
    EstadoLote,
    EstadoVenta,
    Lote,
    Producto,
    Venta,
)

logger = logging.getLogger("tiendamama.dolibarr")

# Permite inyectar un transporte simulado (tests).
_transport_override: Optional[httpx.AsyncBaseTransport] = None

# Ventas que se están enviando en este proceso (evita envíos concurrentes
# desde la BackgroundTask de la caja y el bucle de reintentos).
_ventas_en_proceso: set[int] = set()

DOS_DECIMALES = Decimal("0.01")


# =====================================================================
# Errores
# =====================================================================
class DolibarrError(Exception):
    """Error genérico de la integración."""


class DolibarrConexionError(DolibarrError):
    """Dolibarr apagado / sin red / timeout."""


class DolibarrHTTPError(DolibarrError):
    def __init__(self, status_code: int, mensaje: str):
        self.status_code = status_code
        super().__init__(f"Dolibarr respondió HTTP {status_code}: {mensaje}")


class VentaNoEncontradaError(DolibarrError):
    pass


# =====================================================================
# Cliente HTTP
# =====================================================================
class DolibarrClient:
    """Cliente asíncrono mínimo para la API REST de Dolibarr."""

    def __init__(self, settings: Optional[DolibarrSettings] = None):
        self.settings = settings or get_dolibarr_settings()
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "DolibarrClient":
        self._client = httpx.AsyncClient(
            base_url=self.settings.URL.rstrip("/"),
            headers={
                "DOLAPIKEY": self.settings.API_KEY,
                "Accept": "application/json",
            },
            timeout=self.settings.TIMEOUT,
            transport=_transport_override,
        )
        return self

    async def __aexit__(self, *exc: Any) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        assert self._client is not None, "Usar DolibarrClient dentro de 'async with'"
        try:
            resp = await self._client.request(method, path, **kwargs)
        except httpx.HTTPError as e:
            raise DolibarrConexionError(f"Sin conexión con Dolibarr: {e!r}") from e
        if resp.status_code >= 400:
            raise DolibarrHTTPError(resp.status_code, resp.text[:500])
        if not resp.content:
            return None
        try:
            return resp.json()
        except ValueError:
            return resp.text

    async def estado(self) -> Any:
        return await self._request("GET", "/status")

    async def listar_productos(self) -> list[dict]:
        """``GET /products`` paginado (``limit=DOLIBARR_PAGE_SIZE``) con datos de stock."""
        productos: list[dict] = []
        limite = max(1, self.settings.PAGE_SIZE)
        pagina = 0
        while True:
            try:
                lote = await self._request(
                    "GET", "/products",
                    params={
                        "limit": limite,
                        "page": pagina,
                        "sortfield": "t.rowid",
                        "sortorder": "ASC",
                        "includestockdata": 1,
                    },
                )
            except DolibarrHTTPError as e:
                if e.status_code == 404:  # Dolibarr devuelve 404 cuando no hay más
                    break
                raise
            if not lote:
                break
            productos.extend(lote)
            if len(lote) < limite:
                break
            pagina += 1
        return productos

    async def crear_factura(self, payload: dict) -> int:
        return int(await self._request("POST", "/invoices", json=payload))

    async def validar_factura(self, factura_id: int) -> None:
        # idwarehouse=0 → la validación NO mueve stock (lo hace /stockmovements).
        await self._request(
            "POST", f"/invoices/{factura_id}/validate",
            json={"idwarehouse": 0, "notrigger": 0},
        )

    async def crear_movimiento_stock(self, payload: dict) -> int:
        return int(await self._request("POST", "/stockmovements", json=payload))


# =====================================================================
# Helpers
# =====================================================================
def _decimal(valor: Any, default: str = "0") -> Decimal:
    if valor in (None, ""):
        return Decimal(default)
    try:
        return Decimal(str(valor))
    except Exception:  # noqa: BLE001
        return Decimal(default)


def _stock_dolibarr(prod: dict, warehouse_id: int) -> Decimal:
    """Stock del almacén configurado; si no viene, el stock real total."""
    por_almacen = prod.get("stock_warehouse") or {}
    if isinstance(por_almacen, dict):
        dato = por_almacen.get(str(warehouse_id)) or por_almacen.get(warehouse_id)
        if isinstance(dato, dict) and dato.get("real") is not None:
            return _decimal(dato.get("real"))
    return _decimal(prod.get("stock_reel"))


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


async def _obtener_categoria_default(db: AsyncSession, nombre: str) -> int:
    cat_id = (await db.execute(
        select(Categoria.id).where(Categoria.nombre == nombre)
    )).scalar_one_or_none()
    if cat_id is None:
        cat = Categoria(nombre=nombre, descripcion="Productos importados desde Dolibarr")
        db.add(cat)
        await db.flush()
        cat_id = cat.id
    return cat_id


# =====================================================================
# Migración automática (idempotente) — misma SQL que supabase/migrations/002_dolibarr.sql
# =====================================================================
SQL_MIGRACION_DOLIBARR: tuple[str, ...] = (
    "ALTER TABLE productos ADD COLUMN IF NOT EXISTS dolibarr_id BIGINT",
    "ALTER TABLE productos ADD COLUMN IF NOT EXISTS dolibarr_stock NUMERIC(12,3)",
    "ALTER TABLE productos ADD COLUMN IF NOT EXISTS dolibarr_tva_tx NUMERIC(6,3)",
    "ALTER TABLE productos ADD COLUMN IF NOT EXISTS dolibarr_sincronizado_en TIMESTAMPTZ",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_productos_dolibarr_id ON productos (dolibarr_id)",
    # Ventas existentes → TRUE (no reenviar histórico); nuevas → FALSE.
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS sincronizado_dolibarr BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE ventas ALTER COLUMN sincronizado_dolibarr SET DEFAULT FALSE",
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS dolibarr_factura_id BIGINT",
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS dolibarr_factura_validada BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS dolibarr_intentos INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS ultimo_error_dolibarr TEXT",
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS dolibarr_sincronizado_en TIMESTAMPTZ",
    "CREATE INDEX IF NOT EXISTS idx_ventas_sincronizado_dolibarr ON ventas (sincronizado_dolibarr)",
    "ALTER TABLE detalle_ventas ADD COLUMN IF NOT EXISTS dolibarr_movimiento_id BIGINT",
)


async def asegurar_columnas_dolibarr(engine: AsyncEngine) -> None:
    """Agrega las columnas de Dolibarr si faltan (seguro de ejecutar en cada arranque)."""
    async with engine.begin() as conn:
        for sql in SQL_MIGRACION_DOLIBARR:
            await conn.execute(text(sql))


# =====================================================================
# Estado
# =====================================================================
async def estado_dolibarr() -> dict:
    s = get_dolibarr_settings()
    if not s.habilitado:
        return {"habilitado": False, "online": False, "url": s.URL,
                "error": "DOLIBARR_API_KEY no configurada."}
    try:
        async with DolibarrClient(s) as cli:
            info = await cli.estado()
        version = None
        if isinstance(info, dict):
            version = (info.get("success") or {}).get("dolibarr_version")
        return {"habilitado": True, "online": True, "url": s.URL,
                "version": version, "error": None}
    except DolibarrError as e:
        return {"habilitado": True, "online": False, "url": s.URL, "error": str(e)}


# =====================================================================
# Dolibarr → POS: productos
# =====================================================================
async def sincronizar_productos_dolibarr(db: Optional[AsyncSession] = None) -> dict:
    """Importa/actualiza productos desde ``GET /products``.

    Mapeo (Dolibarr → ``productos``):
        id        → dolibarr_id
        ref       → sku
        barcode   → codigo_barras
        label     → nombre
        price_ttc → precio_unitario (precio final de venta)
        tva_tx    → dolibarr_tva_tx
        stock del almacén DOLIBARR_WAREHOUSE_ID → dolibarr_stock

    Empareja por ``dolibarr_id``, luego ``sku`` y luego ``codigo_barras``.
    """
    if db is None:
        async with AsyncSessionLocal() as nueva:
            return await sincronizar_productos_dolibarr(nueva)

    s = get_dolibarr_settings()
    if not s.habilitado:
        raise DolibarrError("Integración Dolibarr deshabilitada (DOLIBARR_API_KEY vacía).")

    async with DolibarrClient(s) as cli:
        remotos = await cli.listar_productos()

    locales = list((await db.execute(select(Producto))).scalars().all())
    por_dol = {p.dolibarr_id: p for p in locales if p.dolibarr_id is not None}
    por_sku = {p.sku: p for p in locales}
    por_barra = {p.codigo_barras: p for p in locales if p.codigo_barras}

    creados = actualizados = omitidos = 0
    errores: list[dict] = []
    ahora = _ahora()
    categoria_id: Optional[int] = None

    for rp in remotos:
        try:
            dol_id = int(rp["id"])
        except (KeyError, TypeError, ValueError):
            omitidos += 1
            continue
        ref = (rp.get("ref") or "").strip()[:50]
        barcode = (rp.get("barcode") or "").strip()[:50] or None
        nombre = (rp.get("label") or ref or f"Dolibarr #{dol_id}").strip()[:200]
        precio = _decimal(rp.get("price_ttc") or rp.get("price")).quantize(
            DOS_DECIMALES, rounding=ROUND_HALF_UP)
        tva = _decimal(rp.get("tva_tx"), default=str(s.TVA_TX_DEFAULT))
        stock = _stock_dolibarr(rp, s.WAREHOUSE_ID)

        prod = por_dol.get(dol_id) or (por_sku.get(ref) if ref else None) \
            or (por_barra.get(barcode) if barcode else None)

        # No pisar un código de barras que ya pertenece a otro producto local
        if barcode and barcode in por_barra and por_barra[barcode] is not prod:
            barcode = None

        if prod is None:
            if not ref:
                omitidos += 1
                errores.append({"dolibarr_id": dol_id, "error": "Producto sin 'ref'."})
                continue
            if categoria_id is None:
                categoria_id = await _obtener_categoria_default(db, s.CATEGORIA_DEFAULT)
            prod = Producto(
                sku=ref,
                codigo_barras=barcode,
                nombre=nombre,
                categoria_id=categoria_id,
                precio_unitario=precio,
                activo=str(rp.get("status", "1")) == "1",
            )
            db.add(prod)
            creados += 1
        else:
            prod.nombre = nombre
            prod.precio_unitario = precio
            if barcode:
                prod.codigo_barras = barcode
            actualizados += 1

        if prod.dolibarr_id is not None and prod.dolibarr_id != dol_id:
            por_dol.pop(prod.dolibarr_id, None)
        prod.dolibarr_id = dol_id
        prod.dolibarr_tva_tx = tva
        prod.dolibarr_stock = stock
        prod.dolibarr_sincronizado_en = ahora
        por_dol[dol_id] = prod
        por_sku[prod.sku] = prod
        if prod.codigo_barras:
            por_barra[prod.codigo_barras] = prod

    await db.flush()

    # Diferencias de stock: Dolibarr vs. suma de lotes activos (PEPS)
    stock_local = dict((await db.execute(
        select(Lote.producto_id, func.coalesce(func.sum(Lote.cantidad_actual), 0))
        .where(Lote.estado == EstadoLote.ACTIVO)
        .group_by(Lote.producto_id)
    )).all())
    diferencias = []
    for p in por_dol.values():
        local = Decimal(stock_local.get(p.id, 0))
        if p.dolibarr_stock is not None and local != p.dolibarr_stock:
            diferencias.append({
                "producto_id": p.id, "sku": p.sku, "nombre": p.nombre,
                "stock_local": float(local), "stock_dolibarr": float(p.dolibarr_stock),
            })

    await db.commit()
    resultado = {
        "recibidos": len(remotos), "creados": creados, "actualizados": actualizados,
        "omitidos": omitidos, "errores": errores, "diferencias_stock": diferencias,
    }
    logger.info("Sincronización de productos Dolibarr: %s",
                {k: v for k, v in resultado.items() if k != "diferencias_stock"})
    return resultado


# =====================================================================
# POS → Dolibarr: ventas
# =====================================================================
def _precio_neto_unitario(dv: DetalleVenta) -> Decimal:
    return (dv.precio_unitario_aplicado or Decimal("0")) - (dv.descuento_unitario or Decimal("0"))


def _payload_factura(venta: Venta, s: DolibarrSettings) -> dict:
    lineas = []
    for dv in venta.detalle_ventas:
        prod = dv.producto
        tva = _decimal(prod.dolibarr_tva_tx if prod else None, default=str(s.TVA_TX_DEFAULT))
        neto = _precio_neto_unitario(dv)  # precio final con IVA
        sin_iva = (neto / (Decimal("1") + tva / Decimal("100"))).quantize(Decimal("0.00000001"))
        linea = {
            "desc": prod.nombre if prod else f"Producto #{dv.producto_id}",
            "qty": dv.cantidad,
            "subprice": float(sin_iva),
            "tva_tx": float(tva),
            "product_type": 0,
        }
        if prod is not None and prod.dolibarr_id:
            linea["fk_product"] = prod.dolibarr_id
        lineas.append(linea)

    fecha = venta.fecha_hora or _ahora()
    return {
        "socid": s.SOCID_DEFAULT,
        "type": 0,
        "date": int(fecha.timestamp()),
        "ref_client": f"POS-{venta.numero_comprobante}",
        "note_private": f"Venta TiendaMama POS #{venta.numero_comprobante} (id {venta.id})",
        "lines": lineas,
    }


async def _registrar_error(db: AsyncSession, venta_id: int, mensaje: str) -> None:
    await db.rollback()
    await db.execute(
        update(Venta).where(Venta.id == venta_id).values(
            sincronizado_dolibarr=False,
            dolibarr_intentos=Venta.dolibarr_intentos + 1,
            ultimo_error_dolibarr=mensaje[:2000],
        )
    )
    await db.commit()


async def enviar_venta_a_dolibarr(venta_id: int, db: Optional[AsyncSession] = None) -> dict:
    """Envía una venta local a Dolibarr: ``POST /invoices`` (+ validación) y
    ``POST /stockmovements`` por cada línea con producto vinculado.

    Nunca lanza por errores de Dolibarr: los guarda en la venta
    (``ultimo_error_dolibarr``) y la deja con ``sincronizado_dolibarr = False``.
    """
    if db is None:
        async with AsyncSessionLocal() as nueva:
            return await enviar_venta_a_dolibarr(venta_id, nueva)

    s = get_dolibarr_settings()
    if not s.habilitado:
        return {"ok": False, "venta_id": venta_id,
                "error": "Integración Dolibarr deshabilitada (DOLIBARR_API_KEY vacía)."}
    if venta_id in _ventas_en_proceso:
        return {"ok": False, "venta_id": venta_id, "error": "La venta ya se está enviando."}

    _ventas_en_proceso.add(venta_id)
    try:
        venta = (await db.execute(
            select(Venta).where(Venta.id == venta_id).options(
                selectinload(Venta.detalle_ventas).selectinload(DetalleVenta.producto)
            )
        )).scalar_one_or_none()
        if venta is None:
            raise VentaNoEncontradaError(f"Venta {venta_id} no encontrada.")
        if venta.sincronizado_dolibarr:
            return {"ok": True, "venta_id": venta_id, "ya_sincronizada": True,
                    "dolibarr_factura_id": venta.dolibarr_factura_id}
        if venta.estado == EstadoVenta.ANULADA and venta.dolibarr_factura_id is None:
            return {"ok": False, "venta_id": venta_id, "omitida": True,
                    "error": "Venta anulada: no se envía a Dolibarr."}

        sin_producto_dolibarr: list[int] = []
        try:
            async with DolibarrClient(s) as cli:
                # 1) Factura
                if venta.dolibarr_factura_id is None:
                    venta.dolibarr_factura_id = await cli.crear_factura(_payload_factura(venta, s))
                    await db.commit()
                # 2) Validación (no mueve stock)
                if s.VALIDAR_FACTURA and not venta.dolibarr_factura_validada:
                    await cli.validar_factura(venta.dolibarr_factura_id)
                    venta.dolibarr_factura_validada = True
                    await db.commit()
                # 3) Salida de stock por línea
                for dv in venta.detalle_ventas:
                    if dv.dolibarr_movimiento_id is not None:
                        continue
                    if dv.producto is None or not dv.producto.dolibarr_id:
                        sin_producto_dolibarr.append(dv.producto_id)
                        continue
                    dv.dolibarr_movimiento_id = await cli.crear_movimiento_stock({
                        "product_id": dv.producto.dolibarr_id,
                        "warehouse_id": s.WAREHOUSE_ID,
                        "qty": -abs(dv.cantidad),
                        "label": f"Venta POS #{venta.numero_comprobante}",
                        "inventorycode": f"POS-{venta.numero_comprobante}",
                    })
                    await db.commit()
        except DolibarrError as e:
            logger.warning("Venta %s no sincronizada con Dolibarr: %s", venta_id, e)
            await _registrar_error(db, venta_id, str(e))
            return {"ok": False, "venta_id": venta_id, "error": str(e),
                    "conexion": isinstance(e, DolibarrConexionError)}

        venta.sincronizado_dolibarr = True
        venta.ultimo_error_dolibarr = (
            f"Sin movimiento de stock (producto sin dolibarr_id): {sin_producto_dolibarr}"
            if sin_producto_dolibarr else None
        )
        venta.dolibarr_sincronizado_en = _ahora()
        await db.commit()
        logger.info("Venta %s enviada a Dolibarr (factura %s)", venta_id, venta.dolibarr_factura_id)
        return {
            "ok": True, "venta_id": venta_id,
            "dolibarr_factura_id": venta.dolibarr_factura_id,
            "movimientos": [dv.dolibarr_movimiento_id for dv in venta.detalle_ventas
                            if dv.dolibarr_movimiento_id is not None],
            "productos_sin_dolibarr_id": sin_producto_dolibarr,
        }
    except VentaNoEncontradaError:
        raise
    except Exception as e:  # noqa: BLE001 — una tarea en segundo plano no debe romper
        logger.exception("Error inesperado enviando venta %s a Dolibarr", venta_id)
        await _registrar_error(db, venta_id, f"Error inesperado: {e!r}")
        return {"ok": False, "venta_id": venta_id, "error": f"Error inesperado: {e!r}"}
    finally:
        _ventas_en_proceso.discard(venta_id)


async def listar_ventas_pendientes(db: AsyncSession, limite: int = 200) -> list[Venta]:
    return list((await db.execute(
        select(Venta)
        .where(Venta.sincronizado_dolibarr.is_(False), Venta.estado != EstadoVenta.ANULADA)
        .order_by(Venta.id.asc())
        .limit(limite)
    )).scalars().all())


async def reintentar_ventas_pendientes(limite: int = 200) -> dict:
    """Reenvía todas las ventas con ``sincronizado_dolibarr = False``.

    Si Dolibarr no responde se corta en la primera falla de conexión.
    """
    if not get_dolibarr_settings().habilitado:
        return {"procesadas": 0, "enviadas": 0, "fallidas": 0, "detalle": [],
                "error": "Integración Dolibarr deshabilitada (DOLIBARR_API_KEY vacía)."}

    async with AsyncSessionLocal() as db:
        ids = [v.id for v in await listar_ventas_pendientes(db, limite)]

    detalle = []
    for vid in ids:
        async with AsyncSessionLocal() as db:
            res = await enviar_venta_a_dolibarr(vid, db)
        detalle.append(res)
        if not res.get("ok") and res.get("conexion"):
            break
    enviadas = sum(1 for r in detalle if r.get("ok"))
    return {"pendientes": len(ids), "procesadas": len(detalle), "enviadas": enviadas,
            "fallidas": len(detalle) - enviadas, "detalle": detalle}


async def bucle_reintentos(intervalo: int) -> None:
    """Tarea de fondo: reintenta ventas pendientes cada ``intervalo`` segundos."""
    logger.info("Reintento automático Dolibarr cada %s s", intervalo)
    while True:
        await asyncio.sleep(intervalo)
        try:
            res = await reintentar_ventas_pendientes()
            if res.get("procesadas"):
                logger.info("Reintento Dolibarr: %s enviadas, %s fallidas",
                            res["enviadas"], res["fallidas"])
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("Fallo en el reintento automático de Dolibarr")

"""Tests de la integración Dolibarr (Dolibarr simulado con httpx.MockTransport).

Los tests marcados ``db`` usan el PostgreSQL de ``DB_*`` (con
supabase/migrations 001 + 002 aplicadas); se omiten si no hay conexión.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from decimal import Decimal

import httpx
import pytest

os.environ.setdefault("DOLIBARR_API_KEY", "test-key")
os.environ.setdefault("DOLIBARR_URL", "http://dolibarr.test/api/index.php")

from sqlalchemy import delete, select, text  # noqa: E402

from app.config import get_dolibarr_settings  # noqa: E402
from app.database import AsyncSessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    Categoria,
    DetalleVenta,
    Producto,
    RolUsuario,
    Usuario,
    Venta,
)
from app.services import dolibarr_service as svc  # noqa: E402

get_dolibarr_settings.cache_clear()


def _run(coro):
    async def wrapper():
        try:
            return await coro
        finally:
            await engine.dispose()
    return asyncio.run(wrapper())


def _db_disponible() -> bool:
    async def probar():
        async with engine.connect() as c:
            await c.execute(text("SELECT dolibarr_factura_id FROM ventas LIMIT 1"))
    try:
        _run(probar())
        return True
    except Exception:  # noqa: BLE001
        return False


requiere_db = pytest.mark.skipif(not _db_disponible(), reason="PostgreSQL no disponible")


# ---------------------------------------------------------------------
# Sin base de datos
# ---------------------------------------------------------------------
def test_payload_factura_descuenta_iva_y_descuento():
    prod = Producto(id=1, nombre="Leche", dolibarr_id=11, dolibarr_tva_tx=Decimal("21"))
    dv = DetalleVenta(producto_id=1, cantidad=2, precio_unitario_aplicado=Decimal("1210.00"),
                      descuento_unitario=Decimal("121.00"))
    dv.producto = prod
    venta = Venta(id=5, numero_comprobante=77, total=Decimal("2178.00"))
    venta.detalle_ventas = [dv]

    payload = svc._payload_factura(venta, get_dolibarr_settings())

    assert payload["socid"] == get_dolibarr_settings().SOCID_DEFAULT
    assert payload["ref_client"] == "POS-77"
    linea = payload["lines"][0]
    assert linea["fk_product"] == 11 and linea["qty"] == 2 and linea["tva_tx"] == 21.0
    assert linea["subprice"] == pytest.approx(900.0)  # (1210 - 121) / 1.21


def test_stock_dolibarr_usa_almacen_configurado():
    p = {"stock_reel": "40", "stock_warehouse": {"1": {"real": "35"}, "2": {"real": "5"}}}
    assert svc._stock_dolibarr(p, 1) == Decimal("35")
    assert svc._stock_dolibarr(p, 9) == Decimal("40")


# ---------------------------------------------------------------------
# Con base de datos
# ---------------------------------------------------------------------
async def _crear_venta_prueba(sufijo: str) -> tuple[int, int, int]:
    async with AsyncSessionLocal() as db:
        u = Usuario(username=f"test_{sufijo}", password_hash="x", nombre_completo="Test",
                    rol=RolUsuario.CAJERO)
        c = Categoria(nombre=f"cat_{sufijo}")
        db.add_all([u, c])
        await db.flush()
        p = Producto(sku=f"SKU-{sufijo}", nombre="Prod test", categoria_id=c.id,
                     precio_unitario=Decimal("100.00"), dolibarr_id=900000 + abs(hash(sufijo)) % 99999)
        db.add(p)
        await db.flush()
        v = Venta(usuario_id=u.id, subtotal=Decimal("200.00"), total=Decimal("200.00"))
        db.add(v)
        await db.flush()
        db.add(DetalleVenta(venta_id=v.id, producto_id=p.id, cantidad=2,
                            precio_unitario_aplicado=Decimal("100.00"), subtotal=Decimal("200.00")))
        await db.commit()
        return v.id, p.id, u.id


async def _borrar(venta_id: int, producto_id: int, usuario_id: int, sufijo: str) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Venta).where(Venta.id == venta_id))
        await db.execute(delete(Producto).where(Producto.id == producto_id))
        await db.execute(delete(Usuario).where(Usuario.id == usuario_id))
        await db.execute(delete(Categoria).where(Categoria.nombre == f"cat_{sufijo}"))
        await db.commit()


@requiere_db
def test_venta_offline_y_reintento_sin_duplicar():
    llamadas: list[str] = []
    estado = {"online": False, "fallar_stock": True}

    def handler(req: httpx.Request) -> httpx.Response:
        if not estado["online"]:
            raise httpx.ConnectError("apagado", request=req)
        llamadas.append(f"{req.method} {req.url.path}")
        assert req.headers["DOLAPIKEY"] == "test-key"
        if req.url.path.endswith("/invoices"):
            return httpx.Response(200, json=321)
        if req.url.path.endswith("/validate"):
            return httpx.Response(200, json={})
        if req.url.path.endswith("/stockmovements"):
            if estado["fallar_stock"]:
                estado["fallar_stock"] = False
                return httpx.Response(500, text="error interno")
            assert json.loads(req.content)["qty"] == -2
            return httpx.Response(200, json=654)
        return httpx.Response(404)

    async def escenario():
        sufijo = uuid.uuid4().hex[:8]
        venta_id, producto_id, usuario_id = await _crear_venta_prueba(sufijo)
        svc._transport_override = httpx.MockTransport(handler)
        try:
            # 1) Dolibarr apagado → la venta queda pendiente con el error
            r1 = await svc.enviar_venta_a_dolibarr(venta_id)
            assert r1["ok"] is False and r1["conexion"] is True
            async with AsyncSessionLocal() as db:
                v = await db.get(Venta, venta_id)
                assert v.sincronizado_dolibarr is False and v.dolibarr_intentos == 1
                assert "Sin conexión" in v.ultimo_error_dolibarr
                assert venta_id in [x.id for x in await svc.listar_ventas_pendientes(db)]

            # 2) Vuelve, pero falla el movimiento de stock → factura guardada, sigue pendiente
            estado["online"] = True
            r2 = await svc.enviar_venta_a_dolibarr(venta_id)
            assert r2["ok"] is False
            async with AsyncSessionLocal() as db:
                v = await db.get(Venta, venta_id)
                assert v.dolibarr_factura_id == 321 and v.dolibarr_factura_validada
                assert v.sincronizado_dolibarr is False and v.dolibarr_intentos == 2

            # 3) Reintento → sólo el movimiento pendiente, sin segunda factura
            r3 = await svc.enviar_venta_a_dolibarr(venta_id)
            assert r3["ok"] is True and r3["movimientos"] == [654]
            async with AsyncSessionLocal() as db:
                v = await db.get(Venta, venta_id)
                assert v.sincronizado_dolibarr is True and v.ultimo_error_dolibarr is None
                dv = (await db.execute(select(DetalleVenta).where(
                    DetalleVenta.venta_id == venta_id))).scalar_one()
                assert dv.dolibarr_movimiento_id == 654
            assert llamadas.count("POST /api/index.php/invoices") == 1

            # 4) Ya sincronizada → no vuelve a llamar
            n = len(llamadas)
            assert (await svc.enviar_venta_a_dolibarr(venta_id))["ya_sincronizada"]
            assert len(llamadas) == n
        finally:
            svc._transport_override = None
            await _borrar(venta_id, producto_id, usuario_id, sufijo)

    _run(escenario())


@requiere_db
def test_sincronizar_productos_crea_y_actualiza():
    sufijo = uuid.uuid4().hex[:8]
    dol_nuevo, dol_existente = 800000 + int(sufijo[:4], 16), 700000 + int(sufijo[:4], 16)
    remotos = [
        {"id": str(dol_existente), "ref": f"EXIST-{sufijo}", "label": "Actualizado",
         "price_ttc": "121.00", "tva_tx": "21", "stock_reel": "7"},
        {"id": str(dol_nuevo), "ref": f"NUEVO-{sufijo}", "barcode": f"B{sufijo}",
         "label": "Nuevo", "price_ttc": "50", "tva_tx": "10.5", "status": "1",
         "stock_warehouse": {"1": {"real": "3"}}},
    ]

    def handler(req: httpx.Request) -> httpx.Response:
        assert req.url.path.endswith("/products")
        if req.url.params.get("page") != "0":
            return httpx.Response(404)
        return httpx.Response(200, json=remotos)

    async def escenario():
        async with AsyncSessionLocal() as db:
            c = Categoria(nombre=f"cat_{sufijo}")
            db.add(c)
            await db.flush()
            db.add(Producto(sku=f"EXIST-{sufijo}", nombre="Viejo", categoria_id=c.id,
                            precio_unitario=Decimal("1.00")))
            await db.commit()
        svc._transport_override = httpx.MockTransport(handler)
        try:
            res = await svc.sincronizar_productos_dolibarr()
            assert res["creados"] >= 1 and res["actualizados"] >= 1
            async with AsyncSessionLocal() as db:
                ex = (await db.execute(select(Producto).where(
                    Producto.sku == f"EXIST-{sufijo}"))).scalar_one()
                assert (ex.nombre, ex.precio_unitario, ex.dolibarr_id) == (
                    "Actualizado", Decimal("121.00"), dol_existente)
                assert ex.dolibarr_stock == Decimal("7")
                nu = (await db.execute(select(Producto).where(
                    Producto.dolibarr_id == dol_nuevo))).scalar_one()
                assert (nu.sku, nu.codigo_barras, nu.precio_unitario) == (
                    f"NUEVO-{sufijo}", f"B{sufijo}", Decimal("50.00"))
                assert nu.dolibarr_tva_tx == Decimal("10.5") and nu.dolibarr_stock == Decimal("3")
        finally:
            svc._transport_override = None
            async with AsyncSessionLocal() as db:
                await db.execute(delete(Producto).where(
                    Producto.dolibarr_id.in_([dol_nuevo, dol_existente])))
                await db.execute(delete(Producto).where(Producto.sku == f"EXIST-{sufijo}"))
                await db.execute(delete(Categoria).where(Categoria.nombre == f"cat_{sufijo}"))
                await db.commit()

    _run(escenario())

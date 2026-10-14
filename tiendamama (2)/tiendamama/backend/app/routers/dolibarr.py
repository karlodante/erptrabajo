"""
Router de integración con Dolibarr ERP.

Montado en ``{API_V1_PREFIX}/dolibarr``.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import RolUsuario, Usuario
from ..security import get_current_user, require_role
from ..services import dolibarr_service as svc

router = APIRouter()


@router.get("/estado", summary="Configuración y conectividad con Dolibarr")
async def estado(
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    info = await svc.estado_dolibarr()
    info["ventas_pendientes"] = len(await svc.listar_ventas_pendientes(db, limite=10_000))
    return info


@router.post("/productos/sincronizar",
             summary="Importar/actualizar productos desde Dolibarr (GET /products)",
             dependencies=[Depends(require_role(RolUsuario.ADMINISTRADOR))])
async def sincronizar_productos(db: AsyncSession = Depends(get_session)):
    try:
        return await svc.sincronizar_productos_dolibarr(db)
    except svc.DolibarrConexionError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    except svc.DolibarrError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e


@router.get("/ventas/pendientes", summary="Ventas no sincronizadas con Dolibarr")
async def ventas_pendientes(
    limite: int = Query(200, ge=1, le=5000),
    db: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
):
    return [
        {
            "venta_id": v.id,
            "numero_comprobante": v.numero_comprobante,
            "fecha_hora": v.fecha_hora,
            "total": v.total,
            "dolibarr_factura_id": v.dolibarr_factura_id,
            "intentos": v.dolibarr_intentos,
            "ultimo_error": v.ultimo_error_dolibarr,
        }
        for v in await svc.listar_ventas_pendientes(db, limite)
    ]


@router.post("/ventas/{venta_id}/enviar", summary="Enviar (o reenviar) una venta a Dolibarr")
async def enviar_venta(venta_id: int, _: Usuario = Depends(get_current_user)):
    try:
        return await svc.enviar_venta_a_dolibarr(venta_id)
    except svc.VentaNoEncontradaError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e)) from e


@router.post("/ventas/reintentar", summary="Reintentar todas las ventas pendientes")
async def reintentar(
    background_tasks: BackgroundTasks,
    segundo_plano: bool = Query(False, description="true = responde enseguida y procesa con BackgroundTasks"),
    _: Usuario = Depends(get_current_user),
):
    if segundo_plano:
        background_tasks.add_task(svc.reintentar_ventas_pendientes)
        return {"programado": True}
    return await svc.reintentar_ventas_pendientes()

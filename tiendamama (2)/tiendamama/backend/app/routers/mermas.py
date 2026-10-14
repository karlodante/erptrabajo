"""
Router Mermas (alias externo; la lógica real está en routers.lotes).
Aquí agregamos endpoints específicos que no dependen de lotes.
"""

from __future__ import annotations

from fastapi import APIRouter
from .lotes import router as _lotes_router_with_mermas  # re-exportado


router = APIRouter()

# Todos los endpoints de mermas vienen integrados en router "lotes"
# (para poder acceder a /lotes/mermas). Este archivo se mantiene para que
# `main.py` pueda incluirlo como módulo independiente. El acceso público
# sigue siendo por el router lotes.
#
# Si en el futuro se desea una ruta dedicada /mermas, activar:
#
# from .lotes import listar_mermas, crear_merma
# router.add_api_route("/", listar_mermas, methods=["GET"])
# router.add_api_route("/", crear_merma, methods=["POST"])
#
# Por ahora, router queda vacío pero main.py lo puede adjuntar sin errores.


@router.get("", include_in_schema=False)
async def _placeholder():
    """Mantenido para que FastAPI no marque routers vacíos como unused."""
    return {"info": "Use /api/v1/lotes/mermas para endpoints de mermas."}


__all__ = ["router"]

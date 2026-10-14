"""
Archivo principal — crea la aplicación FastAPI y le adjunta routers y middlewares.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .config import get_settings
from .database import init_db
from .routers import (
    auth as router_auth,
    caja as router_caja,
    cotizaciones as router_cotizaciones,
    lotes as router_lotes,
    mermas as router_mermas,
    productos as router_productos,
    proveedores as router_proveedores,
    ventas as router_ventas,
)


# ---------------------------------------------------------------------------
# Startup / shutdown events
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Ejecuta tareas antes (startup) y después (shutdown) de la app."""
    settings = get_settings()
    if settings.DEBUG:
        await init_db()  # sólo en desarrollo — en producción usar Alembic
    yield
    # shutdown: si en el futuro se necesita limpiar recursos, va acá.


# ---------------------------------------------------------------------------
# Instancia de FastAPI
# ---------------------------------------------------------------------------
settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
    description=(
        "Backend del sistema de gestión de ventas e inventario para "
        "tienda de productos lácteos.\n\n"
        "Stack: FastAPI · SQLAlchemy 2.0 (async) · PostgreSQL 15\n"
        "Autor: Tiendamama"
    ),
)

# ---------------------------------------------------------------------------
# Middlewares
# ---------------------------------------------------------------------------
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Total-Count"],
)

# ---------------------------------------------------------------------------
# Root / health-check
# ---------------------------------------------------------------------------
@app.get("/", tags=["Sistema"], summary="Estado / health-check")
async def root():
    return {
        "nombre": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "estado": "ok",
        "docs": f"{settings.API_V1_PREFIX[:-7] if settings.API_V1_PREFIX.endswith('/v1') else ''}/docs",
    }


@app.get("/health", tags=["Sistema"], summary="Health-check para load balancers")
async def health_check():
    return {"status": "healthy"}


# ---------------------------------------------------------------------------
# Routers (todos colgados del prefijo /api/v1)
# ---------------------------------------------------------------------------
PREFIX = settings.API_V1_PREFIX

app.include_router(router_auth.router,           prefix=f"{PREFIX}/auth",          tags=["Autenticación"])
app.include_router(router_productos.router,      prefix=f"{PREFIX}/productos",     tags=["Productos"])
app.include_router(router_lotes.router,          prefix=f"{PREFIX}/lotes",         tags=["Lotes e Inventario"])
app.include_router(router_ventas.router,         prefix=f"{PREFIX}/ventas",        tags=["Ventas"])
app.include_router(router_caja.router,           prefix=f"{PREFIX}/caja",          tags=["Caja y Arqueos"])
app.include_router(router_mermas.router,         prefix=f"{PREFIX}/mermas",        tags=["Mermas"])
app.include_router(router_cotizaciones.router,   prefix=f"{PREFIX}/cotizaciones",  tags=["Cotizaciones Mayoristas"])
app.include_router(router_proveedores.router,    prefix=f"{PREFIX}/proveedores",   tags=["Proveedores"])

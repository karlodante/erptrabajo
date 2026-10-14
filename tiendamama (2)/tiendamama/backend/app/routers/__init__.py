"""
Paquete ``routers``: todos los routers de la API REST.

Importados desde :mod:`app.main`.
"""

from . import auth, caja, cotizaciones, lotes, mermas, productos, proveedores, ventas

__all__ = [
    "auth",
    "caja",
    "cotizaciones",
    "lotes",
    "mermas",
    "productos",
    "proveedores",
    "ventas",
]

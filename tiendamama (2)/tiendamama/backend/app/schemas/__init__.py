"""
Paquete ``schemas`` — esquemas Pydantic de todos los módulos.
"""

from .auth import (
    ChangePassword,
    LoginRequest,
    UsuarioCreate,
    UsuarioOut,
    UsuarioUpdate,
)
from .caja import (
    ArqueoAbrir,
    ArqueoCerrar,
    ArqueoOut,
    ArqueoTotales,
    MovimientoCajaCreate,
    MovimientoCajaOut,
)
from .common import BaseSchema, Message, Paged, Token
from .cotizaciones import (
    CotizacionCreate,
    CotizacionOut,
    CotizacionUpdate,
    DetalleCotizacionCreate,
    DetalleCotizacionOut,
)
from .lotes import LoteCreate, LoteOut, LoteUpdate, MermaCreate, MermaOut
from .productos import (
    CategoriaCreate,
    CategoriaOut,
    CategoriaUpdate,
    PrecioVolumenCreate,
    PrecioVolumenOut,
    PrecioVolumenUpdate,
    ProductoCreate,
    ProductoListado,
    ProductoOut,
    ProductoUpdate,
)
from .proveedores import (
    AlertaMarcarLeida,
    AlertaOut,
    PedidoSugeridoDetalleOut,
    PedidoSugeridoOut,
    ProveedorCreate,
    ProveedorOut,
    ProveedorUpdate,
    ResumenAlertas,
)
from .ventas import (
    DetalleVentaCreate,
    DetalleVentaOut,
    PagoCreate,
    PagoOut,
    VentaCreate,
    VentaOut,
    VentaUpdate,
)

__all__ = [
    # common
    "BaseSchema", "Message", "Paged", "Token",
    # auth
    "LoginRequest", "UsuarioOut", "UsuarioCreate", "UsuarioUpdate", "ChangePassword",
    # productos
    "CategoriaOut", "CategoriaCreate", "CategoriaUpdate",
    "PrecioVolumenOut", "PrecioVolumenCreate", "PrecioVolumenUpdate",
    "ProductoOut", "ProductoListado", "ProductoCreate", "ProductoUpdate",
    # lotes + mermas
    "LoteOut", "LoteCreate", "LoteUpdate",
    "MermaOut", "MermaCreate",
    # ventas
    "PagoOut", "PagoCreate",
    "DetalleVentaOut", "DetalleVentaCreate",
    "VentaOut", "VentaCreate", "VentaUpdate",
    # caja
    "ArqueoOut", "ArqueoAbrir", "ArqueoCerrar", "ArqueoTotales",
    "MovimientoCajaOut", "MovimientoCajaCreate",
    # cotizaciones
    "DetalleCotizacionOut", "DetalleCotizacionCreate",
    "CotizacionOut", "CotizacionCreate", "CotizacionUpdate",
    # proveedores + alertas
    "ProveedorOut", "ProveedorCreate", "ProveedorUpdate",
    "PedidoSugeridoOut", "PedidoSugeridoDetalleOut",
    "AlertaOut", "AlertaMarcarLeida", "ResumenAlertas",
]

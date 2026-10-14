"""
Paquete ``services`` — capa de lógica de negocio.

- :mod:`app.services.peps`      → descuento PEPS, cálculo de precios por volumen
- :mod:`app.services.alertas`   → generación y marcado de alertas
"""

from . import alertas, peps  # noqa: F401

__all__ = ["alertas", "peps"]

"""
Paquete ``services`` — capa de lógica de negocio.

- :mod:`app.services.peps`      → descuento PEPS, cálculo de precios por volumen
- :mod:`app.services.alertas`   → generación y marcado de alertas
- :mod:`app.services.dolibarr_service` → integración con Dolibarr ERP
"""

from . import alertas, dolibarr_service, peps  # noqa: F401

__all__ = ["alertas", "dolibarr_service", "peps"]

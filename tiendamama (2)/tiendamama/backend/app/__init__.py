"""
Backend Tiendamama Lácteos.

FastAPI + SQLAlchemy 2.0 + PostgreSQL.
"""

from . import database, models  # noqa: F401

__all__ = ["database", "models"]

"""
Configuración de conexión a PostgreSQL (SQLAlchemy async engine).
Uso:
    from app.database import get_session
    async with get_session() as session:
        ...
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .models import Base  # noqa: F401  (exporta Base para Alembic)


def _build_database_url() -> str:
    """Construye el DSN de PostgreSQL desde variables de entorno.

    Variables leídas:
      DB_HOST      (default: localhost)
      DB_PORT      (default: 5432)
      DB_NAME      (default: tiendamama)
      DB_USER      (default: postgres)
      DB_PASSWORD  (default: postgres)
    """

    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "tiendamama")
    user = os.getenv("DB_USER", "postgres")
    pwd  = os.getenv("DB_PASSWORD", "postgres")
    return f"postgresql+psycopg://{user}:{pwd}@{host}:{port}/{name}"


DATABASE_URL: str = _build_database_url()


engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("DB_ECHO", "0") == "1",
    pool_pre_ping=True,
    pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
    future=True,
)


AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependencia para FastAPI (Depends(get_session))."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Crea todas las tablas declaradas en models.Base.metadata.

    ⚠️  Sólo para desarrollo. En producción usar Alembic / migraciones.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


__all__ = [
    "Base",
    "DATABASE_URL",
    "engine",
    "AsyncSessionLocal",
    "get_session",
    "init_db",
]

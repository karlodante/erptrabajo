"""
Configuración global de la aplicación.
Lectura desde variables de entorno (pydantic-settings).
"""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables de entorno disponibles.

    Prefijo ``APP_`` → ej: ``APP_APP_NAME=TiendaMama``.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="APP_",
        extra="ignore",
    )

    # ----------------------------------------------------------------
    # FastAPI
    # ----------------------------------------------------------------
    APP_NAME: str           = Field(default="Tiendamama Lácteos — Backend")
    APP_VERSION: str        = Field(default="0.1.0")
    DEBUG: bool             = Field(default=False)
    API_V1_PREFIX: str      = Field(default="/api/v1")

    # ----------------------------------------------------------------
    # CORS — orígenes permitidos (frontend Vue/Electron local)
    # ----------------------------------------------------------------
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",   # Vite dev
            "http://localhost:3000",   # CRA dev
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "file://",                 # Electron: file://
            "http://localhost:8080",
        ],
    )

    # ----------------------------------------------------------------
    # PostgreSQL
    # ----------------------------------------------------------------
    DB_HOST: str     = Field(default="localhost")
    DB_PORT: int     = Field(default=5432)
    DB_NAME: str     = Field(default="tiendamama")
    DB_USER: str     = Field(default="postgres")
    DB_PASSWORD: str = Field(default="postgres")
    DB_ECHO: bool    = Field(default=False)
    DB_POOL_SIZE: int = Field(default=10)
    DB_MAX_OVERFLOW: int = Field(default=20)

    @property
    def DATABASE_URL(self) -> str:  # noqa: N802 (match SQLAlchemy naming style)
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    # ----------------------------------------------------------------
    # JWT — Autenticación simple
    # ----------------------------------------------------------------
    JWT_SECRET: str          = Field(default="cambiar-esta-clave-en-produccion!!123")
    JWT_ALGORITHM: str       = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int  = Field(default=60 * 12)   # 12 horas por defecto

    # ----------------------------------------------------------------
    # Umbrales lógicos de negocio
    # ----------------------------------------------------------------
    ALERTA_VENCIMIENTO_DIAS: int = Field(default=5)  # lotes que vencen ≤ N días
    ALERTA_STOCK_UMBRAL: int     = Field(default=5)  # fallback si producto no define stock_minimo
    ALERTAS_CRON_SEGUNDOS: int   = Field(default=600)  # job cada 10 min


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

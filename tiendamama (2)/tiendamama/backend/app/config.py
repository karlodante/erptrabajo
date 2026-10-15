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


class DolibarrSettings(BaseSettings):
    """Integración con Dolibarr ERP (API REST).

    Se leen sin el prefijo ``APP_``: ``DOLIBARR_URL``, ``DOLIBARR_API_KEY``, etc.
    Si ``DOLIBARR_API_KEY`` está vacía la integración queda deshabilitada.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="DOLIBARR_",
        extra="ignore",
    )

    URL: str = Field(default="http://localhost/dolibarr/api/index.php")
    API_KEY: str = Field(default="")
    SOCID_DEFAULT: int = Field(default=1)       # tercero "cliente mostrador"
    WAREHOUSE_ID: int = Field(default=1)        # almacén principal
    TIMEOUT: float = Field(default=10.0)
    PAGE_SIZE: int = Field(default=1000)
    RETRY_SECONDS: int = Field(default=300)     # 0 = sin reintento automático
    VALIDAR_FACTURA: bool = Field(default=True)
    TVA_TX_DEFAULT: float = Field(default=0.0)  # IVA % si el producto no lo trae de Dolibarr
    CATEGORIA_DEFAULT: str = Field(default="Dolibarr")  # para productos nuevos importados
    LOTE_INICIAL: bool = Field(default=True)    # crear lote inicial con el stock de Dolibarr
    LOTE_DIAS_VENCIMIENTO: int = Field(default=30)  # vencimiento del lote inicial (días desde hoy)

    @property
    def habilitado(self) -> bool:
        return bool(self.API_KEY and self.URL)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def get_dolibarr_settings() -> DolibarrSettings:
    return DolibarrSettings()

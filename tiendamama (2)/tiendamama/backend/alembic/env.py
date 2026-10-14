"""
Configuración de Alembic para migraciones de base de datos.
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Importar configuración y modelos
import sys
from pathlib import Path

# Agregar el directorio app al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from app.database import Base
from app import models  # noqa: F401

# Obtener configuración
settings = get_settings()

# Configuración de Alembic
config = context.config

# Sobrescribir sqlalchemy.url desde la configuración de la app
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpretar el archivo de configuración para Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# MetaData de los modelos para autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Ejecutar migraciones en modo 'offline'."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Ejecutar migraciones en modo 'online'."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

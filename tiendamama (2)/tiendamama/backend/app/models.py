"""
Base de datos — configuración y modelos SQLAlchemy
Compatible con: FastAPI 0.110+, SQLAlchemy 2.0+, PostgreSQL 15+
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    FetchedValue,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)


def _pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Tipo ENUM de PostgreSQL con el mismo nombre y valores (minúsculas) que
    ``supabase/migrations/001_esquema_inicial.sql``."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


# ===================================================================
# ENUMS (igual que en PostgreSQL)
# ===================================================================

class RolUsuario(str, enum.Enum):
    ADMINISTRADOR = "administrador"
    CAJERO = "cajero"
    VENDEDOR_MAYORISTA = "vendedor_mayorista"
    REPOSITOR = "repositor"


class UnidadMedida(str, enum.Enum):
    UNIDAD = "unidad"
    KG = "kg"
    G = "g"
    LITRO = "litro"
    ML = "ml"
    PACK = "pack"
    CAJA = "caja"


class EstadoLote(str, enum.Enum):
    ACTIVO = "activo"
    AGOTADO = "agotado"
    MERMADO = "mermado"
    VENCIDO = "vencido"


class MotivoMerma(str, enum.Enum):
    DANADO = "danado"
    VENCIDO = "vencido"
    ROBO = "robo"
    ERROR_STOCK = "error_stock"
    OTRO = "otro"


class TipoCliente(str, enum.Enum):
    MINORISTA = "minorista"
    MAYORISTA = "mayorista"


class CondicionIVA(str, enum.Enum):
    RESPONSABLE_INSCRIPTO = "responsable_inscripto"
    MONOTRIBUTISTA = "monotributista"
    CONSUMIDOR_FINAL = "consumidor_final"
    EXENTO = "exento"
    NO_RESPONSABLE = "no_responsable"


class EstadoVenta(str, enum.Enum):
    PAGADA = "pagada"
    PENDIENTE = "pendiente"
    ANULADA = "anulada"


class FormaPago(str, enum.Enum):
    EFECTIVO = "efectivo"
    DEBITO = "debito"
    CREDITO = "credito"
    TRANSFERENCIA = "transferencia"
    CHEQUE = "cheque"
    QR = "qr"
    CUENTA_CORRIENTE = "cuenta_corriente"


class TipoCombo(str, enum.Enum):
    DESCUENTO_PORCENTUAL = "descuento_porcentual"
    PRECIO_FIJO = "precio_fijo"
    COMBO = "combo"


class EstadoCotizacion(str, enum.Enum):
    PENDIENTE = "pendiente"
    CONFIRMADA = "confirmada"
    CANCELADA = "cancelada"
    VENCIDA = "vencida"


class EstadoArqueo(str, enum.Enum):
    ABIERTO = "abierto"
    CERRADO = "cerrado"


class TipoMovimientoCaja(str, enum.Enum):
    INGRESO = "ingreso"
    EGRESO = "egreso"


class CategoriaMovimiento(str, enum.Enum):
    PAGO_PROVEEDOR = "pago_proveedor"
    GASTO_MENOR = "gasto_menor"
    FONDO_INICIAL = "fondo_inicial"
    AJUSTE = "ajuste"
    OTRO = "otro"


class EstadoPedidoSugerido(str, enum.Enum):
    PENDIENTE = "pendiente"
    ENVIADO = "enviado"
    CONFIRMADO = "confirmado"
    CANCELADO = "cancelado"


class TipoAlerta(str, enum.Enum):
    STOCK_BAJO = "stock_bajo"
    VENCIMIENTO_PROXIMO = "vencimiento_proximo"
    LOTE_VENCIDO = "lote_vencido"
    STOCK_NEGATIVO = "stock_negativo"


class SeveridadAlerta(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


# ===================================================================
# BASE DECLARATIVA
# ===================================================================

class Base(DeclarativeBase):
    """Base para todos los modelos SQLAlchemy."""
    type_annotation_map = {
        datetime: TIMESTAMP(timezone=True),
        Decimal: Numeric(12, 2),
    }


# ===================================================================
# TABLAS MAESTRAS
# ===================================================================

class Usuario(Base):
    __tablename__ = "usuarios"

    id:              Mapped[int]         = mapped_column(BigInteger, primary_key=True)
    username:        Mapped[str]         = mapped_column(String(50), unique=True, nullable=False)
    password_hash:   Mapped[str]         = mapped_column(String(255), nullable=False)
    nombre_completo: Mapped[str]         = mapped_column(String(150), nullable=False)
    rol:             Mapped[RolUsuario]  = mapped_column(_pg_enum(RolUsuario, "rol_usuario"), default=RolUsuario.CAJERO)
    activo:          Mapped[bool]        = mapped_column(Boolean, default=True)
    created_at:      Mapped[datetime]    = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(),
    )

    # Relaciones
    ventas:            Mapped[list["Venta"]]              = relationship(back_populates="usuario")
    arqueos_apertura:  Mapped[list["ArqueoCaja"]]         = relationship(back_populates="usuario_apertura", foreign_keys="ArqueoCaja.usuario_apertura_id")
    arqueos_cierre:    Mapped[list["ArqueoCaja"]]         = relationship(back_populates="usuario_cierre", foreign_keys="ArqueoCaja.usuario_cierre_id")
    mermas:            Mapped[list["Merma"]]              = relationship(back_populates="usuario")
    movimientos_caja:  Mapped[list["MovimientoCaja"]]     = relationship(back_populates="usuario")
    cotizaciones:      Mapped[list["CotizacionMayorista"]] = relationship(back_populates="usuario")
    productos_creados: Mapped[list["Producto"]]           = relationship(back_populates="creado_por_ref", foreign_keys="Producto.creado_por")
    alertas_leidas:    Mapped[list["Alerta"]]             = relationship(back_populates="usuario_leyo", foreign_keys="Alerta.usuario_leyo_id")


class Categoria(Base):
    __tablename__ = "categorias"

    id:          Mapped[int]      = mapped_column(BigInteger, primary_key=True, )
    nombre:      Mapped[str]      = mapped_column(String(100), unique=True, nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, )
    activo:      Mapped[bool]     = mapped_column(Boolean, default=True)
    created_at:  Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), 
    )

    productos: Mapped[list["Producto"]] = relationship(back_populates="categoria", )


class Proveedor(Base):
    __tablename__ = "proveedores"

    id:         Mapped[int]         = mapped_column(BigInteger, primary_key=True, )
    nombre:     Mapped[str]         = mapped_column(String(150), unique=True, nullable=False)
    cuit:       Mapped[Optional[str]] = mapped_column(String(13), )
    contacto:   Mapped[Optional[str]] = mapped_column(String(150), )
    telefono:   Mapped[Optional[str]] = mapped_column(String(30), )
    email:      Mapped[Optional[str]] = mapped_column(String(150), )
    direccion:  Mapped[Optional[str]] = mapped_column(Text, )
    activo:     Mapped[bool]        = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime]    = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), 
    )

    lotes:            Mapped[list["Lote"]]            = relationship(back_populates="proveedor", )
    pedidos_sugeridos: Mapped[list["PedidoSugerido"]] = relationship(back_populates="proveedor", )


class Cliente(Base):
    __tablename__ = "clientes"

    id:             Mapped[int]           = mapped_column(BigInteger, primary_key=True, )
    nombre_rs:      Mapped[str]           = mapped_column(String(150), nullable=False)
    tipo:           Mapped[TipoCliente]   = mapped_column(_pg_enum(TipoCliente, "tipo_cliente"), default=TipoCliente.MINORISTA)
    dni_cuit:       Mapped[Optional[str]] = mapped_column(String(13), unique=True, )
    condicion_iva:  Mapped[CondicionIVA]  = mapped_column(_pg_enum(CondicionIVA, "condicion_iva"), default=CondicionIVA.CONSUMIDOR_FINAL)
    telefono:       Mapped[Optional[str]] = mapped_column(String(30), )
    email:          Mapped[Optional[str]] = mapped_column(String(150), )
    direccion:      Mapped[Optional[str]] = mapped_column(Text, )
    limite_credito: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), CheckConstraint("limite_credito >= 0"), 
    )
    saldo_cuenta: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"),
    )
    activo:     Mapped[bool]     = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), 
    )

    __table_args__ = (
        CheckConstraint("saldo_cuenta >= 0", name="chk_clientes_saldo_no_negativo"),
    )

    ventas:       Mapped[list["Venta"]]              = relationship(back_populates="cliente", )
    cotizaciones: Mapped[list["CotizacionMayorista"]] = relationship(back_populates="cliente", )


# ===================================================================
# PRODUCTOS Y LOTES (PEPS)
# ===================================================================

class Producto(Base):
    __tablename__ = "productos"

    id:              Mapped[int]              = mapped_column(BigInteger, primary_key=True, )
    sku:             Mapped[str]              = mapped_column(String(50), unique=True, nullable=False)
    codigo_barras:   Mapped[Optional[str]]    = mapped_column(String(50), unique=True, )
    nombre:          Mapped[str]              = mapped_column(String(200), nullable=False)
    categoria_id:    Mapped[int]              = mapped_column(ForeignKey("categorias.id", ondelete="RESTRICT"))
    unidad_medida:   Mapped[UnidadMedida]     = mapped_column(_pg_enum(UnidadMedida, "unidad_medida"), default=UnidadMedida.UNIDAD)
    precio_unitario: Mapped[Decimal]          = mapped_column(Numeric(12, 2))
    stock_minimo:    Mapped[int]              = mapped_column(Integer, default=5)
    activo:          Mapped[bool]             = mapped_column(Boolean, default=True)
    creado_por:      Mapped[Optional[int]]    = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), 
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), 
    )

    # Integración Dolibarr (supabase/migrations/002_dolibarr.sql)
    dolibarr_id:              Mapped[Optional[int]]      = mapped_column(BigInteger, unique=True)
    dolibarr_stock:           Mapped[Optional[Decimal]]  = mapped_column(Numeric(12, 3))
    dolibarr_tva_tx:          Mapped[Optional[Decimal]]  = mapped_column(Numeric(6, 3))
    dolibarr_sincronizado_en: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))

    __table_args__ = (
        CheckConstraint("precio_unitario >= 0", name="chk_precio_unitario_no_negativo"),
        CheckConstraint("stock_minimo >= 0",    name="chk_stock_minimo_no_negativo"),
        Index("idx_productos_codigo_barras", "codigo_barras"),
        Index("idx_productos_sku",           "sku"),
        Index("idx_productos_nombre",        "nombre"),
        Index("idx_productos_activo",        "activo"),
    )

    # Relaciones
    categoria:        Mapped["Categoria"]          = relationship(back_populates="productos", )
    creado_por_ref:   Mapped[Optional["Usuario"]]  = relationship(back_populates="productos_creados", foreign_keys=[creado_por], )
    lotes:            Mapped[list["Lote"]]         = relationship(back_populates="producto", )
    precios_volumen:  Mapped[list["PrecioVolumen"]] = relationship(back_populates="producto", )
    combo_detalles:   Mapped[list["ComboDetalle"]] = relationship(back_populates="producto", )
    detalle_ventas:   Mapped[list["DetalleVenta"]] = relationship(back_populates="producto", )
    mermas:           Mapped[list["Merma"]]        = relationship(back_populates="producto", )
    detalle_cotizacion: Mapped[list["DetalleCotizacion"]] = relationship(back_populates="producto", )
    alertas:          Mapped[list["Alerta"]]       = relationship(back_populates="producto", foreign_keys="Alerta.producto_id", )
    pedido_detalles:  Mapped[list["PedidoSugeridoDetalle"]] = relationship(back_populates="producto", )


class Lote(Base):
    __tablename__ = "lotes"

    id:               Mapped[int]              = mapped_column(BigInteger, primary_key=True, )
    producto_id:      Mapped[int]              = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"))
    proveedor_id:     Mapped[Optional[int]]    = mapped_column(
        ForeignKey("proveedores.id", ondelete="SET NULL"), 
    )
    numero_lote:      Mapped[Optional[str]]    = mapped_column(String(100), )
    cantidad_inicial: Mapped[int]              = mapped_column(Integer)
    cantidad_actual:  Mapped[int]              = mapped_column(Integer)
    costo_unitario:   Mapped[Decimal]          = mapped_column(Numeric(12, 4), default=Decimal("0.0000"))
    fecha_ingreso:    Mapped[datetime]         = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(),
    )
    fecha_vencimiento: Mapped[date]            = mapped_column(Date, nullable=False)
    estado:           Mapped[EstadoLote]       = mapped_column(_pg_enum(EstadoLote, "estado_lote"), default=EstadoLote.ACTIVO)
    created_at:       Mapped[datetime]         = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )

    __table_args__ = (
        CheckConstraint("cantidad_inicial > 0",  name="chk_lotes_cant_inicial_positiva"),
        CheckConstraint("cantidad_actual >= 0",  name="chk_lotes_cant_actual_no_negativa"),
        CheckConstraint("costo_unitario >= 0",   name="chk_lotes_costo_no_negativo"),
        Index(
            "idx_lotes_producto_estado",
            "producto_id", "estado",
            postgresql_where="cantidad_actual > 0",
        ),
        Index(
            "idx_lotes_vencimiento",
            "fecha_vencimiento",
            postgresql_where="cantidad_actual > 0 AND estado = 'activo'",
        ),
    )

    # Relaciones
    producto:        Mapped["Producto"]             = relationship(back_populates="lotes", )
    proveedor:       Mapped[Optional["Proveedor"]]  = relationship(back_populates="lotes", )
    detalle_ventas:  Mapped[list["DetalleVenta"]]   = relationship(back_populates="lote", )
    mermas:          Mapped[list["Merma"]]          = relationship(back_populates="lote", )
    alertas:         Mapped[list["Alerta"]]         = relationship(back_populates="lote", foreign_keys="Alerta.lote_id", )


class PrecioVolumen(Base):
    """Precio mayorista automático cuando se compra ≥ cantidad_minima."""
    __tablename__ = "precios_volumen"

    id:              Mapped[int]      = mapped_column(BigInteger, primary_key=True, )
    producto_id:     Mapped[int]      = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"))
    cantidad_minima: Mapped[int]      = mapped_column(Integer)
    precio_especial: Mapped[Decimal]  = mapped_column(Numeric(12, 2))
    activo:          Mapped[bool]     = mapped_column(Boolean, default=True)
    created_at:      Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), 
    )

    __table_args__ = (
        CheckConstraint("cantidad_minima > 0", name="chk_precios_volumen_cant_positiva"),
        CheckConstraint("precio_especial >= 0", name="chk_precios_volumen_precio_no_negativo"),
        UniqueConstraint(
            "producto_id", "cantidad_minima",
            name="uq_precio_volumen_producto_cantidad",
        ),
        Index(
            "idx_precios_volumen_producto",
            "producto_id", "cantidad_minima",
            postgresql_where="activo = true",
        ),
    )

    producto: Mapped["Producto"] = relationship(back_populates="precios_volumen", )


# ===================================================================
# COMBOS Y PROMOCIONES
# ===================================================================

class ComboPromocion(Base):
    __tablename__ = "combos_promociones"

    id:           Mapped[int]             = mapped_column(BigInteger, primary_key=True, )
    nombre:       Mapped[str]             = mapped_column(String(200), nullable=False)
    descripcion:  Mapped[Optional[str]]   = mapped_column(Text, )
    tipo:         Mapped[TipoCombo]       = mapped_column(_pg_enum(TipoCombo, "tipo_combo"))
    valor:        Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), )
    fecha_inicio: Mapped[date]            = mapped_column(Date)
    fecha_fin:    Mapped[Optional[date]]  = mapped_column(Date, )
    activo:       Mapped[bool]            = mapped_column(Boolean, default=True)
    created_at:   Mapped[datetime]        = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), 
    )

    __table_args__ = (
        CheckConstraint("valor > 0", name="chk_combo_valor_positivo"),
        CheckConstraint(
            "fecha_fin IS NULL OR fecha_fin >= fecha_inicio",
            name="chk_combo_vigencia",
        ),
    )

    detalles:       Mapped[list["ComboDetalle"]] = relationship(back_populates="combo", )
    detalle_ventas: Mapped[list["DetalleVenta"]] = relationship(back_populates="combo", )


class ComboDetalle(Base):
    """Tabla N:M entre combos y productos + cantidad requerida por combo."""
    __tablename__ = "combo_detalles"

    id:          Mapped[int] = mapped_column(BigInteger, primary_key=True, )
    combo_id:    Mapped[int] = mapped_column(ForeignKey("combos_promociones.id", ondelete="CASCADE"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"))
    cantidad:    Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        CheckConstraint("cantidad > 0", name="chk_combo_detalle_cant_positiva"),
        UniqueConstraint("combo_id", "producto_id", name="uq_combo_producto"),
    )

    combo:    Mapped["ComboPromocion"] = relationship(back_populates="detalles", )
    producto: Mapped["Producto"]       = relationship(back_populates="combo_detalles", )


# ===================================================================
# VENTAS (CAJA)
# ===================================================================

class Venta(Base):
    __tablename__ = "ventas"

    id:                 Mapped[int]           = mapped_column(BigInteger, primary_key=True, )
    numero_comprobante: Mapped[int]           = mapped_column(BigInteger, unique=True, server_default=FetchedValue())  # BIGSERIAL
    fecha_hora:         Mapped[datetime]      = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(),
    )
    cliente_id:      Mapped[Optional[int]] = mapped_column(
        ForeignKey("clientes.id", ondelete="SET NULL"), 
    )
    usuario_id:      Mapped[int]           = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"),
    )
    subtotal:        Mapped[Decimal]       = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    descuento_total: Mapped[Decimal]       = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    total:           Mapped[Decimal]       = mapped_column(Numeric(12, 2))
    estado:          Mapped[EstadoVenta]   = mapped_column(_pg_enum(EstadoVenta, "estado_venta"), default=EstadoVenta.PAGADA)
    observaciones:   Mapped[Optional[str]] = mapped_column(Text, )
    created_at:      Mapped[datetime]      = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )

    # Integración Dolibarr (supabase/migrations/002_dolibarr.sql)
    sincronizado_dolibarr:     Mapped[bool]               = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False,
    )
    dolibarr_factura_id:       Mapped[Optional[int]]      = mapped_column(BigInteger)
    dolibarr_factura_validada: Mapped[bool]               = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False,
    )
    dolibarr_intentos:         Mapped[int]                = mapped_column(
        Integer, default=0, server_default="0", nullable=False,
    )
    ultimo_error_dolibarr:     Mapped[Optional[str]]      = mapped_column(Text)
    dolibarr_sincronizado_en:  Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))

    __table_args__ = (
        CheckConstraint("subtotal >= 0",        name="chk_ventas_subtotal_no_negativo"),
        CheckConstraint("descuento_total >= 0", name="chk_ventas_descuento_no_negativo"),
        CheckConstraint("total >= 0",           name="chk_ventas_total_no_negativo"),
        Index("idx_ventas_fecha_hora",    "fecha_hora", postgresql_ops={"fecha_hora": "DESC"}),
        Index("idx_ventas_usuario_fecha", "usuario_id",   "fecha_hora", postgresql_ops={"fecha_hora": "DESC"}),
        Index("idx_ventas_estado",        "estado"),
        Index("idx_ventas_sincronizado_dolibarr", "sincronizado_dolibarr"),
    )

    # Relaciones
    cliente: Mapped[Optional["Cliente"]] = relationship(back_populates="ventas", )
    usuario: Mapped["Usuario"]           = relationship(back_populates="ventas", )

    pagos:          Mapped[list["VentaPago"]]    = relationship(back_populates="venta", cascade="all, delete-orphan")
    detalle_ventas: Mapped[list["DetalleVenta"]] = relationship(back_populates="venta", cascade="all, delete-orphan")


class VentaPago(Base):
    """Permite pago mixto (ej: $500 efectivo + $300 débito en la misma venta)."""
    __tablename__ = "venta_pagos"

    id:         Mapped[int]        = mapped_column(BigInteger, primary_key=True, )
    venta_id:   Mapped[int]        = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"))
    forma_pago: Mapped[FormaPago]  = mapped_column(_pg_enum(FormaPago, "forma_pago"))
    monto:      Mapped[Decimal]    = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime]   = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )

    __table_args__ = (
        CheckConstraint("monto > 0", name="chk_venta_pagos_monto_positivo"),
        Index("idx_venta_pagos_venta", "venta_id"),
    )

    venta: Mapped["Venta"] = relationship(back_populates="pagos", )


class DetalleVenta(Base):
    __tablename__ = "detalle_ventas"

    id:                       Mapped[int]           = mapped_column(BigInteger, primary_key=True, )
    venta_id:                 Mapped[int]           = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"))
    producto_id:              Mapped[int]           = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"))
    lote_id:                  Mapped[Optional[int]] = mapped_column(
        ForeignKey("lotes.id", ondelete="SET NULL"), 
    )
    combo_id:                 Mapped[Optional[int]] = mapped_column(
        ForeignKey("combos_promociones.id", ondelete="SET NULL"), 
    )
    cantidad:                 Mapped[int]           = mapped_column(Integer)
    precio_unitario_aplicado: Mapped[Decimal]       = mapped_column(Numeric(12, 2))
    descuento_unitario:       Mapped[Decimal]       = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    subtotal:                 Mapped[Decimal]       = mapped_column(Numeric(12, 2))
    dolibarr_movimiento_id:   Mapped[Optional[int]] = mapped_column(BigInteger)

    __table_args__ = (
        CheckConstraint("cantidad > 0",                   name="chk_dv_cantidad_positiva"),
        CheckConstraint("precio_unitario_aplicado >= 0",  name="chk_dv_precio_no_negativo"),
        CheckConstraint("descuento_unitario >= 0",        name="chk_dv_descuento_no_negativo"),
        CheckConstraint("subtotal >= 0",                  name="chk_dv_subtotal_no_negativo"),
        Index("idx_detalle_ventas_venta",    "venta_id"),
        Index("idx_detalle_ventas_lote",     "lote_id"),
        Index("idx_detalle_ventas_producto", "producto_id"),
    )

    # Relaciones — lote_id enlaza al lote consumido según PEPS
    venta:    Mapped["Venta"]              = relationship(back_populates="detalle_ventas", )
    producto: Mapped["Producto"]           = relationship(back_populates="detalle_ventas", )
    lote:     Mapped[Optional["Lote"]]     = relationship(back_populates="detalle_ventas", )
    combo:    Mapped[Optional["ComboPromocion"]] = relationship(back_populates="detalle_ventas", )


# ===================================================================
# MERMAS
# ===================================================================

class Merma(Base):
    __tablename__ = "mermas"

    id:            Mapped[int]           = mapped_column(BigInteger, primary_key=True, )
    producto_id:   Mapped[int]           = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"))
    lote_id:       Mapped[Optional[int]] = mapped_column(
        ForeignKey("lotes.id", ondelete="SET NULL"), 
    )
    cantidad:      Mapped[int]           = mapped_column(Integer)
    motivo:        Mapped[MotivoMerma]   = mapped_column(_pg_enum(MotivoMerma, "motivo_merma"))
    fecha_hora:    Mapped[datetime]      = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(),
    )
    usuario_id:    Mapped[int]           = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    observaciones: Mapped[Optional[str]] = mapped_column(Text, )

    __table_args__ = (
        CheckConstraint("cantidad > 0", name="chk_mermas_cantidad_positiva"),
        Index("idx_mermas_fecha",    "fecha_hora", postgresql_ops={"fecha_hora": "DESC"}),
        Index("idx_mermas_producto", "producto_id"),
        Index("idx_mermas_lote",     "lote_id"),
    )

    producto: Mapped["Producto"]         = relationship(back_populates="mermas", )
    lote:     Mapped[Optional["Lote"]]   = relationship(back_populates="mermas", )
    usuario:  Mapped["Usuario"]          = relationship(back_populates="mermas", )


# ===================================================================
# COTIZACIONES MAYORISTAS
# ===================================================================

class CotizacionMayorista(Base):
    __tablename__ = "cotizaciones_mayoristas"

    id:               Mapped[int]                 = mapped_column(BigInteger, primary_key=True, )
    numero_cotizacion: Mapped[str]                = mapped_column(String(30), unique=True, nullable=False)
    fecha_hora:       Mapped[datetime]            = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(),
    )
    validez_hasta:    Mapped[date]                = mapped_column(Date)
    cliente_id:       Mapped[int]                 = mapped_column(ForeignKey("clientes.id", ondelete="RESTRICT"))
    usuario_id:       Mapped[int]                 = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    subtotal:         Mapped[Decimal]             = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    descuento_total:  Mapped[Decimal]             = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    total:            Mapped[Decimal]             = mapped_column(Numeric(12, 2))
    estado:           Mapped[EstadoCotizacion]    = mapped_column(_pg_enum(EstadoCotizacion, "estado_cotizacion"), default=EstadoCotizacion.PENDIENTE)
    stock_reservado:  Mapped[bool]                = mapped_column(Boolean, default=False)
    observaciones:    Mapped[Optional[str]]       = mapped_column(Text, )
    created_at:       Mapped[datetime]            = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), 
    )

    __table_args__ = (
        CheckConstraint("subtotal >= 0",        name="chk_cotiz_subtotal_no_negativo"),
        CheckConstraint("descuento_total >= 0", name="chk_cotiz_descuento_no_negativo"),
        CheckConstraint("total >= 0",           name="chk_cotiz_total_no_negativo"),
        Index("idx_cotizaciones_cliente", "cliente_id", "fecha_hora", postgresql_ops={"fecha_hora": "DESC"}),
        Index("idx_cotizaciones_estado",  "estado"),
    )

    cliente:            Mapped["Cliente"]              = relationship(back_populates="cotizaciones", )
    usuario:            Mapped["Usuario"]              = relationship(back_populates="cotizaciones", )
    detalle_cotizacion: Mapped[list["DetalleCotizacion"]] = relationship(
        back_populates="cotizacion", cascade="all, delete-orphan",
    )


class DetalleCotizacion(Base):
    __tablename__ = "detalle_cotizacion"

    id:              Mapped[int]     = mapped_column(BigInteger, primary_key=True, )
    cotizacion_id:   Mapped[int]     = mapped_column(ForeignKey("cotizaciones_mayoristas.id", ondelete="CASCADE"))
    producto_id:     Mapped[int]     = mapped_column(ForeignKey("productos.id", ondelete="RESTRICT"))
    cantidad:        Mapped[int]     = mapped_column(Integer)
    precio_acordado: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    subtotal:        Mapped[Decimal] = mapped_column(Numeric(12, 2))

    __table_args__ = (
        CheckConstraint("cantidad > 0",          name="chk_dc_cantidad_positiva"),
        CheckConstraint("precio_acordado >= 0",  name="chk_dc_precio_no_negativo"),
        CheckConstraint("subtotal >= 0",         name="chk_dc_subtotal_no_negativo"),
    )

    cotizacion: Mapped["CotizacionMayorista"] = relationship(back_populates="detalle_cotizacion", )
    producto:   Mapped["Producto"]            = relationship(back_populates="detalle_cotizacion", )


# ===================================================================
# ARQUEO Y MOVIMIENTOS DE CAJA
# ===================================================================

class ArqueoCaja(Base):
    __tablename__ = "arqueos_caja"

    id:                     Mapped[int]           = mapped_column(BigInteger, primary_key=True, )
    fecha:                  Mapped[date]          = mapped_column(Date, server_default=func.current_date())
    usuario_apertura_id:    Mapped[int]           = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    usuario_cierre_id:      Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), 
    )
    hora_apertura:          Mapped[datetime]      = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(),
    )
    hora_cierre:            Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), )
    monto_inicial:          Mapped[Decimal]       = mapped_column(Numeric(12, 2))
    monto_efectivo_contado: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), )
    monto_esperado:         Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), )
    diferencia:             Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), )
    estado:                 Mapped[EstadoArqueo]  = mapped_column(_pg_enum(EstadoArqueo, "estado_arqueo"), default=EstadoArqueo.ABIERTO)
    observaciones:          Mapped[Optional[str]] = mapped_column(Text, )
    created_at:             Mapped[datetime]      = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), 
    )

    __table_args__ = (
        CheckConstraint("monto_inicial >= 0",          name="chk_ac_monto_inicial_no_negativo"),
        CheckConstraint("monto_efectivo_contado >= 0", name="chk_ac_efectivo_no_negativo"),
        CheckConstraint("monto_esperado >= 0",         name="chk_ac_esperado_no_negativo"),
        Index("idx_arqueos_fecha",  "fecha", postgresql_ops={"fecha": "DESC"}),
        Index("idx_arqueos_estado", "estado"),
    )

    usuario_apertura: Mapped["Usuario"]              = relationship(back_populates="arqueos_apertura", foreign_keys=[usuario_apertura_id], )
    usuario_cierre:   Mapped[Optional["Usuario"]]    = relationship(back_populates="arqueos_cierre",   foreign_keys=[usuario_cierre_id], )
    movimientos:      Mapped[list["MovimientoCaja"]] = relationship(back_populates="arqueo", cascade="all, delete-orphan")


class MovimientoCaja(Base):
    """Ingresos / egresos manuales: pago a proveedor, gasto menor, ajuste."""
    __tablename__ = "movimientos_caja"

    id:         Mapped[int]                = mapped_column(BigInteger, primary_key=True, )
    arqueo_id:  Mapped[int]                = mapped_column(ForeignKey("arqueos_caja.id", ondelete="RESTRICT"))
    tipo:       Mapped[TipoMovimientoCaja] = mapped_column(_pg_enum(TipoMovimientoCaja, "tipo_movimiento_caja"))
    categoria:  Mapped[CategoriaMovimiento] = mapped_column(_pg_enum(CategoriaMovimiento, "categoria_movimiento"), default=CategoriaMovimiento.OTRO)
    monto:      Mapped[Decimal]            = mapped_column(Numeric(12, 2))
    motivo:     Mapped[Optional[str]]      = mapped_column(Text, )
    fecha_hora: Mapped[datetime]           = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(),
    )
    usuario_id: Mapped[int]                = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))

    __table_args__ = (
        CheckConstraint("monto > 0", name="chk_mc_monto_positivo"),
        Index("idx_movimientos_arqueo", "arqueo_id"),
    )

    arqueo:  Mapped["ArqueoCaja"] = relationship(back_populates="movimientos", )
    usuario: Mapped["Usuario"]    = relationship(back_populates="movimientos_caja", )


# ===================================================================
# PEDIDOS SUGERIDOS A PROVEEDORES
# ===================================================================

class PedidoSugerido(Base):
    __tablename__ = "pedidos_sugeridos"

    id:               Mapped[int]                 = mapped_column(BigInteger, primary_key=True, )
    proveedor_id:     Mapped[Optional[int]]       = mapped_column(
        ForeignKey("proveedores.id", ondelete="SET NULL"), 
    )
    fecha_generacion: Mapped[datetime]            = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(),
    )
    estado:           Mapped[EstadoPedidoSugerido] = mapped_column(_pg_enum(EstadoPedidoSugerido, "estado_pedido_sugerido"), default=EstadoPedidoSugerido.PENDIENTE)
    usuario_id:       Mapped[Optional[int]]       = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), 
    )
    observaciones:    Mapped[Optional[str]]       = mapped_column(Text, )
    created_at:       Mapped[datetime]            = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), 
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), 
    )

    proveedor: Mapped[Optional["Proveedor"]]       = relationship(back_populates="pedidos_sugeridos", )
    detalles:  Mapped[list["PedidoSugeridoDetalle"]] = relationship(
        back_populates="pedido_sugerido", cascade="all, delete-orphan",
    )


class PedidoSugeridoDetalle(Base):
    __tablename__ = "pedido_sugerido_detalles"

    id:                 Mapped[int]         = mapped_column(BigInteger, primary_key=True, )
    pedido_sugerido_id: Mapped[int]         = mapped_column(ForeignKey("pedidos_sugeridos.id", ondelete="CASCADE"))
    producto_id:        Mapped[int]         = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"))
    cantidad_sugerida:  Mapped[int]         = mapped_column(Integer)
    cantidad_aprobada:  Mapped[Optional[int]] = mapped_column(Integer, )

    __table_args__ = (
        CheckConstraint("cantidad_sugerida > 0",                    name="chk_psd_sugerida_positiva"),
        CheckConstraint("cantidad_aprobada IS NULL OR cantidad_aprobada >= 0", name="chk_psd_aprobada_no_negativa"),
    )

    pedido_sugerido: Mapped["PedidoSugerido"] = relationship(back_populates="detalles", )
    producto:        Mapped["Producto"]       = relationship(back_populates="pedido_detalles", )


# ===================================================================
# ALERTAS (stock bajo, vencimiento, etc.)
# ===================================================================

class Alerta(Base):
    __tablename__ = "alertas"

    id:               Mapped[int]                = mapped_column(BigInteger, primary_key=True, )
    tipo:             Mapped[TipoAlerta]         = mapped_column(_pg_enum(TipoAlerta, "tipo_alerta"))
    severidad:        Mapped[SeveridadAlerta]    = mapped_column(_pg_enum(SeveridadAlerta, "severidad_alerta"), default=SeveridadAlerta.WARNING)
    producto_id:      Mapped[Optional[int]]      = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"), 
    )
    lote_id:          Mapped[Optional[int]]      = mapped_column(
        ForeignKey("lotes.id", ondelete="CASCADE"), 
    )
    mensaje:          Mapped[str]                = mapped_column(Text, nullable=False)
    fecha_generacion: Mapped[datetime]           = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(),
    )
    leida:            Mapped[bool]               = mapped_column(Boolean, default=False)
    usuario_leyo_id:  Mapped[Optional[int]]      = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), 
    )
    fecha_vista:      Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), )

    __table_args__ = (
        Index(
            "idx_alertas_leida",
            "leida", "fecha_generacion",
            postgresql_ops={"fecha_generacion": "DESC"},
            postgresql_where="leida = false",
        ),
        Index("idx_alertas_producto", "producto_id"),
        Index("idx_alertas_lote",     "lote_id"),
    )

    producto:     Mapped[Optional["Producto"]] = relationship(back_populates="alertas", foreign_keys=[producto_id], )
    lote:         Mapped[Optional["Lote"]]     = relationship(back_populates="alertas", foreign_keys=[lote_id], )
    usuario_leyo: Mapped[Optional["Usuario"]]  = relationship(back_populates="alertas_leidas", foreign_keys=[usuario_leyo_id], )

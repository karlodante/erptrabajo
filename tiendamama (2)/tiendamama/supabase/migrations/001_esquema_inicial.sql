-- ============================================================
-- PROYECTO: Sistema de Gestión de Ventas e Inventario - Tienda de Lácteos
-- ARCHIVO:  001_esquema_inicial.sql
-- MOTOR:    PostgreSQL 15+
-- ============================================================

-- ------------------------------------------------------------
-- SECCIÓN 1: DIAGRAMA CONCEPTUAL ENTIDAD-RELACIÓN (TEXTO)
-- ------------------------------------------------------------
--
--  TABLAS PRINCIPALES                        RELACIONES (1:N / N:M)
--  ─────────────────────────────────       ──────────────────────────────
--  usuarios                                 usuarios (1) ── (N) ventas
--    id (PK)                                usuarios (1) ── (N) arqueos apertura/cierre
--    username (UQ, NN)                      usuarios (1) ── (N) mermas
--    password_hash (NN)                     usuarios (1) ── (N) movimientos_caja
--    nombre_completo (NN)                   usuarios (1) ── (N) cotizaciones
--    rol [admin|cajero|vendedor|repo]
--    activo
--
--  categorias                               categorias (1) ── (N) productos
--    id (PK)
--    nombre (UQ, NN)
--    activo
--
--  proveedores                              proveedores (1) ── (N) lotes
--    id (PK)                                proveedores (1) ── (N) pedidos_sugeridos
--    nombre (UQ, NN)
--    contacto, telefono, email
--    activo
--
--  clientes                                 clientes (1) ── (N) ventas
--    id (PK)                                clientes (1) ── (N) cotizaciones_mayoristas
--    nombre / razon_social
--    tipo [minorista|mayorista]
--    dni_cuit (UQ), condicion_iva
--    limite_credito, saldo_cuenta
--
--  productos                                productos (1) ── (N) lotes
--    id (PK)                                productos (1) ── (N) detalle_ventas
--    sku (UQ, NN)                           productos (1) ── (N) precios_volumen
--    codigo_barras (UQ, INDEX)              productos (1) ── (N) mermas
--    nombre (NN)                            productos (1) ── (N) detalle_cotizacion
--    categoria_id (FK)                      productos (1) ── (N) alertas
--    unidad_medida [unidad|kg|litro|pack|caja|ml|g]
--    precio_unitario (NN, NUMERIC(12,2))
--    stock_minimo (def: 5)
--    activo
--
--  lotes                                    lotes (1) ── (N) detalle_ventas (PEPS)
--    id (PK)                                lotes (1) ── (N) mermas
--    producto_id (FK, INDEX, NN)            lotes (1) ── (N) alertas
--    proveedor_id (FK)
--    numero_lote
--    cantidad_inicial, cantidad_actual (NN)
--    costo_unitario (NUMERIC(12,4))
--    fecha_ingreso (NN, INDEX)
--    fecha_vencimiento (INDEX)         ───► ORDENACIÓN PEPS: ASC por fecha_vencimiento
--    estado [activo|agotado|mermado|vencido]
--
--  precios_volumen                          N:1 con productos
--    id (PK)
--    producto_id (FK)
--    cantidad_minima (NN, ≥1)
--    precio_especial (NN, < precio_unitario)
--    activo
--    UQ(producto_id, cantidad_minima)
--
--  combos_promociones                       N:M con productos via combo_detalles
--    id (PK)
--    nombre (NN)
--    tipo [descuento_porcentual|precio_fijo|combo]
--    valor
--    fecha_inicio, fecha_fin
--    activo
--
--  combo_detalles (N:M)
--    combo_id (FK) + producto_id (FK) + cantidad
--
--  ventas                                   ventas (1) ── (N) detalle_ventas
--    id (PK)                                ventas (1) ── (N) venta_pagos
--    numero_comprobante (UQ, SERIAL)
--    fecha_hora (NN, INDEX)
--    cliente_id (FK)
--    usuario_id (FK)        ← cajero
--    subtotal, descuento, total (NUMERIC 12,2)
--    estado [pagada|pendiente|anulada]
--
--  venta_pagos (soporta pago mixto)
--    id (PK)
--    venta_id (FK)
--    forma_pago [efectivo|debito|credito|transferencia|cheque|qr|cuenta_corriente]
--    monto
--
--  detalle_ventas
--    id (PK)
--    venta_id (FK)
--    producto_id (FK)
--    lote_id (FK)       ← PEPS: cuál lote se consumió
--    cantidad (NN, > 0)
--    precio_unitario_aplicado
--    subtotal
--    combo_id (FK, NULLABLE)
--
--  mermas
--    id (PK)
--    producto_id (FK)
--    lote_id (FK)
--    cantidad (NN, > 0)
--    motivo [danado|vencido|robo|error_stock|otro]
--    fecha_hora
--    usuario_id (FK)   ← responsable
--    observaciones
--
--  cotizaciones_mayoristas
--    id (PK)
--    numero_cotizacion (UQ)
--    fecha_hora, validez_hasta
--    cliente_id (FK)
--    usuario_id (FK)   ← vendedor
--    total
--    estado [pendiente|confirmada|cancelada|vencida]
--    stock_reservado BOOL
--
--  detalle_cotizacion   (1) cotizacion ── (N) detalle
--    id (PK)
--    cotizacion_id (FK)
--    producto_id (FK)
--    cantidad
--    precio_acordado
--    subtotal
--
--  arqueos_caja
--    id (PK)
--    fecha (NN, INDEX)
--    usuario_apertura_id (FK)
--    usuario_cierre_id (FK, NULL)
--    hora_apertura, hora_cierre
--    monto_inicial (NN)
--    monto_efectivo_contado, monto_esperado, diferencia
--    estado [abierto|cerrado]
--    observaciones
--
--  movimientos_caja
--    id (PK)
--    arqueo_id (FK)       ← cada movimiento pertenece a una caja abierta
--    tipo [ingreso|egreso]
--    categoria [pago_proveedor|gasto_menor|fondo_inicial|ajuste|otro]
--    monto (NN)
--    motivo
--    fecha_hora
--    usuario_id (FK)
--
--  pedidos_sugeridos
--    id (PK)
--    proveedor_id (FK)
--    fecha_generacion (NN)
--    estado [pendiente|enviado|confirmado|cancelado]
--    usuario_id (FK)
--
--  pedido_sugerido_detalles  (1) pedido ── (N) items
--    id (PK)
--    pedido_sugerido_id (FK)
--    producto_id (FK)
--    cantidad_sugerida, cantidad_aprobada
--
--  alertas
--    id (PK)
--    tipo [stock_bajo|vencimiento_proximo|lote_vencido|stock_negativo]
--    severidad [info|warning|critical]
--    producto_id (FK, NULL)
--    lote_id (FK, NULL)
--    mensaje (NN)
--    fecha_generacion (NN, INDEX)
--    leida BOOL default false
--    leida_por (FK usuario, NULL)
--    fecha_vista (NULL)
--
-- ============================================================
-- FIN DIAGRAMA CONCEPTUAL
-- ============================================================

SET client_encoding = 'UTF8';

-- ------------------------------------------------------------
-- SECCIÓN 2: ENUMS Y TIPOS
-- ------------------------------------------------------------

CREATE TYPE rol_usuario            AS ENUM ('administrador', 'cajero', 'vendedor_mayorista', 'repositor');
CREATE TYPE unidad_medida          AS ENUM ('unidad', 'kg', 'g', 'litro', 'ml', 'pack', 'caja');
CREATE TYPE estado_lote            AS ENUM ('activo', 'agotado', 'mermado', 'vencido');
CREATE TYPE motivo_merma           AS ENUM ('danado', 'vencido', 'robo', 'error_stock', 'otro');
CREATE TYPE tipo_cliente           AS ENUM ('minorista', 'mayorista');
CREATE TYPE condicion_iva          AS ENUM ('responsable_inscripto', 'monotributista', 'consumidor_final', 'exento', 'no_responsable');
CREATE TYPE estado_venta           AS ENUM ('pagada', 'pendiente', 'anulada');
CREATE TYPE forma_pago             AS ENUM ('efectivo', 'debito', 'credito', 'transferencia', 'cheque', 'qr', 'cuenta_corriente');
CREATE TYPE tipo_combo             AS ENUM ('descuento_porcentual', 'precio_fijo', 'combo');
CREATE TYPE estado_cotizacion      AS ENUM ('pendiente', 'confirmada', 'cancelada', 'vencida');
CREATE TYPE estado_arqueo          AS ENUM ('abierto', 'cerrado');
CREATE TYPE tipo_movimiento_caja   AS ENUM ('ingreso', 'egreso');
CREATE TYPE categoria_movimiento   AS ENUM ('pago_proveedor', 'gasto_menor', 'fondo_inicial', 'ajuste', 'otro');
CREATE TYPE estado_pedido_sugerido AS ENUM ('pendiente', 'enviado', 'confirmado', 'cancelado');
CREATE TYPE tipo_alerta            AS ENUM ('stock_bajo', 'vencimiento_proximo', 'lote_vencido', 'stock_negativo');
CREATE TYPE severidad_alerta       AS ENUM ('info', 'warning', 'critical');

-- ------------------------------------------------------------
-- SECCIÓN 3: TABLAS (CREATE TABLE + CONSTRAINTS)
-- ------------------------------------------------------------

-- ══════════════════════════════════════════════════════════════
-- TABLA: usuarios
-- ══════════════════════════════════════════════════════════════
CREATE TABLE usuarios (
    id               BIGSERIAL    PRIMARY KEY,
    username         VARCHAR(50)  NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    nombre_completo  VARCHAR(150) NOT NULL,
    rol              rol_usuario  NOT NULL DEFAULT 'cajero',
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: categorias
-- ══════════════════════════════════════════════════════════════
CREATE TABLE categorias (
    id          BIGSERIAL    PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: proveedores
-- ══════════════════════════════════════════════════════════════
CREATE TABLE proveedores (
    id         BIGSERIAL    PRIMARY KEY,
    nombre     VARCHAR(150) NOT NULL UNIQUE,
    cuit       VARCHAR(13),
    contacto   VARCHAR(150),
    telefono   VARCHAR(30),
    email      VARCHAR(150),
    direccion  TEXT,
    activo     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: clientes
-- ══════════════════════════════════════════════════════════════
CREATE TABLE clientes (
    id              BIGSERIAL      PRIMARY KEY,
    nombre_rs       VARCHAR(150)   NOT NULL,
    tipo            tipo_cliente   NOT NULL DEFAULT 'minorista',
    dni_cuit        VARCHAR(13)    UNIQUE,
    condicion_iva   condicion_iva  NOT NULL DEFAULT 'consumidor_final',
    telefono        VARCHAR(30),
    email           VARCHAR(150),
    direccion       TEXT,
    limite_credito  NUMERIC(12,2)  CHECK (limite_credito IS NULL OR limite_credito >= 0),
    saldo_cuenta    NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (saldo_cuenta >= 0),
    activo          BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: productos
-- ══════════════════════════════════════════════════════════════
CREATE TABLE productos (
    id              BIGSERIAL       PRIMARY KEY,
    sku             VARCHAR(50)     NOT NULL UNIQUE,
    codigo_barras   VARCHAR(50)     UNIQUE,
    nombre          VARCHAR(200)    NOT NULL,
    categoria_id    BIGINT          NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    unidad_medida   unidad_medida   NOT NULL DEFAULT 'unidad',
    precio_unitario NUMERIC(12,2)   NOT NULL CHECK (precio_unitario >= 0),
    stock_minimo    INTEGER         NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    creado_por      BIGINT          REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: lotes  (PEPS = ordenar por fecha_vencimiento ASC, cantidad_actual > 0)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE lotes (
    id               BIGSERIAL      PRIMARY KEY,
    producto_id      BIGINT         NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    proveedor_id     BIGINT         REFERENCES proveedores(id) ON DELETE SET NULL,
    numero_lote      VARCHAR(100),
    cantidad_inicial INTEGER        NOT NULL CHECK (cantidad_inicial > 0),
    cantidad_actual  INTEGER        NOT NULL CHECK (cantidad_actual >= 0),
    costo_unitario   NUMERIC(12,4)  NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
    fecha_ingreso    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    fecha_vencimiento DATE         NOT NULL,
    estado           estado_lote    NOT NULL DEFAULT 'activo',
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: precios_volumen  (precio mayorista automático por cantidad)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE precios_volumen (
    id              BIGSERIAL      PRIMARY KEY,
    producto_id     BIGINT         NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad_minima INTEGER        NOT NULL CHECK (cantidad_minima > 0),
    precio_especial NUMERIC(12,2)  NOT NULL CHECK (precio_especial >= 0),
    activo          BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_precio_volumen_producto_cantidad UNIQUE (producto_id, cantidad_minima)
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: combos_promociones
-- ══════════════════════════════════════════════════════════════
CREATE TABLE combos_promociones (
    id           BIGSERIAL    PRIMARY KEY,
    nombre       VARCHAR(200) NOT NULL,
    descripcion  TEXT,
    tipo         tipo_combo   NOT NULL,
    valor        NUMERIC(12,2) CHECK (valor > 0),
    fecha_inicio DATE         NOT NULL,
    fecha_fin    DATE,
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_combo_vigencia CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

-- ══════════════════════════════════════════════════════════════
-- TABLA N:M: combo_detalles
-- ══════════════════════════════════════════════════════════════
CREATE TABLE combo_detalles (
    id          BIGSERIAL PRIMARY KEY,
    combo_id    BIGINT    NOT NULL REFERENCES combos_promociones(id) ON DELETE CASCADE,
    producto_id BIGINT    NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad    INTEGER   NOT NULL CHECK (cantidad > 0),
    CONSTRAINT uq_combo_producto UNIQUE (combo_id, producto_id)
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: ventas
-- ══════════════════════════════════════════════════════════════
CREATE TABLE ventas (
    id                  BIGSERIAL       PRIMARY KEY,
    numero_comprobante  BIGSERIAL       UNIQUE NOT NULL,
    fecha_hora          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    cliente_id          BIGINT          REFERENCES clientes(id) ON DELETE SET NULL,
    usuario_id          BIGINT          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    subtotal            NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    descuento_total     NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (descuento_total >= 0),
    total               NUMERIC(12,2)   NOT NULL CHECK (total >= 0),
    estado              estado_venta    NOT NULL DEFAULT 'pagada',
    observaciones       TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: venta_pagos  (pago mixto: 1 venta = N pagos de distinto medio)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE venta_pagos (
    id         BIGSERIAL     PRIMARY KEY,
    venta_id   BIGINT        NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    forma_pago forma_pago    NOT NULL,
    monto      NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: detalle_ventas  (PEPS — lote_id indica qué lote se consumió)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE detalle_ventas (
    id                      BIGSERIAL      PRIMARY KEY,
    venta_id                BIGINT         NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id             BIGINT         NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    lote_id                 BIGINT         REFERENCES lotes(id) ON DELETE SET NULL,
    combo_id                BIGINT         REFERENCES combos_promociones(id) ON DELETE SET NULL,
    cantidad                INTEGER        NOT NULL CHECK (cantidad > 0),
    precio_unitario_aplicado NUMERIC(12,2) NOT NULL CHECK (precio_unitario_aplicado >= 0),
    descuento_unitario      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento_unitario >= 0),
    subtotal                NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: mermas
-- ══════════════════════════════════════════════════════════════
CREATE TABLE mermas (
    id          BIGSERIAL    PRIMARY KEY,
    producto_id BIGINT       NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    lote_id     BIGINT       REFERENCES lotes(id) ON DELETE SET NULL,
    cantidad    INTEGER      NOT NULL CHECK (cantidad > 0),
    motivo      motivo_merma NOT NULL,
    fecha_hora  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    usuario_id  BIGINT       NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    observaciones TEXT
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: cotizaciones_mayoristas
-- ══════════════════════════════════════════════════════════════
CREATE TABLE cotizaciones_mayoristas (
    id               BIGSERIAL         PRIMARY KEY,
    numero_cotizacion VARCHAR(30)      UNIQUE NOT NULL,
    fecha_hora       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    validez_hasta    DATE              NOT NULL,
    cliente_id       BIGINT            NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    usuario_id       BIGINT            NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    subtotal         NUMERIC(12,2)     NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    descuento_total  NUMERIC(12,2)     NOT NULL DEFAULT 0 CHECK (descuento_total >= 0),
    total            NUMERIC(12,2)     NOT NULL CHECK (total >= 0),
    estado           estado_cotizacion NOT NULL DEFAULT 'pendiente',
    stock_reservado  BOOLEAN           NOT NULL DEFAULT FALSE,
    observaciones    TEXT,
    created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: detalle_cotizacion
-- ══════════════════════════════════════════════════════════════
CREATE TABLE detalle_cotizacion (
    id             BIGSERIAL      PRIMARY KEY,
    cotizacion_id  BIGINT         NOT NULL REFERENCES cotizaciones_mayoristas(id) ON DELETE CASCADE,
    producto_id    BIGINT         NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad       INTEGER        NOT NULL CHECK (cantidad > 0),
    precio_acordado NUMERIC(12,2) NOT NULL CHECK (precio_acordado >= 0),
    subtotal       NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: arqueos_caja
-- ══════════════════════════════════════════════════════════════
CREATE TABLE arqueos_caja (
    id                   BIGSERIAL      PRIMARY KEY,
    fecha                DATE           NOT NULL DEFAULT CURRENT_DATE,
    usuario_apertura_id  BIGINT         NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    usuario_cierre_id    BIGINT         REFERENCES usuarios(id) ON DELETE SET NULL,
    hora_apertura        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    hora_cierre          TIMESTAMPTZ,
    monto_inicial        NUMERIC(12,2)  NOT NULL CHECK (monto_inicial >= 0),
    monto_efectivo_contado NUMERIC(12,2) CHECK (monto_efectivo_contado >= 0),
    monto_esperado       NUMERIC(12,2)  CHECK (monto_esperado >= 0),
    diferencia           NUMERIC(12,2),
    estado               estado_arqueo  NOT NULL DEFAULT 'abierto',
    observaciones        TEXT,
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: movimientos_caja
-- ══════════════════════════════════════════════════════════════
CREATE TABLE movimientos_caja (
    id          BIGSERIAL            PRIMARY KEY,
    arqueo_id   BIGINT               NOT NULL REFERENCES arqueos_caja(id) ON DELETE RESTRICT,
    tipo        tipo_movimiento_caja NOT NULL,
    categoria   categoria_movimiento NOT NULL DEFAULT 'otro',
    monto       NUMERIC(12,2)        NOT NULL CHECK (monto > 0),
    motivo      TEXT,
    fecha_hora  TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    usuario_id  BIGINT               NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: pedidos_sugeridos
-- ══════════════════════════════════════════════════════════════
CREATE TABLE pedidos_sugeridos (
    id               BIGSERIAL             PRIMARY KEY,
    proveedor_id     BIGINT                REFERENCES proveedores(id) ON DELETE SET NULL,
    fecha_generacion TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    estado           estado_pedido_sugerido NOT NULL DEFAULT 'pendiente',
    usuario_id       BIGINT                REFERENCES usuarios(id) ON DELETE SET NULL,
    observaciones    TEXT,
    created_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: pedido_sugerido_detalles
-- ══════════════════════════════════════════════════════════════
CREATE TABLE pedido_sugerido_detalles (
    id                  BIGSERIAL PRIMARY KEY,
    pedido_sugerido_id  BIGINT    NOT NULL REFERENCES pedidos_sugeridos(id) ON DELETE CASCADE,
    producto_id         BIGINT    NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad_sugerida   INTEGER   NOT NULL CHECK (cantidad_sugerida > 0),
    cantidad_aprobada   INTEGER   CHECK (cantidad_aprobada IS NULL OR cantidad_aprobada >= 0)
);

-- ══════════════════════════════════════════════════════════════
-- TABLA: alertas
-- ══════════════════════════════════════════════════════════════
CREATE TABLE alertas (
    id               BIGSERIAL        PRIMARY KEY,
    tipo             tipo_alerta      NOT NULL,
    severidad        severidad_alerta NOT NULL DEFAULT 'warning',
    producto_id      BIGINT           REFERENCES productos(id) ON DELETE CASCADE,
    lote_id          BIGINT           REFERENCES lotes(id) ON DELETE CASCADE,
    mensaje          TEXT             NOT NULL,
    fecha_generacion TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    leida            BOOLEAN          NOT NULL DEFAULT FALSE,
    usuario_leyo_id  BIGINT           REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_vista      TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- SECCIÓN 4: ÍNDICES RECOMENDADOS (consultas frecuentes)
-- ------------------------------------------------------------

-- Búsqueda por código de barras (lector) — crítica en caja
CREATE INDEX idx_productos_codigo_barras  ON productos(codigo_barras);
CREATE INDEX idx_productos_sku            ON productos(sku);
CREATE INDEX idx_productos_nombre         ON productos(nombre);
CREATE INDEX idx_productos_activo         ON productos(activo);

-- PEPS: lotes con cantidad_actual > 0 ordenados por vencimiento asc
CREATE INDEX idx_lotes_producto_estado    ON lotes(producto_id, estado)
    WHERE cantidad_actual > 0;
CREATE INDEX idx_lotes_vencimiento        ON lotes(fecha_vencimiento ASC)
    WHERE cantidad_actual > 0 AND estado = 'activo';

-- Ventas por fecha
CREATE INDEX idx_ventas_fecha_hora        ON ventas(fecha_hora DESC);
CREATE INDEX idx_ventas_usuario_fecha     ON ventas(usuario_id, fecha_hora DESC);
CREATE INDEX idx_ventas_estado            ON ventas(estado);

-- Detalle de ventas -> lote_id
CREATE INDEX idx_detalle_ventas_venta     ON detalle_ventas(venta_id);
CREATE INDEX idx_detalle_ventas_lote      ON detalle_ventas(lote_id);
CREATE INDEX idx_detalle_ventas_producto  ON detalle_ventas(producto_id);

-- Pago mixto
CREATE INDEX idx_venta_pagos_venta        ON venta_pagos(venta_id);

-- Alertas sin leer
CREATE INDEX idx_alertas_leida            ON alertas(leida, fecha_generacion DESC)
    WHERE leida = FALSE;
CREATE INDEX idx_alertas_producto         ON alertas(producto_id);
CREATE INDEX idx_alertas_lote             ON alertas(lote_id);

-- Arqueos
CREATE INDEX idx_arqueos_fecha            ON arqueos_caja(fecha DESC);
CREATE INDEX idx_arqueos_estado           ON arqueos_caja(estado);
CREATE INDEX idx_movimientos_arqueo       ON movimientos_caja(arqueo_id);

-- Cotizaciones
CREATE INDEX idx_cotizaciones_cliente     ON cotizaciones_mayoristas(cliente_id, fecha_hora DESC);
CREATE INDEX idx_cotizaciones_estado      ON cotizaciones_mayoristas(estado);

-- Precios volumen
CREATE INDEX idx_precios_volumen_producto ON precios_volumen(producto_id, cantidad_minima)
    WHERE activo = TRUE;

-- Mermas
CREATE INDEX idx_mermas_fecha             ON mermas(fecha_hora DESC);
CREATE INDEX idx_mermas_producto          ON mermas(producto_id);
CREATE INDEX idx_mermas_lote              ON mermas(lote_id);

-- ------------------------------------------------------------
-- SECCIÓN 5: FUNCIONES Y TRIGGERS AUXILIARES
-- ------------------------------------------------------------

-- Trigger automático para updated_at (todas las tablas que lo tienen)
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_categorias_updated_at
    BEFORE UPDATE ON categorias
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_proveedores_updated_at
    BEFORE UPDATE ON proveedores
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_productos_updated_at
    BEFORE UPDATE ON productos
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_precios_volumen_updated_at
    BEFORE UPDATE ON precios_volumen
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_combos_promociones_updated_at
    BEFORE UPDATE ON combos_promociones
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_cotizaciones_mayoristas_updated_at
    BEFORE UPDATE ON cotizaciones_mayoristas
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_arqueos_caja_updated_at
    BEFORE UPDATE ON arqueos_caja
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_pedidos_sugeridos_updated_at
    BEFORE UPDATE ON pedidos_sugeridos
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- ------------------------------------------------------------
-- SECCIÓN 6: VISTAS ÚTILES
-- ------------------------------------------------------------

-- Vista: stock actual por producto (suma de lotes activos con cantidad_actual > 0)
CREATE OR REPLACE VIEW v_stock_productos AS
SELECT
    p.id                         AS producto_id,
    p.sku,
    p.codigo_barras,
    p.nombre,
    p.precio_unitario,
    p.stock_minimo,
    COALESCE(SUM(l.cantidad_actual), 0) AS stock_total,
    MIN(l.fecha_vencimiento)     AS proximo_vencimiento,
    CASE
        WHEN COALESCE(SUM(l.cantidad_actual), 0) <= p.stock_minimo
        THEN 'stock_bajo'
        WHEN MIN(l.fecha_vencimiento) <= CURRENT_DATE + INTERVAL '5 days'
        THEN 'vencimiento_proximo'
        ELSE 'ok'
    END AS estado
FROM productos p
LEFT JOIN lotes l
    ON l.producto_id = p.id
    AND l.estado = 'activo'
    AND l.cantidad_actual > 0
WHERE p.activo = TRUE
GROUP BY p.id, p.sku, p.codigo_barras, p.nombre, p.precio_unitario, p.stock_minimo;

COMMENT ON VIEW v_stock_productos IS 'Stock actual por producto + próximo vencimiento (PEPS)';

-- ------------------------------------------------------------
-- SECCIÓN 7: ESTRATEGIA DE GENERACIÓN DE ALERTAS (RECOMENDACIÓN)
-- ------------------------------------------------------------
--
-- 🔴 NO RECOMIENDO usar TRIGGERS de base de datos para generar alertas.
-- ✅ RECOMIENDO:  Backend (FastAPI) + APScheduler (job programado en Python).
--
-- MOTIVOS:
--  1. FLEXIBILIDAD: Los umbrales (stock ≤ 5 o vencimiento ≤ 5 días) cambian.
--     Con APScheduler basta con editar una variable Python; con triggers hay
--     que ALTER TRIGGER / DROP/CREATE FUNCTION.
--  2. TESTEABILIDAD: Podemos escribir tests unitarios de la función de
--     generación de alertas sin tocar la BD. Con triggers hace falta mockear
--     INSERT/UPDATE reales.
--  3. DEPURACIÓN: Un job Python loguea, envía mails, webhooks, etc. sin
--     esfuerzo. Triggers son caja negra.
--  4. RENDIMIENTO: Los triggers se ejecutan SÍ o SÍ en cada INSERT/UPDATE.
--     Un job cada 5 o 10 minutos tiene costo despreciable.
--  5. IDEMPOTENCIA: El job verifica si la alerta ya existe antes de crearla,
--     evitando duplicados.
--
--  FRECUENCIA SUGERIDA:
--   • Stock bajo        → cada 10 minutos
--   • Vencimiento 5d    → 1 vez por día a las 08:00 hs
--   • Lotes vencidos    → 1 vez por día a las 00:05 hs
--   • Stock negativo    → en línea (al crear detalle_venta) + job cada 5 min
--
-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================

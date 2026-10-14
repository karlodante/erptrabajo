-- ============================================================
-- ARCHIVO:  002_dolibarr.sql
-- MOTOR:    PostgreSQL 15+
-- Integración con Dolibarr ERP. Idempotente (IF NOT EXISTS).
-- El backend también aplica estas sentencias al arrancar
-- (app/services/dolibarr_service.py → asegurar_columnas_dolibarr).
--
-- Las ventas que ya existían quedan con sincronizado_dolibarr = TRUE
-- para NO reenviar el histórico a Dolibarr; las nuevas nacen en FALSE.
-- ============================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS dolibarr_id              BIGINT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dolibarr_stock           NUMERIC(12,3);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dolibarr_tva_tx          NUMERIC(6,3);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dolibarr_sincronizado_en TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_productos_dolibarr_id ON productos (dolibarr_id);

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS sincronizado_dolibarr     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE ventas ALTER COLUMN sincronizado_dolibarr SET DEFAULT FALSE;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS dolibarr_factura_id       BIGINT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS dolibarr_factura_validada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS dolibarr_intentos         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS ultimo_error_dolibarr     TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS dolibarr_sincronizado_en  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_ventas_sincronizado_dolibarr ON ventas (sincronizado_dolibarr);

ALTER TABLE detalle_ventas ADD COLUMN IF NOT EXISTS dolibarr_movimiento_id BIGINT;

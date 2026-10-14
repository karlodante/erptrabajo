import { db } from "./localDb.js";

export const MOCK_PRODUCTOS = db.productos;

export function buscarMockProductoPorCodigo(codigo) {
  const p = MOCK_PRODUCTOS.find(
    (x) => x.codigo_barras === codigo || x.sku === codigo || String(x.id) === codigo,
  );
  return p ? { ...p } : null;
}

export function buscarMockProductos(q) {
  if (!q || q.trim() === "") return { items: MOCK_PRODUCTOS.slice(0, 10), total: MOCK_PRODUCTOS.length };
  const query = q.trim().toLowerCase();
  const items = MOCK_PRODUCTOS.filter(
    (x) =>
      x.nombre.toLowerCase().includes(query) ||
      (x.sku && x.sku.toLowerCase().includes(query)) ||
      (x.codigo_barras && x.codigo_barras.includes(query)),
  );
  return { items, total: items.length };
}

export function obtenerMockPreciosVolumen(productoId) {
  return db.preciosVolumen
    .filter((x) => x.producto_id === Number(productoId) && x.activo !== false)
    .sort((a, b) => a.cantidad_minima - b.cantidad_minima);
}

export const MOCK_PRECIOS_VOLUMEN = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === "then") return undefined;
      const id = Number(prop);
      if (Number.isNaN(id)) return undefined;
      return obtenerMockPreciosVolumen(id);
    },
  },
);

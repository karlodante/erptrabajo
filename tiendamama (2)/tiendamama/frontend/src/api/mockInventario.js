import { MOCK_PRODUCTOS } from "./mockPos.js";
import { db, persist, nextId } from "./localDb.js";

const hoy = new Date();
const sumarDias = (d) => {
  const dt = new Date(hoy);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString();
};
const soloFecha = (iso) => iso.slice(0, 10);

export const MOCK_CATEGORIAS = [
  { id: 1, nombre: "Leches", descripcion: "Leches fluidas y en polvo", activo: true, created_at: new Date().toISOString() },
  { id: 2, nombre: "Quesos", descripcion: "Quesos duros, semiduros, blandos", activo: true, created_at: new Date().toISOString() },
  { id: 3, nombre: "Yogures y Postres", descripcion: "Yogures, flanes, postres", activo: true, created_at: new Date().toISOString() },
  { id: 4, nombre: "Mantecas y Grasas", descripcion: "Manteca, margarina, crema", activo: true, created_at: new Date().toISOString() },
  { id: 5, nombre: "Cremas", descripcion: "Crema de leche, crema pastelera", activo: true, created_at: new Date().toISOString() },
  { id: 6, nombre: "Leches Condensadas", descripcion: "Leche condensada, evaporada", activo: true, created_at: new Date().toISOString() },
  { id: 7, nombre: "Postres Lácteos", descripcion: "Flanes, mousses, dulces de leche", activo: true, created_at: new Date().toISOString() },
  { id: 8, nombre: "Otros Lácteos", descripcion: "Otros productos lácteos varios", activo: true, created_at: new Date().toISOString() },
];

// Sistema nuevo: sin lotes ni mermas de demostración. Se cargan desde la
// pantalla de Inventario ("Nuevo lote" / "Registrar merma") a medida que
// se opera el negocio.
export const MOCK_LOTES = db.lotes;
export const MOCK_MERMAS = db.mermas;
export const MOCK_PRECIOS_VOLUMEN_GLOBAL = {};

function _diasRestantes(vtoStr) {
  const vto = new Date(vtoStr);
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const ms = vto.getTime() - h.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function buscarMockProductos(q = "", filtros = {}) {
  let items = MOCK_PRODUCTOS.map((p) => {
    const lotesProd = MOCK_LOTES.filter(
      (l) => l.producto_id === p.id && l.estado === "activo" && l.cantidad_actual > 0,
    );
    const stock = lotesProd.reduce((s, l) => s + l.cantidad_actual, 0);
    const vtos = lotesProd.map((l) => l.fecha_vencimiento).sort();
    const proximo = vtos[0] ?? p.proximo_vencimiento;
    let estado = "ok";
    const dias = proximo ? _diasRestantes(proximo) : 999;
    if (stock <= p.stock_minimo) estado = "stock_bajo";
    else if (dias <= 5) estado = "vencimiento_proximo";
    return { ...p, stock_total: stock, proximo_vencimiento: proximo, estado };
  });

  if (q && q.trim()) {
    const query = q.trim().toLowerCase();
    items = items.filter(
      (x) =>
        x.nombre.toLowerCase().includes(query) ||
        (x.sku && x.sku.toLowerCase().includes(query)) ||
        (x.codigo_barras && x.codigo_barras.includes(query)),
    );
  }
  if (filtros.categoria_id) {
    items = items.filter((p) => p.categoria_id === Number(filtros.categoria_id));
  }
  if (filtros.estado_stock === "stock_bajo") {
    items = items.filter((p) => p.estado === "stock_bajo");
  } else if (filtros.estado_stock === "vencimiento_proximo") {
    items = items.filter((p) => p.estado === "vencimiento_proximo");
  } else if (filtros.estado_stock === "fuera_stock") {
    items = items.filter((p) => p.stock_total === 0);
  }
  if (filtros.solo_a_vencer) {
    items = items.filter((p) => {
      if (!p.proximo_vencimiento) return false;
      return _diasRestantes(p.proximo_vencimiento) <= 7;
    });
  }
  return { items, total: items.length, page: 1, perPage: 50, total_pages: 1 };
}

export function obtenerMockProducto(id) {
  const p = MOCK_PRODUCTOS.find((x) => x.id === Number(id));
  if (!p) return null;
  return { ...p, precios_volumen: MOCK_PRECIOS_VOLUMEN_GLOBAL[id] ?? [] };
}

export function listarMockCategorias() {
  return MOCK_CATEGORIAS.filter((c) => c.activo);
}

export function listarMockLotes(params = {}) {
  let lotes = [...MOCK_LOTES];
  if (params.producto_id) {
    lotes = lotes.filter((l) => l.producto_id === Number(params.producto_id));
  }
  if (params.soloActivos || params.solo_activos) {
    lotes = lotes.filter((l) => l.estado === "activo" && l.cantidad_actual > 0);
  }
  if (params.aVencerEnDias != null || params.a_vencer_en_dias != null) {
    const d = Number(params.aVencerEnDias ?? params.a_vencer_en_dias);
    lotes = lotes.filter((l) => {
      if (l.estado !== "activo") return false;
      return _diasRestantes(l.fecha_vencimiento) <= d;
    });
  }
  lotes.sort((a, b) => {
    const va = new Date(a.fecha_vencimiento).getTime();
    const vb = new Date(b.fecha_vencimiento).getTime();
    if (va !== vb) return va - vb;
    return new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime();
  });
  return lotes;
}

export function lotesMockPorProducto(productoId) {
  return listarMockLotes({ producto_id: productoId, soloActivos: false });
}

export function listarMockMermas(params = {}) {
  let m = [...MOCK_MERMAS];
  if (params.producto_id) m = m.filter((x) => x.producto_id === Number(params.producto_id));
  if (params.motivo) m = m.filter((x) => x.motivo === params.motivo);
  m.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
  return m;
}

export function crearMockLote(payload) {
  const id = nextId("lote");
  const lote = {
    id,
    producto_id: payload.producto_id,
    proveedor_id: payload.proveedor_id ?? null,
    numero_lote: payload.numero_lote ?? `L-${id}`,
    cantidad_inicial: payload.cantidad_inicial,
    cantidad_actual: payload.cantidad_actual ?? payload.cantidad_inicial,
    costo_unitario: Number(payload.costo_unitario ?? 0),
    fecha_ingreso: payload.fecha_ingreso ?? new Date().toISOString(),
    fecha_vencimiento: payload.fecha_vencimiento,
    estado: "activo",
    created_at: new Date().toISOString(),
  };
  MOCK_LOTES.push(lote);
  persist();
  return lote;
}

export function crearMockProducto(payload) {
  const id = nextId("producto");
  const p = {
    id,
    sku: payload.sku,
    codigo_barras: payload.codigo_barras ?? null,
    nombre: payload.nombre,
    categoria_id: payload.categoria_id,
    unidad_medida: payload.unidad_medida ?? "unidad",
    precio_unitario: parseFloat(Number(payload.precio_unitario).toFixed(2)),
    stock_minimo: payload.stock_minimo ?? 5,
    activo: payload.activo ?? true,
    creado_por: 1,
    created_at: new Date().toISOString(),
    stock_total: 0,
    proximo_vencimiento: null,
    estado: "ok",
  };
  MOCK_PRODUCTOS.push(p);
  persist();
  return p;
}

export function crearMockMerma(payload) {
  const id = nextId("merma");
  const m = {
    id,
    producto_id: payload.producto_id,
    lote_id: payload.lote_id ?? null,
    cantidad: payload.cantidad,
    motivo: payload.motivo,
    observaciones: payload.observaciones ?? null,
    fecha_hora: new Date().toISOString(),
    usuario_id: 2,
  };
  if (m.lote_id) {
    const l = MOCK_LOTES.find((x) => x.id === m.lote_id);
    if (l) l.cantidad_actual = Math.max(0, l.cantidad_actual - m.cantidad);
  } else {
    const lotesProd = MOCK_LOTES
      .filter((l) => l.producto_id === m.producto_id && l.estado === "activo" && l.cantidad_actual > 0)
      .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));
    let restante = m.cantidad;
    for (const l of lotesProd) {
      if (restante <= 0) break;
      const take = Math.min(l.cantidad_actual, restante);
      l.cantidad_actual -= take;
      restante -= take;
      m.lote_id = l.id;
    }
  }
  MOCK_MERMAS.push(m);
  persist();
  return m;
}

export function actualizarMockProducto(id, payload) {
  const p = MOCK_PRODUCTOS.find((x) => x.id === Number(id));
  if (!p) return null;
  Object.assign(p, payload);
  persist();
  return p;
}

export function consumirStockMock(productoId, cantidad) {
  let restante = Number(cantidad) || 0;
  const lotesProd = MOCK_LOTES
    .filter((l) => l.producto_id === Number(productoId) && l.estado === "activo" && l.cantidad_actual > 0)
    .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento) || a.id - b.id);
  for (const l of lotesProd) {
    if (restante <= 0) break;
    const take = Math.min(l.cantidad_actual, restante);
    l.cantidad_actual -= take;
    restante -= take;
    if (l.cantidad_actual <= 0) l.estado = "agotado";
  }
  persist();
  return restante;
}

export function obtenerMockLotesEnRiesgo(dias = 5) {
  const lotes = MOCK_LOTES.filter(
    (l) =>
      l.estado === "activo" &&
      l.cantidad_actual > 0 &&
      _diasRestantes(l.fecha_vencimiento) <= dias,
  ).map((l) => {
    const prod = MOCK_PRODUCTOS.find((p) => p.id === l.producto_id);
    return {
      ...l,
      dias_restantes: _diasRestantes(l.fecha_vencimiento),
      producto_nombre: prod?.nombre ?? `Producto #${l.producto_id}`,
      categoria_id: prod?.categoria_id,
    };
  });
  return lotes.sort((a, b) => a.dias_restantes - b.dias_restantes);
}

export function diasRestantes(vtoStr) {
  return _diasRestantes(vtoStr);
}

export function borrarMockProducto(id) {
  const idx = MOCK_PRODUCTOS.findIndex((x) => x.id === Number(id));
  if (idx === -1) return null;
  const borrado = MOCK_PRODUCTOS.splice(idx, 1)[0];
  // Borrar lotes asociados
  const lotesIdx = MOCK_LOTES.filter((l) => l.producto_id === Number(id));
  lotesIdx.forEach((l) => {
    const lIdx = MOCK_LOTES.indexOf(l);
    if (lIdx !== -1) MOCK_LOTES.splice(lIdx, 1);
  });
  persist();
  return borrado;
}

export function borrarMockLote(id) {
  const idx = MOCK_LOTES.findIndex((x) => x.id === Number(id));
  if (idx === -1) return null;
  const borrado = MOCK_LOTES.splice(idx, 1)[0];
  persist();
  return borrado;
}
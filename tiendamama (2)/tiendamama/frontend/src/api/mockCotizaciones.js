import { MOCK_PRODUCTOS, obtenerMockPreciosVolumen } from "./mockPos.js";
import { MOCK_LOTES } from "./mockInventario.js";
import { db, persist, nextId } from "./localDb.js";

const hoy = new Date();
const soloFecha = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
const sumarDias = (d) => {
  const dt = new Date(hoy);
  dt.setDate(dt.getDate() + d);
  return dt;
};
const isoConHora = (d) => d.toISOString();

export const MOCK_CLIENTES = db.clientes;

const NUM_COT = (d, idx) => {
  const s = d.toISOString().replace(/[-:T.]/g, "").slice(0, 14) + String(100 + idx);
  return `COT-${s.slice(0, 8)}-${s.slice(8, 15)}`;
};

const _COT_MUT = db.cotizaciones;

export function precioSugeridoPorCantidad(productoId, cantidad) {
  const prod = MOCK_PRODUCTOS.find((p) => p.id === Number(productoId));
  if (!prod) return null;
  const pv = obtenerMockPreciosVolumen(productoId).slice().sort((a, b) => b.cantidad_minima - a.cantidad_minima);
  for (const e of pv) {
    if (e.activo && e.cantidad_minima <= Number(cantidad)) return Number(e.precio_especial);
  }
  return Number(prod.precio_unitario);
}

export function stockDisponibleMock(productoId, { excluirReservas = true } = {}) {
  const lotes = MOCK_LOTES.filter((l) => l.producto_id === Number(productoId) && l.estado === "activo" && l.cantidad_actual > 0);
  let stock = lotes.reduce((s, l) => s + l.cantidad_actual, 0);
  if (excluirReservas) {
    for (const c of _COT_MUT) {
      if (c.stock_reservado && c.estado !== "cancelada" && c.estado !== "vencida") {
        for (const it of c.items) {
          if (it.producto_id === Number(productoId)) stock -= it.cantidad;
        }
      }
    }
  }
  return Math.max(0, stock);
}

export function reservasPorProducto() {
  const m = new Map();
  for (const c of _COT_MUT) {
    if (!(c.stock_reservado && c.estado !== "cancelada" && c.estado !== "vencida")) continue;
    for (const it of c.items) {
      m.set(it.producto_id, (m.get(it.producto_id) || 0) + it.cantidad);
    }
  }
  return m;
}

function _enriquecer(c) {
  const cliente = MOCK_CLIENTES.find((x) => x.id === c.cliente_id);
  const items = (c.items || []).map((it) => {
    const p = MOCK_PRODUCTOS.find((x) => x.id === it.producto_id);
    return {
      ...it,
      producto_nombre: p?.nombre ?? "",
      sku: p?.sku ?? "",
      precio_original: Number(p?.precio_unitario ?? it.precio_acordado),
    };
  });
  return {
    ...c,
    cliente_nombre: cliente?.nombre_rs ?? `Cliente #${c.cliente_id}`,
    cliente,
    detalle_cotizacion: items,
  };
}

export function listarMockCotizaciones(params = {}) {
  let rows = _COT_MUT.map(_enriquecer);
  if (params.estado) {
    rows = rows.filter((r) => r.estado === params.estado);
  }
  if (params.q) {
    const q = String(params.q).toLowerCase().trim();
    rows = rows.filter((r) =>
      r.numero_cotizacion.toLowerCase().includes(q) ||
      r.cliente_nombre.toLowerCase().includes(q),
    );
  }
  if (params.cliente_id) {
    rows = rows.filter((r) => r.cliente_id === Number(params.cliente_id));
  }
  if (params.fecha_desde) {
    const d = new Date(String(params.fecha_desde).slice(0, 10));
    rows = rows.filter((r) => new Date(r.fecha_hora) >= d);
  }
  if (params.fecha_hasta) {
    const d = new Date(String(params.fecha_hasta).slice(0, 10));
    d.setDate(d.getDate() + 1);
    rows = rows.filter((r) => new Date(r.fecha_hora) < d);
  }
  rows.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
  const page = Number(params.page ?? 1);
  const perPage = Number(params.perPage ?? params.per_page ?? 50);
  const total = rows.length;
  const start = (page - 1) * perPage;
  return { items: rows.slice(start, start + perPage), total, page, perPage, total_pages: Math.ceil(total / perPage) || 0 };
}

export function obtenerMockCotizacion(id) {
  const c = _COT_MUT.find((x) => x.id === Number(id));
  if (!c) return null;
  return _enriquecer(c);
}

export function crearMockCotizacion(payload) {
  const items = (payload.items || []).map((it, i) => {
    const p = MOCK_PRODUCTOS.find((x) => x.id === Number(it.producto_id));
    const pa = Number(it.precio_acordado);
    const cant = Number(it.cantidad);
    return {
      id: 9000 + _COT_MUT.length * 10 + i,
      producto_id: Number(it.producto_id),
      cantidad: cant,
      precio_acordado: pa,
      subtotal: Math.round(pa * cant * 100) / 100,
      producto_nombre: p?.nombre ?? "",
      sku: p?.sku ?? "",
      precio_original: Number(p?.precio_unitario ?? pa),
    };
  });
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const desc = Number(payload.descuento_total ?? 0);
  const id = nextId("cotizacion");
  const now = new Date();
  const c = {
    id,
    numero_cotizacion: NUM_COT(now, id),
    fecha_hora: isoConHora(now),
    validez_hasta: String(payload.validez_hasta).slice(0, 10),
    cliente_id: Number(payload.cliente_id),
    usuario_id: 1,
    subtotal: Math.round(subtotal * 100) / 100,
    descuento_total: Math.round(desc * 100) / 100,
    total: Math.round((subtotal - desc) * 100) / 100,
    estado: "pendiente",
    stock_reservado: !!payload.stock_reservado,
    observaciones: payload.observaciones ?? null,
    created_at: isoConHora(now),
    updated_at: isoConHora(now),
    items: items.map(({ producto_nombre, sku, precio_original, ...x }) => x),
  };
  _COT_MUT.push(c);
  persist();
  return _enriquecer(c);
}

export function actualizarMockCotizacion(id, payload) {
  const idx = _COT_MUT.findIndex((x) => x.id === Number(id));
  if (idx < 0) return null;
  const c = _COT_MUT[idx];
  const data = typeof payload?.model_dump === "function" ? payload.model_dump(exclude_unset) : payload;
  Object.assign(c, data);
  if (data.descuento_total != null) {
    c.total = Math.max(0, Math.round((c.subtotal - Number(data.descuento_total)) * 100) / 100);
  }
  c.updated_at = isoConHora(new Date());
  persist();
  return _enriquecer(c);
}

export function confirmarMockCotizacion(id) {
  const idx = _COT_MUT.findIndex((x) => x.id === Number(id));
  if (idx < 0) return null;
  const c = _COT_MUT[idx];
  const hoyDate = soloFecha(new Date());
  if (c.validez_hasta < hoyDate) {
    c.estado = "vencida";
    persist();
    return _enriquecer(c);
  }
  for (const it of c.items) {
    let pend = it.cantidad;
    const lotesProd = MOCK_LOTES
      .filter((l) => l.producto_id === it.producto_id && l.estado === "activo" && l.cantidad_actual > 0)
      .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento) || a.id - b.id);
    for (const lote of lotesProd) {
      if (pend <= 0) break;
      const tomar = Math.min(pend, lote.cantidad_actual);
      lote.cantidad_actual -= tomar;
      pend -= tomar;
      if (lote.cantidad_actual === 0) lote.estado = "agotado";
    }
  }
  c.estado = "confirmada";
  c.updated_at = isoConHora(new Date());
  persist();
  return _enriquecer(c);
}

export function cancelarMockCotizacion(id) {
  return actualizarMockCotizacion(id, { estado: "cancelada" });
}

export function clientesMock() {
  return MOCK_CLIENTES.filter((c) => c.activo);
}

export function buscarMockClientes(q = "") {
  if (!q) return clientesMock();
  const s = q.toLowerCase().trim();
  return clientesMock().filter(
    (c) =>
      c.nombre_rs.toLowerCase().includes(s) ||
      (c.dni_cuit || "").includes(s) ||
      (c.telefono || "").includes(s),
  );
}

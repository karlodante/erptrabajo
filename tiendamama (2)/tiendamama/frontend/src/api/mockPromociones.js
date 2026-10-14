import { MOCK_PRODUCTOS } from "./mockPos.js";
import { MOCK_LOTES, diasRestantes as _diasRestantes } from "./mockInventario.js";
import { db, persist, nextId } from "./localDb.js";

export const MOCK_PRECIOS_VOLUMEN = db.preciosVolumen;

const hoy = new Date();
const sumarDias = (d) => {
  const dt = new Date(hoy);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
};

export const MOCK_COMBOS = db.combos;

// Fórmula sugerencia remate:
// -5d o menos: 0%  (aún normal)
//  5d restante: 15%
//  3d restante: 30%
//  1d restante: 45%
//  0d: 55%
//  <0: 70% (ya vencido - dar aviso!)
export function sugerirDescuentoRemate(diasRestantes) {
  if (diasRestantes < 0) return { porcentaje: 70, etiqueta: "Vencido - remate final", tono: "danger" };
  if (diasRestantes === 0) return { porcentaje: 55, etiqueta: "Vence HOY - sugerencia", tono: "danger" };
  if (diasRestantes === 1) return { porcentaje: 45, etiqueta: "Falta 1 día", tono: "danger" };
  if (diasRestantes <= 2) return { porcentaje: 35, etiqueta: `${diasRestantes} días - urgente`, tono: "danger" };
  if (diasRestantes <= 3) return { porcentaje: 30, etiqueta: `${diasRestantes} días`, tono: "warning" };
  if (diasRestantes <= 4) return { porcentaje: 20, etiqueta: `${diasRestantes} días`, tono: "warning" };
  if (diasRestantes <= 5) return { porcentaje: 15, etiqueta: `${diasRestantes} días - prevención`, tono: "info" };
  return { porcentaje: 0, etiqueta: "Aún con margen", tono: "success" };
}

export function listarRematesSugeridos() {
  const lotes = MOCK_LOTES.filter(
    (l) => l.estado === "activo" && l.cantidad_actual > 0 && _diasRestantes(l.fecha_vencimiento) <= 7,
  ).map((l) => {
    const prod = MOCK_PRODUCTOS.find((p) => p.id === l.producto_id);
    const dias = _diasRestantes(l.fecha_vencimiento);
    const sug = sugerirDescuentoRemate(dias);
    const precioOri = Number(prod?.precio_unitario ?? 0);
    const precioFinal = precioOri * (1 - sug.porcentaje / 100);
    const perdidaSinRemate = l.cantidad_actual * precioOri;
    const recuperoConRemate = l.cantidad_actual * precioFinal;
    const remateAplicado = MOCK_COMBOS.find(
      (c) => c.es_remate && c.lote_id === l.id && c.activo,
    );
    return {
      ...l,
      dias_restantes: dias,
      producto: prod,
      producto_nombre: prod?.nombre ?? "",
      sugerencia: sug,
      precio_original: precioOri,
      precio_sugerido: Math.round(precioFinal * 100) / 100,
      ahorro_por_unidad: Math.round((precioOri - precioFinal) * 100) / 100,
      recupero_estimado: Math.round(recuperoConRemate * 100) / 100,
      perdida_si_vence: Math.round(perdidaSinRemate * 100) / 100,
      ahorro_evitado: Math.round((perdidaSinRemate - recuperoConRemate) * -1 * 100) / 100,
      remate_aplicado: !!remateAplicado,
      remate_id: remateAplicado?.id,
      remate_pct_usado: remateAplicado?.valor,
    };
  });
  return lotes.sort((a, b) => a.dias_restantes - b.dias_restantes);
}

export function listarPreciosVolumenConProductos() {
  const rows = [];
  const porProd = new Map();
  for (const pv of MOCK_PRECIOS_VOLUMEN.filter((x) => x.activo)) {
    if (!porProd.has(pv.producto_id)) porProd.set(pv.producto_id, []);
    porProd.get(pv.producto_id).push(pv);
  }
  for (const [prodId, precios] of porProd.entries()) {
    const prod = MOCK_PRODUCTOS.find((p) => p.id === prodId);
    if (!prod) continue;
    precios
      .sort((a, b) => a.cantidad_minima - b.cantidad_minima)
      .forEach((pv, idx) => {
        rows.push({
          _groupKey: prodId,
          _groupIdx: idx,
          _groupTotal: precios.length,
          id: pv.id,
          producto_id: prodId,
          producto: prod,
          cantidad_minima: pv.cantidad_minima,
          precio_especial: Number(pv.precio_especial),
          ahorro_unitario: Number(prod.precio_unitario) - Number(pv.precio_especial),
          activo: pv.activo,
        });
      });
  }
  return rows;
}

export function preciosVolumenPorProducto(productoId) {
  return MOCK_PRECIOS_VOLUMEN
    .filter((x) => x.producto_id === Number(productoId))
    .sort((a, b) => a.cantidad_minima - b.cantidad_minima);
}

export function agregarMockPrecioVolumen(productoId, payload) {
  const existe = MOCK_PRECIOS_VOLUMEN.find(
    (x) => x.producto_id === Number(productoId) && x.cantidad_minima === Number(payload.cantidad_minima),
  );
  if (existe) {
    Object.assign(existe, {
      precio_especial: Number(payload.precio_especial),
      activo: payload.activo !== undefined ? !!payload.activo : existe.activo,
    });
    persist();
    return existe;
  }
  const pv = {
    id: nextId("precioVolumen"),
    producto_id: Number(productoId),
    cantidad_minima: Number(payload.cantidad_minima),
    precio_especial: Number(payload.precio_especial),
    activo: payload.activo !== undefined ? !!payload.activo : true,
  };
  MOCK_PRECIOS_VOLUMEN.push(pv);
  persist();
  return pv;
}

export function actualizarMockPrecioVolumen(productoId, pvId, payload) {
  const pv = MOCK_PRECIOS_VOLUMEN.find((x) => x.id === Number(pvId) && x.producto_id === Number(productoId));
  if (!pv) return null;
  if (payload.cantidad_minima !== undefined) pv.cantidad_minima = Number(payload.cantidad_minima);
  if (payload.precio_especial !== undefined) pv.precio_especial = Number(payload.precio_especial);
  if (payload.activo !== undefined) pv.activo = !!payload.activo;
  persist();
  return pv;
}

export function listarMockCombos(params = {}) {
  let combos = [...MOCK_COMBOS];
  if (params.soloActivos || params.activo === true || params.activo === "true") {
    combos = combos.filter((c) => c.activo);
  }
  if (params.tipo) combos = combos.filter((c) => c.tipo === params.tipo);
  if (params.q && params.q.trim()) {
    const q = params.q.trim().toLowerCase();
    combos = combos.filter((c) => c.nombre.toLowerCase().includes(q) || (c.descripcion ?? "").toLowerCase().includes(q));
  }
  combos = combos.map((c) => enriquecerCombo(c));
  return { items: combos, total: combos.length, page: 1, perPage: 50, total_pages: 1 };
}

function enriquecerCombo(c) {
  let precioNormal = 0;
  const detalles = (c.detalles || []).map((d) => {
    const p = MOCK_PRODUCTOS.find((x) => x.id === d.producto_id);
    precioNormal += (p ? Number(p.precio_unitario) : 0) * d.cantidad;
    return {
      ...d,
      producto_nombre: p?.nombre ?? `Producto #${d.producto_id}`,
      precio_unitario: p ? Number(p.precio_unitario) : 0,
    };
  });
  let precioFinal = precioNormal;
  if (c.tipo === "precio_fijo") precioFinal = Number(c.valor);
  else if (c.tipo === "descuento_porcentual") precioFinal = Math.round(precioNormal * (1 - Number(c.valor) / 100) * 100) / 100;
  const ahorroAbs = precioNormal - precioFinal;
  const ahorroPct = precioNormal > 0 ? Math.round((ahorroAbs / precioNormal) * 100) : 0;
  return { ...c, detalles, precio_original: precioNormal, precio_final: precioFinal, ahorro_absoluto: ahorroAbs, ahorro_porcentual: ahorroPct };
}

export function obtenerMockCombo(id) {
  const c = MOCK_COMBOS.find((x) => x.id === Number(id));
  return c ? enriquecerCombo(c) : null;
}

export function crearMockCombo(payload) {
  const id = nextId("combo");
  const nuevo = {
    id,
    nombre: payload.nombre,
    descripcion: payload.descripcion ?? null,
    tipo: payload.tipo,
    valor: payload.valor != null ? Number(payload.valor) : null,
    fecha_inicio: payload.fecha_inicio,
    fecha_fin: payload.fecha_fin ?? null,
    activo: payload.activo !== undefined ? !!payload.activo : true,
    es_remate: !!payload.es_remate,
    lote_id: payload.lote_id ?? null,
    detalles: (payload.detalles || []).map((d, i) => ({
      id: id * 10 + i + 1,
      combo_id: id,
      producto_id: d.producto_id,
      cantidad: d.cantidad,
    })),
  };
  MOCK_COMBOS.push(nuevo);
  persist();
  return enriquecerCombo(nuevo);
}

export function actualizarMockCombo(id, payload) {
  const c = MOCK_COMBOS.find((x) => x.id === Number(id));
  if (!c) return null;
  for (const k of Object.keys(payload)) {
    if (k === "detalles") {
      c.detalles = payload.detalles.map((d, i) => ({
        id: d.id ?? c.id * 100 + i + 1,
        combo_id: c.id,
        producto_id: d.producto_id,
        cantidad: d.cantidad,
      }));
    } else if (payload[k] !== undefined) {
      c[k] = payload[k];
    }
  }
  persist();
  return enriquecerCombo(c);
}

export function diasRestantesMock(vto) { return _diasRestantes(vto); }

export const PRODUCTOS_MOCK = MOCK_PRODUCTOS;

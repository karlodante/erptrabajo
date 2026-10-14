import http from "./http.js";

export async function arqueoAbierto() {
  try {
    const { data } = await http.get("/caja/abierto");
    return data;
  } catch (err) {
    return null;
  }
}

export async function listarArqueos(params = {}) {
  const q = {};
  if (params.fechaDesde || params.fecha_desde) q.fechaDesde = params.fechaDesde || params.fecha_desde;
  if (params.fechaHasta || params.fecha_hasta) q.fechaHasta = params.fechaHasta || params.fecha_hasta;
  if (params.soloAbiertos || params.solo_abiertos) q.soloAbiertos = true;
  const { data } = await http.get("/caja", { params: q });
  return data;
}

export async function arqueoTotales(arqueoId) {
  const { data } = await http.get(`/caja/${arqueoId}/totales`);
  return data;
}

export async function abrirArqueo(payload) {
  const { data } = await http.post("/caja/abrir", {
    monto_inicial: Number(payload.monto_inicial ?? payload.montoInicial),
    fecha: payload.fecha ?? undefined,
  });
  return data;
}

export async function cerrarArqueo(arqueoId, payload) {
  const { data } = await http.post(`/caja/${arqueoId}/cerrar`, {
    monto_efectivo_contado: Number(payload.monto_efectivo_contado ?? payload.montoEfectivoContado),
    observaciones: payload.observaciones ?? null,
  });
  return data;
}

export async function listarMovimientos(params = {}) {
  const q = {};
  if (params.arqueo_id || params.arqueoId) q.arqueo_id = params.arqueo_id ?? params.arqueoId;
  if (params.tipo) q.tipo = params.tipo;
  const { data } = await http.get("/caja/movimientos", { params: q });
  return data;
}

export async function nuevoMovimiento(payload) {
  const { data } = await http.post("/caja/movimientos", {
    tipo: payload.tipo,
    categoria: payload.categoria ?? "otro",
    monto: Number(payload.monto),
    motivo: payload.motivo ?? null,
  });
  return data;
}

export async function listarVentas(params = {}) {
  const q = { ...params };
  if (q.fechaDesde) q.fechaDesde = String(q.fechaDesde).slice(0, 10);
  if (q.fechaHasta) q.fechaHasta = String(q.fechaHasta).slice(0, 10);
  const { data } = await http.get("/ventas", { params: q });
  return data;
}

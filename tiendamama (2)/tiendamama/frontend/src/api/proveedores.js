import http from "./http.js";

export async function listarProveedores(params = {}) {
  const q = {};
  if (params.q) q.q = params.q;
  if (params.soloActivos !== undefined) q.soloActivos = !!params.soloActivos;
  const { data } = await http.get("/proveedores", { params: q });
  return data;
}

export async function obtenerProveedor(id) {
  const { data } = await http.get(`/proveedores/${id}`);
  return data;
}

export async function crearProveedor(payload) {
  const { data } = await http.post("/proveedores", payload);
  return data;
}

export async function actualizarProveedor(id, payload) {
  const { data } = await http.patch(`/proveedores/${id}`, payload);
  return data;
}

export async function listarSugerenciasProveedor(params = {}) {
  const q = {};
  if (params.proveedor_id) q.proveedor_id = params.proveedor_id;
  if (params.umbral_pct !== undefined) q.umbral_pct = params.umbral_pct;
  const { data } = await http.get("/proveedores/pedidos-sugeridos", { params: q });
  return data;
}

export async function listarPedidosSugeridos(params = {}) {
  const q = { ...params };
  const { data } = await http.get("/pedidos-sugeridos", { params: q });
  return data;
}

export async function obtenerPedidoSugerido(id) {
  const { data } = await http.get(`/pedidos-sugeridos/${id}`);
  return data;
}

export async function generarPedidoSugerido(payload) {
  const body = {
    proveedor_id: payload.proveedor_id ?? null,
    detalles: (payload.detalles || []).map((d) => ({
      producto_id: Number(d.producto_id),
      cantidad_sugerida: Number(d.cantidad_sugerida),
      cantidad_aprobada: d.cantidad_aprobada != null ? Number(d.cantidad_aprobada) : null,
    })),
    observaciones: payload.observaciones ?? null,
    estado: payload.estado ?? "pendiente",
  };
  const { data } = await http.post("/pedidos-sugeridos", body);
  return data;
}

export async function actualizarPedidoSugerido(id, payload) {
  const { data } = await http.patch(`/pedidos-sugeridos/${id}`, payload);
  return data;
}

export async function marcarPedidoEnviado(id) {
  return actualizarPedidoSugerido(id, { estado: "enviado" });
}

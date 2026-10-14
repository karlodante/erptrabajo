import http from "./http.js";

export async function listarCotizaciones(params = {}) {
  const query = { ...params };
  if (query.fecha_desde) query.fecha_desde = String(query.fecha_desde).slice(0, 10);
  if (query.fecha_hasta) query.fecha_hasta = String(query.fecha_hasta).slice(0, 10);
  const { data } = await http.get("/cotizaciones-mayoristas", { params: query });
  return data;
}

export async function obtenerCotizacion(id) {
  const { data } = await http.get(`/cotizaciones-mayoristas/${id}`);
  return data;
}

export async function crearCotizacion(payload) {
  const items = (payload.items || []).map((i) => ({
    producto_id: i.producto_id,
    cantidad: Number(i.cantidad),
    precio_acordado: Number(i.precio_acordado),
  }));
  const body = {
    validez_hasta: String(payload.validez_hasta).slice(0, 10),
    cliente_id: Number(payload.cliente_id),
    items,
    descuento_total: Number(payload.descuento_total ?? 0),
    stock_reservado: !!payload.stock_reservado,
    observaciones: payload.observaciones ?? null,
  };
  const { data } = await http.post("/cotizaciones-mayoristas", body);
  return data;
}

export async function actualizarCotizacion(id, payload) {
  const { data } = await http.patch(`/cotizaciones-mayoristas/${id}`, payload);
  return data;
}

export async function confirmarCotizacion(id) {
  const { data } = await http.post(`/cotizaciones-mayoristas/${id}/confirmar`);
  return data;
}

export async function cancelarCotizacion(id) {
  return actualizarCotizacion(id, { estado: "cancelada" });
}

export async function crearCliente(payload) {
  const { data } = await http.post("/clientes", payload);
  return data;
}

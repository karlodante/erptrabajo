import http from "./http.js";

export async function listarProductos(params = {}) {
  const { data } = await http.get("/productos", { params });
  return data;
}

export async function obtenerProducto(id) {
  const { data } = await http.get(`/productos/${id}`);
  return data;
}

export async function listarCategorias(params = {}) {
  const { data } = await http.get("/productos/categorias", { params });
  return data;
}

export async function crearProducto(payload) {
  const { data } = await http.post("/productos", payload);
  return data;
}

export async function actualizarProducto(id, payload) {
  const { data } = await http.patch(`/productos/${id}`, payload);
  return data;
}

export async function listarLotes(params = {}) {
  const { data } = await http.get("/lotes", { params });
  return data;
}

export async function obtenerLote(id) {
  const { data } = await http.get(`/lotes/${id}`);
  return data;
}

export async function crearLote(payload) {
  const { data } = await http.post("/lotes", payload);
  return data;
}

export async function actualizarLote(id, payload) {
  const { data } = await http.patch(`/lotes/${id}`, payload);
  return data;
}

export async function listarMermas(params = {}) {
  const { data } = await http.get("/lotes/mermas", { params });
  return data;
}

export async function crearMerma(payload) {
  const { data } = await http.post("/lotes/mermas", payload);
  return data;
}

export async function crearCategoria(payload) {
  const { data } = await http.post("/productos/categorias", payload);
  return data;
}

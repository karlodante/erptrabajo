import http from "./http.js";

export async function buscarProductoPorCodigo(codigo) {
  try {
    const { data } = await http.get(`/productos/por-codigo/${encodeURIComponent(codigo)}`);
    return data;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function buscarProductos(q, { page = 1, perPage = 20 } = {}) {
  const { data } = await http.get("/productos", {
    params: { q, page, perPage, soloActivos: true },
  });
  return data;
}

export async function obtenerPreciosVolumen(productoId) {
  try {
    const { data } = await http.get(`/productos/${productoId}/precios-volumen`);
    return data;
  } catch (err) {
    if (err?.response?.status === 404) return [];
    throw err;
  }
}

export async function crearVenta(payload) {
  const { data } = await http.post("/ventas", payload);
  return data;
}

export async function estadoCajaAbierto() {
  try {
    const { data } = await http.get("/caja/abierto");
    return data;
  } catch (err) {
    return null;
  }
}

export async function abrirCaja(payload) {
  const { data } = await http.post("/caja/abrir", payload);
  return data;
}

export async function obtenerVenta(ventaId) {
  const { data } = await http.get(`/ventas/${ventaId}`);
  return data;
}

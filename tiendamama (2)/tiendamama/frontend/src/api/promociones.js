import http from "./http.js";

export async function listarPreciosVolumenTodos(params = {}) {
  if (params.producto_id) {
    return listarPreciosVolumenPorProducto(params.producto_id);
  }
  const { data } = await http.get("/productos/precios-volumen", { params }).catch(async () => {
    const { data } = await http.get("/productos", { params: { ...params, perPage: 200, page: 1 } });
    return { data: data ?? { items: [] } };
  });
  return data;
}

export async function listarPreciosVolumenPorProducto(productoId) {
  const { data } = await http.get(`/productos/${productoId}/precios-volumen`);
  return Array.isArray(data) ? data : [];
}

export async function agregarPrecioVolumen(productoId, payload) {
  const { data } = await http.post(`/productos/${productoId}/precios-volumen`, payload);
  return data;
}

export async function actualizarPrecioVolumen(productoId, pvId, payload) {
  const { data } = await http.patch(`/productos/${productoId}/precios-volumen/${pvId}`, payload);
  return data;
}

export async function listarCombos(params = {}) {
  try {
    const { data } = await http.get("/combos", { params });
    return data;
  } catch (err) {
    return { items: [], total: 0, page: 1, perPage: 50 };
  }
}

export async function obtenerCombo(id) {
  const { data } = await http.get(`/combos/${id}`);
  return data;
}

export async function crearCombo(payload) {
  try {
    const { data } = await http.post("/combos", payload);
    return data;
  } catch (err) {
    return null;
  }
}

export async function actualizarCombo(id, payload) {
  try {
    const { data } = await http.patch(`/combos/${id}`, payload);
    return data;
  } catch (err) {
    return null;
  }
}

export async function toggleActivoCombo(id, activo) {
  try {
    return await actualizarCombo(id, { activo });
  } catch (err) {
    return null;
  }
}

export async function crearPromocionRemate(payload) {
  try {
    const { data } = await http.post("/combos", payload);
    return data;
  } catch (err) {
    return null;
  }
}

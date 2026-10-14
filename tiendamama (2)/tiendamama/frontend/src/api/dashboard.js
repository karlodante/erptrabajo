// Dashboard API — endpoints consumidos por el panel principal.
// Si el backend responde OK, se usan los datos reales; si no, fallback a MOCK.

import http from "./http.js";
import {
  mockKpis, mockVentasSemana, mockAlertas, mockArqueoEstado,
} from "./mockDashboard.js";

const USE_MOCK = true;

async function safeGet(path, fallback) {
  if (USE_MOCK) return typeof fallback === "function" ? fallback() : fallback;
  try {
    const { data } = await http.get(path);
    return data;
  }
  catch {
    return typeof fallback === "function" ? fallback() : fallback;
  }
}

export async function fetchKpisHoy() {
  return safeGet("/v1/dashboard/kpis-hoy", mockKpis);
}

export async function fetchVentas7Dias() {
  return safeGet("/v1/dashboard/ventas-7dias", mockVentasSemana);
}

export async function fetchResumenAlertas() {
  return safeGet("/v1/alertas/resumen", () => mockAlertas().resumen);
}
export async function fetchAlertasSinLeer(limite = 30) {
  if (USE_MOCK) return mockAlertas().items.slice(0, limite);
  try {
    const { data } = await http.get("/v1/alertas", {
      params: { soloSinLeer: true, limite },
    });
    return data;
  }
  catch {
    return mockAlertas().items;
  }
}
export async function marcarAlertaLeida(id) {
  try {
    await http.patch(`/v1/alertas/${id}`, { leida: true });
    return true;
  }
  catch {
    return false;
  }
}
export async function evaluarAlertasAhora() {
  try {
    await http.post("/v1/alertas/evaluar");
    return true;
  }
  catch {
    return false;
  }
}

// ---------------------------- Estado de caja (arqueo abierto) ----------
// Usa el endpoint real /caja/abierto
export async function fetchEstadoCaja() {
  return safeGet("/v1/caja/abierto", mockArqueoEstado);
}

export { mockKpis, mockVentasSemana, mockAlertas, mockArqueoEstado };

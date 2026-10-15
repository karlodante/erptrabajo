// API de integración con Dolibarr ERP (backend: /api/v1/dolibarr).
// La base del cliente puede ser "/api" (Vite) o "http://127.0.0.1:8765"
// (Electron), así que el prefijo se resuelve en cada llamada.

import http from "./http.js";

function v1(path) {
  const base = String(http.defaults.baseURL ?? "").replace(/\/+$/, "");
  return (/\/api$/.test(base) ? "/v1" : "/api/v1") + path;
}

export const TOKEN_KEY = "auth:token";

export function tieneSesion() {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function cerrarSesion() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function iniciarSesion(username, password) {
  const body = new URLSearchParams({ username, password });
  const { data } = await http.post(v1("/auth/login"), body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  localStorage.setItem(TOKEN_KEY, data.access_token);
  return data;
}

export async function obtenerEstado() {
  const { data } = await http.get(v1("/dolibarr/estado"));
  return data;
}

export async function sincronizarProductos() {
  const { data } = await http.post(v1("/dolibarr/productos/sincronizar"), null, { timeout: 120_000 });
  return data;
}

export async function listarVentasPendientes(limite = 200) {
  const { data } = await http.get(v1("/dolibarr/ventas/pendientes"), { params: { limite } });
  return data;
}

export async function enviarVenta(ventaId) {
  const { data } = await http.post(v1(`/dolibarr/ventas/${ventaId}/enviar`), null, { timeout: 60_000 });
  return data;
}

export async function reintentarPendientes() {
  const { data } = await http.post(v1("/dolibarr/ventas/reintentar"), null, { timeout: 120_000 });
  return data;
}

// Cliente HTTP (axios) para la API REST del backend.
// - Base URL y timeout centralizados.
// - Interceptor: inyecta JWT guardado en localStorage.
// - Interceptor: muestra toast genérico en errores 5xx/401/403.
// - Retry automático para conexiones fallidas al inicio.
//
// Si el backend no está disponible en la URL, el store usa datos mock
// definidos en `mockDashboard.js`.

import axios from "axios";

const _fromWindow = typeof window !== "undefined" ? window.__TM_API_BASE_OVERRIDE__ : null;
const BASE = _fromWindow ?? import.meta.env.VITE_API_URL ?? "/api";
const TIMEOUT_MS = 15_000;

const http = axios.create({
  baseURL: BASE,
  timeout: TIMEOUT_MS,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// Exponer para que el preload/bridge de Desktop pueda pisar baseURL dinámicamente.
if (typeof window !== "undefined") {
  window.__axiosHttpClient = http;
}

// Contador de reintentos para errores de conexión
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 segundos

// JWT
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth:token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Errores centralizados con retry para errores de conexión
http.interceptors.response.use(
  (res) => {
    // Resetear contador en éxitos
    retryCount = 0;
    return res;
  },
  async (err) => {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail ?? err.message;

    // Retry para errores de conexión (ECONNREFUSED, ENOTFOUND, etc.)
    if (!status && retryCount < MAX_RETRIES) {
      retryCount++;
      console.warn(`[HTTP] Error de conexión, reintentando ${retryCount}/${MAX_RETRIES}...`, err.message);

      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));

      // Reintentar la petición original
      return http.request(err.config);
    }

    // Resetear contador si no es error de conexión o se excedieron reintentos
    if (status) retryCount = 0;

    // Injectar notificación toast si está disponible
    try {
      if (typeof window !== "undefined") {
        const ev = new CustomEvent("app:http-error", {
          detail: { status, detail },
        });
        window.dispatchEvent(ev);
      }
    }
    catch { /* no-op */ }

    return Promise.reject(err);
  },
);

export default http;
export { BASE as API_BASE };

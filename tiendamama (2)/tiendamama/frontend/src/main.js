// ============================================================
// Entry point — Vue App + Global Error Handler
// ============================================================
import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router/index.js";

import "./styles/main.css";

// Toast plugin (componente global) — simple reactive bus
import { createToastPlugin, toastApi } from "./components/ui/ToastBus.js";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(createToastPlugin());

// ══════════════════════════════════════════════════════════════════
// Global Error Handlers (NIVEL 0 - la última línea de defensa)
// Evita que un error de render o unhandled rejection queden en
// pantalla BLANCA sin feedback al usuario.
// ══════════════════════════════════════════════════════════════════
function reportarErrorGlobal(contexto, err, info) {
  const msg = err?.message || String(err || "Error sin descripción");
  const stack = err?.stack || "";
  // eslint-disable-next-line no-console
  console.error(`%c[GLOBAL ERROR:${contexto}]`, "color:white;background:#dc2626;font-weight:bold;padding:2px 6px", msg, info ?? "", stack);
  // Disparar evento para que App.vue (error boundary) pueda levantar la tarjeta visible
  try {
    window.dispatchEvent(
      new CustomEvent("app:global-error", {
        detail: { context: contexto, message: msg, info: info ?? null, stack, ts: Date.now() },
      }),
    );
  } catch (_) { /* ignore */ }
  // Toast emergente para el usuario
  try {
    toastApi?.error?.("Algo salió mal", msg.slice(0, 120) + (msg.length > 120 ? "…" : ""), { duration: 8000 });
  } catch (_) { /* ignore */ }
}

// Errores dentro del árbol de componentes Vue (render, watch, lifecycle)
app.config.errorHandler = (err, vm, info) => reportarErrorGlobal("Vue", err, info);

// Warnings: solo a consola (no interrumpir UX)
app.config.warnHandler = (msg, vm, trace) => {
  // eslint-disable-next-line no-console
  console.warn(`%c[VUE WARN]`, "color:white;background:#d97706;font-weight:bold;padding:2px 6px", msg, trace ?? "");
};

if (typeof window !== "undefined") {
  // Errores globales JS fuera de Vue (ej: <script>, setTimeout, etc.)
  window.addEventListener("error", (ev) => reportarErrorGlobal("window.error", ev.error || { message: ev.message }, `${ev.filename}:${ev.lineno}:${ev.colno}`));
  // Promesas sin .catch()
  window.addEventListener("unhandledrejection", (ev) => reportarErrorGlobal("unhandledrejection", ev.reason?.message ? ev.reason : { message: String(ev.reason || "Promise rechazada sin catch") }, ev.reason?.stack || null));
}

app.mount("#app");

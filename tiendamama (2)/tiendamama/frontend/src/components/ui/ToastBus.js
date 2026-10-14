/**
 * Toast plugin + <TmToastHost /> — sistema de notificaciones flotantes.
 *
 * Instalación (main.js):
 *   import { createToastPlugin } from "@/components/ui/ToastBus.js";
 *   app.use(createToastPlugin());
 *
 * Uso desde cualquier componente:
 *   const toast = inject("$toast");
 *   toast.success("Guardado correctamente");
 *   toast.error("No se pudo conectar con el servidor");
 *   toast({ title: "...", description: "...", tone: "warning", duration: 5000 });
 */

import { reactive, markRaw } from "vue";
import {
  CheckCircle, AlertTriangle, XCircle, Info, X as XIcon,
} from "lucide-vue-next";

// ---------- Estado global ----------
const state = reactive({
  toasts: [], // [{id, title, description, tone, duration, icon, close}
});

let counter = 1;
const defaults = {
  tone: "info",
  duration: 4200,
};

function push(payload) {
  const data = typeof payload === "string" ? { title: payload } : payload;
  const toast = {
    id: counter++,
    ...defaults,
    ...data,
  };
  state.toasts.push(toast);
  if (toast.duration > 0) {
    setTimeout(() => dismiss(toast.id), toast.duration);
  }
  return toast.id;
}

function dismiss(id) {
  const i = state.toasts.findIndex(t => t.id === id);
  if (i >= 0) state.toasts.splice(i, 1);
}

function clearAll() {
  state.toasts.splice(0, state.toasts.length);
}

// Shortcuts helpers
const toast = Object.assign(push, {
  success: (t, d, opts = {}) =>
    push({ title: t, description: d, tone: "success", icon: CheckCircle, ...opts }),
  error:   (t, d, opts = {}) =>
    push({ title: t, description: d, tone: "danger",  icon: XCircle, ...opts }),
  warning: (t, d, opts = {}) =>
    push({ title: t, description: d, tone: "warning", icon: AlertTriangle, ...opts }),
  info:    (t, d, opts = {}) =>
    push({ title: t, description: d, tone: "info",    icon: Info, ...opts }),
  dismiss,
  clearAll,
  _state: state,
});

export { state as toastState, toast as toastApi, dismiss };

// ---------- Plugin Vue ----------
export function createToastPlugin() {
  return {
    install(app) {
      app.config.globalProperties.$toast = toast;
      app.provide("$toast", toast);
    },
  };
}

import _TmToastHost from "./TmToastHost.vue";
const TmToastHost = _TmToastHost;
export { TmToastHost };

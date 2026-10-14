// /desktop/renderer-helpers/tiendamama-inject.js
// Este script se "chunea" (inject) al frontend empaquetado mediante build.
// NO lo cargamos <script src> directo; lo insertamos al build por Vite via
// una función copy en vite.config / package.json.

// - Piso la VITE_API_URL / axios base URL para que apunte al backend spawned local
// - Expone el desktop API (abrir carpeta de datos, reiniciar backend, salir) al scope window.TM_DESKTOP_APP
// - Reacciona al evento "backend crash" con notificación visible en UI vía app:http-error

(function injectDesktopBridge() {
  try {
    const isDesktop = typeof window !== "undefined" && !!window.TM_DESKTOP;
    if (!isDesktop) return;

    window.TM_DESKTOP.getConfig?.().then((cfg) => {
      if (cfg && cfg.backendBaseUrl && typeof window.__TM_API_BASE_OVERRIDE__ === "undefined") {
        const apiBase = cfg.backendBaseUrl.endsWith("/")
          ? `${cfg.backendBaseUrl}api/v1`
          : `${cfg.backendBaseUrl}/api/v1`;
        window.__TM_API_BASE_OVERRIDE__ = apiBase;

        // Si axios ya fue instanciado antes del inject (típico en MODO PROD cargado)
        // Forzamos defaults:
        const w = window;
        if (w.__axiosHttpClient && w.__axiosHttpClient.defaults) {
          w.__axiosHttpClient.defaults.baseURL = apiBase;
        }
        console.info(`[TM Desktop] API base seteada: ${apiBase}`);
      }

      if (cfg) {
        window.TM_DESKTOP_APP = {
          ...window.TM_DESKTOP_APP,
          ...cfg,
          restartBackend:      () => window.TM_DESKTOP.restartBackend?.(),
          openDataFolder:      () => window.TM_DESKTOP.openDataFolder?.(),
          quitApp:             () => window.TM_DESKTOP.quit?.(),
        };
      }
    });

    window.TM_DESKTOP.onBackendCrashed?.((d) => {
      try {
        window.dispatchEvent(new CustomEvent("app:http-error", {
          detail: {
            status: 503,
            detail: `Motor interno cerrado (código ${d.code}). Reinicia la aplicación o contacta soporte.`,
          },
        }));
      } catch (_) { /* ignore */ }
    });
  } catch (_) { /* ignore: no es desktop, el preload no cargó */ }
})();

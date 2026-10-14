// ./desktop/preload.js
// Preload script: expone un API mínimo y seguro al renderer (frontend),
// evitando nodeIntegration=true.
const { contextBridge, ipcRenderer } = require("electron");

const TM_DESKTOP = {
  getConfig:     ()                 => ipcRenderer.invoke("tm:get-config"),
  restartBackend: ()                 => ipcRenderer.invoke("tm:backend-restart"),
  openDataFolder: ()                 => ipcRenderer.invoke("tm:open-data-folder"),
  quit:          ()                 => ipcRenderer.invoke("tm:app-quit"),
  onBackendCrashed: (listener)      => ipcRenderer.on("tm:backend-crashed", (_e, d) => listener?.(d)),
};

contextBridge.exposeInMainWorld("TM_DESKTOP", TM_DESKTOP);

// Exponer la URL del backend para que el frontend pueda usarla
(async () => {
  try {
    const config = await ipcRenderer.invoke("tm:get-config");
    if (config && config.backendBaseUrl) {
      window.__TM_API_BASE_OVERRIDE__ = config.backendBaseUrl;
      console.log("[PRELOAD] Backend URL configurada:", config.backendBaseUrl);
    }
  } catch (e) {
    console.error("[PRELOAD] Error obteniendo config:", e);
  }
})();

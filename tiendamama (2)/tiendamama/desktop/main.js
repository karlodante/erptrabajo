// ./desktop/main.js
// Proceso principal (Main) de Electron para TiendaMama Lácteos Desktop.
//
// Funcionalidad:
//   1. Spawnea uvicorn (FastAPI) como proceso hijo sobre el Python empaquetado / instalado.
//   2. Detecta el frontend compilado (o usa dev server en MODO DESARROLLO).
//      En producción -> sirve frontend via `electron-serve` (build estático).
//   3. Espera que el backend esté listo (health-check) y abre la ventana.
//   4. Se asegura de matar el backend al cerrar.
//
// Para modo dev ejecutar desde /desktop:  npm run electron:dev
// Para build instalador .exe:             npm run dist

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const { spawn, exec, execSync } = require("node:child_process");
const isDev = !app.isPackaged;

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
const CONFIG = {
  BACKEND_HOST: "127.0.0.1",
  BACKEND_PORT: process.env.TM_BACKEND_PORT ?? 8765,
  FRONTEND_DEV_URL: process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173",
  POLL_MAX_ATTEMPTS: 60,       // espera hasta 60s a que arranque uvicorn
  POLL_INTERVAL_MS: 1000,
  PROD_BACKEND_WAIT_TIMEOUT: 30_000,
};

const PY_BACKEND_MODULE = "backend.app.main:app";
const PY_UVICORN_BIN_NAME = process.platform === "win32" ? "uvicorn.exe" : "uvicorn";

let mainWindow = null;
let backendProcess = null;
let pythonBin = null;      // path resuelto a python(.exe)
let uvicornBin = null;
let resourcesRoot = null;  // dir de recursos en instalador / desarrollo
let backendLogFile = null; // path al archivo de logs del backend

// ---------------------------------------------------------------------------
// Resolución de paths según entorno
// ---------------------------------------------------------------------------
function resolveResources() {
  if (isDev) {
    resourcesRoot = path.resolve(__dirname, "..");     // /tiendamama
  } else {
    // En Electron asar: process.resourcesPath = <exe-root>/resources
    // Ponemos el backend compilado (PyInstaller) y frontend dist en <resources>/app
    resourcesRoot = process.resourcesPath;
  }
  return resourcesRoot;
}
resolveResources();

// Inicializar archivo de logs en directorio de usuario escribible
function initLogFile() {
  const userData = app.getPath("userData");
  if (!fs.existsSync(userData)) {
    fs.mkdirSync(userData, { recursive: true });
  }
  backendLogFile = path.join(userData, "backend.log");
  console.log("[MAIN] Log file:", backendLogFile);
}

function backendDir() {
  // En dev es <repo>/backend
  // En prod: resources/app/python-dist/tiendamama-backend (carpeta del PyInstaller)
  if (isDev) return path.resolve(resourcesRoot, "backend");
  return path.resolve(resourcesRoot, "app", "python-dist", "tiendamama-backend");
}
function frontendDistDir() {
  if (isDev) return null;
  return path.resolve(resourcesRoot, "app", "frontend");
}

// ---------------------------------------------------------------------------
// Resolución de intérprete Python
// ---------------------------------------------------------------------------
function findLocalPythonOrBundled() {
  // 1) Python empaquetado por PyInstaller (un solo exe o carpeta)
  const bundled = path.join(backendDir(), "tiendamama-backend.exe");
  console.log("[MAIN] Buscando backend empaquetado en:", bundled);
  console.log("[MAIN] ¿Existe?", fs.existsSync(bundled));
  if (fs.existsSync(bundled)) return { mode: "bundled-exe", bin: bundled, script: null };

  const bundleUvi = path.join(backendDir(), PY_UVICORN_BIN_NAME);
  if (fs.existsSync(bundleUvi)) return { mode: "uvicorn-direct", bin: bundleUvi, script: null };

  // 2) .venv local del desarrollador (win)
  const venvWin = path.resolve(resourcesRoot, ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venvWin)) return { mode: "venv", bin: venvWin, script: "-m uvicorn" };
  const venvUvWin = path.resolve(resourcesRoot, ".venv", "Scripts", PY_UVICORN_BIN_NAME);
  if (fs.existsSync(venvUvWin)) return { mode: "venv-uvicorn", bin: venvUvWin, script: null };

  const venvPosix = path.resolve(resourcesRoot, ".venv", "bin", "python");
  if (fs.existsSync(venvPosix)) return { mode: "venv", bin: venvPosix, script: "-m uvicorn" };

  // 3) Python del sistema
  try {
    const pyExe = process.platform === "win32" ? "python.exe" : "python3";
    execSync(`${pyExe} -c "import fastapi, uvicorn, sqlalchemy; print('ok')"`, { stdio: "ignore", timeout: 5000 });
    return { mode: "system", bin: pyExe, script: "-m uvicorn" };
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ejecución del backend
// ---------------------------------------------------------------------------
function backendUrl() {
  return `http://${CONFIG.BACKEND_HOST}:${CONFIG.BACKEND_PORT}`;
}

async function spawnBackend() {
  const resolved = findLocalPythonOrBundled();
  if (!resolved) {
    throw new Error(
      "No se encontró un Python válido. Instalá Python 3.11+ y dependencias " +
      "del backend (requirements.txt) o usá la build empaquetada con PyInstaller.\n\n" +
      "Backend directory: " + backendDir() + "\n" +
      "Resources root: " + resourcesRoot,
    );
  }

  let cmd;
  let args = [];
  const dbUrl = buildDefaultDbUrl();
  const opts = {
    cwd: isDev ? path.resolve(resourcesRoot) : backendDir(),
    env: {
      ...process.env,
      TM_DESKTOP: "1",
      PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1",
      DATABASE_URL: dbUrl,
      DB_PATH: path.join(app.getPath("userData"), "tiendamama.db"),
    },
  };

  console.log("[BACKEND] DB URL:", dbUrl);
  console.log("[BACKEND] Working directory:", opts.cwd);

  if (resolved.mode === "bundled-exe") {
    // .exe de PyInstaller escucha en puerto configurable
    cmd = resolved.bin;
    args = [
      `--host=${CONFIG.BACKEND_HOST}`,
      `--port=${CONFIG.BACKEND_PORT}`,
    ];
  } else if (resolved.mode === "uvicorn-direct" || resolved.mode === "venv-uvicorn") {
    cmd = resolved.bin;
    args = [
      PY_BACKEND_MODULE,
      `--host=${CONFIG.BACKEND_HOST}`,
      `--port=${CONFIG.BACKEND_PORT}`,
      "--no-access-log",
      "--loop=asyncio",
    ];
  } else {
    // venv python / system python
    const parts = resolved.script.split(" ");
    cmd = resolved.bin;
    args = [
      ...parts,
      PY_BACKEND_MODULE,
      `--host=${CONFIG.BACKEND_HOST}`,
      `--port=${CONFIG.BACKEND_PORT}`,
      "--no-access-log",
    ];
  }

  // Evitar pop-up de consola negra en Windows (prod)
  if (process.platform === "win32" && !isDev) {
    opts.windowsHide = true;
    opts.detached = false;
  }

  console.log("[BACKEND] spawn:", cmd, args.join(" "));
  backendProcess = spawn(cmd, args, opts);

  // Función para escribir logs en archivo
  const logToFile = (stream, data) => {
    const txt = String(data).replace(/\s+$/g, "");
    if (!txt) return;
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${stream}] ${txt}\n`;
    console[stream === "stderr" ? "warn" : "log"](`[BACKEND ${stream}] ${txt}`);
    if (backendLogFile) {
      try {
        fs.appendFileSync(backendLogFile, logLine);
      } catch (e) {
        console.error("[MAIN] Error writing to log file:", e);
      }
    }
  };

  backendProcess.stdout.on("data", (data) => logToFile("stdout", data));
  backendProcess.stderr.on("data", (data) => logToFile("stderr", data));
  backendProcess.on("error", (err) => {
    console.error("[BACKEND] error:", err);
    logToFile("stderr", "Process error: " + err.message);
  });
  backendProcess.on("close", (code, sig) => {
    const msg = `[BACKEND] exited code=${code} sig=${sig}`;
    console.warn(msg);
    logToFile("stderr", msg);
    backendProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Mostrar banner en frontend vía IPC
      mainWindow.webContents.send("tm:backend-crashed", { code });
    }
  });
}

function buildDefaultDbUrl() {
  // En instalador local: Postgres de la instalación o SQLite local portable.
  // Por defecto, SQLite local al directorio de datos del usuario (sin dependencias).
  const dbDir = app.getPath("userData");
  const dbPath = path.join(dbDir, "tiendamama.db");
  return `sqlite+aiosqlite:///${dbPath.replace(/\\/g, "/")}`;
}

// ---------------------------------------------------------------------------
// Esperar backend
// ---------------------------------------------------------------------------
function puertoAguardable(host, port, timeoutMs = 200) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port, timeout: timeoutMs });
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
    sock.once("error",   () => resolve(false));
  });
}
async function esperarBackend() {
  for (let i = 1; i <= CONFIG.POLL_MAX_ATTEMPTS; i++) {
    if (!backendProcess) return false;
    const ok = await puertoAguardable(CONFIG.BACKEND_HOST, CONFIG.BACKEND_PORT);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, CONFIG.POLL_INTERVAL_MS));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Kill backend
// ---------------------------------------------------------------------------
function killBackendSync() {
  if (!backendProcess) return;
  try {
    if (process.platform === "win32") {
      // Tree-kill más seguro en Windows
      exec(`taskkill /F /T /PID ${backendProcess.pid}`, () => {});
    } else {
      backendProcess.kill("SIGTERM");
      setTimeout(() => backendProcess && backendProcess.kill("SIGKILL"), 1500);
    }
  } catch (_) {}
  backendProcess = null;
}

// ---------------------------------------------------------------------------
// Ventana
// ---------------------------------------------------------------------------
async function crearVentanaPrincipal() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    show: false,
    icon: path.resolve(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  // Links externos -> navegador default
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Cargar contenido
  if (isDev) {
    await mainWindow.loadURL(CONFIG.FRONTEND_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // En producción, cargar directamente el archivo HTML
    // Con base: './' en vite.config.js, las rutas relativas funcionan con file://
    const indexPath = path.join(frontendDistDir(), "index.html");
    console.log("[MAIN] Cargando frontend desde:", indexPath);
    console.log("[MAIN] ¿Existe el archivo?", fs.existsSync(indexPath));

    try {
      await mainWindow.loadFile(indexPath);
      // Habilitar DevTools en producción para debugging temporal
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } catch (error) {
      console.error("[MAIN] Error al cargar el frontend:", error);
      await mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`
        <html>
          <head><title>Error de Carga</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>Error al cargar la interfaz</h1>
            <p>No se pudo cargar el archivo: ${indexPath}</p>
            <p>Error: ${error.message}</p>
            <p>Directorio frontend: ${frontendDistDir()}</p>
            <p>Resources path: ${process.resourcesPath}</p>
          </body>
        </html>
      `));
    }
  }
}

// ---------------------------------------------------------------------------
// IPC handlers (bridge seguro)
// ---------------------------------------------------------------------------
ipcMain.handle("tm:get-config", () => ({
  backendBaseUrl: backendUrl(),
  isDev,
  resourcesRoot,
  appVersion: app.getVersion(),
}));

ipcMain.handle("tm:backend-restart", async () => {
  killBackendSync();
  await new Promise((r) => setTimeout(r, 500));
  await spawnBackend();
  return await esperarBackend();
});

ipcMain.handle("tm:open-data-folder", () => {
  shell.openPath(app.getPath("userData"));
  return app.getPath("userData");
});

ipcMain.handle("tm:app-quit", () => {
  app.quit();
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  // Inicializar archivo de logs
  initLogFile();

  try {
    await spawnBackend();
    const ready = await esperarBackend();
    if (!ready) {
      const errorMessage =
        "El backend de TiendaMama no pudo arrancar en 60 segundos.\n\n" +
        "Información de diagnóstico:\n" +
        "- Modo: " + (isDev ? "Desarrollo" : "Producción (empaquetado)") + "\n" +
        "- Directorio de recursos: " + resourcesRoot + "\n" +
        "- Directorio del backend: " + backendDir() + "\n" +
        "- Archivo de logs: " + backendLogFile + "\n" +
        "- Usuario data: " + app.getPath("userData") + "\n\n" +
        "Para más detalles, revisa el archivo backend.log en la carpeta de datos del usuario.";

      await dialog.showErrorBox("No se pudo iniciar el motor interno", errorMessage);
    }
  } catch (err) {
    const errorMessage =
      "Error al iniciar TiendaMama:\n\n" + err.message + "\n\n" +
      "Información de diagnóstico:\n" +
      "- Directorio de recursos: " + resourcesRoot + "\n" +
      "- Directorio del backend: " + backendDir() + "\n" +
      "- Archivo de logs: " + backendLogFile + "\n" +
      "- Usuario data: " + app.getPath("userData");
    dialog.showErrorBox("Error al iniciar TiendaMama", errorMessage);
  }

  await crearVentanaPrincipal();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentanaPrincipal();
  });
});

app.on("window-all-closed", () => {
  killBackendSync();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  killBackendSync();
});

process.on("SIGINT",  () => { killBackendSync(); process.exit(0); });
process.on("SIGTERM", () => { killBackendSync(); process.exit(0); });
process.on("uncaughtException", (err) => {
  console.error("[MAIN] uncaught:", err);
  killBackendSync();
});

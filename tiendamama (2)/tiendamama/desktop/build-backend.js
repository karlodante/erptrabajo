// ./desktop/build-backend.js
// Script de utilidad para compilar el backend con PyInstaller (one-folder mode).
// Se ejecuta manualmente desde /desktop antes de `npm run dist`.
//   Uso:  node build-backend.js
// Requiere Python 3.11+ y venv con dependencias instaladas en el repo.
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const VENV_PY_WIN = path.join(ROOT, ".venv", "Scripts", "python.exe");
const VENV_PY_POSIX = path.join(ROOT, ".venv", "bin", "python");
const PYINSTALLER_ENTRY = path.join(ROOT, "backend", "app", "__main__pyinstaller.py");
const OUT_DIR = path.join(__dirname, "python-dist");

const PY = fs.existsSync(VENV_PY_WIN) ? VENV_PY_WIN : VENV_PY_POSIX;

if (!fs.existsSync(PY)) {
  console.error("No se encontró .venv. Creá .venv e instalá requirements.txt antes de build-backend.");
  process.exit(1);
}

// Generar entry-point PyInstaller si no existe
if (!fs.existsSync(PYINSTALLER_ENTRY)) {
  fs.writeFileSync(
    PYINSTALLER_ENTRY,
    `
# Entry point PyInstaller — arranca uvicorn en 127.0.0.1:${process.env.TM_BACKEND_PORT ?? 8765}
import argparse
import uvicorn
from app.main import app

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    a = p.parse_args()
    uvicorn.run(app, host=a.host, port=a.port, loop="asyncio", access_log=False)

if __name__ == "__main__":
    main()
`.trim() + "\n",
  );
}

try {
  console.log("Instalando PyInstaller...");
  execSync(`"${PY}" -m pip install pyinstaller --quiet`, { stdio: "inherit" });
} catch (e) {
  console.warn("PyInstaller ya instalado? -> continuando");
}

// Limpiar salida anterior
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const cmd = [
  `"${PY}" -m PyInstaller`,
  `--noconfirm`,
  `--clean`,
  `--name tiendamama-backend`,
  `--distpath "${OUT_DIR}"`,
  `--workpath "${path.join(__dirname, ".build-pyi")}"`,
  `--specpath "${path.join(__dirname, ".build-pyi")}"`,
  `--collect-all fastapi --collect-all sqlalchemy --collect-all alembic --collect-all passlib`,
  `--collect-submodules app`,
  `--hidden-import aiosqlite --hidden-import asyncpg`,
  `--add-data "${path.join(ROOT, "backend", "app")};app"`,
  `--onedir`,
  `"${PYINSTALLER_ENTRY}"`,
].join(" ");

console.log("Ejecutando PyInstaller:", cmd);
execSync(cmd, { stdio: "inherit", cwd: path.dirname(PYINSTALLER_ENTRY) });
console.log("\nBackend compilado en", OUT_DIR);

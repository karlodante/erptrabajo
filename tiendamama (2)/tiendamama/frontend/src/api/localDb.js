// Base local (sin backend): catálogo y operación persistidos en localStorage.
// Arranca vacío. Lo que el usuario crea (productos, lotes, ventas, etc.) se guarda.

const KEY = "tiendamama:localdb:v1";

export const db = {
  productos: [],
  lotes: [],
  mermas: [],
  ventas: [],
  arqueos: [],
  movimientos: [],
  cotizaciones: [],
  clientes: [],
  combos: [],
  preciosVolumen: [],
  proveedores: [],
  pedidos: [],
  ids: {
    producto: 1,
    lote: 1,
    merma: 1,
    venta: 1,
    arqueo: 1,
    movimiento: 1,
    cotizacion: 1,
    cliente: 1,
    combo: 1,
    precioVolumen: 1,
    proveedor: 1,
    pedido: 1,
  },
};

function snapshot() {
  return {
    productos: db.productos,
    lotes: db.lotes,
    mermas: db.mermas,
    ventas: db.ventas,
    arqueos: db.arqueos,
    movimientos: db.movimientos,
    cotizaciones: db.cotizaciones,
    clientes: db.clientes,
    combos: db.combos,
    preciosVolumen: db.preciosVolumen,
    proveedores: db.proveedores,
    pedidos: db.pedidos,
    ids: db.ids,
  };
}

function hydrate(data) {
  const keys = [
    "productos",
    "lotes",
    "mermas",
    "ventas",
    "arqueos",
    "movimientos",
    "cotizaciones",
    "clientes",
    "combos",
    "preciosVolumen",
    "proveedores",
    "pedidos",
  ];
  for (const k of keys) {
    if (!Array.isArray(data[k])) continue;
    db[k].length = 0;
    db[k].push(...data[k]);
  }
  if (data.ids && typeof data.ids === "object") {
    Object.assign(db.ids, data.ids);
  }
}

export function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot()));
  } catch {
    /* quota / private mode */
  }
}

export function nextId(kind) {
  const current = Number(db.ids[kind] ?? 1);
  db.ids[kind] = current + 1;
  persist();
  return current;
}

function load() {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data === "object") hydrate(data);
  } catch {
    /* corrupt payload → keep empty */
  }
}

function initMockData() {
  // Solo limpiar datos falsos de pedidos
  // Mantener productos, lotes, mermas, clientes, cotizaciones, proveedores (datos reales del usuario)
  
  // Limpiar pedidos falsos
  db.pedidos = [];
  
  // Limpiar promociones para empezar limpios
  db.combos = [];
  db.preciosVolumen = [];
  
  // Inicializar arrays vacíos si no existen
  if (db.clientes.length === 0) {
    db.clientes = [];
  }
  if (db.cotizaciones.length === 0) {
    db.cotizaciones = [];
  }
  
  // No limpiar localStorage para no perder productos reales del usuario
  persist();
}

load();
initMockData();

// ============================
// Funciones de Backup/Restore
// ============================
export function exportarDatos() {
  try {
    const data = {
      version: "1.0",
      fecha: new Date().toISOString(),
      datos: snapshot(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiendamama-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("Error al exportar datos:", err);
    return false;
  }
}

export function importarDatos(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.datos || typeof data.datos !== "object") {
      throw new Error("Formato de backup inválido");
    }
    hydrate(data.datos);
    persist();
    return true;
  } catch (err) {
    console.error("Error al importar datos:", err);
    return false;
  }
}

export function tieneDatosGuardados() {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(KEY);
    return raw !== null && raw.length > 0;
  } catch {
    return false;
  }
}

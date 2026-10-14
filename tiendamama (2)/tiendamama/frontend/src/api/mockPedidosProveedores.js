import { MOCK_LOTES } from "./mockInventario.js";
import { MOCK_PRODUCTOS } from "./mockPos.js";
import { db, persist, nextId } from "./localDb.js";

const MOCK_PROVEEDORES = db.proveedores;

// -------------------------------------------------------------------------
// Mapeo proveedor -> productos (basado en lotes históricos)
// Cada producto tendrá asignado su proveedor "principal" (el que más lotes suministró)
// -------------------------------------------------------------------------
function _productoIdToProveedorId() {
  const acum = new Map(); // productoId -> Map(proveedorId -> count)
  for (const lote of MOCK_LOTES) {
    if (!lote.proveedor_id) continue;
    const mapaProv = acum.get(lote.producto_id) ?? new Map();
    mapaProv.set(lote.proveedor_id, (mapaProv.get(lote.proveedor_id) ?? 0) + lote.cantidad_inicial);
    acum.set(lote.producto_id, mapaProv);
  }
  const res = new Map();
  for (const [pid, mapa] of acum) {
    let best = null, bestCnt = 0;
    for (const [prId, cnt] of mapa) {
      if (cnt > bestCnt) { best = prId; bestCnt = cnt; }
    }
    if (best) res.set(pid, best);
  }
  return res;
}
const _prodToProv = _productoIdToProveedorId();

function proveedorPrincipalDeProducto(productoId) {
  return _prodToProv.get(Number(productoId));
}
function productosDeProveedor(proveedorId) {
  const out = [];
  for (const p of MOCK_PRODUCTOS) {
    if (proveedorPrincipalDeProducto(p.id) === Number(proveedorId)) out.push(p);
  }
  return out;
}

// -------------------------------------------------------------------------
// Cálculo de stock actual por producto
// -------------------------------------------------------------------------
function stockActualPorProductoId() {
  const s = new Map();
  for (const lote of MOCK_LOTES) {
    if (lote.estado !== "activo") continue;
    s.set(lote.producto_id, (s.get(lote.producto_id) ?? 0) + lote.cantidad_actual);
  }
  for (const p of MOCK_PRODUCTOS) {
    if (!s.has(p.id)) s.set(p.id, 0);
  }
  return s;
}

// -------------------------------------------------------------------------
// Promedio de ventas (proxy "ventas últimos N días")
// Lo derivamos de stock_minimo y rotación para tener un valor realista.
// -------------------------------------------------------------------------
function promedioVentaDiaria(producto, stockActual) {
  const base = Math.max(1, Number(producto.stock_minimo ?? 5) * 0.5);
  const rotacion = Number((producto.categoria_id ?? 0) % 3) * 0.2 + 1;
  return Math.max(1, Math.round(base * rotacion + Math.random() * base * 0.8));
}

// -------------------------------------------------------------------------
// Fórmula cantidad sugerida:
//   objetivo = max(stock_minimo * 2.5, stock_minimo + promedio*7_dias)
//   cantidad_sugerida = max(0, ceil(objetivo - stock_actual))
// Redondeo siempre al múltiplo de presentación + 1 (múltiplo de 6 o 12 según
// producto se asume cajitas; para simplificar, múltiplos de 6).
// -------------------------------------------------------------------------
function _redondearAEnt(n, multiplo = 6) {
  if (n <= 0) return 0;
  return Math.ceil(n / multiplo) * multiplo;
}

export function calcularSugerenciaProducto(producto, stockActual, { N_DIAS = 7, UMBRAL_PCT = 130 } = {}) {
  const sm = Number(producto.stock_minimo ?? 5);
  const sa = Number(stockActual ?? 0);
  const cerquita = sa <= Math.round(sm * (UMBRAL_PCT / 100));
  if (!cerquita) return null;
  const pd = promedioVentaDiaria(producto, sa);
  const objetivo = Math.max(
    Math.round(sm * 2.5),
    Math.round(sm + pd * N_DIAS),
  );
  const sugeridaBruta = Math.max(0, objetivo - sa);
  const sugerida = sugeridaBruta > 0 ? _redondearAEnt(sugeridaBruta, 6) : 0;
  return {
    producto,
    stock_actual: sa,
    stock_minimo: sm,
    promedio_venta_diario: pd,
    dias_restantes_hasta_stock_min: sa <= 0 ? 0 : Math.floor(sa / Math.max(1, pd)),
    urgencia: sa <= 0 ? "critica" : sa <= sm ? "alta" : "media",
    cantidad_sugerida: sugerida,
    cantidad_aprobada: sugerida, // arranca igual que la sugerida
  };
}

// -------------------------------------------------------------------------
// Mocks API
// -------------------------------------------------------------------------
export function mockListarProveedores(params = {}) {
  let rows = MOCK_PROVEEDORES.slice();
  if (params.soloActivos !== false) rows = rows.filter(r => r.activo);
  if (params.q) {
    const s = String(params.q).trim().toLowerCase();
    rows = rows.filter(p =>
      p.nombre.toLowerCase().includes(s) ||
      (p.contacto || "").toLowerCase().includes(s) ||
      (p.telefono || "").includes(s) ||
      (p.email || "").toLowerCase().includes(s),
    );
  }
  rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return rows;
}

export function mockObtenerProveedor(id) {
  return MOCK_PROVEEDORES.find(p => p.id === Number(id)) ?? null;
}

// Sugerencias agrupadas por proveedor (o filtrable por proveedor_id)
export function mockSugerencias(params = {}) {
  const umbral = Number(params.umbral_pct ?? 130);
  const soloProveedor = params.proveedor_id ? Number(params.proveedor_id) : null;
  const stocks = stockActualPorProductoId();

  // 1) Lista de productos con sugerencia
  const sugerenciasTodos = [];
  for (const producto of MOCK_PRODUCTOS) {
    if (!producto.activo) continue;
    const sa = stocks.get(producto.id) ?? 0;
    const sug = calcularSugerenciaProducto(producto, sa, { UMBRAL_PCT: umbral });
    if (!sug) continue;
    const provId = proveedorPrincipalDeProducto(producto.id);
    sugerenciasTodos.push({ ...sug, proveedor_id: provId ?? 6 });
  }

  // 2) Agrupar por proveedor
  const grupos = new Map();
  for (const s of sugerenciasTodos) {
    if (soloProveedor && s.proveedor_id !== soloProveedor) continue;
    const key = s.proveedor_id;
    if (!grupos.has(key)) {
      const prov = MOCK_PROVEEDORES.find(p => p.id === key);
      grupos.set(key, {
        proveedor_id: key,
        proveedor: prov ?? MOCK_PROVEEDORES[5],
        items: [],
        total_productos: 0,
        total_unidades_sugeridas: 0,
        total_unidades_aprobadas: 0,
        urgencia_max: "media",
      });
    }
    const g = grupos.get(key);
    g.items.push(s);
    g.total_productos += 1;
    g.total_unidades_sugeridas += Number(s.cantidad_sugerida);
    g.total_unidades_aprobadas += Number(s.cantidad_aprobada);
    if (s.urgencia === "critica") g.urgencia_max = "critica";
    else if (g.urgencia_max !== "critica" && s.urgencia === "alta") g.urgencia_max = "alta";
  }

  const gruposArr = [...grupos.values()].sort((a, b) => {
    const urgOrd = { critica: 0, alta: 1, media: 2 };
    if (urgOrd[a.urgencia_max] !== urgOrd[b.urgencia_max]) return urgOrd[a.urgencia_max] - urgOrd[b.urgencia_max];
    return b.total_productos - a.total_productos;
  });

  // Resumen total
  const resumen = {
    proveedores_con_sugerencia: gruposArr.length,
    total_productos_sugeridos: gruposArr.reduce((s, g) => s + g.total_productos, 0),
    total_unidades_sugeridas: gruposArr.reduce((s, g) => s + g.total_unidades_sugeridas, 0),
    criticos: gruposArr.reduce((s, g) => s + g.items.filter(i => i.urgencia === "critica").length, 0),
    alta: gruposArr.reduce((s, g) => s + g.items.filter(i => i.urgencia === "alta").length, 0),
    media: gruposArr.reduce((s, g) => s + g.items.filter(i => i.urgencia === "media").length, 0),
  };
  return { resumen, grupos: gruposArr, timestamp: new Date().toISOString() };
}

// -------------------------------------------------------------------------
// Historial de pedidos generados
// -------------------------------------------------------------------------
const _HIST = db.pedidos;

function _haceDias(n, hhmm = "10:00") {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function mockListarPedidos(params = {}) {
  let rows = JSON.parse(JSON.stringify(_HIST));
  if (params.estado) rows = rows.filter(r => r.estado === params.estado);
  if (params.proveedor_id) rows = rows.filter(r => r.proveedor_id === Number(params.proveedor_id));
  rows.sort((a, b) => new Date(b.fecha_generacion) - new Date(a.fecha_generacion));

  // Enriquecer
  for (const p of rows) {
    const prov = MOCK_PROVEEDORES.find(x => x.id === p.proveedor_id);
    p.proveedor_nombre = prov?.nombre ?? "Proveedor #";
    p.proveedor = prov ?? null;
    p.total_productos = (p.detalles || []).length;
    p.total_unidades = (p.detalles || []).reduce((s, d) => s + Number(d.cantidad_aprobada ?? d.cantidad_sugerida), 0);
    for (const d of p.detalles) {
      const prod = MOCK_PRODUCTOS.find(x => x.id === d.producto_id);
      d.producto_nombre = prod?.nombre ?? "";
      d.sku = prod?.sku ?? "";
    }
  }
  const page = Number(params.page ?? 1);
  const perPage = Number(params.perPage ?? params.per_page ?? 50);
  const total = rows.length;
  return {
    items: rows.slice((page - 1) * perPage, page * perPage),
    total, page, perPage,
    total_pages: Math.ceil(total / perPage) || 0,
  };
}

export function mockObtenerPedido(id) {
  const list = mockListarPedidos({ page: 1, perPage: 1000 });
  return list.items.find(p => p.id === Number(id)) ?? null;
}

export function mockGenerarPedido(payload) {
  const now = new Date().toISOString();
  const p = {
    id: nextId("pedido"),
    proveedor_id: payload.proveedor_id ?? null,
    fecha_generacion: now,
    estado: payload.estado ?? "pendiente",
    usuario_id: 1,
    observaciones: payload.observaciones ?? null,
    detalles: (payload.detalles || []).map((d, i) => ({
      id: (_nextPedidoId * 100) + i,
      producto_id: Number(d.producto_id),
      cantidad_sugerida: Number(d.cantidad_sugerida),
      cantidad_aprobada: d.cantidad_aprobada != null ? Number(d.cantidad_aprobada) : Number(d.cantidad_sugerida),
    })),
  };
  _HIST.unshift(p);
  persist();
  const prov = MOCK_PROVEEDORES.find(x => x.id === p.proveedor_id);
  p.proveedor_nombre = prov?.nombre ?? "";
  p.proveedor = prov ?? null;
  p.total_productos = p.detalles.length;
  p.total_unidades = p.detalles.reduce((s, d) => s + Number(d.cantidad_aprobada ?? d.cantidad_sugerida), 0);
  for (const d of p.detalles) {
    const prod = MOCK_PRODUCTOS.find(x => x.id === d.producto_id);
    d.producto_nombre = prod?.nombre ?? "";
    d.sku = prod?.sku ?? "";
  }
  return p;
}

export function mockActualizarPedido(id, payload) {
  const p = _HIST.find(x => x.id === Number(id));
  if (!p) return null;
  if (payload.estado) p.estado = payload.estado;
  if (payload.observaciones !== undefined) p.observaciones = payload.observaciones ?? null;
  p.updated_at = new Date().toISOString();
  persist();
  return mockObtenerPedido(id);
}

// -------------------------------------------------------------------------
// Helpers públicos de exportación
// -------------------------------------------------------------------------
export function textoPedidoParaWhatsApp(proveedor, items, { observaciones = "", numPedido = null, fecha = new Date() } = {}) {
  const lines = [];
  lines.push(`*PEDIDO DE MERCADERÍA*`);
  if (numPedido) lines.push(`*N°:* #${numPedido}`);
  lines.push(`*Fecha:* ${fecha.toLocaleDateString("es-AR")} ${fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`);
  lines.push(`*Proveedor:* ${proveedor?.nombre ?? "—"}`);
  if (proveedor?.contacto) lines.push(`_(${proveedor.contacto})_`);
  lines.push("");
  lines.push("*Productos:*");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  const rows = items.map((i, idx) => {
    const cant = Number(i.cantidad_aprobada ?? i.cantidad_sugerida ?? i.cantidad);
    const prod = i.producto_nombre ?? i.nombre ?? "";
    const sku = i.sku ? ` [${i.sku}]` : "";
    return `${idx + 1}) ${cant} × ${prod}${sku}`;
  });
  lines.push(...rows);
  const totalUn = items.reduce((s, i) => s + Number(i.cantidad_aprobada ?? i.cantidad_sugerida ?? i.cantidad ?? 0), 0);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`*Total de unidades:* ${totalUn}`);
  lines.push(`*Items totales:* ${items.length}`);
  if (observaciones) {
    lines.push("");
    lines.push(`*Observaciones:* ${observaciones}`);
  }
  lines.push("");
  lines.push("_Mensaje generado por TiendaMama_");
  return lines.join("\n");
}

export function htmlPedidoImprimible(proveedor, items, { observaciones = "", numPedido = null, fecha = new Date() } = {}) {
  const rows = items.map((i, idx) => {
    const cant = Number(i.cantidad_aprobada ?? i.cantidad_sugerida ?? i.cantidad);
    const prod = i.producto_nombre ?? i.nombre ?? "";
    const sku = i.sku ?? "";
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:left;">${idx + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:left;font-weight:600;">${prod}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:left;color:#666;font-family:monospace;">${sku || "—"}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:700;font-size:15px;">${cant}</td>
    </tr>`;
  }).join("");
  const totalUn = items.reduce((s, i) => s + Number(i.cantidad_aprobada ?? i.cantidad_sugerida ?? i.cantidad ?? 0), 0);
  return `
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Pedido #${numPedido || "Nuevo"}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;padding:28px;color:#1f2937;max-width:780px;margin:0 auto;}
  h1{font-size:22px;margin:0 0 6px;}
  .meta{color:#4b5563;font-size:13px;margin-bottom:22px;line-height:1.6;}
  .brand{background:#0D8A72;color:#fff;padding:10px 14px;border-radius:10px;display:inline-block;font-weight:800;font-size:13px;letter-spacing:1px;margin-bottom:12px;}
  table{width:100%;border-collapse:collapse;}
  thead th{background:#f3f4f6;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;padding:10px;}
  .total-badge{background:#0D8A72;color:#fff;padding:14px 18px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-top:20px;font-size:15px;}
  .total-badge .num{font-size:22px;font-weight:900;}
  .obs{margin-top:18px;background:#fef3c7;color:#92400e;padding:14px;border-radius:10px;font-size:13px;}
  .footer{margin-top:30px;color:#6b7280;font-size:12px;text-align:center;}
</style>
</head><body>
  <div class="brand">TIENDAMAMA · PEDIDO A PROVEEDOR</div>
  <h1>Pedido ${numPedido ? "#" + numPedido : "provisorio"}</h1>
  <div class="meta">
    <div><b>Fecha generación:</b> ${fecha.toLocaleString("es-AR")}</div>
    <div><b>Proveedor:</b> ${proveedor?.nombre ?? "—"}</div>
    ${proveedor?.contacto ? `<div><b>Contacto:</b> ${proveedor.contacto}</div>` : ""}
    ${proveedor?.telefono ? `<div><b>Teléfono:</b> ${proveedor.telefono}</div>` : ""}
    ${proveedor?.email ? `<div><b>Email:</b> ${proveedor.email}</div>` : ""}
  </div>
  <table>
    <thead><tr>
      <th style="width:8%;">#</th>
      <th>Producto</th>
      <th style="width:18%;">SKU</th>
      <th style="width:14%;text-align:center;">Cantidad</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total-badge">
    <span><b>Total unidades solicitadas</b> · ${items.length} línea(s)</span>
    <span class="num">${totalUn}</span>
  </div>
  ${observaciones ? `<div class="obs"><b>Observaciones:</b><br>${String(observaciones).replace(/\n/g, "<br>")}</div>` : ""}
  <div class="footer">Documento generado automáticamente por TiendaMama — Pedidos Sugeridos.</div>
</body></html>`;
}

export const PROVEEDORES_MOCK = MOCK_PROVEEDORES;

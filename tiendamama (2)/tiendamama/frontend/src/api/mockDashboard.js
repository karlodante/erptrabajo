import { db } from "./localDb.js";
import { MOCK_PRODUCTOS } from "./mockPos.js";
import { MOCK_LOTES, diasRestantes } from "./mockInventario.js";
import { mockArqueoAbierto } from "./mockCaja.js";

const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const soloFecha = (iso) => String(iso).slice(0, 10);

function stockDeProducto(p) {
  return MOCK_LOTES
    .filter((l) => l.producto_id === p.id && l.estado === "activo" && l.cantidad_actual > 0)
    .reduce((s, l) => s + l.cantidad_actual, 0);
}

function ventasDelDia(fecha) {
  return db.ventas.filter(
    (v) => soloFecha(v.fecha_hora) === fecha && v.estado !== "anulada",
  );
}

export function mockVentasSemana() {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const fecha = fmt(d);
    const ventas = ventasDelDia(fecha);
    return {
      fecha,
      diaLabel: d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""),
      monto: Math.round(ventas.reduce((s, v) => s + Number(v.total || 0), 0) * 100) / 100,
      tickets: ventas.length,
    };
  });
}

export function mockKpis() {
  const hoy = fmt(new Date());
  const ayerDate = new Date();
  ayerDate.setDate(ayerDate.getDate() - 1);
  const ayer = fmt(ayerDate);
  const ventasHoy = ventasDelDia(hoy);
  const ventasAyer = ventasDelDia(ayer);
  const montoHoy = ventasHoy.reduce((s, v) => s + Number(v.total || 0), 0);
  const montoAyer = ventasAyer.reduce((s, v) => s + Number(v.total || 0), 0);
  const tickets = ventasHoy.length;
  const stockCritico = MOCK_PRODUCTOS.filter((p) => {
    if (!p.activo) return false;
    return stockDeProducto(p) <= Number(p.stock_minimo ?? 0);
  }).length;
  const lotesPorVencer = MOCK_LOTES.filter(
    (l) =>
      l.estado === "activo" &&
      l.cantidad_actual > 0 &&
      diasRestantes(l.fecha_vencimiento) <= 7,
  ).length;
  const caja = mockArqueoAbierto();
  let horaApertura = null;
  if (caja?.hora_apertura) {
    try {
      horaApertura = new Date(caja.hora_apertura).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      horaApertura = null;
    }
  }
  const delta = montoAyer > 0 ? Math.round(((montoHoy - montoAyer) / montoAyer) * 1000) / 10 : 0;
  return {
    ventas_hoy: Math.round(montoHoy * 100) / 100,
    delta_ventas_vs_ayer: delta,
    tickets_hoy: tickets,
    ticket_promedio: tickets > 0 ? Math.round((montoHoy / tickets) * 100) / 100 : 0,
    stock_critico: stockCritico,
    lotes_por_vencer: lotesPorVencer,
    caja_abierta: !!caja,
    hora_apertura_caja: horaApertura,
  };
}

export function mockAlertas() {
  const items = [];
  let id = 1;
  for (const l of MOCK_LOTES.filter((x) => x.estado === "activo" && x.cantidad_actual > 0)) {
    const dias = diasRestantes(l.fecha_vencimiento);
    const prod = MOCK_PRODUCTOS.find((p) => p.id === l.producto_id);
    const nombre = prod?.nombre ?? `Producto #${l.producto_id}`;
    if (dias < 0) {
      items.push({
        id: id++,
        tipo: "lote_vencido",
        severidad: "critical",
        producto_id: l.producto_id,
        lote_id: l.id,
        mensaje: `Lote VENCIDO: ${nombre} vencido. Quedan ${l.cantidad_actual} unidades.`,
        fecha_generacion: new Date().toISOString(),
      });
    } else if (dias <= 5) {
      items.push({
        id: id++,
        tipo: "vencimiento_proximo",
        severidad: "warning",
        producto_id: l.producto_id,
        lote_id: l.id,
        mensaje: `${nombre} — lote ${l.numero_lote ?? l.id} vence en ${dias} día(s) · ${l.cantidad_actual} u.`,
        fecha_generacion: new Date().toISOString(),
      });
    }
  }
  for (const p of MOCK_PRODUCTOS.filter((x) => x.activo !== false)) {
    const stock = stockDeProducto(p);
    const min = Number(p.stock_minimo ?? 0);
    if (stock <= min) {
      items.push({
        id: id++,
        tipo: stock === 0 ? "stock_bajo" : "stock_bajo",
        severidad: stock === 0 ? "critical" : "warning",
        producto_id: p.id,
        mensaje:
          stock === 0
            ? `Sin stock: ${p.nombre}`
            : `Stock bajo: ${p.nombre} — quedan ${stock} (mínimo ${min})`,
        fecha_generacion: new Date().toISOString(),
      });
    }
  }
  const resumen = {
    total_sin_leer: items.length,
    stock_bajo: items.filter((a) => a.tipo === "stock_bajo").length,
    vencimiento_proximo: items.filter((a) => a.tipo === "vencimiento_proximo").length,
    lotes_vencidos: items.filter((a) => a.tipo === "lote_vencido").length,
    stock_negativo: 0,
    criticas: items.filter((a) => a.severidad === "critical").length,
  };
  return { resumen, items };
}

export function mockArqueoEstado() {
  return mockArqueoAbierto();
}

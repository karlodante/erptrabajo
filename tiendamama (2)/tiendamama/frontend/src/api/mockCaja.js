import { db, persist, nextId } from "./localDb.js";

const hoy = new Date();
const soloFecha = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
const isoConHora = (d) => d.toISOString();
const sumarDias = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};
const CATEGORIAS = [
  { value: "pago_proveedor", label: "Pago a proveedor", defaultTipo: "egreso" },
  { value: "gasto_menor", label: "Gasto menor", defaultTipo: "egreso" },
  { value: "fondo_inicial", label: "Fondo inicial", defaultTipo: "ingreso" },
  { value: "ajuste", label: "Ajuste", defaultTipo: "ingreso" },
  { value: "otro", label: "Otro", defaultTipo: "ingreso" },
];
export const CATEGORIAS_MOV = CATEGORIAS;

const MOCK_VENTAS = db.ventas;
const MOCK_ARQUEOS = db.arqueos;
const MOCK_MOVIMIENTOS = db.movimientos;
const RANGO_DIAS = 14;

function _numComprobante(n) {
  return String(500000 + n).padStart(8, "0");
}

function esEfectivo(forma) {
  return String(forma || "").toLowerCase() === "efectivo";
}

export function registrarMockVenta(venta) {
  MOCK_VENTAS.unshift(venta);
  persist();
  return venta;
}

export function mockArqueoAbierto() {
  return MOCK_ARQUEOS.find((a) => a.estado === "abierto") ?? null;
}

export function mockListarArqueos(params = {}) {
  let rows = [...MOCK_ARQUEOS];
  if (params.fechaDesde) rows = rows.filter((a) => a.fecha >= String(params.fechaDesde).slice(0, 10));
  if (params.fechaHasta) rows = rows.filter((a) => a.fecha <= String(params.fechaHasta).slice(0, 10));
  if (params.soloAbiertos) rows = rows.filter((a) => a.estado === "abierto");
  rows.sort((a, b) => (b.fecha + b.hora_apertura).localeCompare(a.fecha + a.hora_apertura));
  return rows;
}

export function mockArqueoTotales(arqueoId) {
  const a = MOCK_ARQUEOS.find((x) => x.id === Number(arqueoId));
  if (!a) return null;
  const hasta = a.hora_cierre ? new Date(a.hora_cierre) : new Date();
  const desde = new Date(a.hora_apertura);
  const vendidoEfectivo = MOCK_VENTAS
    .filter((v) => {
      const d = new Date(v.fecha_hora);
      return d >= desde && d <= hasta && v.estado !== "anulada"
        && (v.pagos || []).some((p) => esEfectivo(p.forma_pago));
    })
    .reduce((s, v) => s + (v.pagos || []).filter((p) => esEfectivo(p.forma_pago)).reduce((acc, p) => acc + Number(p.monto), 0), 0);
  const movs = MOCK_MOVIMIENTOS.filter((m) => m.arqueo_id === a.id && m.categoria !== "fondo_inicial");
  const ingresos = parseFloat(movs.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0).toFixed(2));
  const egresos = parseFloat(movs.filter((m) => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0).toFixed(2));
  const saldoEsperado = parseFloat((a.monto_inicial + vendidoEfectivo + ingresos - egresos).toFixed(2));
  return {
    arqueo: a,
    total_ventas_efectivo: parseFloat(vendidoEfectivo.toFixed(2)),
    total_ingresos: ingresos,
    total_egresos: egresos,
    saldo_esperado: saldoEsperado,
  };
}

export function mockAbrirArqueo(payload) {
  const existente = MOCK_ARQUEOS.find((a) => a.estado === "abierto");
  if (existente) return null;
  const now = new Date();
  const a = {
    id: nextId("arqueo"),
    fecha: payload.fecha ?? soloFecha(now),
    usuario_apertura_id: 1,
    usuario_cierre_id: null,
    hora_apertura: isoConHora(now),
    hora_cierre: null,
    monto_inicial: Number(payload.monto_inicial ?? payload.montoInicial),
    monto_efectivo_contado: null,
    monto_esperado: null,
    diferencia: null,
    estado: "abierto",
    observaciones: null,
    created_at: isoConHora(now),
    updated_at: isoConHora(now),
  };
  MOCK_ARQUEOS.unshift(a);
  MOCK_MOVIMIENTOS.unshift({
    id: nextId("movimiento"),
    arqueo_id: a.id,
    tipo: "ingreso",
    categoria: "fondo_inicial",
    monto: a.monto_inicial,
    motivo: "Fondo inicial de caja",
    fecha_hora: isoConHora(now),
    usuario_id: 1,
  });
  persist();
  return a;
}

export function mockCerrarArqueo(arqueoId, payload) {
  const totales = mockArqueoTotales(arqueoId);
  const a = totales?.arqueo;
  if (!a || a.estado !== "abierto") return null;
  const contado = parseFloat(Number(payload.monto_efectivo_contado ?? payload.montoEfectivoContado).toFixed(2));
  const now = new Date();
  a.monto_efectivo_contado = contado;
  a.monto_esperado = totales.saldo_esperado;
  a.diferencia = parseFloat((contado - totales.saldo_esperado).toFixed(2));
  a.hora_cierre = isoConHora(now);
  a.usuario_cierre_id = 1;
  a.estado = "cerrado";
  a.observaciones = payload.observaciones ?? a.observaciones;
  a.updated_at = isoConHora(now);
  persist();
  return a;
}

export function mockListarMovimientos(params = {}) {
  let rows = [...MOCK_MOVIMIENTOS];
  if (params.arqueo_id || params.arqueoId) {
    const id = Number(params.arqueo_id ?? params.arqueoId);
    rows = rows.filter((m) => m.arqueo_id === id);
  }
  if (params.tipo) rows = rows.filter((m) => m.tipo === params.tipo);
  rows.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
  return rows;
}

export function mockNuevoMovimiento(payload) {
  const arqueo = mockArqueoAbierto();
  if (!arqueo) return null;
  const m = {
    id: nextId("movimiento"),
    arqueo_id: arqueo.id,
    tipo: payload.tipo,
    categoria: payload.categoria ?? "otro",
    monto: parseFloat(Number(payload.monto).toFixed(2)),
    motivo: payload.motivo ?? null,
    fecha_hora: isoConHora(new Date()),
    usuario_id: 1,
  };
  MOCK_MOVIMIENTOS.unshift(m);
  persist();
  return m;
}

export function mockListarVentas(params = {}) {
  let rows = [...MOCK_VENTAS];
  if (params.fechaDesde) {
    const d = new Date(String(params.fechaDesde).slice(0, 10));
    rows = rows.filter((v) => new Date(v.fecha_hora) >= d);
  }
  if (params.fechaHasta) {
    const d = new Date(String(params.fechaHasta).slice(0, 10));
    d.setDate(d.getDate() + 1);
    rows = rows.filter((v) => new Date(v.fecha_hora) < d);
  }
  if (params.estado) rows = rows.filter((v) => v.estado === params.estado);
  rows.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
  const page = Number(params.page ?? 1);
  const perPage = Number(params.perPage ?? params.per_page ?? 50);
  const total = rows.length;
  const start = (page - 1) * perPage;
  return { items: rows.slice(start, start + perPage), total, page, perPage, total_pages: Math.ceil(total / perPage) || 0 };
}

export function mockVentasAgrupadas(granularidad = "dia", { fechaDesde, fechaHasta } = {}) {
  let ventas = MOCK_VENTAS.slice();
  if (fechaDesde) {
    const d = new Date(String(fechaDesde).slice(0, 10));
    ventas = ventas.filter((v) => new Date(v.fecha_hora) >= d);
  }
  if (fechaHasta) {
    const d = new Date(String(fechaHasta).slice(0, 10));
    d.setDate(d.getDate() + 1);
    ventas = ventas.filter((v) => new Date(v.fecha_hora) < d);
  }
  const grupos = new Map();
  const etiquetas = [];
  if (granularidad === "dia") {
    const desde = fechaDesde ? new Date(String(fechaDesde).slice(0, 10)) : sumarDias(hoy, -(RANGO_DIAS - 1));
    const hasta = fechaHasta ? new Date(String(fechaHasta).slice(0, 10)) : hoy;
    for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
      const k = soloFecha(d);
      grupos.set(k, { key: k, label: d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }), total: 0, tickets: 0, efectivo: 0 });
      etiquetas.push(k);
    }
  } else if (granularidad === "semana") {
    for (let s = 0; s < 4; s++) {
      const fin = sumarDias(hoy, -s * 7);
      const inicio = sumarDias(fin, -6);
      const k = `Sem-${s + 1}`;
      grupos.set(k, {
        key: k,
        label: `${inicio.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} → ${fin.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`,
        total: 0, tickets: 0, efectivo: 0,
      });
      etiquetas.push(k);
    }
  } else if (granularidad === "mes") {
    for (let m = 0; m < 3; m++) {
      const dt = new Date(hoy.getFullYear(), hoy.getMonth() - m, 1);
      const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      grupos.set(k, {
        key: k,
        label: dt.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
        total: 0, tickets: 0, efectivo: 0,
      });
      etiquetas.push(k);
    }
  }

  for (const v of ventas) {
    let k = null;
    const vd = new Date(v.fecha_hora);
    if (granularidad === "dia") k = soloFecha(vd);
    else if (granularidad === "semana") {
      const dias = Math.floor((hoy.getTime() - vd.getTime()) / 86400000);
      const sem = Math.min(3, Math.floor(dias / 7));
      k = `Sem-${sem + 1}`;
    } else if (granularidad === "mes") {
      k = `${vd.getFullYear()}-${String(vd.getMonth() + 1).padStart(2, "0")}`;
    }
    if (!grupos.has(k)) continue;
    const g = grupos.get(k);
    g.total = parseFloat((g.total + Number(v.total)).toFixed(2));
    g.tickets += 1;
    const efectivo = parseFloat((v.pagos || []).filter((p) => esEfectivo(p.forma_pago)).reduce((s, p) => s + Number(p.monto), 0).toFixed(2));
    g.efectivo = parseFloat((g.efectivo + efectivo).toFixed(2));
  }

  return etiquetas.map((k) => {
    const g = grupos.get(k);
    return {
      ...g,
      total: g.total,
      efectivo: g.efectivo,
      ticket_promedio: g.tickets > 0 ? parseFloat((g.total / g.tickets).toFixed(2)) : 0,
    };
  });
}

export function mockKpiVentas(granularidad = "dia") {
  const data = mockVentasAgrupadas(granularidad);
  const total = data.reduce((s, d) => s + d.total, 0);
  const tickets = data.reduce((s, d) => s + d.tickets, 0);
  return {
    total: Math.round(total * 100) / 100,
    tickets,
    ticket_promedio: tickets > 0 ? Math.round((total / tickets) * 100) / 100 : 0,
    data,
  };
}

export { _numComprobante };

import { defineStore } from "pinia";
import {
  arqueoAbierto as apiArqueoAbierto,
  listarArqueos as apiListarArqueos,
  arqueoTotales as apiArqueoTotales,
  abrirArqueo as apiAbrirArqueo,
  cerrarArqueo as apiCerrarArqueo,
  listarMovimientos as apiListarMovimientos,
  nuevoMovimiento as apiNuevoMovimiento,
  listarVentas as apiListarVentas,
} from "@/api/caja.js";
import {
  mockArqueoAbierto,
  mockListarArqueos,
  mockArqueoTotales,
  mockAbrirArqueo,
  mockCerrarArqueo,
  mockListarMovimientos,
  mockNuevoMovimiento,
  mockListarVentas,
  mockVentasAgrupadas,
  mockKpiVentas,
  CATEGORIAS_MOV,
} from "@/api/mockCaja.js";

const USE_MOCK = true;

async function _or(fnApi, fnMock, ...args) {
  if (USE_MOCK) return fnMock(...args);
  try {
    return await fnApi(...args);
  } catch (err) {
    if (err?.code === "ERR_NETWORK" || !err?.response) return fnMock(...args);
    throw err;
  }
}

export const useCajaStore = defineStore("caja", {
  state: () => ({
    loading: false,
    lastError: null,

    arqueoAbierto: null,
    arqueoTotalesCache: new Map(),
    arqueos: [],
    movimientos: [],
    movimientosFiltrarArqueoId: null,

    ventas: [],
    ventasTotal: 0,
    filtroVentas: {
      granularidad: "dia",
      fechaDesde: "",
      fechaHasta: "",
      estado: "",
      page: 1,
      perPage: 50,
    },
    reporteVentasAgrupado: [],

    ultimoArqueoCreado: null,
    ultimoMovimiento: null,
  }),

  getters: {
    cajaAbierta: (s) => !!s.arqueoAbierto,
    saldoEsperadoAbierto: (s) => s.arqueoTotalesCache.get(s.arqueoAbierto?.id)?.saldo_esperado ?? null,
    totalEfectivoVentasAbierto: (s) => s.arqueoTotalesCache.get(s.arqueoAbierto?.id)?.total_ventas_efectivo ?? 0,
    ingresosManualesAbierto: (s) => s.arqueoTotalesCache.get(s.arqueoAbierto?.id)?.total_ingresos ?? 0,
    egresosManualesAbierto: (s) => s.arqueoTotalesCache.get(s.arqueoAbierto?.id)?.total_egresos ?? 0,

    totalArqueosCerrados: (s) => s.arqueos.filter(a => a.estado === "cerrado").length,
    totalFaltantes: (s) => s.arqueos.filter(a => a.estado === "cerrado" && Number(a.diferencia) < 0).length,
    totalSobrantes: (s) => s.arqueos.filter(a => a.estado === "cerrado" && Number(a.diferencia) > 0).length,
    totalDiferenciaAbsoluta: (s) =>
      parseFloat(
        s.arqueos
          .filter(a => a.estado === "cerrado")
          .reduce((acc, a) => acc + Math.abs(Number(a.diferencia || 0)), 0)
          .toFixed(2),
      ),

    kpiReporte: (s) => {
      const data = s.reporteVentasAgrupado;
      const total = parseFloat(
        data.reduce((acc, d) => acc + Number(d.total || 0), 0).toFixed(2),
      );
      const tickets = data.reduce((acc, d) => acc + Number(d.tickets || 0), 0);
      return {
        total,
        tickets,
        ticket_promedio: tickets > 0 ? parseFloat((total / tickets).toFixed(2)) : 0,
      };
    },

    categoriasMov: () => CATEGORIAS_MOV,
  },

  actions: {
    setFiltroVenta(clave, valor) {
      this.filtroVentas[clave] = valor;
      if (clave !== "page") this.filtroVentas.page = 1;
    },
    resetFiltrosVentas() {
      this.filtroVentas = { granularidad: "dia", fechaDesde: "", fechaHasta: "", estado: "", page: 1, perPage: 50 };
    },

    async cargarTodo() {
      this.loading = true;
      try {
        await Promise.all([
          this.cargarArqueoAbierto(),
          this.cargarArqueos(),
          this.cargarReporteVentas(),
          this.cargarVentasDetalle(),
        ]);
      } finally {
        this.loading = false;
      }
    },

    async cargarArqueoAbierto() {
      const ab = await _or(apiArqueoAbierto, mockArqueoAbierto);
      this.arqueoAbierto = ab ?? null;
      if (ab) {
        const tot = await _or(apiArqueoTotales, mockArqueoTotales, ab.id);
        if (tot) this.arqueoTotalesCache.set(ab.id, tot);
        await this.cargarMovimientos(ab.id);
      }
      return this.arqueoAbierto;
    },

    async cargarArqueos(params = {}) {
      this.arqueos = await _or(apiListarArqueos, mockListarArqueos, params);
      return this.arqueos;
    },

    async obtenerTotalesArqueo(arqueoId, { forzar = false } = {}) {
      const key = Number(arqueoId);
      if (!forzar && this.arqueoTotalesCache.has(key)) return this.arqueoTotalesCache.get(key);
      const tot = await _or(apiArqueoTotales, mockArqueoTotales, key);
      if (tot) this.arqueoTotalesCache.set(key, tot);
      return tot;
    },

    async cargarMovimientos(arqueoId) {
      this.movimientosFiltrarArqueoId = arqueoId ?? null;
      this.movimientos = await _or(apiListarMovimientos, mockListarMovimientos, arqueoId ? { arqueoId } : {});
      return this.movimientos;
    },

    async abrirArqueo({ monto_inicial, fecha }) {
      const creado = await _or(apiAbrirArqueo, mockAbrirArqueo, { monto_inicial, fecha });
      this.ultimoArqueoCreado = creado;
      if (creado) {
        this.arqueoAbierto = creado;
        await Promise.all([this.cargarArqueos(), this.cargarMovimientos(creado.id), this.obtenerTotalesArqueo(creado.id, { forzar: true })]);
      }
      return creado;
    },

    async cerrarArqueo(arqueoId, { monto_efectivo_contado, observaciones }) {
      const cerrado = await _or(apiCerrarArqueo, mockCerrarArqueo, arqueoId, { monto_efectivo_contado, observaciones });
      if (cerrado) {
        this.arqueoAbierto = null;
        await Promise.all([this.cargarArqueos(), this.obtenerTotalesArqueo(arqueoId, { forzar: true }), this.cargarMovimientos(arqueoId)]);
      }
      return cerrado;
    },

    async registrarMovimiento({ tipo, categoria, monto, motivo }) {
      const m = await _or(apiNuevoMovimiento, mockNuevoMovimiento, { tipo, categoria, monto, motivo });
      this.ultimoMovimiento = m;
      if (m && this.arqueoAbierto) {
        await Promise.all([
          this.cargarMovimientos(this.arqueoAbierto.id),
          this.obtenerTotalesArqueo(this.arqueoAbierto.id, { forzar: true }),
        ]);
      }
      return m;
    },

    async cargarReporteVentas() {
      if (USE_MOCK) {
        this.reporteVentasAgrupado = mockVentasAgrupadas(this.filtroVentas.granularidad, {
          fechaDesde: this.filtroVentas.fechaDesde,
          fechaHasta: this.filtroVentas.fechaHasta,
        });
      } else {
        // Aggregation via detail fallback
        const list = await this.cargarVentasDetalle();
        const g = new Map();
        for (const v of list.items ?? []) {
          const d = new Date(v.fecha_hora);
          const k = this.filtroVentas.granularidad === "dia" ? d.toISOString().slice(0, 10) :
            this.filtroVentas.granularidad === "semana" ? `Sem-${Math.ceil((new Date().getTime() - d.getTime()) / (7*86400000))}` :
            `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          const e = g.get(k) ?? { key: k, label: k, total: 0, tickets: 0, efectivo: 0 };
          e.total += Number(v.total);
          e.tickets += 1;
          const ef = (v.pagos || []).filter(p => (p.forma_pago || "").toLowerCase() === "efectivo").reduce((s, p) => s + Number(p.monto), 0);
          e.efectivo += ef;
          g.set(k, e);
        }
        this.reporteVentasAgrupado = [...g.values()].map(e => ({
          ...e,
          ticket_promedio: e.tickets > 0 ? Math.round((e.total / e.tickets) * 100) / 100 : 0,
        }));
        if (!USE_MOCK) {
          const kpi = mockKpiVentas(this.filtroVentas.granularidad);
          this.reporteVentasAgrupado = kpi.data;
        }
      }
      return this.reporteVentasAgrupado;
    },

    async cargarVentasDetalle() {
      const params = {
        fechaDesde: this.filtroVentas.fechaDesde,
        fechaHasta: this.filtroVentas.fechaHasta,
        estado: this.filtroVentas.estado || undefined,
        page: this.filtroVentas.page,
        perPage: this.filtroVentas.perPage,
      };
      const data = await _or(apiListarVentas, mockListarVentas, params);
      this.ventas = data.items ?? [];
      this.ventasTotal = data.total ?? this.ventas.length;
      return data;
    },
  },
});

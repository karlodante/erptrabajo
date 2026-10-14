// Pinia store — Estado global del dashboard y alertas.
// Útil porque varios componentes comparten los mismos datos (App.vue,
// DashboardView, AlertDropdown) sin tener que re-fetchearlos.

import { defineStore } from "pinia";
import {
  fetchKpisHoy,
  fetchVentas7Dias,
  fetchResumenAlertas,
  fetchAlertasSinLeer,
  fetchEstadoCaja,
  marcarAlertaLeida as apiMarcarLeida,
} from "@/api/dashboard.js";

export const useDashboardStore = defineStore("dashboard", {
  state: () => ({
    loading: false,
    lastUpdated: null,

    kpis: null,
    ventas7dias: [],

    alertaResumen: {
      total_sin_leer: 0,
      stock_bajo: 0,
      vencimiento_proximo: 0,
      lotes_vencidos: 0,
      stock_negativo: 0,
      criticas: 0,
    },
    alertas: [],

    caja: null,
  }),

  getters: {
    // Semáforo: verde / amarillo / rojo
    // Rojo  = hay lotes vencidos o stock negativo o criticas > 0
    // Amarillo = stock_bajo o vencimiento próximo (sin rojo)
    // Verde = nada
    semaforo(state) {
      const {
        lotes_vencidos, stock_negativo, criticas,
        stock_bajo, vencimiento_proximo, total_sin_leer,
      } = state.alertaResumen;
      if (lotes_vencidos > 0 || stock_negativo > 0 || criticas > 0) return "danger";
      if (stock_bajo > 0 || vencimiento_proximo > 0) return "warning";
      if (total_sin_leer > 0) return "warning";
      return "success";
    },
    semaforoLabel() {
      switch (this.semaforo) {
        case "danger":  return "Estado crítico — requiere atención inmediata";
        case "warning": return "Advertencias — revisar stock y vencimientos";
        default:        return "Todo en orden — sin alertas pendientes";
      }
    },
  },

  actions: {
    async cargarTodo() {
      this.loading = true;
      try {
        const [kpis, v7, resumen, alerts, caja] = await Promise.all([
          fetchKpisHoy(),
          fetchVentas7Dias(),
          fetchResumenAlertas(),
          fetchAlertasSinLeer(),
          fetchEstadoCaja(),
        ]);
        this.kpis = kpis;
        this.ventas7dias = v7;
        this.alertaResumen = resumen;
        this.alertas = alerts;
        this.caja = caja;
        this.lastUpdated = new Date().toISOString();
      }
      finally {
        this.loading = false;
      }
    },

    async marcarLeida(id) {
      const ok = await apiMarcarLeida(id);
      if (ok) {
        // Actualización optimista local
        const a = this.alertas.find((x) => x.id === id);
        if (a) this.alertas.splice(this.alertas.indexOf(a), 1);
        if (this.alertaResumen.total_sin_leer > 0) this.alertaResumen.total_sin_leer--;
      }
      return ok;
    },
  },
});

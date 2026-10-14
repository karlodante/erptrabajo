import { defineStore } from "pinia";
import {
  listarPreciosVolumenPorProducto as apiPVProducto,
  agregarPrecioVolumen as apiAgregarPV,
  actualizarPrecioVolumen as apiActualizarPV,
  listarCombos as apiListarCombos,
  obtenerCombo as apiObtenerCombo,
  crearCombo as apiCrearCombo,
  actualizarCombo as apiActualizarCombo,
} from "@/api/promociones.js";
import {
  listarRematesSugeridos,
  listarPreciosVolumenConProductos,
  preciosVolumenPorProducto,
  agregarMockPrecioVolumen,
  actualizarMockPrecioVolumen,
  listarMockCombos,
  obtenerMockCombo,
  crearMockCombo,
  actualizarMockCombo,
  sugerirDescuentoRemate,
  PRODUCTOS_MOCK,
} from "@/api/mockPromociones.js";
import { buscarMockProductos } from "@/api/mockInventario.js";

const USE_MOCK = true;

async function _or(fnApi, fnMock, ...args) {
  if (USE_MOCK) return fnMock(...args);
  try { return await fnApi(...args); }
  catch (err) {
    if (err?.code === "ERR_NETWORK" || !err?.response) return fnMock(...args);
    throw err;
  }
}

export const usePromocionesStore = defineStore("promociones", {
  state: () => ({
    loading: false,

    preciosVolumen: [],
    pvProductoCache: new Map(),

    remates: [],
    rematesCargadosEn: 0,

    combos: [],
    combosTotal: 0,
    filtroCombos: { q: "", activo: "", tipo: "" },

    ultimoPrecioVolumen: null,
    ultimoCombo: null,
    ultimoRemateAplicado: null,

    productosSelect: PRODUCTOS_MOCK.slice(),
  }),

  getters: {
    combosActivos: (s) => s.combos.filter((c) => c.activo),
    combosRemate: (s) => s.combos.filter((c) => c.es_remate),

    rematesPendientes: (s) => s.remates.filter((r) => !r.remate_aplicado),
    rematesAplicados: (s) => s.remates.filter((r) => r.remate_aplicado),

    valorPerdidaTotal: (s) =>
      s.remates.reduce((acc, r) => acc + (r.remate_aplicado ? 0 : r.perdida_si_vence), 0),
    valorRecuperable: (s) =>
      s.remates.reduce((acc, r) => acc + (r.remate_aplicado ? 0 : r.recupero_estimado), 0),
    ahorroEvitable: (s) =>
      s.remates.reduce((acc, r) => acc + (r.remate_aplicado ? 0 : (r.perdida_si_vence - r.recupero_estimado)), 0),

    sugerirPct: () => (dias) => sugerirDescuentoRemate(dias),

    productosSelectList: (s) =>
      (s.productosSelect || []).map((p) => ({
        ...p,
        label: `${p.nombre} · ${p.sku}`,
      })),
  },

  actions: {
    async cargarTodo() {
      this.loading = true;
      try {
        await Promise.all([
          this.cargarPreciosVolumen(),
          this.cargarRemates(),
          this.cargarCombos(),
          this.cargarProductosSelect(),
        ]);
      } finally {
        this.loading = false;
      }
    },

    async cargarPreciosVolumen() {
      const listado = USE_MOCK
        ? listarPreciosVolumenConProductos()
        : (async () => {
            const res = await buscarMockProductos("", {});
            const rows = [];
            for (const p of res.items) {
              try {
                const lista = await apiPVProducto(p.id);
                if (lista.length === 0) continue;
                lista.sort((a, b) => a.cantidad_minima - b.cantidad_minima)
                  .forEach((pv, idx) => {
                    rows.push({
                      _groupKey: p.id,
                      _groupIdx: idx,
                      _groupTotal: lista.length,
                      id: pv.id,
                      producto_id: p.id,
                      producto: p,
                      cantidad_minima: pv.cantidad_minima,
                      precio_especial: Number(pv.precio_especial),
                      ahorro_unitario: Number(p.precio_unitario) - Number(pv.precio_especial),
                      activo: pv.activo,
                    });
                  });
              } catch (e) { /* skip */ }
            }
            return rows;
          })();
      this.preciosVolumen = listado;
      return listado;
    },

    async cargarPreciosVolumenProducto(productoId) {
      const key = Number(productoId);
      if (this.pvProductoCache.has(key)) return this.pvProductoCache.get(key);
      const lista = await _or(apiPVProducto, preciosVolumenPorProducto, productoId);
      const ordered = (lista || []).sort((a, b) => a.cantidad_minima - b.cantidad_minima);
      this.pvProductoCache.set(key, ordered);
      return ordered;
    },

    async guardarEscala(productoId, { id, cantidad_minima, precio_especial, activo = true }) {
      const payload = {
        cantidad_minima: Number(cantidad_minima),
        precio_especial: Number(precio_especial),
        activo,
      };
      let creado;
      if (id == null) {
        creado = await _or(apiAgregarPV, agregarMockPrecioVolumen, productoId, payload);
      } else {
        creado = await _or(apiActualizarPV, actualizarMockPrecioVolumen, productoId, id, payload);
      }
      this.ultimoPrecioVolumen = creado;
      this.pvProductoCache.delete(Number(productoId));
      await this.cargarPreciosVolumen();
      return creado;
    },

    async desactivarEscala(productoId, pvId) {
      return await this.guardarEscala(productoId, { id: pvId, activo: false });
    },

    async cargarRemates() {
      this.remates = listarRematesSugeridos();
      this.rematesCargadosEn = Date.now();
      return this.remates;
    },

    recargarRemates() {
      return this.cargarRemates();
    },

    async aplicarRemate(loteId, { porcentaje, producto_id, dias_restantes }) {
      const lote = this.remates.find((l) => l.id === loteId);
      if (!lote) return null;
      const producto = PRODUCTOS_MOCK.find((p) => p.id === (producto_id ?? lote.producto_id));
      const pct = Number(porcentaje) > 0 ? Number(porcentaje) : lote.sugerencia.porcentaje;
      const nombre = `🏷️ REMATE ${producto?.nombre ?? "Producto"}`;
      const d = dias_restantes ?? lote.dias_restantes;
      const payload = {
        nombre,
        descripcion: `Remate lote ${lote.numero_lote ?? `#${lote.id}`} · ${
          d < 0 ? `Vencido hace ${-d} días` : d === 0 ? "Vence HOY" : `Vence en ${d} días`
        }`,
        tipo: "descuento_porcentual",
        valor: pct,
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: new Date(Date.now() + Math.max(0, d) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        activo: true,
        es_remate: true,
        lote_id: loteId,
        detalles: [{ producto_id: producto_id ?? lote.producto_id, cantidad: 1 }],
      };
      const creado = await _or(apiCrearCombo, crearMockCombo, payload);
      this.ultimoRemateAplicado = creado;
      this.ultimoCombo = creado;
      await Promise.all([this.cargarRemates(), this.cargarCombos()]);
      return creado;
    },

    async cargarProductosSelect() {
      try {
        const res = await buscarMockProductos("", {});
        this.productosSelect = res.items ?? [];
      } catch (err) {
        this.productosSelect = PRODUCTOS_MOCK;
      }
    },

    setFiltroCombos(clave, valor) {
      this.filtroCombos[clave] = valor;
    },

    resetFiltroCombos() {
      this.filtroCombos = { q: "", activo: "", tipo: "" };
    },

    async cargarCombos() {
      const params = { ...this.filtroCombos };
      if (!params.q) delete params.q;
      if (!params.activo) delete params.activo;
      if (!params.tipo) delete params.tipo;
      const res = await _or(apiListarCombos, listarMockCombos, params);
      this.combos = res.items ?? [];
      this.combosTotal = res.total ?? this.combos.length;
      return this.combos;
    },

    async recargarCombos() {
      return await this.cargarCombos();
    },

    async obtenerCombo(id) {
      return await _or(apiObtenerCombo, obtenerMockCombo, id);
    },

    async guardarCombo({ id, payload }) {
      let res;
      if (id == null) res = await _or(apiCrearCombo, crearMockCombo, payload);
      else res = await _or(apiActualizarCombo, actualizarMockCombo, id, payload);
      this.ultimoCombo = res;
      await this.cargarCombos();
      await this.cargarRemates();
      return res;
    },

    async toggleComboActivo(id, activo) {
      const res = await _or(apiActualizarCombo, actualizarMockCombo, id, { activo: !!activo });
      await this.cargarCombos();
      return res;
    },
  },
});

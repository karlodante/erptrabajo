import { defineStore } from "pinia";
import {
  listarProductos as apiListarProductos,
  obtenerProducto as apiObtenerProducto,
  listarCategorias as apiListarCategorias,
  crearProducto as apiCrearProducto,
  actualizarProducto as apiActualizarProducto,
  listarLotes as apiListarLotes,
  crearLote as apiCrearLote,
  listarMermas as apiListarMermas,
  crearMerma as apiCrearMerma,
} from "@/api/inventario.js";
import {
  buscarMockProductos,
  obtenerMockProducto,
  listarMockCategorias,
  listarMockLotes,
  listarMockMermas,
  crearMockLote,
  crearMockProducto,
  crearMockMerma,
  actualizarMockProducto,
  obtenerMockLotesEnRiesgo,
  diasRestantes as diasRestantesMock,
  borrarMockProducto,
  borrarMockLote,
} from "@/api/mockInventario.js";

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

export const useInventarioStore = defineStore("inventario", {
  state: () => ({
    loading: false,
    lastError: null,

    productos: [],
    productosTotal: 0,
    filtros: {
      q: "",
      categoria_id: null,
      estado_stock: "",
      solo_a_vencer: false,
      page: 1,
      perPage: 50,
    },

    categorias: [],
    lotesCache: new Map(),
    lotesEnRiesgo: [],
    mermas: [],

    productoSeleccionado: null,
    productoSeleccionadoLotes: [],

    ultimoLoteCreado: null,
    ultimaMerma: null,
  }),

  getters: {
    categoriaPorId: (s) => (id) =>
      s.categorias.find((c) => c.id === Number(id)),

    productosFiltradosCantidad: (s) => s.productos.length,

    productosConStockBajo: (s) =>
      s.productos.filter((p) => p.estado === "stock_bajo").length,

    productosProximoVencer: (s) =>
      s.productos.filter((p) => p.estado === "vencimiento_proximo").length,

    cantidadTotalProductos: (s) => s.productosTotal,

    diasRestantes: () => (vto) => diasRestantesMock(vto),

    riesgoTone: () => (dias) => {
      if (dias < 0) return "danger";
      if (dias <= 2) return "danger";
      if (dias <= 5) return "warning";
      if (dias <= 15) return "info";
      return "success";
    },
  },

  actions: {
    setFiltro(clave, valor) {
      this.filtros[clave] = valor;
      if (clave !== "page") this.filtros.page = 1;
    },

    resetFiltros() {
      this.filtros = {
        q: "",
        categoria_id: null,
        estado_stock: "",
        solo_a_vencer: false,
        page: 1,
        perPage: 50,
      };
    },

    async cargarTodo() {
      this.loading = true;
      try {
        await Promise.all([
          this.cargarProductos(),
          this.cargarCategorias(),
          this.cargarLotesEnRiesgo(),
        ]);
      } finally {
        this.loading = false;
      }
    },

    async cargarProductos() {
      const params = {
        q: this.filtros.q || undefined,
        categoria_id: this.filtros.categoria_id || undefined,
        categoriaId: this.filtros.categoria_id || undefined,
        page: this.filtros.page,
        perPage: this.filtros.perPage,
        per_page: this.filtros.perPage,
        soloActivos: true,
      };
      const data = await _or(apiListarProductos, buscarMockProductos, this.filtros.q || "", this.filtros);
      this.productos = data.items ?? [];
      this.productosTotal = data.total ?? this.productos.length;
    },

    async cargarCategorias() {
      const lista = await _or(apiListarCategorias, listarMockCategorias, { soloActivos: true });
      this.categorias = Array.isArray(lista) ? lista : [];
    },

    async cargarLotesPorProducto(productoId, { forzar = false } = {}) {
      const key = Number(productoId);
      if (!forzar && this.lotesCache.has(key)) {
        return this.lotesCache.get(key);
      }
      const params = {
        producto_id: productoId,
        productoId,
        soloActivos: false,
      };
      const lotes = await _or(apiListarLotes, listarMockLotes, params);
      this.lotesCache.set(key, lotes);
      return lotes;
    },

    async cargarDetalleProducto(productoId) {
      this.loading = true;
      try {
        const prod = await _or(apiObtenerProducto, obtenerMockProducto, productoId);
        this.productoSeleccionado = prod;
        this.productoSeleccionadoLotes = await this.cargarLotesPorProducto(productoId, { forzar: true });
        return prod;
      } finally {
        this.loading = false;
      }
    },

    limpiarDetalle() {
      this.productoSeleccionado = null;
      this.productoSeleccionadoLotes = [];
    },

    async cargarLotesEnRiesgo() {
      if (USE_MOCK) {
        this.lotesEnRiesgo = obtenerMockLotesEnRiesgo(5);
        return;
      }
      try {
        const lista = await apiListarLotes({ aVencerEnDias: 5, soloActivos: true });
        const productosMap = new Map(this.productos.map((p) => [p.id, p]));
        this.lotesEnRiesgo = (lista ?? []).map((l) => {
          const prod = productosMap.get(l.producto_id);
          return {
            ...l,
            dias_restantes: diasRestantesMock(l.fecha_vencimiento),
            producto_nombre: prod?.nombre ?? `Producto #${l.producto_id}`,
            categoria_id: prod?.categoria_id,
          };
        }).sort((a, b) => a.dias_restantes - b.dias_restantes);
      } catch (err) {
        this.lotesEnRiesgo = obtenerMockLotesEnRiesgo(5);
      }
    },

    async cargarMermas(params = {}) {
      const lista = await _or(apiListarMermas, listarMockMermas, params);
      this.mermas = lista ?? [];
      return this.mermas;
    },

    async crearProducto(payload) {
      const creado = await _or(apiCrearProducto, crearMockProducto, payload);
      this.lotesCache.clear();
      await this.cargarProductos();
      return creado;
    },

    async actualizarStockMinimo(productoId, stockMinimo) {
      const payload = { stock_minimo: Number(stockMinimo) };
      const actualizado = await _or(apiActualizarProducto, actualizarMockProducto, productoId, payload);
      if (actualizado) {
        const idx = this.productos.findIndex((p) => p.id === Number(productoId));
        if (idx >= 0) {
          this.productos[idx] = { ...this.productos[idx], stock_minimo: Number(stockMinimo) };
        }
        if (this.productoSeleccionado && Number(this.productoSeleccionado.id) === Number(productoId)) {
          this.productoSeleccionado = { ...this.productoSeleccionado, stock_minimo: Number(stockMinimo) };
        }
        // invalidate cache
        this.lotesCache.clear();
      }
      return actualizado;
    },

    async actualizarCodigoBarras(productoId, codigoBarras) {
      const payload = { codigo_barras: codigoBarras?.trim() || null };
      const actualizado = await _or(apiActualizarProducto, actualizarMockProducto, productoId, payload);
      if (actualizado) {
        const idx = this.productos.findIndex((p) => p.id === Number(productoId));
        if (idx >= 0) {
          this.productos[idx] = { ...this.productos[idx], codigo_barras: payload.codigo_barras };
        }
        if (this.productoSeleccionado && Number(this.productoSeleccionado.id) === Number(productoId)) {
          this.productoSeleccionado = { ...this.productoSeleccionado, codigo_barras: payload.codigo_barras };
        }
        // invalidate cache
        this.lotesCache.clear();
      }
      return actualizado;
    },

    async actualizarProducto(productoId, payload) {
      const actualizado = await _or(apiActualizarProducto, actualizarMockProducto, productoId, payload);
      if (actualizado) {
        const idx = this.productos.findIndex((p) => p.id === Number(productoId));
        if (idx >= 0) {
          this.productos[idx] = { ...this.productos[idx], ...payload };
        }
        if (this.productoSeleccionado && Number(this.productoSeleccionado.id) === Number(productoId)) {
          this.productoSeleccionado = { ...this.productoSeleccionado, ...payload };
        }
        // invalidate cache
        this.lotesCache.clear();
      }
      return actualizado;
    },

    async crearLote(payload) {
      const creado = await _or(apiCrearLote, crearMockLote, payload);
      this.ultimoLoteCreado = creado;
      this.lotesCache.delete(Number(payload.producto_id));
      await Promise.all([
        this.cargarProductos(),
        this.cargarLotesEnRiesgo(),
      ]);
      if (this.productoSeleccionado && Number(this.productoSeleccionado.id) === Number(payload.producto_id)) {
        this.productoSeleccionadoLotes = await this.cargarLotesPorProducto(payload.producto_id, { forzar: true });
      }
      return creado;
    },

    async registrarMerma(payload) {
      const creado = await _or(apiCrearMerma, crearMockMerma, payload);
      this.ultimaMerma = creado;
      this.lotesCache.delete(Number(payload.producto_id));
      await Promise.all([
        this.cargarProductos(),
        this.cargarLotesEnRiesgo(),
        this.cargarMermas({ producto_id: payload.producto_id }),
      ]);
      if (this.productoSeleccionado && Number(this.productoSeleccionado.id) === Number(payload.producto_id)) {
        this.productoSeleccionadoLotes = await this.cargarLotesPorProducto(payload.producto_id, { forzar: true });
      }
      return creado;
    },

    async borrarProducto(id) {
      const borrado = await _or(() => Promise.reject("API no implementada"), borrarMockProducto, id);
      if (borrado) {
        this.lotesCache.clear();
        await this.cargarProductos();
        if (this.productoSeleccionado && Number(this.productoSeleccionado.id) === Number(id)) {
          this.limpiarDetalle();
        }
      }
      return borrado;
    },

    async borrarLote(id) {
      const borrado = await _or(() => Promise.reject("API no implementada"), borrarMockLote, id);
      if (borrado) {
        this.lotesCache.clear();
        await Promise.all([
          this.cargarProductos(),
          this.cargarLotesEnRiesgo(),
        ]);
        if (this.productoSeleccionado) {
          this.productoSeleccionadoLotes = await this.cargarLotesPorProducto(this.productoSeleccionado.id, { forzar: true });
        }
      }
      return borrado;
    },
  },
});

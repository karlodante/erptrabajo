import { defineStore } from "pinia";
import {
  listarCotizaciones as apiListar,
  obtenerCotizacion as apiObtener,
  crearCotizacion as apiCrear,
  actualizarCotizacion as apiActualizar,
  confirmarCotizacion as apiConfirmar,
  cancelarCotizacion as apiCancelar,
  crearCliente as apiCrearCliente,
} from "@/api/cotizaciones.js";
import {
  listarMockCotizaciones,
  obtenerMockCotizacion,
  crearMockCotizacion,
  actualizarMockCotizacion,
  confirmarMockCotizacion,
  cancelarMockCotizacion,
  buscarMockClientes,
  clientesMock,
  precioSugeridoPorCantidad,
  stockDisponibleMock,
  reservasPorProducto,
} from "@/api/mockCotizaciones.js";
import { buscarMockProductos, obtenerMockProducto } from "@/api/mockInventario.js";
import { db, persist, nextId } from "@/api/localDb.js";

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

export const useCotizacionesStore = defineStore("cotizaciones", {
  state: () => ({
    loading: false,
    lastError: null,

    cotizaciones: [],
    cotizacionesTotal: 0,
    filtros: {
      q: "",
      estado: "",
      cliente_id: null,
      fecha_desde: "",
      fecha_hasta: "",
      page: 1,
      perPage: 50,
    },

    detalle: null,
    ultimoCreada: null,
    ultimaActualizada: null,

    clientesSelect: [],
    productosSelect: [],

    formulario: {
      cliente_id: null,
      validez_hasta: _hoyMas(7),
      items: [],
      descuento_total: 0,
      stock_reservado: false,
      observaciones: "",
    },
  }),

  getters: {
    cotPendientes: (s) => s.cotizaciones.filter((c) => c.estado === "pendiente").length,
    cotConfirmadas: (s) => s.cotizaciones.filter((c) => c.estado === "confirmada").length,
    cotCanceladas: (s) => s.cotizaciones.filter((c) => c.estado === "cancelada").length,
    cotVencidas: (s) => s.cotizaciones.filter((c) => c.estado === "vencida").length,

    montoTotalMes: (s) => {
      const inicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      return s.cotizaciones.reduce((acc, c) => {
        const d = new Date(c.fecha_hora);
        if (d >= inicio && c.estado === "confirmada") return acc + Number(c.total);
        return acc;
      }, 0);
    },

    formSubtotal: (s) =>
      s.formulario.items.reduce((acc, i) => acc + (Number(i.precio_acordado) * Number(i.cantidad || 0)), 0),

    formTotal: (s) => {
      const subtotal = s.formulario.items.reduce(
        (acc, i) => acc + (Number(i.precio_acordado) * Number(i.cantidad || 0)),
        0,
      );
      const desc = Number(s.formulario.descuento_total || 0);
      return Math.max(0, Math.round((subtotal - desc) * 100) / 100);
    },

    formAhorroItems: (s) =>
      s.formulario.items.reduce((acc, i) => {
        const base = Number(i.precio_original || i.precio_acordado);
        return acc + (base - Number(i.precio_acordado)) * Number(i.cantidad || 0);
      }, 0),

    reservasMap: () => reservasPorProducto(),
  },

  actions: {
    setFiltro(clave, valor) {
      this.filtros[clave] = valor;
      if (clave !== "page") this.filtros.page = 1;
    },
    resetFiltros() {
      this.filtros = { q: "", estado: "", cliente_id: null, fecha_desde: "", fecha_hasta: "", page: 1, perPage: 50 };
    },

    async cargarTodo() {
      this.loading = true;
      try {
        await Promise.all([
          this.cargarCotizaciones(),
          this.cargarClientes(),
          this.cargarProductosSelect(),
        ]);
      } finally {
        this.loading = false;
      }
    },

    async cargarCotizaciones() {
      const params = { ...this.filtros };
      if (!params.q) delete params.q;
      if (!params.estado) delete params.estado;
      if (!params.cliente_id) delete params.cliente_id;
      if (!params.fecha_desde) delete params.fecha_desde;
      if (!params.fecha_hasta) delete params.fecha_hasta;
      const res = await _or(apiListar, listarMockCotizaciones, params);
      this.cotizaciones = res.items ?? [];
      this.cotizacionesTotal = res.total ?? this.cotizaciones.length;
      return this.cotizaciones;
    },

    async cargarDetalle(id) {
      this.detalle = await _or(apiObtener, obtenerMockCotizacion, id);
      return this.detalle;
    },

    async cargarClientes(q = "") {
      this.clientesSelect = buscarMockClientes(q);
      return this.clientesSelect;
    },

    async cargarProductosSelect() {
      const res = await buscarMockProductos("", {});
      this.productosSelect = (res.items ?? []).map((p) => ({
        ...p,
        label: `${p.nombre} · ${p.sku}`,
        precio: Number(p.precio_unitario),
      }));
    },

    async obtenerProductoCompleto(id) {
      return obtenerMockProducto(id);
    },

    stockDisponible(productoId) {
      return stockDisponibleMock(productoId, { excluirReservas: true });
    },

    precioAplicado(productoId, cantidad) {
      return precioSugeridoPorCantidad(productoId, cantidad);
    },

    clientes() {
      return clientesMock();
    },

    resetFormulario() {
      this.formulario = {
        cliente_id: null,
        validez_hasta: _hoyMas(7),
        items: [],
        descuento_total: 0,
        stock_reservado: false,
        observaciones: "",
      };
    },

    agregarItemForm(producto) {
      const p = typeof producto === "number" ? this.productosSelect.find((x) => x.id === producto) : producto;
      if (!p) return false;
      const existente = this.formulario.items.find((i) => i.producto_id === p.id);
      const cantidad = existente ? Number(existente.cantidad) + 1 : 1;
      const precio = this.precioAplicado(p.id, cantidad);
      if (existente) {
        existente.cantidad = cantidad;
        existente.precio_acordado = precio;
      } else {
        this.formulario.items.push({
          producto_id: p.id,
          producto_nombre: p.nombre,
          sku: p.sku,
          cantidad,
          precio_original: Number(p.precio_unitario),
          precio_acordado: precio,
        });
      }
      return true;
    },

    actualizarCantidadItem(idx, cantidad) {
      const it = this.formulario.items[idx];
      if (!it) return;
      const n = Math.max(1, Number(cantidad) || 1);
      it.cantidad = n;
      it.precio_acordado = this.precioAplicado(it.producto_id, n) ?? it.precio_acordado;
    },

    actualizarPrecioItem(idx, precio) {
      const it = this.formulario.items[idx];
      if (!it) return;
      it.precio_acordado = Math.max(0, Number(precio) || 0);
    },

    quitarItemForm(idx) {
      this.formulario.items.splice(idx, 1);
    },

    async guardarCotizacion() {
      const items = this.formulario.items.map((i) => ({
        producto_id: i.producto_id,
        cantidad: Number(i.cantidad),
        precio_acordado: Number(i.precio_acordado),
      }));
      const payload = {
        validez_hasta: this.formulario.validez_hasta,
        cliente_id: this.formulario.cliente_id,
        items,
        descuento_total: Number(this.formulario.descuento_total || 0),
        stock_reservado: !!this.formulario.stock_reservado,
        observaciones: this.formulario.observaciones || null,
      };
      const res = await _or(apiCrear, crearMockCotizacion, payload);
      this.ultimoCreada = res;
      await this.cargarCotizaciones();
      return res;
    },

    async modificarCotizacion(id, payload) {
      const res = await _or(apiActualizar, actualizarMockCotizacion, id, payload);
      this.ultimaActualizada = res;
      await this.cargarCotizaciones();
      if (this.detalle && this.detalle.id === id) this.detalle = res;
      return res;
    },

    async confirmarCotizacion(id) {
      const res = await _or(apiConfirmar, confirmarMockCotizacion, id);
      this.ultimaActualizada = res;
      await this.cargarCotizaciones();
      if (this.detalle && this.detalle.id === id) this.detalle = res;
      return res;
    },

    async cancelarCotizacion(id) {
      const res = await _or(apiCancelar, cancelarMockCotizacion, id);
      this.ultimaActualizada = res;
      await this.cargarCotizaciones();
      if (this.detalle && this.detalle.id === id) this.detalle = res;
      return res;
    },

    async crearCliente(datos) {
      if (USE_MOCK) {
        const cliente = {
          id: nextId("cliente"),
          nombre_rs: datos.nombre_rs,
          dni_cuit: datos.dni_cuit || null,
          telefono: datos.telefono || null,
          email: datos.email || null,
          direccion: datos.direccion || null,
          tipo: datos.tipo || "minorista",
          limite_credito: datos.limite_credito || 0,
          notas: datos.notas || null,
          activo: true,
          fecha_creacion: new Date().toISOString(),
        };
        db.clientes.push(cliente);
        persist();
        return cliente;
      } else {
        return await apiCrearCliente(datos);
      }
    },
  },
});

function _hoyMas(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

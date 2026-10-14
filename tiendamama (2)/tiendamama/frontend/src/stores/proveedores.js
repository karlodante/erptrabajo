import { defineStore } from "pinia";
import {
  listarProveedores as apiListar,
  listarSugerenciasProveedor as apiSugerencias,
  listarPedidosSugeridos as apiListaPedidos,
  obtenerPedidoSugerido as apiObtenerPedido,
  generarPedidoSugerido as apiGenerarPedido,
  actualizarPedidoSugerido as apiActualizarPedido,
  marcarPedidoEnviado as apiMarcarEnviado,
  crearProveedor as apiCrearProveedor,
} from "@/api/proveedores.js";
import {
  mockListarProveedores,
  mockObtenerProveedor,
  mockSugerencias,
  mockListarPedidos,
  mockObtenerPedido,
  mockGenerarPedido,
  mockActualizarPedido,
  textoPedidoParaWhatsApp,
  htmlPedidoImprimible,
} from "@/api/mockPedidosProveedores.js";
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

export const useProveedoresStore = defineStore("proveedores", {
  state: () => ({
    loading: false,

    proveedores: [],
    busquedaProveedor: "",
    soloActivos: true,

    sugerencias: { resumen: null, grupos: [], timestamp: null },
    umbralStock: 130,

    pedidos: [],
    pedidosTotal: 0,
    filtroPedidos: {
      estado: "",
      proveedor_id: null,
      page: 1,
      perPage: 20,
    },

    // Carrito activo: agrupaciones aprobadas para generar pedido
    carritoGrupos: [], // mismo formato que sugerencias.grupos
    observacionesGenerales: "",

    ultimoPedido: null,
    detallePedido: null,
  }),

  getters: {
    totalCriticos: (s) => s.sugerencias?.resumen?.criticos ?? 0,
    totalAlta: (s) => s.sugerencias?.resumen?.alta ?? 0,
    totalMedia: (s) => s.sugerencias?.resumen?.media ?? 0,
    totalProductosSugeridos: (s) => s.sugerencias?.resumen?.total_productos_sugeridos ?? 0,
    totalUnidadesSugeridas: (s) => s.sugerencias?.resumen?.total_unidades_sugeridas ?? 0,

    carritoTotalUnidades: (s) =>
      s.carritoGrupos.reduce(
        (acc, g) => acc + g.items.reduce((s2, i) => s2 + Number(i.cantidad_aprobada ?? 0), 0),
        0,
      ),
    carritoTotalItems: (s) => s.carritoGrupos.reduce((acc, g) => acc + g.items.length, 0),
    carritoProveedores: (s) => s.carritoGrupos.length,
  },

  actions: {
    async cargarTodo() {
      this.loading = true;
      try {
        await Promise.all([
          this.cargarProveedores(),
          this.cargarSugerencias(),
          this.cargarPedidos(),
        ]);
      } finally {
        this.loading = false;
      }
    },

    async cargarProveedores() {
      this.proveedores = await _or(apiListar, mockListarProveedores, {
        q: this.busquedaProveedor || undefined,
        soloActivos: this.soloActivos,
      });
      return this.proveedores;
    },

    proveedorPorId(id) {
      return this.proveedores.find(p => p.id === Number(id))
        ?? mockObtenerProveedor(id);
    },

    async cargarSugerencias() {
      const data = await _or(apiSugerencias, mockSugerencias, {
        umbral_pct: this.umbralStock,
      });
      this.sugerencias = data;
      // Copiar sugerencias al carrito editable (por defecto todas aprobadas)
      this.carritoGrupos = data.grupos.map(g => ({
        proveedor_id: g.proveedor_id,
        proveedor: g.proveedor,
        urgencia_max: g.urgencia_max,
        items: g.items.map(it => ({
          ...it,
          cantidad_aprobada: it.cantidad_aprobada ?? it.cantidad_sugerida,
        })),
        total_productos: g.total_productos,
        total_unidades_sugeridas: g.total_unidades_sugeridas,
        total_unidades_aprobadas: g.items.reduce((s, i) => s + Number(i.cantidad_aprobada ?? i.cantidad_sugerida), 0),
      }));
      this.recalcularTotalesCarrito();
      return data;
    },

    recalcularTotalesCarrito() {
      for (const g of this.carritoGrupos) {
        g.total_unidades_aprobadas = g.items.reduce((s, i) => s + Number(i.cantidad_aprobada ?? 0), 0);
      }
    },

    setCantidadAprobada(proveedorId, productoId, valor) {
      const g = this.carritoGrupos.find(x => x.proveedor_id === proveedorId);
      if (!g) return;
      const it = g.items.find(x => x.producto_id === productoId);
      if (!it) return;
      it.cantidad_aprobada = Math.max(0, Math.round(Number(valor) || 0));
      this.recalcularTotalesCarrito();
    },

    ajustarTodasCantidadesPor(factor = 1) {
      for (const g of this.carritoGrupos) {
        for (const it of g.items) {
          it.cantidad_aprobada = Math.max(0, Math.round(Number(it.cantidad_sugerida) * factor));
        }
      }
      this.recalcularTotalesCarrito();
    },

    quitarItem(proveedorId, productoId) {
      const g = this.carritoGrupos.find(x => x.proveedor_id === proveedorId);
      if (!g) return;
      g.items = g.items.filter(i => i.producto_id !== productoId);
      g.total_productos = g.items.length;
      g.total_unidades_aprobadas = g.items.reduce((s, i) => s + Number(i.cantidad_aprobada ?? 0), 0);
      this.carritoGrupos = this.carritoGrupos.filter(x => x.items.length > 0);
    },

    quitarProveedorCompleto(proveedorId) {
      this.carritoGrupos = this.carritoGrupos.filter(g => g.proveedor_id !== proveedorId);
    },

    async cargarPedidos() {
      const params = { ...this.filtroPedidos };
      if (!params.estado) delete params.estado;
      if (!params.proveedor_id) delete params.proveedor_id;
      const data = await _or(apiListaPedidos, mockListarPedidos, params);
      this.pedidos = data.items ?? [];
      this.pedidosTotal = data.total ?? this.pedidos.length;
      return this.pedidos;
    },

    async obtenerDetallePedido(id) {
      this.detallePedido = await _or(apiObtenerPedido, mockObtenerPedido, id);
      return this.detallePedido;
    },

    async generarPedidoPorProveedor(proveedorId) {
      const g = this.carritoGrupos.find(x => x.proveedor_id === proveedorId);
      if (!g) return null;
      const items = g.items
        .filter(i => Number(i.cantidad_aprobada ?? 0) > 0)
        .map(i => ({
          producto_id: i.producto_id,
          cantidad_sugerida: i.cantidad_sugerida,
          cantidad_aprobada: i.cantidad_aprobada,
        }));
      if (items.length === 0) return null;
      const pedido = await _or(apiGenerarPedido, mockGenerarPedido, {
        proveedor_id: proveedorId,
        detalles: items,
        observaciones: this.observacionesGenerales || null,
        estado: "pendiente",
      });
      this.ultimoPedido = pedido;
      await this.cargarPedidos();
      // Quitar del carrito al generar
      this.carritoGrupos = this.carritoGrupos.filter(x => x.proveedor_id !== proveedorId);
      return pedido;
    },

    async generarTodosLosPedidos() {
      const ids = this.carritoGrupos.map(g => g.proveedor_id);
      const creados = [];
      for (const id of ids) {
        const p = await this.generarPedidoPorProveedor(id);
        if (p) creados.push(p);
      }
      return creados;
    },

    async marcarEnviado(id) {
      const r = await _or(apiMarcarEnviado, mockActualizarPedido, id, { estado: "enviado" });
      if (r) await this.cargarPedidos();
      return r;
    },

    async cancelarPedido(id) {
      const r = await _or(
        async (i) => (await apiActualizarPedido(i, { estado: "cancelado" })),
        mockActualizarPedido,
        id,
        { estado: "cancelado" },
      );
      if (r) await this.cargarPedidos();
      return r;
    },

    async crearProveedor(datos) {
      if (USE_MOCK) {
        const proveedor = {
          id: nextId("proveedor"),
          nombre: datos.nombre,
          telefono: datos.telefono || null,
          email: datos.email || null,
          direccion: datos.direccion || null,
          cuit: datos.cuit || null,
          notas: datos.notas || null,
          activo: true,
          fecha_creacion: new Date().toISOString(),
        };
        db.proveedores.push(proveedor);
        persist();
        return proveedor;
      } else {
        return await apiCrearProveedor(datos);
      }
    },

    setFiltroPedido(clave, valor) {
      this.filtroPedidos[clave] = valor;
      if (clave !== "page") this.filtroPedidos.page = 1;
    },

    textoWhatsApp(pedidoOProveedor, items, extra = {}) {
      return textoPedidoParaWhatsApp(pedidoOProveedor, items, extra);
    },

    htmlImprimible(pedidoOProveedor, items, extra = {}) {
      return htmlPedidoImprimible(pedidoOProveedor, items, extra);
    },

    async imprimirPedido(proveedor, items, opts = {}) {
      const html = this.htmlImprimible(proveedor, items, opts);
      const printWindow = window.open("", "_blank", "width=780,height=900");
      if (!printWindow) return false;
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
      return true;
    },

    async copiarTextoWhatsApp(proveedor, items, opts = {}) {
      const txt = this.textoWhatsApp(proveedor, items, opts);
      try {
        await navigator.clipboard.writeText(txt);
        return { ok: true, txt };
      } catch {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = txt;
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch { ok = false; }
        document.body.removeChild(ta);
        return { ok, txt };
      }
    },
  },
});

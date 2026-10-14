import { defineStore } from "pinia";
import {
  buscarProductoPorCodigo as apiPorCodigo,
  buscarProductos as apiBuscar,
  obtenerPreciosVolumen as apiPreciosVol,
  crearVenta as apiCrearVenta,
} from "@/api/pos.js";
import {
  buscarMockProductoPorCodigo,
  buscarMockProductos,
  obtenerMockPreciosVolumen,
} from "@/api/mockPos.js";
import { db, persist, nextId } from "@/api/localDb.js";
import { consumirStockMock } from "@/api/mockInventario.js";
import { useInventarioStore } from "./inventario.js";

const USE_MOCK = true;

async function _apiOr(fnApi, fnMock, ...args) {
  if (USE_MOCK) return fnMock(...args);
  try {
    return await fnApi(...args);
  } catch (err) {
    if (err?.code === "ERR_NETWORK" || !err?.response) {
      return fnMock(...args);
    }
    throw err;
  }
}

export const usePosStore = defineStore("pos", {
  state: () => ({
    loading: false,
    lastFlash: null,
    ventaConfirmada: null,
    mostrarTicket: false,
    cajaAbierta: true,

    items: [],
    pagos: [],
    observaciones: "",

    preciosVolumenCache: new Map(),

    busqueda: "",
    resultadosBusqueda: [],
  }),

  getters: {
    carritoVacio: (s) => s.items.length === 0,

    cantidadTotalItems: (s) =>
      s.items.reduce((acc, it) => acc + (Number(it?.cantidad) || 0), 0),

    subtotalBruto: (s) =>
      parseFloat(
        s.items
          .reduce(
            (acc, it) => acc + (Number(it?.producto?.precio_unitario) || 0) * (Number(it?.cantidad) || 0),
            0,
          )
          .toFixed(2),
      ),

    subtotalAplicado: (s) =>
      parseFloat(
        s.items
          .reduce(
            (acc, it) =>
              acc +
              (Number(it?.precio_aplicado ?? it?.producto?.precio_unitario) || 0) *
                (Number(it?.cantidad) || 0),
            0,
          )
          .toFixed(2),
      ),

    descuentoTotal() {
      return parseFloat((Number(this.subtotalBruto) - Number(this.subtotalAplicado)).toFixed(2));
    },

    totalVenta() {
      return parseFloat(Number(this.subtotalAplicado).toFixed(2));
    },

    pagadoTotal: (s) =>
      parseFloat(
        s.pagos.reduce((acc, p) => acc + (Number(p?.monto) || 0), 0).toFixed(2),
      ),

    pagoEfectivo: (s) =>
      parseFloat(
        Number(s.pagos.find((p) => p.forma_pago === "efectivo")?.monto ?? 0).toFixed(2),
      ),

    pagoQR: (s) =>
      parseFloat(
        Number(s.pagos.find((p) => p.forma_pago === "qr")?.monto ?? 0).toFixed(2),
      ),

    cambioEfectivo() {
      const ef = Number(this.pagoEfectivo);
      if (ef <= 0) return 0;
      return parseFloat(
        Math.max(0, ef - this.totalVenta + (this.totalVenta - Number(this.pagadoTotal))).toFixed(2),
      );
    },

    qrPendiente: (s) =>
      s.pagos.some((p) => p.forma_pago === "qr" && p.estado === "pendiente"),

    qrConfirmado: (s) =>
      s.pagos.some((p) => p.forma_pago === "qr" && p.estado === "confirmado"),

    puedeFinalizar() {
      return (
        !this.carritoVacio &&
        (this.pagadoTotal >= this.totalVenta - 0.05 || this.qrPendiente) &&
        !this.qrPendiente
      );
    },
  },

  actions: {
    _flash(tipo, mensaje) {
      const id = Date.now();
      this.lastFlash = { id, tipo, mensaje };
      setTimeout(() => {
        if (this.lastFlash?.id === id) this.lastFlash = null;
      }, 1600);
    },

    async escanearCodigo(codigo) {
      if (!codigo || !codigo.trim()) return null;
      const c = codigo.trim();
      const existente = this.items.find(
        (it) =>
          it.producto.codigo_barras === c ||
          it.producto.sku === c ||
          String(it.producto.id) === c,
      );
      if (existente) {
        return this.incrementarCantidad(existente.id, 1);
      }
      this.loading = true;
      try {
        const prod = await _apiOr(apiPorCodigo, buscarMockProductoPorCodigo, c);
        if (!prod) {
          this._flash("error", `Código ${c} no encontrado`);
          return null;
        }
        await this._agregarProductoAlCarrito(prod);
        this._flash("ok", `Agregado: ${prod.nombre}`);
        return prod;
      } finally {
        this.loading = false;
      }
    },

    async _cargarPreciosVolumenSiNo(productoId) {
      if (this.preciosVolumenCache.has(productoId)) return;
      const lista = await _apiOr(
        apiPreciosVol,
        obtenerMockPreciosVolumen,
        productoId,
      );
      this.preciosVolumenCache.set(productoId, lista);
    },

    _calcularPrecioAplicado(producto, cantidad) {
      const lista = this.preciosVolumenCache.get(producto.id) ?? [];
      const preciosActivos = lista
        .filter((pv) => pv.activo)
        .sort((a, b) => b.cantidad_minima - a.cantidad_minima);
      for (const pv of preciosActivos) {
        if (cantidad >= pv.cantidad_minima) {
          return parseFloat(parseFloat(pv.precio_especial).toFixed(2));
        }
      }
      return parseFloat(parseFloat(producto.precio_unitario).toFixed(2));
    },

    _tienePrecioVolumenAplicado(producto, cantidad) {
      const pAplicado = this._calcularPrecioAplicado(producto, cantidad);
      return pAplicado < Number(producto.precio_unitario);
    },

    async _agregarProductoAlCarrito(producto) {
      await this._cargarPreciosVolumenSiNo(producto.id);
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const precio = this._calcularPrecioAplicado(producto, 1);
      this.items.push({
        id,
        producto_id: producto.id,
        producto,
        cantidad: 1,
        precio_aplicado: precio,
        precio_volumen_aplicado: this._tienePrecioVolumenAplicado(producto, 1),
      });
    },

    async agregarProductoDesdeBusqueda(producto) {
      const existente = this.items.find((it) => it.producto_id === producto.id);
      if (existente) {
        return this.incrementarCantidad(existente.id, 1);
      }
      await this._agregarProductoAlCarrito(producto);
      this._flash("ok", `Agregado: ${producto.nombre}`);
    },

    async incrementarCantidad(itemId, delta = 1) {
      const it = this.items.find((x) => x.id === itemId);
      if (!it) return;
      const nuevaCant = Number(it.cantidad) + delta;
      if (nuevaCant <= 0) {
        this.removerItem(itemId);
        return;
      }
      // Eliminar restricción de stock para permitir agregar más productos
      // if (nuevaCant > it.producto.stock_total) {
      //   this._flash("error", `Stock insuficiente: ${it.producto.nombre}`);
      //   return;
      // }
      it.cantidad = nuevaCant;
      const precio = this._calcularPrecioAplicado(it.producto, nuevaCant);
      it.precio_aplicado = precio;
      it.precio_volumen_aplicado = this._tienePrecioVolumenAplicado(
        it.producto,
        nuevaCant,
      );
      // Forzar reactividad
      this.items = [...this.items];
    },

    cambiarCantidad(itemId, nuevaCantidad) {
      const it = this.items.find((x) => x.id === itemId);
      if (!it) return;
      const cant = Math.max(1, Math.floor(Number(nuevaCantidad) || 1));
      // Eliminar restricción de stock para permitir agregar más productos
      // if (cant > it.producto.stock_total) {
      //   this._flash("error", `Stock insuficiente: ${it.producto.nombre}`);
      //   return;
      // }
      it.cantidad = cant;
      const precio = this._calcularPrecioAplicado(it.producto, cant);
      it.precio_aplicado = precio;
      it.precio_volumen_aplicado = this._tienePrecioVolumenAplicado(
        it.producto,
        cant,
      );
    },

    actualizarPrecioSegunCantidad(itemId) {
      const it = this.items.find((x) => x.id === itemId);
      if (!it) return;
      const cant = Math.max(1, Math.floor(Number(it.cantidad) || 1));
      // Eliminar restricción de stock para permitir agregar más productos
      // if (cant > it.producto.stock_total) {
      //   this._flash("error", `Stock insuficiente: ${it.producto.nombre}`);
      //   it.cantidad = it.producto.stock_total;
      //   return;
      // }
      const precio = this._calcularPrecioAplicado(it.producto, cant);
      it.precio_aplicado = precio;
      it.precio_volumen_aplicado = this._tienePrecioVolumenAplicado(
        it.producto,
        cant,
      );
      // Forzar reactividad
      this.items = [...this.items];
    },

    removerItem(itemId) {
      const i = this.items.findIndex((x) => x.id === itemId);
      if (i >= 0) this.items.splice(i, 1);
    },

    vaciarCarrito() {
      this.items = [];
      this.pagos = [];
      this.observaciones = "";
    },

    async realizarBusqueda(q) {
      this.busqueda = q;
      if (!q || q.trim().length < 2) {
        this.resultadosBusqueda = [];
        return;
      }
      try {
        const res = await _apiOr(apiBuscar, buscarMockProductos, q.trim(), {
          page: 1,
          perPage: 15,
        });
        this.resultadosBusqueda = res.items ?? [];
      } catch (err) {
        this.resultadosBusqueda = [];
      }
    },

    limpiarBusqueda() {
      this.busqueda = "";
      this.resultadosBusqueda = [];
    },

    _crearOActualizarPago(forma_pago, monto, estado = "confirmado") {
      const montoN = Number(monto);
      if (montoN <= 0) {
        const i = this.pagos.findIndex((p) => p.forma_pago === forma_pago);
        if (i >= 0) this.pagos.splice(i, 1);
        return;
      }
      const existente = this.pagos.find((p) => p.forma_pago === forma_pago);
      if (existente) {
        existente.monto = montoN;
        existente.estado = estado;
      } else {
        this.pagos.push({ forma_pago, monto: montoN, estado });
      }
    },

    setPagoEfectivo(monto) {
      this._crearOActualizarPago("efectivo", monto);
    },

    setPagoQR(monto, estado = "pendiente") {
      this._crearOActualizarPago("qr", monto, estado);
    },

    confirmarQR() {
      const p = this.pagos.find((x) => x.forma_pago === "qr");
      if (p) p.estado = "confirmado";
      this._flash("ok", "Pago QR confirmado");
    },

    async finalizarVenta() {
      if (this.carritoVacio) {
        this._flash("error", "Carrito vacío");
        return null;
      }
      this.loading = true;
      try {
        const payload = {
          items: this.items.map((it) => ({
            producto_id: it.producto_id,
            cantidad: it.cantidad,
          })),
          pagos: this.pagos.map((p) => ({
            forma_pago: p.forma_pago.toUpperCase(),
            monto: Number(p.monto),
          })),
          estado: "pagada",
          observaciones: this.observaciones || undefined,
        };

        let venta;
        if (USE_MOCK) {
          venta = this._mockCrearVenta(payload);
        } else {
          try {
            venta = await apiCrearVenta(payload);
          } catch (err) {
            venta = this._mockCrearVenta(payload);
          }
        }

        this.ventaConfirmada = venta;
        this.mostrarTicket = true;
        this._flash("ok", `Venta #${venta.numero_comprobante} registrada`);
        return venta;
      } catch (err) {
        this._flash(
          "error",
          err?.response?.data?.detail ?? "Error al registrar la venta",
        );
        return null;
      } finally {
        this.loading = false;
      }
    },

    _mockCrearVenta(payload) {
      const now = new Date();
      const ventaId = nextId("venta");
      const numeroComprobante = Math.floor(Math.random() * 9000) + 1000;

      const venta = {
        id: ventaId,
        numero_comprobante: numeroComprobante,
        fecha_hora: now.toISOString(),
        usuario_id: 1,
        cliente_id: null,
        subtotal: parseFloat(this.subtotalBruto.toFixed(2)),
        descuento_total: parseFloat(this.descuentoTotal.toFixed(2)),
        total: parseFloat(this.totalVenta.toFixed(2)),
        estado: "pagada",
        observaciones: this.observaciones || null,
        detalle_ventas: this.items.map((it) => ({
          id: Math.random(),
          producto_id: it.producto_id,
          producto_nombre: it.producto.nombre,
          cantidad: it.cantidad,
          precio_unitario_aplicado: parseFloat(it.precio_aplicado.toFixed(2)),
          descuento_unitario: parseFloat(
            (Number(it.producto.precio_unitario) - it.precio_aplicado).toFixed(2)
          ),
          subtotal: parseFloat((it.precio_aplicado * it.cantidad).toFixed(2)),
        })),
        pagos: this.pagos.map((p, i) => ({
          id: i + 1,
          forma_pago: p.forma_pago.toUpperCase(),
          monto: parseFloat(Number(p.monto).toFixed(2)),
        })),
      };

      // Guardar venta en base de datos local
      db.ventas.push(venta);

      // Descontar stock de cada producto
      for (const item of this.items) {
        consumirStockMock(item.producto_id, item.cantidad);
      }

      // Recargar inventario para actualizar el stock mostrado
      const inventarioStore = useInventarioStore();
      inventarioStore.cargarProductos().catch((err) => {
        console.error("Error al recargar inventario:", err);
      });

      // Registrar movimiento de caja por cada pago
      this.pagos.forEach((p, i) => {
        const movimiento = {
          id: nextId("movimiento"),
          arqueo_id: null,
          categoria: "venta",
          subcategoria: p.forma_pago.toUpperCase(),
          descripcion: `Venta #${numeroComprobante} - ${p.forma_pago.toUpperCase()}`,
          monto: parseFloat(Number(p.monto).toFixed(2)),
          fecha_hora: now.toISOString(),
          usuario_id: 1,
        };
        db.movimientos.push(movimiento);
      });

      persist();

      return venta;
    },

    cerrarTicketYSiguiente() {
      this.mostrarTicket = false;
      this.ventaConfirmada = null;
      this.vaciarCarrito();
    },

    cerrarTicket() {
      this.mostrarTicket = false;
    },
  },
});

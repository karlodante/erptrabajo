<template>
  <div class="flex flex-col gap-gap-card min-w-0">
    <TmCard padding="none" class="overflow-hidden">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border-b border-border">
        <div>
          <h2 class="text-h2 font-extrabold text-neutral-800">Integración Dolibarr ERP</h2>
          <p class="text-caption text-neutral-500 mt-1">
            Productos y stock desde Dolibarr; las ventas de caja se envían como facturas.
          </p>
        </div>
        <div v-if="sesion" class="flex items-center gap-2 flex-wrap">
          <TmButton variant="ghost" :icon="RefreshIcon" :loading="cargando" @click="cargarTodo">
            Actualizar estado
          </TmButton>
          <TmButton variant="outline" :icon="SendIcon" :loading="reintentando"
                    :disabled="!estado?.online || pendientes.length === 0" @click="reintentar">
            Reintentar ventas pendientes
          </TmButton>
          <TmButton variant="primary" :icon="DownloadIcon" :loading="sincronizando"
                    :disabled="!estado?.online" @click="sincronizar">
            Sincronizar productos desde Dolibarr
          </TmButton>
        </div>
      </div>

      <!-- Login (los endpoints requieren JWT) -->
      <form v-if="!sesion" class="p-5 flex flex-col gap-3 max-w-sm" @submit.prevent="login">
        <p class="text-body-sm text-neutral-600">
          Iniciá sesión con un usuario administrador para usar la integración.
        </p>
        <input v-model="cred.username" placeholder="Usuario" autocomplete="username" required />
        <input v-model="cred.password" type="password" placeholder="Contraseña"
               autocomplete="current-password" required />
        <p v-if="errorLogin" class="text-caption text-danger-600">{{ errorLogin }}</p>
        <TmButton native-type="submit" :loading="logueando" :icon="LogInIcon">Ingresar</TmButton>
      </form>

      <div v-else class="p-5 flex flex-col gap-5">
        <div class="tm-stat-grid">
          <Kpi title="Conexión" :value="conexionLabel" :sub-value="estado?.url ?? ''"
               :icon="estado?.online ? WifiIcon : WifiOffIcon"
               :tone="estado?.online ? 'success' : 'danger'" />
          <Kpi title="Versión Dolibarr" :value="estado?.version ?? '—'"
               :sub-value="estado?.habilitado === false ? 'Integración deshabilitada' : 'API REST'"
               :icon="ServerIcon" tone="primary" />
          <Kpi title="Ventas pendientes" :value="String(estado?.ventas_pendientes ?? pendientes.length)"
               sub-value="sin enviar a Dolibarr" :icon="ClockIcon"
               :tone="(estado?.ventas_pendientes ?? 0) > 0 ? 'warning' : 'success'" />
          <Kpi title="Última sincronización" :value="ultimaSync ? horaCorta(ultimaSync.fecha) : '—'"
               :sub-value="ultimaSync ? `${ultimaSync.res.lotes_creados?.length ?? 0} lote(s) creados` : 'en esta sesión'"
               :icon="PackageIcon" tone="info" />
        </div>

        <div v-if="estado?.error"
             class="flex items-start gap-3 p-4 rounded-xl bg-danger-50 text-danger-700 text-body-sm">
          <component :is="AlertIcon" class="w-5 h-5 shrink-0 mt-0.5" />
          <span class="break-all">{{ estado.error }}</span>
        </div>

        <TmCard padding="none" class="overflow-hidden">
          <h3 class="text-h4 text-neutral-800 px-5 pt-4 pb-3 border-b border-border">
            Ventas pendientes de envío
          </h3>
          <TmDataTable :rows="pendientes" :columns="COLS_PENDIENTES" row-key="venta_id"
                       :searchable="false" :per-page="10" :loading="cargando"
                       empty-text="No hay ventas pendientes: todo está sincronizado.">
            <template #cell:fecha_hora="{ row }">{{ fechaHora(row.fecha_hora) }}</template>
            <template #cell:total="{ row }">{{ dinero(row.total) }}</template>
            <template #cell:ultimo_error="{ row }">
              <span class="text-caption text-danger-600 whitespace-normal line-clamp-2 max-w-md block"
                    :title="row.ultimo_error">{{ row.ultimo_error || "—" }}</span>
            </template>
            <template #cell:acciones="{ row }">
              <TmButton size="sm" variant="ghost" :icon="SendIcon" :loading="enviando === row.venta_id"
                        :disabled="!estado?.online" @click="enviar(row)">
                Enviar
              </TmButton>
            </template>
          </TmDataTable>
        </TmCard>

        <div class="flex justify-end">
          <button type="button" class="text-caption text-neutral-500 hover:text-danger-600" @click="logout">
            Cerrar sesión de la integración
          </button>
        </div>
      </div>
    </TmCard>

    <!-- Resultado de sincronización / reintento -->
    <TmModal v-model="modal.abierto" :title="modal.titulo" size="lg" :icon="modal.icono">
      <template v-if="modal.tipo === 'sync'">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Resumen label="Recibidos" :valor="modal.res.recibidos" />
          <Resumen label="Creados" :valor="modal.res.creados" />
          <Resumen label="Actualizados" :valor="modal.res.actualizados" />
          <Resumen label="Lotes creados" :valor="modal.res.lotes_creados?.length ?? 0" />
        </div>
        <Seccion v-if="modal.res.lotes_creados?.length" titulo="Lotes iniciales creados en el POS">
          <li v-for="l in modal.res.lotes_creados" :key="l.producto_id">
            <b>{{ l.sku }}</b> · {{ l.nombre }} — {{ l.cantidad }} u. (vence {{ l.fecha_vencimiento }})
          </li>
        </Seccion>
        <Seccion v-if="modal.res.diferencias_stock?.length" titulo="Diferencias de stock (POS vs Dolibarr)">
          <li v-for="d in modal.res.diferencias_stock" :key="d.producto_id">
            <b>{{ d.sku }}</b> · {{ d.nombre }} — POS {{ d.stock_local }} / Dolibarr {{ d.stock_dolibarr }}
          </li>
        </Seccion>
        <Seccion v-if="modal.res.errores?.length" titulo="Errores" tono="danger">
          <li v-for="(e, i) in modal.res.errores" :key="i">#{{ e.dolibarr_id }}: {{ e.error }}</li>
        </Seccion>
      </template>
      <template v-else-if="modal.tipo === 'retry'">
        <div class="grid grid-cols-3 gap-3 mb-5">
          <Resumen label="Procesadas" :valor="modal.res.procesadas ?? 0" />
          <Resumen label="Enviadas" :valor="modal.res.enviadas ?? 0" />
          <Resumen label="Fallidas" :valor="modal.res.fallidas ?? 0" />
        </div>
        <Seccion v-if="fallidas.length" titulo="Ventas con error" tono="danger">
          <li v-for="d in fallidas" :key="d.venta_id">Venta #{{ d.venta_id }}: {{ d.error }}</li>
        </Seccion>
      </template>
      <template #footer>
        <TmButton @click="modal.abierto = false">Cerrar</TmButton>
      </template>
    </TmModal>
  </div>
</template>

<script setup>
import { computed, h, inject, onMounted, reactive, ref } from "vue";
import {
  AlertTriangle as AlertIcon,
  CheckCircle as CheckIcon,
  Clock as ClockIcon,
  Download as DownloadIcon,
  LogIn as LogInIcon,
  Package as PackageIcon,
  RefreshCw as RefreshIcon,
  Send as SendIcon,
  Server as ServerIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
} from "lucide-vue-next";
import { TmButton, TmCard, TmDataTable, TmModal } from "@/components/ui";
import * as api from "@/api/dolibarr.js";

const toast = inject("$toast");

const COLS_PENDIENTES = [
  { key: "numero_comprobante", label: "Comprobante" },
  { key: "fecha_hora", label: "Fecha" },
  { key: "total", label: "Total", align: "right" },
  { key: "intentos", label: "Intentos", align: "center" },
  { key: "ultimo_error", label: "Último error" },
  { key: "acciones", label: "", align: "right" },
];

const sesion = ref(api.tieneSesion());
const cred = reactive({ username: "", password: "" });
const logueando = ref(false);
const errorLogin = ref("");

const estado = ref(null);
const pendientes = ref([]);
const cargando = ref(false);
const sincronizando = ref(false);
const reintentando = ref(false);
const enviando = ref(null);
const ultimaSync = ref(null);
const modal = reactive({ abierto: false, tipo: "", titulo: "", icono: null, res: {} });

const conexionLabel = computed(() => {
  if (!estado.value) return "—";
  if (!estado.value.habilitado) return "Deshabilitada";
  return estado.value.online ? "En línea" : "Sin conexión";
});
const fallidas = computed(() => (modal.res.detalle ?? []).filter((d) => !d.ok));

function mensajeError(err) {
  const d = err?.response?.data?.detail;
  if (Array.isArray(d)) return d.map((x) => x.msg).join("; ");
  return d ?? err?.message ?? "Error desconocido";
}

function manejarError(err, titulo) {
  if (err?.response?.status === 401) {
    api.cerrarSesion();
    sesion.value = false;
    errorLogin.value = "La sesión expiró. Volvé a ingresar.";
    return;
  }
  toast?.error(titulo, mensajeError(err));
}

async function login() {
  logueando.value = true;
  errorLogin.value = "";
  try {
    await api.iniciarSesion(cred.username.trim(), cred.password);
    cred.password = "";
    sesion.value = true;
    await cargarTodo();
  } catch (err) {
    errorLogin.value = err?.response?.status === 401
      ? "Usuario o contraseña incorrectos."
      : `No se pudo conectar con el backend: ${mensajeError(err)}`;
  } finally {
    logueando.value = false;
  }
}

function logout() {
  api.cerrarSesion();
  sesion.value = false;
  estado.value = null;
  pendientes.value = [];
}

async function cargarTodo() {
  cargando.value = true;
  try {
    const [e, p] = await Promise.all([api.obtenerEstado(), api.listarVentasPendientes()]);
    estado.value = e;
    pendientes.value = p;
  } catch (err) {
    manejarError(err, "No se pudo obtener el estado de Dolibarr");
  } finally {
    cargando.value = false;
  }
}

async function sincronizar() {
  sincronizando.value = true;
  try {
    const res = await api.sincronizarProductos();
    ultimaSync.value = { fecha: new Date(), res };
    Object.assign(modal, {
      abierto: true, tipo: "sync", titulo: "Productos sincronizados", icono: CheckIcon, res,
    });
    toast?.success("Sincronización completa",
      `${res.creados} creados, ${res.actualizados} actualizados, ${res.lotes_creados?.length ?? 0} lotes.`);
  } catch (err) {
    manejarError(err, "Error al sincronizar productos");
  } finally {
    sincronizando.value = false;
    await cargarTodo();
  }
}

async function reintentar() {
  reintentando.value = true;
  try {
    const res = await api.reintentarPendientes();
    Object.assign(modal, {
      abierto: true, tipo: "retry", titulo: "Reintento de ventas pendientes", icono: SendIcon, res,
    });
  } catch (err) {
    manejarError(err, "Error al reintentar ventas");
  } finally {
    reintentando.value = false;
    await cargarTodo();
  }
}

async function enviar(row) {
  enviando.value = row.venta_id;
  try {
    const res = await api.enviarVenta(row.venta_id);
    if (res.ok) toast?.success(`Venta #${row.numero_comprobante} enviada`, `Factura Dolibarr ${res.dolibarr_factura_id}`);
    else toast?.error(`Venta #${row.numero_comprobante} no enviada`, res.error);
  } catch (err) {
    manejarError(err, "Error al enviar la venta");
  } finally {
    enviando.value = null;
    await cargarTodo();
  }
}

const dinero = (v) => Number(v ?? 0).toLocaleString("es", { style: "currency", currency: "USD" });
const fechaHora = (v) => (v ? new Date(v).toLocaleString("es") : "—");
const horaCorta = (d) => d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

onMounted(() => {
  if (sesion.value) cargarTodo();
});

const Kpi = {
  props: ["title", "value", "subValue", "icon", "tone"],
  setup(p) {
    const tones = {
      primary: "bg-primary-50 text-primary-700",
      success: "bg-success-50 text-success-700",
      warning: "bg-warning-50 text-warning-700",
      danger: "bg-danger-50 text-danger-700",
      info: "bg-primary-50 text-primary-700",
    };
    return () =>
      h("div", { class: "tm-stat" }, [
        h("div", { class: ["tm-stat-icon", tones[p.tone] ?? tones.primary] }, [
          h(p.icon, { class: "w-[18px] h-[18px]" }),
        ]),
        h("p", { class: "tm-stat-label mt-4" }, p.title),
        h("p", { class: "tm-stat-value mt-1" }, p.value),
        p.subValue ? h("p", { class: "text-caption-xs text-neutral-500 mt-0.5 truncate" }, p.subValue) : null,
      ]);
  },
};

const Resumen = {
  props: ["label", "valor"],
  setup(p) {
    return () =>
      h("div", { class: "p-3 rounded-xl bg-neutral-50 border border-border" }, [
        h("p", { class: "text-caption-xs text-neutral-500" }, p.label),
        h("p", { class: "text-h3 font-extrabold text-neutral-800 tabular" }, String(p.valor ?? 0)),
      ]);
  },
};

const Seccion = {
  props: ["titulo", "tono"],
  setup(p, { slots }) {
    return () =>
      h("div", { class: "mb-4" }, [
        h("p", { class: ["text-body-sm font-bold mb-2", p.tono === "danger" ? "text-danger-700" : "text-neutral-700"] }, p.titulo),
        h("ul", { class: "text-caption text-neutral-600 space-y-1 max-h-48 overflow-y-auto list-disc pl-5" }, slots.default?.()),
      ]);
  },
};
</script>

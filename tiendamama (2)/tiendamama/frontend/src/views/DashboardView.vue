<template>
  <div class="flex flex-col gap-gap-card min-w-0">
    <div
      v-if="viewError"
      class="rounded-2xl border border-danger-200 bg-danger-50 p-6 text-danger-800"
    >
      <div class="flex items-start gap-3">
        <component :is="XCircleIcon" class="w-6 h-6 text-danger-500 shrink-0 mt-0.5" />
        <div class="min-w-0 flex-1">
          <h3 class="text-h4 font-extrabold text-danger-900 mb-1">
            No se pudo cargar el Dashboard
          </h3>
          <p class="text-caption font-semibold mb-3">{{ viewError }}</p>
          <div class="flex items-center gap-2">
            <TmButton size="md" variant="primary" :icon="RefreshIcon" @click="forzarRecarga">
              Reintentar
            </TmButton>
            <TmButton size="md" variant="ghost" @click="viewError = null; errorDetalle = null">
              Cerrar aviso
            </TmButton>
          </div>
          <details v-if="errorDetalle" class="mt-4 text-xs font-mono bg-white/60 border border-danger-100 rounded-lg p-3 whitespace-pre-wrap">
            <summary class="font-bold cursor-pointer text-danger-700">Detalle técnico</summary>
            {{ errorDetalle }}
          </details>
        </div>
      </div>
    </div>

    <TmCard v-else-if="store.loading && store.ventas7dias.length === 0" class="p-6">
      <div class="flex items-center gap-3 text-neutral-500">
        <component :is="RefreshIcon" class="w-5 h-5 animate-spin" />
        <p class="text-caption font-bold">Cargando KPIs, ventas y alertas…</p>
      </div>
    </TmCard>

    <div v-else class="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-gap-card">
    <!-- Columna IZQUIERDA: KPIs + Gráfico + Últimas ventas -->
    <div class="flex flex-col gap-gap-card min-w-0">
      <!-- KPIs -->
      <section class="tm-stat-grid">
        <KpiTarjeta
          title="Ventas de hoy"
          :value="formatearMonto(kpis?.ventas_hoy)"
          :delta="kpis?.delta_ventas_vs_ayer"
          label="vs. ayer"
          :icon="ReceiptIcon"
          tone="primary"
        />
        <KpiTarjeta
          title="Tickets emitidos"
          :value="String(kpis?.tickets_hoy ?? 0)"
          :sub-value="`Promedio: ${formatearMonto(kpis?.ticket_promedio ?? 0)}`"
          :icon="TicketIcon"
          tone="secondary"
        />
        <KpiTarjeta
          title="Productos con stock crítico"
          :value="String(kpis?.stock_critico ?? 0)"
          :delta="kpis?.stock_critico ?? 0 > 0 ? -kpis.stock_critico : 0"
          :bad="true"
          label="requieren acción"
          :icon="PackageAlertIcon"
          tone="warning"
          to="/inventario"
        />
        <KpiTarjeta
          title="Lotes por vencer"
          :value="String(kpis?.lotes_por_vencer ?? 0)"
          subtitle-pronostico="próximos 7 días"
          :icon="CalendarClockIcon"
          tone="info"
          to="/inventario"
          :caja="kpis"
        />
      </section>

      <!-- Estado de caja -->
      <TmCard title="Caja" :subtitle="subtituloCaja">
        <template #header>
          <div class="flex items-center gap-3">
            <div
              class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              :class="kpis?.caja_abierta ? 'bg-success-50 text-success-600' : 'bg-neutral-100 text-neutral-500'"
            >
              <component
                :is="kpis?.caja_abierta ? CashRegisterIcon : LockIcon"
                class="w-[22px] h-[22px]"
              />
            </div>
            <div class="min-w-0">
              <h3 class="text-h4 text-neutral-800 leading-tight">Caja</h3>
              <p class="text-caption text-neutral-500">{{ subtituloCaja }}</p>
            </div>
          </div>
        </template>
        <template #actions>
          <TmButton
            :variant="kpis?.caja_abierta ? 'danger' : 'success'"
            size="sm"
            :to="kpis?.caja_abierta ? '/caja/arqueos' : '/caja'"
            :icon="kpis?.caja_abierta ? XCircleIcon : CheckCircleIcon"
          >
            {{ kpis?.caja_abierta ? "Cerrar caja" : "Abrir caja" }}
          </TmButton>
        </template>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Dato label="Fondo inicial" :value="formatearMonto(caja?.monto_inicial ?? 0)" />
          <Dato label="Apertura" :value="hora(caja?.hora_apertura)" tone="success" />
          <Dato
            label="Saldo proyectado"
            :value="formatearMonto(saldoProyectado)"
            tone="primary"
            strong
          />
          <Dato
            label="Último arqueo"
            value="—"
            :sub-value="caja ? `N° ${caja.id}` : undefined"
          />
        </div>
      </TmCard>

      <!-- Gráfico últimos 7 días -->
      <TmCard>
        <template #header>
          <div class="flex items-center justify-between w-full gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                <component :is="TrendingUpIcon" class="w-[22px] h-[22px]" />
              </div>
              <div class="min-w-0">
                <h3 class="text-h4 text-neutral-800 leading-tight">Ventas últimos 7 días</h3>
                <p class="text-caption text-neutral-500">Total: {{ total7dias }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <TmButton variant="ghost" size="sm">Semana</TmButton>
              <TmButton variant="outline" size="sm">Mes</TmButton>
            </div>
          </div>
        </template>
        <div class="h-[300px] mt-1">
          <Line v-if="chartData" :data="chartData" :options="chartOptions" />
        </div>
      </TmCard>
    </div>

    <!-- Columna DERECHA: Alertas principales + Quick actions -->
    <div class="flex flex-col gap-gap-card min-w-0">
      <!-- Semáforo grande -->
      <TmCard>
        <div class="flex items-center gap-4">
          <div class="relative shrink-0">
            <div
              class="w-16 h-16 rounded-full flex items-center justify-center"
              :class="semaforoBgClass"
            >
              <component
                :is="semaforoIcon"
                class="w-8 h-8 text-white drop-shadow-sm"
              />
            </div>
            <span
              class="absolute -bottom-1 -right-1 h-7 min-w-7 px-2 rounded-full text-caption-xs font-bold text-white shadow-sm tabular flex items-center justify-center ring-2 ring-white"
              :class="semaforoBadgeClass"
            >
              {{ store.alertaResumen.total_sin_leer }}
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-caption font-bold uppercase tracking-wider"
               :class="semaforoTextClass">
              Estado del negocio
            </p>
            <h3 class="text-h4 text-neutral-800 leading-tight mt-0.5">
              {{ store.semaforoLabel }}
            </h3>
            <div class="mt-3 flex items-center gap-2 flex-wrap">
              <span v-for="chip in resumenChips" :key="chip.label"
                    :class="[
                      'h-6', 'px-2.5', 'rounded-full', 'text-caption-xs', 'font-semibold', 'inline-flex', 'items-center', 'gap-1.5',
                      chip.tone,
                    ]">
                <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                {{ chip.label }}: <b class="tabular">{{ chip.count }}</b>
              </span>
            </div>
          </div>
        </div>
      </TmCard>

      <!-- Últimas alertas -->
      <TmCard
        title="Últimas alertas"
        :subtitle="`${store.alertas.length} sin leer`"
      >
        <template #actions>
          <TmButton
            size="sm"
            variant="ghost"
            :icon="RefreshIcon"
            @click="store.cargarTodo()"
            title="Actualizar"
          />
          <RouterLink to="/inventario">
            <TmButton size="sm" variant="outline">Ver todas</TmButton>
          </RouterLink>
        </template>
        <ul class="flex flex-col divide-y divide-border/70 -mx-2">
          <li
            v-for="a in store.alertas.slice(0, 6)"
            :key="a.id"
            class="px-2 py-3 group"
          >
            <div class="flex items-start gap-3">
              <div
                class="mt-0.5 w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                :class="iconBgFor(a)"
              >
                <component :is="iconFor(a)" class="w-[17px] h-[17px]" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <TmBadge :size="'sm'" :tone="toneFor(a)" class="uppercase">
                    {{ tipoLabel(a) }}
                  </TmBadge>
                  <span class="text-caption-xs text-neutral-400 tabular">
                    {{ formatFecha(a.fecha_generacion) }}
                  </span>
                </div>
                <p class="text-body-sm text-neutral-700 line-clamp-2">
                  {{ a.mensaje }}
                </p>
              </div>
            </div>
          </li>
          <li v-if="store.alertas.length === 0"
              class="px-2 py-8 text-center text-neutral-500 text-body-sm">
            ¡Sin alertas pendientes! ✅
          </li>
        </ul>
      </TmCard>

      <!-- Acciones rápidas -->
      <TmCard title="Acciones rápidas">
        <div class="grid grid-cols-2 gap-2.5">
          <QuickAction label="Nueva venta"  :icon="ScanLineIcon" tone="primary"  to="/caja" />
          <QuickAction label="Cotización"  :icon="FilePlusIcon" tone="secondary" to="/cotizaciones" />
          <QuickAction label="Nuevo lote"  :icon="PackagePlusIcon" tone="info" to="/inventario" />
          <QuickAction label="Merma"        :icon="Trash2Icon" tone="warning" to="/inventario" />
        </div>
      </TmCard>
    </div>
  </div>
  </div>
</template>

<script setup>
import { computed, h, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "vue-chartjs";

import {
  Receipt as ReceiptIcon,
  Ticket as TicketIcon,
  PackageX as PackageAlertIcon,
  Clock as CalendarClockIcon,
  Wallet as CashRegisterIcon,
  Lock as LockIcon,
  XCircle as XCircleIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  RefreshCw as RefreshIcon,
  AlertTriangle, AlertOctagon, Info as InfoIcon,
  ScanLine as ScanLineIcon,
  FilePlus as FilePlusIcon,
  Package as PackagePlusIcon,
  Trash2 as Trash2Icon,
  Smile, Shield, Gift as PartyPopper,
} from "lucide-vue-next";

import { TmButton, TmCard, TmBadge } from "@/components/ui";
import { useDashboardStore } from "@/stores/dashboard.js";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler,
);

const router = useRouter();
const store = useDashboardStore();

const viewError = ref(null);
const errorDetalle = ref(null);

async function forzarRecarga() {
  viewError.value = null;
  errorDetalle.value = null;
  try {
    await store.cargarTodo();
  } catch (err) {
    viewError.value = err?.message || "Error desconocido al cargar los datos.";
    errorDetalle.value = err?.stack || String(err);
  }
}

const kpis  = computed(() => store.kpis);
const caja  = computed(() => store.caja);

onMounted(async () => {
  try {
    if (!store.kpis) await store.cargarTodo();
  } catch (err) {
    viewError.value = err?.message || "Error desconocido al cargar los datos.";
    errorDetalle.value = err?.stack || String(err);
  }
});

// ------------------------- Helpers format -------------------------
const CURRENCY_FMT = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0,
});
function formatearMonto(v) {
  if (v == null) return "$0";
  return CURRENCY_FMT.format(Number(v));
}
function hora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const subtituloCaja = computed(() => {
  if (!kpis.value) return "Estado de caja";
  return kpis.value.caja_abierta
    ? `Caja abierta desde las ${kpis.value.hora_apertura_caja ?? "—"}`
    : "Caja cerrada — no es posible registrar ventas";
});
const saldoProyectado = computed(() =>
  Number(caja.value?.monto_inicial ?? 0) + Number(kpis.value?.ventas_hoy ?? 0),
);

// ------------------------- Gráfico 7 días -------------------------
const total7dias = computed(() =>
  formatearMonto(store.ventas7dias.reduce((a, b) => a + Number(b.monto ?? 0), 0)),
);
const chartData = computed(() => {
  const labels = store.ventas7dias.map((d) => d.diaLabel || d.fecha);
  const data = store.ventas7dias.map((d) => Number(d.monto ?? 0));
  return {
    labels,
    datasets: [
      {
        type: "line",
        label: "Monto",
        data,
        borderColor: "#0D8A72",
        backgroundColor: "rgba(13, 138, 114, 0.12)",
        borderWidth: 2.5,
        tension: 0.38,
        fill: true,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#0D8A72",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        type: "bar",
        label: "Tickets",
        data: store.ventas7dias.map((d) => Number(d.tickets ?? 0)),
        backgroundColor: "rgba(240, 78, 28, 0.22)",
        borderColor: "rgba(240, 78, 28, 0.6)",
        borderWidth: 1.5,
        borderRadius: 8,
        yAxisID: "y1",
      },
    ],
  };
});
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      labels: {
        boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle",
        color: "#5A5650",
        font: { family: "Manrope, system-ui", weight: "600" },
      },
    },
    tooltip: {
      backgroundColor: "#1A1918",
      padding: 12,
      cornerRadius: 10,
      titleFont: { family: "Manrope", weight: "700" },
      bodyFont:  { family: "Manrope", weight: "500" },
      callbacks: {
        label: (ctx) => {
          if (ctx.dataset.label === "Monto") return `  Monto: ${formatearMonto(ctx.parsed.y)}`;
          return `  Tickets: ${ctx.parsed.y}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#78746D", font: { family: "Manrope", weight: 600 } },
      border: { color: "#E6E4DE" },
    },
    y: {
      position: "left",
      grid: { color: "rgba(230, 228, 222, 0.5)" },
      ticks: {
        color: "#78746D", font: { family: "Manrope", weight: 600 },
        callback: (v) => formatearMonto(v),
      },
      border: { display: false },
    },
    y1: {
      position: "right",
      grid: { display: false },
      ticks: {
        color: "#D23D11", font: { family: "Manrope", weight: 600 },
      },
      border: { display: false },
    },
  },
};

// ------------------------- Semáforo -------------------------------
const semaforoBgClass = computed(() => ({
  "bg-gradient-to-br from-success-400 to-success-600 shadow-[0_8px_24px_-8px_rgba(16,179,89,0.6)]": store.semaforo === "success",
  "bg-gradient-to-br from-warning-400 to-warning-600 shadow-[0_8px_24px_-8px_rgba(232,148,18,0.6)]": store.semaforo === "warning",
  "bg-gradient-to-br from-danger-500 to-danger-700 shadow-[0_8px_24px_-8px_rgba(213,30,50,0.6)]": store.semaforo === "danger",
})[0]);
const semaforoBadgeClass = computed(() => ({
  "bg-success-600": store.semaforo === "success",
  "bg-warning-600": store.semaforo === "warning",
  "bg-danger-600":  store.semaforo === "danger",
})[0]);
const semaforoTextClass = computed(() => ({
  "text-success-700": store.semaforo === "success",
  "text-warning-700": store.semaforo === "warning",
  "text-danger-700":  store.semaforo === "danger",
})[0]);
const semaforoIcon = computed(() => ({
  success: PartyPopper,
  warning: Shield,
  danger:  AlertOctagon,
})[store.semaforo] ?? InfoIcon);

const resumenChips = computed(() => [
  {
    label: "Stock bajo", count: store.alertaResumen.stock_bajo,
    tone: "bg-warning-50 text-warning-700 ring-1 ring-warning-500/20",
  },
  {
    label: "Vence pronto", count: store.alertaResumen.vencimiento_proximo,
    tone: "bg-primary-50 text-primary-700 ring-1 ring-primary-500/20",
  },
  {
    label: "Vencidos", count: store.alertaResumen.lotes_vencidos,
    tone: "bg-danger-50 text-danger-700 ring-1 ring-danger-500/25",
  },
  {
    label: "Críticas", count: store.alertaResumen.criticas,
    tone: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-500/10",
  },
]);

function iconFor(a) {
  return {
    lote_vencido: AlertOctagon,
    stock_negativo: PackageAlertIcon,
    stock_bajo: AlertTriangle,
    vencimiento_proximo: AlertTriangle,
  }[a.tipo] ?? InfoIcon;
}
function iconBgFor(a) {
  const t = a.severidad ?? (a.tipo === "lote_vencido" ? "critical" : "warning");
  return {
    critical: "bg-danger-50 text-danger-600",
    warning:  "bg-warning-50 text-warning-600",
    info:     "bg-primary-50 text-primary-600",
  }[t] ?? "bg-neutral-100 text-neutral-600";
}
function toneFor(a) {
  if (a.severidad === "critical" || a.tipo === "lote_vencido" || a.tipo === "stock_negativo") return "danger";
  return "warning";
}
function tipoLabel(a) {
  return {
    stock_bajo: "Stock bajo",
    vencimiento_proximo: "Vence pronto",
    lote_vencido: "Vencido",
    stock_negativo: "Stock neg.",
  }[a.tipo] ?? "Alerta";
}
function formatFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 3600 * 24) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

// ------------------------- Subcomponentes inline -----------------
const KpiTarjeta = {
  props: ["title", "value", "subValue", "delta", "label", "icon", "tone", "to", "caja", "subtitlePronostico", "bad"],
  setup(p, { slots }) {
    const router = useRouter();
    const tones = {
      primary:   "bg-primary-50 text-primary-700",
      secondary: "bg-secondary-50 text-secondary-700",
      success:   "bg-success-50 text-success-700",
      warning:   "bg-warning-50 text-warning-700",
      danger:    "bg-danger-50 text-danger-700",
      info:      "bg-primary-50 text-primary-700",
    };
    const wrap = (cls, node) => h("div", { class: cls }, [node]);
    return () => {
      const delta = Number(p.delta ?? 0);
      const hasDelta = p.delta !== undefined && p.delta !== null;
      const good = p.bad ? delta > 0 : delta >= 0;
      const deltaColor = good ? "text-success-700 bg-success-50" : "text-danger-700 bg-danger-50";
      const deltaSign = delta > 0 ? "+" : "";
      const iconWrap = h("div", { class: ["tm-stat-icon", tones[p.tone] ?? tones.primary] }, [
        h(p.icon, { class: "w-[18px] h-[18px]" }),
      ]);
      const deltaBadge = hasDelta ? h("div", {
        class: ["h-6 px-2 rounded-full text-caption-xs font-bold tabular inline-flex items-center gap-1", deltaColor],
      }, [
        h(good ? Smile : XCircleIcon, { class: "w-3.5 h-3.5" }),
        `${deltaSign}${Number(delta).toFixed(1)}${p.label ? ` · ${p.label}` : ""}`,
      ]) : null;
      const inner = [
        iconWrap,
        h("p", { class: "tm-stat-label mt-4" }, p.title),
        h("p", { class: "tm-stat-value mt-1" }, p.value),
        p.subValue ? h("p", { class: "text-caption-xs text-neutral-500 mt-0.5" }, p.subValue) : null,
        p.subtitlePronostico ? h("p", { class: "text-caption-xs text-neutral-500 mt-0.5" }, p.subtitlePronostico) : null,
        deltaBadge,
      ].filter(Boolean);
      const card = h("div", {
        class: ["tm-stat", p.to ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200" : ""],
        onClick: p.to ? () => router.push(p.to) : undefined,
      }, inner);
      return card;
    };
  },
};

const Dato = {
  props: ["label", "value", "subValue", "tone", "strong"],
  setup(p) {
    const tones = {
      primary: "text-primary-700",
      success: "text-success-700",
      warning: "text-warning-700",
    };
    return () => h("div", { class: "tm-surface-soft p-3 rounded-xl border-border" }, [
      h("p", { class: "text-caption-xs font-semibold uppercase tracking-wide text-neutral-500" }, p.label),
      h("p", {
        class: ["text-h4 tabular mt-1", p.strong ? "font-extrabold text-neutral-800" : "font-bold text-neutral-700", tones[p.tone] ?? ""],
      }, p.value),
      p.subValue ? h("p", { class: "text-caption-xs text-neutral-500 mt-0.5" }, p.subValue) : null,
    ]);
  },
};

const QuickAction = {
  props: ["label", "icon", "tone", "to"],
  setup(p) {
    const router = useRouter();
    const tones = {
      primary:   "bg-primary-50 text-primary-700 hover:bg-primary-100",
      secondary: "bg-secondary-50 text-secondary-700 hover:bg-secondary-100",
      info:      "bg-neutral-100 text-neutral-800 hover:bg-neutral-200",
      warning:   "bg-warning-50 text-warning-700 hover:bg-warning-100",
    };
    return () => h("button", {
      type: "button",
      class: ["group flex flex-col items-center justify-center gap-2 rounded-xl p-3.5 transition-all duration-150 ease-soft", tones[p.tone] ?? tones.primary],
      onClick: () => p.to && router.push(p.to),
    }, [
      h("div", {
        class: "w-10 h-10 rounded-lg bg-white/80 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform",
      }, [h(p.icon, { class: "w-[18px] h-[18px]" })]),
      h("span", { class: "text-caption font-bold" }, p.label),
    ]);
  },
};
</script>
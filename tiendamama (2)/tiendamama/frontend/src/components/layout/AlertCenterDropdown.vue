<template>
  <!-- Semáforo (barra superior) -->
  <div class="relative inline-flex items-center">
    <button
      type="button"
      class="relative inline-flex items-center gap-2 h-10 px-3 rounded-xl
             border border-border bg-surface-elevated shadow-sm
             hover:shadow-md transition-all duration-150 ease-soft
             group"
      :title="store.semaforoLabel"
      @click="toggleDropdown"
    >
      <span class="relative w-2.5 h-2.5 rounded-full inline-flex items-center justify-center shrink-0"
            :class="semaforoDotClass">
        <span
          class="absolute inset-0 rounded-full animate-ping opacity-40"
          :class="semaforoPulseClass"
        />
      </span>
      <span class="text-caption font-bold uppercase tracking-wide"
            :class="semaforoTextClass">
        {{ semaforoText }}
      </span>
      <span
        v-if="store.alertaResumen.total_sin_leer > 0"
        class="ml-1 h-5 min-w-5 px-1.5 inline-flex items-center justify-center rounded-full
               text-caption-xs tabular font-bold text-white"
        :class="semaforoBadgeClass"
      >
        {{ store.alertaResumen.total_sin_leer }}
      </span>
      <component
        :is="ChevronDown"
        class="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors transition-transform duration-150"
        :class="{ 'rotate-180': open }"
      />
    </button>

    <!-- Dropdown panel de alertas -->
    <Teleport to="body">
      <Transition name="tm-pop">
        <div
          v-if="open"
          class="fixed z-[85]"
          :style="dropdownStyle"
        >
          <div
            ref="panelRef"
            class="w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] bg-surface-elevated
                   border border-border rounded-2xl shadow-lg overflow-hidden
                   animate-pop-in"
          >
            <!-- Header -->
            <header
              class="flex items-center justify-between gap-2 px-4 py-3.5
                     border-b border-border bg-surface-muted/60"
            >
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                  <component :is="BellDotIcon" class="w-[18px] h-[18px]" />
                </div>
                <div class="flex flex-col min-w-0 leading-tight">
                  <p class="text-h4 text-neutral-800">Centro de alertas</p>
                  <p class="text-caption-xs text-neutral-500">
                    {{ store.alertaResumen.total_sin_leer }} pendientes
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button
                  v-if="store.alertaResumen.total_sin_leer > 0"
                  type="button"
                  class="text-caption font-semibold text-primary-700
                         hover:text-primary-800 hover:bg-primary-50
                         rounded-lg px-2.5 h-8 transition-colors"
                  @click="marcarTodas"
                >
                  Leer todas
                </button>
                <button
                  type="button"
                  class="w-8 h-8 rounded-lg hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-500"
                  title="Actualizar"
                  @click="refresh"
                >
                  <component :is="RefreshIcon" :class="['w-4 h-4', loading && 'animate-spin']" />
                </button>
              </div>
            </header>

            <!-- Resumen semáforo -->
            <div class="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border/80">
              <ResumenChip label="Stock bajo" :count="store.alertaResumen.stock_bajo" tone="warning" />
              <ResumenChip label="Vence pronto" :count="store.alertaResumen.vencimiento_proximo" tone="warning" />
              <ResumenChip label="Vencidos" :count="store.alertaResumen.lotes_vencidos" tone="danger" />
              <ResumenChip label="Críticas" :count="store.alertaResumen.criticas" tone="danger" />
            </div>

            <!-- Lista -->
            <div class="max-h-[420px] overflow-y-auto scrollbar-thin">
              <div v-if="store.alertas.length === 0" class="px-4 py-10 text-center">
                <component :is="PartyPopperIcon" class="w-10 h-10 text-success-500 mx-auto mb-2" />
                <p class="text-body-sm font-semibold text-neutral-700">¡Todo en orden!</p>
                <p class="text-caption text-neutral-500">No hay alertas pendientes.</p>
              </div>
              <ul v-else class="divide-y divide-border/70">
                <li
                  v-for="a in store.alertas.slice(0, 30)"
                  :key="a.id"
                  class="group px-4 py-3 hover:bg-surface-muted/70 transition-colors"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="mt-0.5 w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                      :class="iconBgFor(a)"
                    >
                      <component :is="iconFor(a)" class="w-[16px] h-[16px]" />
                    </div>
                    <div class="flex-1 min-w-0 leading-snug">
                      <div class="flex items-center gap-2 mb-1">
                        <TmBadge size="sm" :tone="toneFor(a)" class="uppercase text-[10px]">
                          {{ labelTipo(a.tipo) }}
                        </TmBadge>
                        <span class="text-caption-xs text-neutral-400 tabular">
                          {{ formatFecha(a.fecha_generacion) }}
                        </span>
                      </div>
                      <p class="text-body-sm text-neutral-700 break-words line-clamp-2 group-hover:line-clamp-none transition-all">
                        {{ a.mensaje }}
                      </p>
                      <div class="flex items-center gap-1 mt-2">
                        <button
                          type="button"
                          v-if="a.lote_id || a.producto_id"
                          @click="navegar(a)"
                          class="text-caption-xs font-semibold text-primary-700 hover:text-primary-800
                                 hover:underline underline-offset-2"
                        >
                          Ir al {{ a.lote_id ? "lote" : "producto" }} →
                        </button>
                        <button
                          type="button"
                          class="ml-auto text-caption-xs font-semibold text-neutral-500
                                 hover:text-primary-700 hover:bg-primary-50
                                 rounded-md px-2 h-6 transition-colors"
                          @click="marcarLeida(a.id)"
                        >
                          Marcar leída
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Footer -->
            <footer class="px-4 py-3 border-t border-border/80 bg-surface-muted/50
                           flex items-center justify-between">
              <p class="text-caption-xs text-neutral-500">
                {{ store.lastUpdated ? `Última actualización ${formatFecha(store.lastUpdated)}` : "" }}
              </p>
              <TmButton size="sm" variant="ghost" :icon="SettingsIcon">
                Configurar alertas
              </TmButton>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Backdrop invisible para cerrar -->
    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-[80]"
        @click="open = false"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  Bell as BellDotIcon, ChevronDown, RefreshCw as RefreshIcon,
  AlertTriangle, AlertOctagon, PackageX, Info as InfoIcon,
  Gift as PartyPopperIcon, Settings as SettingsIcon,
} from "lucide-vue-next";

import { TmBadge, TmButton } from "@/components/ui";
import { useDashboardStore } from "@/stores/dashboard.js";

const props = defineProps({
  anchorId: { type: String, default: "app-semaforo-anchor" },
});
defineExpose({ toggleDropdown });

const router = useRouter();
const store = useDashboardStore();
const open = ref(false);
const loading = ref(false);
const anchorEl = ref(null);
const panelRef = ref(null);
const dropdownStyle = ref({});

// ----- Semáforo -----
const semaforoDotClass = computed(() => {
  switch (store.semaforo) {
    case "danger":  return "bg-danger-500";
    case "warning": return "bg-warning-500";
    default:        return "bg-success-500";
  }
});
const semaforoPulseClass = computed(() => semaforoDotClass.value);
const semaforoTextClass = computed(() => {
  switch (store.semaforo) {
    case "danger":  return "text-danger-700";
    case "warning": return "text-warning-700";
    default:        return "text-success-700";
  }
});
const semaforoBadgeClass = computed(() => {
  switch (store.semaforo) {
    case "danger":  return "bg-danger-500";
    case "warning": return "bg-warning-500";
    default:        return "bg-success-500";
  }
});
const semaforoText = computed(() => {
  switch (store.semaforo) {
    case "danger":  return "Crítico";
    case "warning": return "Atención";
    default:        return "OK";
  }
});

// ----- Posicionamiento -----
async function positionDropdown() {
  await nextTick();
  if (!open.value) return;
  const anchor = document.getElementById(props.anchorId) || anchorEl.value;
  const panel = panelRef.value;
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const panelH = panel?.offsetHeight ?? 360;
  const panelW = panel?.offsetWidth ?? 420;
  let top = r.bottom + 10;
  let left = r.right - panelW;
  if (left < 16) left = 16;
  if (left + panelW > window.innerWidth - 16) left = window.innerWidth - panelW - 16;
  if (top + panelH > window.innerHeight - 16) top = r.top - panelH - 10;
  dropdownStyle.value = { top: `${top}px`, left: `${left}px` };
}

function toggleDropdown() {
  open.value = !open.value;
}

watch(open, async (v) => {
  if (v) await positionDropdown();
});

function onResize() {
  if (open.value) positionDropdown();
}
function onKey(e) {
  if (e.key === "Escape") open.value = false;
}
onMounted(() => {
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("keydown", onKey);
});

// ----- Helpers alertas -----
function iconFor(a) {
  switch (a.tipo) {
    case "lote_vencido":     return AlertOctagon;
    case "stock_negativo":   return PackageX;
    case "stock_bajo":       return AlertTriangle;
    case "vencimiento_proximo": return AlertTriangle;
    default:                 return InfoIcon;
  }
}
function iconBgFor(a) {
  switch (a.severidad ?? (a.tipo === "lote_vencido" ? "critical" : "warning")) {
    case "critical": return "bg-danger-50 text-danger-600";
    case "warning":  return "bg-warning-50 text-warning-600";
    case "info":     return "bg-primary-50 text-primary-600";
    default:         return "bg-neutral-100 text-neutral-600";
  }
}
function toneFor(a) {
  if (a.severidad === "critical" || a.tipo === "lote_vencido" || a.tipo === "stock_negativo") return "danger";
  if (a.severidad === "warning" || a.tipo === "stock_bajo" || a.tipo === "vencimiento_proximo") return "warning";
  return "info";
}
function labelTipo(tipo) {
  return {
    stock_bajo: "Stock bajo",
    vencimiento_proximo: "Vence pronto",
    lote_vencido: "Vencido",
    stock_negativo: "Stock negativo",
  }[tipo] ?? "Alerta";
}
function formatFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 3600 * 24) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

// ----- Acciones -----
async function refresh() {
  loading.value = true;
  try {
    await store.cargarTodo();
  }
  finally {
    loading.value = false;
  }
}
async function marcarLeida(id) {
  await store.marcarLeida(id);
}
function marcarTodas() {
  // Optimista: marcarlas todas localmente
  store.alertas.slice().forEach((a) => store.marcarLeida(a.id));
}
function navegar(a) {
  open.value = false;
  const qs = a.lote_id
    ? { name: "Inventario", query: { lote: String(a.lote_id) } }
    : { name: "Inventario", query: { producto: String(a.producto_id) } };
  router.push(qs);
}

// Subcomponente inline resumen chips
import { h } from "vue";
const ResumenChip = {
  props: ["label", "count", "tone"],
  setup(p) {
    const toneClass = {
      warning: "text-warning-700 bg-warning-50 ring-1 ring-warning-500/20",
      danger:  "text-danger-700  bg-danger-50  ring-1 ring-danger-500/25",
      info:    "text-primary-700 bg-primary-50 ring-1 ring-primary-500/20",
    }[p.tone] ?? "bg-neutral-100 text-neutral-600";
    return () => h("div", {
      class: ["flex flex-col items-center justify-center rounded-xl px-2 py-2.5", toneClass],
    }, [
      h("span", { class: "text-h3 tabular font-bold" }, String(p.count)),
      h("span", { class: "text-micro font-semibold uppercase tracking-wide mt-0.5" }, p.label),
    ]);
  },
};
</script>

<style scoped>
.tm-pop-enter-active, .tm-pop-leave-active { transition: all .18s cubic-bezier(.2,.7,.2,1); }
.tm-pop-enter-from, .tm-pop-leave-to   { opacity: 0; transform: translateY(-6px) scale(.98); }
</style>
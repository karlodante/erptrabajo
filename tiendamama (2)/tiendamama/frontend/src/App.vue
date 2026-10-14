<template>
  <div class="min-h-screen flex bg-surface text-neutral-700">
    <!-- Sidebar (anclado) -->
    <aside
      class="hidden md:flex flex-col w-sidebar shrink-0 border-r border-border
             bg-surface-elevated relative"
    >
      <!-- Brand -->
      <div class="h-header-h flex items-center gap-3 px-5 border-b border-border shrink-0">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700
                    text-white shadow-sm flex items-center justify-center shrink-0">
          <component :is="MilkyIcon" class="w-5 h-5" />
        </div>
        <div class="flex flex-col leading-tight min-w-0">
          <span class="text-h4 text-neutral-800 font-extrabold tracking-tight">
            Tiendamama
          </span>
          <span class="text-caption-xs text-neutral-500">Lácteos · POS</span>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
        <div
          v-for="group in groupedNav"
          :key="group.label"
          class="mb-5 last:mb-0"
        >
          <p class="text-micro text-neutral-400 uppercase tracking-wider
                    font-bold px-3 mb-2">
            {{ group.label }}
          </p>
          <RouterLink
            v-for="route in group.items"
            :key="route.name"
            :to="route"
            class="group relative flex items-center gap-3 h-10 px-3 rounded-lg
                   text-body-sm font-semibold transition-all duration-150 ease-soft"
            :class="isActive(route)
              ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-500/15'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'"
          >
            <span
              v-if="isActive(route)"
              class="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary-600"
              aria-hidden="true"
            />
            <component :is="route.meta.icon && ICONS[route.meta.icon] || ICONS.Circle"
                       class="w-[18px] h-[18px] shrink-0" />
            <span class="flex-1 truncate">{{ route.meta.title }}</span>
            <TmBadge
              v-if="route.meta.badge"
              size="sm"
              :tone="route.meta.badgeTone ?? 'danger'"
              pulse
              class="hidden sm:inline-flex"
            >
              {{ route.meta.badge }}
            </TmBadge>
          </RouterLink>
        </div>
      </nav>

      <!-- Footer sidebar: usuario + cerrar -->
      <div class="border-t border-border p-3 shrink-0">
        <div
          class="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-100 cursor-pointer
                 transition-colors group"
        >
          <div class="w-10 h-10 rounded-full bg-primary-100 text-primary-700
                      flex items-center justify-center font-bold shrink-0">
            CA
          </div>
          <div class="flex-1 min-w-0 leading-tight">
            <p class="text-body-sm font-bold text-neutral-800 truncate">
              Cajero Demo
            </p>
            <p class="text-caption-xs text-neutral-500 truncate">
              Administrador
            </p>
          </div>
          <button
            type="button"
            class="w-8 h-8 rounded-lg text-neutral-400 hover:text-danger-600
                   hover:bg-danger-50 inline-flex items-center justify-center shrink-0"
            title="Cerrar sesión"
          >
            <component :is="LogOutIcon" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Content Column -->
    <div class="flex flex-col min-w-0 flex-1">
      <!-- Top bar -->
      <header
        class="h-header-h shrink-0 bg-surface-elevated/80 backdrop-blur
               border-b border-border sticky top-0 z-30 px-5 lg:px-8
               flex items-center justify-between gap-4"
      >
        <!-- Breadcrumbs + title -->
        <div class="flex items-center gap-3 min-w-0">
          <button
            class="md:hidden w-9 h-9 rounded-lg hover:bg-neutral-100 inline-flex
                   items-center justify-center text-neutral-600"
            type="button"
            aria-label="Abrir menú"
          >
            <component :is="MenuIcon" class="w-5 h-5" />
          </button>
          <div class="min-w-0">
            <p class="text-caption-xs text-neutral-400 font-semibold uppercase tracking-wider hidden sm:block">
              {{ breadcrumbLabel }}
            </p>
            <h1 class="text-h3 truncate">{{ currentTitle }}</h1>
          </div>
        </div>

        <!-- Right actions -->
        <div class="flex items-center gap-2">
          <!-- Búsqueda global -->
          <div class="hidden sm:block w-full max-w-xs relative">
            <TmSearch
              ref="globalSearchRef"
              v-model="globalSearchQuery"
              placeholder="Buscar productos, clientes…"
              shortcutKey="⌘K"
              @focus="globalSearchOpen = true"
              @keydown.enter="onGlobalSearchEnter"
              @keydown.esc="globalSearchOpen = false"
            />
            <Teleport to="body">
              <div
                v-if="globalSearchOpen && globalSearchQuery.trim()"
                class="fixed z-[85]"
                :style="globalSearchDropdownStyle"
              >
                <div
                  class="w-[340px] max-w-[calc(100vw-32px)] bg-surface-elevated border border-border
                         rounded-2xl shadow-lg overflow-hidden"
                >
                  <div v-if="globalSearchResultados.productos.length === 0 && globalSearchResultados.clientes.length === 0"
                       class="px-4 py-6 text-center text-caption text-neutral-500">
                    Sin resultados para "{{ globalSearchQuery }}"
                  </div>
                  <template v-else>
                    <div v-if="globalSearchResultados.productos.length" class="py-1.5">
                      <p class="px-3.5 py-1 text-micro font-bold uppercase tracking-wider text-neutral-400">Productos</p>
                      <button
                        v-for="p in globalSearchResultados.productos"
                        :key="'p'+p.id"
                        type="button"
                        class="w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 hover:bg-neutral-100"
                        @click="irAProducto(p)"
                      >
                        <span class="min-w-0">
                          <span class="block text-body-sm font-semibold text-neutral-800 truncate">{{ p.nombre }}</span>
                          <span class="block text-caption-xs text-neutral-500">SKU {{ p.sku }} · Stock {{ p.stock_total ?? 0 }}</span>
                        </span>
                      </button>
                    </div>
                    <div v-if="globalSearchResultados.clientes.length" class="py-1.5 border-t border-border/70">
                      <p class="px-3.5 py-1 text-micro font-bold uppercase tracking-wider text-neutral-400">Clientes</p>
                      <button
                        v-for="c in globalSearchResultados.clientes"
                        :key="'c'+c.id"
                        type="button"
                        class="w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 hover:bg-neutral-100"
                        @click="irACliente(c)"
                      >
                        <span class="min-w-0">
                          <span class="block text-body-sm font-semibold text-neutral-800 truncate">{{ c.nombre_rs }}</span>
                          <span class="block text-caption-xs text-neutral-500">{{ c.telefono || c.dni_cuit || "Sin datos" }}</span>
                        </span>
                      </button>
                    </div>
                  </template>
                </div>
              </div>
            </Teleport>
            <Teleport to="body">
              <div v-if="globalSearchOpen" class="fixed inset-0 z-[80]" @click="globalSearchOpen = false" />
            </Teleport>
          </div>

          <!-- Semáforo global + centro de alertas -->
          <div id="app-semaforo-anchor">
            <AlertCenterDropdown anchor-id="app-semaforo-anchor" />
          </div>

          <!-- Quick new -->
          <TmButton
            variant="primary"
            size="md"
            :icon="PlusIcon"
            class="hidden sm:inline-flex"
            to="/caja"
          >
            Nueva venta
          </TmButton>
        </div>
      </header>

      <!-- Main content -->
      <main class="flex-1 overflow-y-auto scrollbar-thin">
        <div class="px-5 lg:px-8 py-6 max-w-content mx-auto w-full">
          <RouterView v-slot="{ Component }">
            <Transition name="fade-page" mode="out-in">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </div>
      </main>
    </div>

    <!-- Toast host (siempre visible) -->
    <TmToastHost />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import * as I from "lucide-vue-next";

import {
  TmBadge, TmButton, TmSearch, TmToastHost,
} from "@/components/ui";
import AlertCenterDropdown from "@/components/layout/AlertCenterDropdown.vue";
import { useDashboardStore } from "@/stores/dashboard.js";
import { useInventarioStore } from "@/stores/inventario.js";
import { useCotizacionesStore } from "@/stores/cotizaciones.js";

const router = useRouter();

// ── Iconos ────────────────────────────────────────────────────
const MilkyIcon = I.Milk; // Lucide no tiene Milk? es un ícono moderno compatible
const BellIcon  = I.Bell;
const PlusIcon  = I.Plus;
const MenuIcon  = I.Menu;
const LogOutIcon = I.LogOut;

// Iconos compatibles con la navegación
const ICONS = {
  LayoutDashboard: I.LayoutDashboard,
  ScanLine: I.ScanLine,
  Package:  I.Package,
  Tags:     I.Tags,
  FileText: I.FileText,
  Calculator: I.Calculator,
  Truck:    I.Truck,
  Gift:     I.Gift,
  Circle:   I.CircleDot,
};

// ── Agrupamiento navegación (leyendo desde router) ────────────
import { routes as flatRoutes } from "@/router/index.js";

const groupOrder = ["Principal", "Operaciones", "Gestión", "Reportes"];
const groupedMap = new Map();
for (const r of flatRoutes) {
  const key = r.meta?.group || defaultGroupForRoute(r);
  if (!groupedMap.has(key)) groupedMap.set(key, { label: key, items: [] });
  groupedMap.get(key).items.push(r);
}
const groupedNav = Array.from(groupedMap.entries())
  .sort((a, b) => {
    const ai = groupOrder.indexOf(a[0]);
    const bi = groupOrder.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  })
  .map(([, v]) => v);

function defaultGroupForRoute(r) {
  switch (r.name) {
    case "Dashboard": return "Principal";
    case "Caja":
    case "Cotizaciones": return "Operaciones";
    case "Inventario":
    case "Promociones":
    case "Proveedores": return "Gestión";
    case "Arqueos": return "Reportes";
    default: return "General";
  }
}

const route = useRoute();
const store = useDashboardStore();
const inventarioStore = useInventarioStore();
const cotizacionesStore = useCotizacionesStore();

// ── Búsqueda global (productos + clientes) ──────────────────────
const globalSearchRef = ref(null);
const globalSearchQuery = ref("");
const globalSearchOpen = ref(false);
const globalSearchDropdownStyle = ref({});
let _globalSearchDataCargada = false;

async function asegurarDatosBusqueda() {
  if (_globalSearchDataCargada) return;
  _globalSearchDataCargada = true;
  try {
    if (!inventarioStore.productos.length) await inventarioStore.cargarProductos();
  } catch { /* noop */ }
  try {
    if (!cotizacionesStore.clientesSelect?.length) await cotizacionesStore.cargarClientes?.();
  } catch { /* noop */ }
}

const globalSearchResultados = computed(() => {
  const q = globalSearchQuery.value.trim().toLowerCase();
  if (!q) return { productos: [], clientes: [] };
  const productos = (inventarioStore.productos || [])
    .filter((p) =>
      p.nombre?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.codigo_barras?.includes(q))
    .slice(0, 6);
  const clientes = (cotizacionesStore.clientesSelect || [])
    .filter((c) =>
      c.nombre_rs?.toLowerCase().includes(q) ||
      (c.dni_cuit || "").includes(q) ||
      (c.telefono || "").includes(q))
    .slice(0, 5);
  return { productos, clientes };
});

function posicionarDropdownBusqueda() {
  const el = globalSearchRef.value?.$el;
  if (!el) return;
  const r = el.getBoundingClientRect();
  globalSearchDropdownStyle.value = { top: `${r.bottom + 8}px`, left: `${r.left}px` };
}

watch(globalSearchOpen, (v) => { if (v) posicionarDropdownBusqueda(); });
watch(globalSearchQuery, (v) => {
  if (v.trim()) { asegurarDatosBusqueda(); posicionarDropdownBusqueda(); }
});

function irAProducto(p) {
  globalSearchOpen.value = false;
  router.push({ name: "Inventario", query: { q: p.nombre } });
}
function irACliente(c) {
  globalSearchOpen.value = false;
  router.push({ name: "Cotizaciones", query: { cliente: String(c.id) } });
}
function onGlobalSearchEnter() {
  const { productos, clientes } = globalSearchResultados.value;
  if (productos.length) return irAProducto(productos[0]);
  if (clientes.length) return irACliente(clientes[0]);
}

function onGlobalShortcut(e) {
  const isK = e.key === "k" || e.key === "K";
  if (isK && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    globalSearchOpen.value = true;
    asegurarDatosBusqueda();
    globalSearchRef.value?.focus?.();
  }
}
onMounted(() => window.addEventListener("keydown", onGlobalShortcut));
onBeforeUnmount(() => window.removeEventListener("keydown", onGlobalShortcut));

onMounted(async () => {
  await store.cargarTodo();

  // Toast iniciales de bienvenida: destacar las 1-2 alertas más críticas
  if (typeof window !== "undefined") {
    const topAlertas = store.alertas
      .slice()
      .sort((a, b) => severidadRank(b) - severidadRank(a))
      .slice(0, 3);
    topAlertas.forEach((a, i) => {
      setTimeout(() => {
        const tone = severidadRank(a) >= 20 ? "error"
                  : severidadRank(a) >= 10 ? "warning"
                  : "info";
        const title = { error: "Atención urgente", warning: "Alerta", info: "Notificación" }[tone];
        window.$toast?.[tone]?.(title, a.mensaje, { duration: 7000 });
      }, 500 + i * 900);
    });
  }
});

function severidadRank(a) {
  if (a.tipo === "lote_vencido" || a.severidad === "critical" || a.tipo === "stock_negativo") return 30;
  if (a.tipo === "vencimiento_proximo") return 20;
  if (a.tipo === "stock_bajo") return 10;
  return 5;
}

const currentTitle = computed(() => route.meta?.title ?? "Tiendamama");
const breadcrumbLabel = computed(() =>
  route.meta?.group ? `${route.meta.group} · ${currentTitle.value}` : currentTitle.value,
);
const isActive = (r) => route.name === r.name;
</script>

<style scoped>
.fade-page-enter-active,
.fade-page-leave-active { transition: all .25s cubic-bezier(.2,.7,.2,1); }
.fade-page-enter-from   { opacity: 0; transform: translateY(8px); }
.fade-page-leave-to     { opacity: 0; transform: translateY(-4px); }
</style>
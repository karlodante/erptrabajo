<template>
  <div class="tm-surface overflow-hidden flex flex-col">
    <div
      v-if="$slots.toolbar || searchable"
      class="flex flex-col md:flex-row md:items-center justify-between gap-3
             px-5 py-4 border-b border-border bg-surface-muted/50"
    >
      <TmSearch
        v-if="searchable"
        v-model="search"
        :placeholder="searchPlaceholder"
        class="w-full md:max-w-xs"
      />
      <div v-else-if="$slots.toolbarLeft" class="flex items-center gap-2">
        <slot name="toolbarLeft" />
      </div>
      <div v-if="$slots.toolbar" class="flex items-center gap-2 ml-auto">
        <slot name="toolbar" />
      </div>
    </div>

    <div class="overflow-x-auto scrollbar-thin">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-surface-muted/60 text-caption-xs uppercase text-neutral-500 tracking-wide">
            <th
              v-for="col in resolvedColumns"
              :key="col.key"
              :style="{ width: col.width, textAlign: col.align ?? 'left' }"
              class="px-5 py-3 first:pl-5 last:pr-5 font-semibold whitespace-nowrap"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/80">
          <tr
            v-for="(row, ri) in pageRows"
            :key="rowKeyFor(row, ri)"
            class="group text-body-sm hover:bg-surface-muted/60 transition-colors"
          >
            <td
              v-for="col in resolvedColumns"
              :key="col.key"
              :style="{ textAlign: col.align ?? 'left' }"
              class="px-5 py-3.5 first:pl-5 last:pr-5 text-neutral-700 align-middle whitespace-nowrap"
            >
              <slot
                v-if="$slots[`cell:${col.key}`]"
                :name="`cell:${col.key}`"
                :row="row"
                :column="col"
                :index="ri"
              />
              <template v-else>{{ row[col.key] }}</template>
            </td>
          </tr>
          <tr v-if="pageRows.length === 0 && !loading">
            <td
              :colspan="resolvedColumns.length"
              class="text-center py-14 text-neutral-500"
            >
              <div class="flex flex-col items-center gap-2">
                <component :is="InboxIcon" class="w-10 h-10 text-neutral-300" />
                <p class="text-body-sm">{{ emptyText }}</p>
              </div>
            </td>
          </tr>
          <tr v-if="loading">
            <td :colspan="resolvedColumns.length" class="py-12">
              <div class="flex justify-center">
                <svg class="w-6 h-6 text-primary-600 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity=".2"/>
                  <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                </svg>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer
      v-if="paginated"
      class="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-border bg-surface-muted/40"
    >
      <p class="text-caption text-neutral-500 tabular">
        Mostrando
        <span class="font-semibold text-neutral-700">{{ startDisplay }}</span>
        –
        <span class="font-semibold text-neutral-700">{{ endDisplay }}</span>
        de
        <span class="font-semibold text-neutral-700">{{ filteredTotal }}</span>
        resultados
      </p>

      <div class="flex items-center gap-1">
        <TmButton
          variant="outline" size="icon"
          :disabled="currentPage === 1"
          @click="goTo(currentPage - 1)"
          :icon="ChevronLeft" title="Anterior"
        />
        <template v-for="p in visiblePages" :key="p">
          <button
            v-if="p === '...'"
            type="button"
            class="w-9 h-9 rounded-lg text-caption text-neutral-500" disabled
          >…</button>
          <TmButton
            v-else
            :variant="p === currentPage ? 'primary' : 'ghost'"
            size="icon"
            @click="goTo(p)"
          >{{ p }}</TmButton>
        </template>
        <TmButton
          variant="outline" size="icon"
          :disabled="currentPage === totalPages"
          @click="goTo(currentPage + 1)"
          :icon="ChevronRight" title="Siguiente"
        />
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { ChevronLeft, ChevronRight, Inbox as InboxIcon } from "lucide-vue-next";
import TmButton from "./TmButton.vue";
import TmSearch from "./TmSearch.vue";

const props = defineProps({
  rows:              { type: Array,  required: true },
  columns:           { type: Array,  required: true },
  rowKey:            { type: [String, Function], default: "id" },
  searchable:        { type: Boolean, default: true },
  searchPlaceholder: { type: String,  default: "Buscar…" },
  paginated:         { type: Boolean, default: true },
  perPage:           { type: Number,  default: 10 },
  loading:           { type: Boolean, default: false },
  emptyText:         { type: String,  default: "No hay datos para mostrar." },
  currentPage:       { type: Number,  default: 1 },
});

const emit = defineEmits(["update:currentPage", "page-change"]);

const search = ref("");
const currentPage = ref(props.currentPage);

watch(() => props.currentPage, (v) => { currentPage.value = v; });
watch(currentPage, (v) => { emit("update:currentPage", v); emit("page-change", v); });

const resolvedColumns = computed(() =>
  props.columns.map((c) => ({
    key: c.key,
    label: c.label ?? "",
    align: c.align,
    width: c.width ? `${c.width}px` : undefined,
  })),
);

const rowKeyFor = (row, ri) => {
  if (typeof props.rowKey === "function") {
    try { return String(props.rowKey(row, ri)); }
    catch { /* ignore */ }
  }
  const v = row[props.rowKey];
  return v == null ? String(ri) : String(v);
};

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.rows;
  return props.rows.filter((r) => {
    for (const c of props.columns) {
      const v = r[c.key];
      if (v == null) continue;
      if (String(v).toLowerCase().includes(q)) return true;
    }
    return false;
  });
});

const filteredTotal = computed(() => filteredRows.value.length);

const totalPages = computed(() =>
  props.paginated ? Math.max(1, Math.ceil(filteredTotal.value / props.perPage)) : 1,
);
watch(totalPages, (tp) => { if (currentPage.value > tp) currentPage.value = tp; });

const pageRows = computed(() => {
  if (!props.paginated) return filteredRows.value;
  const start = (currentPage.value - 1) * props.perPage;
  return filteredRows.value.slice(start, start + props.perPage);
});

const startDisplay = computed(() =>
  filteredTotal.value === 0 ? 0 : (currentPage.value - 1) * props.perPage + 1,
);
const endDisplay = computed(() =>
  Math.min(currentPage.value * props.perPage, filteredTotal.value),
);

const visiblePages = computed(() => {
  const tp = totalPages.value;
  const cp = currentPage.value;
  const pages = new Set([1, tp, cp - 1, cp, cp + 1]);
  const out = [];
  for (let i = 1; i <= tp; i++) {
    if (pages.has(i)) out.push(i);
    else if (out[out.length - 1] !== "...") out.push("...");
  }
  return out;
});

const goTo = (p) => { currentPage.value = p; };
</script>

<template>
  <div class="flex flex-col gap-gap-card min-w-0">
    <!-- ============ HEADER TABS ============ -->
    <TmCard padding="none" class="overflow-hidden">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4
               px-5 pt-5 pb-0 border-b border-border"
      >
        <div>
          <h2 class="text-h2 font-extrabold text-neutral-800">
            Promociones & Precios Especiales
          </h2>
          <p class="text-caption text-neutral-500 mt-1">
            Configurá precios por volumen, evitá pérdidas con remates automáticos y armá combos.
          </p>
        </div>
        <div class="flex items-center gap-2 pb-4 md:pb-0">
          <TmButton
            variant="ghost"
            size="md"
            :icon="RefreshIcon"
            @click="recargarTodo"
          >
            Actualizar
          </TmButton>
          <TmButton
            v-if="tab.value === 'combos'"
            variant="primary"
            size="md"
            :icon="PlusIcon"
            @click="abrirComboEditor()"
          >
            Nuevo combo
          </TmButton>
        </div>
      </div>

      <!-- Tabs -->
      <div class="px-5 pt-4">
        <TmTabs v-model="tab.value" :tabs="TABS" />
      </div>

      <!-- ============================================================ -->
      <!-- TAB 1: PRECIOS POR VOLUMEN                                   -->
      <!-- ============================================================ -->
      <div v-if="tab.value === 'precios-volumen'" class="p-5 pt-4">
        <!-- KPIs -->
        <div class="tm-stat-grid mb-6">
          <Kpi
            title="Productos con escalas"
            :value="String(cantProductosConPV)"
            :icon="LayersIcon"
            tone="primary"
          />
          <Kpi
            title="Escalas activas"
            :value="String(store.preciosVolumen.length)"
            :icon="TrendingUpIcon"
            tone="success"
          />
          <Kpi
            title="Ahorro promedio / unidad"
            :value="fmtMoney(ahorroPromedio)"
            sub-value="por unidad en escala mayorista"
            :icon="PiggyBankIcon"
            tone="secondary"
          />
          <Kpi
            title="Top producto escalas"
            :value="topProducto?.nombre ?? '—'"
            :sub-value="topProducto ? `${topProducto._count} escalas` : 'sin datos'"
            :icon="AwardIcon"
            tone="info"
          />
        </div>

        <!-- Toolbar -->
        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3"
        >
          <div class="flex items-center gap-3 flex-wrap">
            <TmSearch
              v-model="pvBuscar"
              placeholder="Buscar producto, SKU o código"
              shortcutKey="/"
              class="max-w-md"
              @clear="pvBuscar = ''"
            />
          </div>
          <div class="flex items-center gap-2">
            <TmButton
              variant="outline"
              size="md"
              :icon="PlusIcon"
              @click="abrirEscalaEditor()"
            >
              Agregar escala
            </TmButton>
          </div>
        </div>

        <!-- Tabla PV -->
        <TmDataTable
          :rows="pvFiltrados"
          :columns="COL_PV"
          :loading="store.loading"
          :searchable="false"
          :per-page="20"
          empty-text="No hay escalas de precio por volumen."
        >
          <template #cell:producto="{ row }">
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-lg bg-primary-50 text-primary-600
                       flex items-center justify-center shrink-0"
              >
                <component :is="PackageIcon" class="w-4.5 h-4.5" />
              </div>
              <div class="min-w-0">
                <p class="text-caption font-bold text-neutral-800 leading-snug line-clamp-1">
                  {{ row.producto.nombre }}
                </p>
                <p class="text-micro text-neutral-500 tabular mt-0.5">
                  SKU {{ row.producto.sku }}
                  <span v-if="row.producto.codigo_barras" class="mx-1.5 text-neutral-300">·</span>
                  <span v-if="row.producto.codigo_barras">{{ row.producto.codigo_barras }}</span>
                </p>
              </div>
            </div>
          </template>
          <template #cell:precio_original="{ row }">
            <p class="tabular text-neutral-500 line-through text-caption">
              {{ fmtMoney(row.producto.precio_unitario) }}
            </p>
          </template>
          <template #cell:ahorro_unitario="{ row }">
            <div class="flex items-center gap-2">
              <TmBadge
                size="md"
                tone="secondary"
                dot
              >
                -{{ fmtMoney(row.ahorro_unitario) }} x u.
              </TmBadge>
              <span class="text-micro text-neutral-500 tabular">
                ({{ pctAhorro(row) }}% off)
              </span>
            </div>
          </template>
          <template #cell:acciones="{ row }">
            <div class="flex items-center gap-1 justify-end">
              <TmButton
                size="xs"
                variant="ghost"
                :icon="EditIcon"
                @click="abrirEscalaEditor(row)"
                title="Editar escala"
              />
              <TmButton
                size="xs"
                variant="ghost"
                :icon="SettingsIcon"
                @click="abrirEscalasPorProducto(row.producto)"
                title="Todas las escalas de este producto"
              />
              <TmButton
                size="xs"
                variant="ghost"
                :icon="PowerIcon"
                @click="desactivarEscala(row)"
                class="text-danger-600 hover:!bg-danger-50"
                title="Desactivar escala"
              />
            </div>
          </template>
        </TmDataTable>
      </div>

      <!-- ============================================================ -->
      <!-- TAB 2: REMATE AUTOMÁTICO                                     -->
      <!-- ============================================================ -->
      <div v-else-if="tab.value === 'remate'" class="p-5 pt-4">
        <!-- Alertas / resumen ejecutivo -->
        <section
          class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6"
        >
          <div
            class="tm-stat !m-0 bg-gradient-to-br from-danger-50 to-warning-50/70 !border-danger-200"
          >
            <div class="tm-stat-icon bg-danger-500/15 text-danger-700">
              <component :is="AlertTriangleIcon" class="w-[18px] h-[18px]" />
            </div>
            <p class="tm-stat-label mt-4 !text-danger-800/80">Lotes en riesgo ≤ 7 días</p>
            <p class="tm-stat-value mt-1 !text-danger-800">{{ store.remates.length }}</p>
            <p class="text-caption-xs font-bold text-danger-700 mt-2">
              Pendientes: {{ store.rematesPendientes.length }}
            </p>
          </div>
          <div class="tm-stat !m-0">
            <div class="tm-stat-icon bg-warning-500/15 text-warning-700">
              <component :is="TrendingDownIcon" class="w-[18px] h-[18px]" />
            </div>
            <p class="tm-stat-label mt-4">Pérdida si vence todo</p>
            <p class="tm-stat-value mt-1 text-danger-700">{{ fmtMoney(store.valorPerdidaTotal) }}</p>
            <p class="text-caption-xs text-neutral-500 mt-2">
              Si no vendés nada
            </p>
          </div>
          <div class="tm-stat !m-0">
            <div class="tm-stat-icon bg-success-500/15 text-success-700">
              <component :is="WalletIcon" class="w-[18px] h-[18px]" />
            </div>
            <p class="tm-stat-label mt-4">Valor recuperable con remates</p>
            <p class="tm-stat-value mt-1 text-success-700">{{ fmtMoney(store.valorRecuperable) }}</p>
            <p class="text-caption-xs text-neutral-500 mt-2">
              Aplicando descuentos sugeridos
            </p>
          </div>
          <div class="tm-stat !m-0">
            <div class="tm-stat-icon bg-secondary-500/15 text-secondary-700">
              <component :is="SparklesIcon" class="w-[18px] h-[18px]" />
            </div>
            <p class="tm-stat-label mt-4">Ahorro evitable total</p>
            <p class="tm-stat-value mt-1 text-secondary-700">
              {{ fmtMoney(Math.max(0, -store.ahorroEvitable)) }}
            </p>
            <p class="text-caption-xs text-neutral-500 mt-2">
              Diferencia a favor de rematar
            </p>
          </div>
        </section>

        <!-- Filtros remate -->
        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              @click="remateFiltro = 'todos'"
              class="h-9 px-3 rounded-lg text-caption font-bold transition-colors"
              :class="
                remateFiltro === 'todos'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              "
            >
              Todos ({{ store.remates.length }})
            </button>
            <button
              type="button"
              @click="remateFiltro = 'pendientes'"
              class="h-9 px-3 rounded-lg text-caption font-bold transition-colors"
              :class="
                remateFiltro === 'pendientes'
                  ? 'bg-danger-600 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              "
            >
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-danger-500"></span>
                Pendientes ({{ store.rematesPendientes.length }})
              </span>
            </button>
            <button
              type="button"
              @click="remateFiltro = 'aplicados'"
              class="h-9 px-3 rounded-lg text-caption font-bold transition-colors"
              :class="
                remateFiltro === 'aplicados'
                  ? 'bg-success-600 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              "
            >
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-success-500"></span>
                Remate aplicado ({{ store.rematesAplicados.length }})
              </span>
            </button>
          </div>
          <div class="flex items-center gap-2">
            <TmButton
              size="sm"
              variant="outline"
              :icon="SparklesIcon"
              tone="secondary"
              @click="aplicarTodosLosRematesSugeridos"
              :disabled="store.rematesPendientes.length === 0"
            >
              Aplicar sugerencias automáticamente
            </TmButton>
          </div>
        </div>

        <!-- Tarjetas de remate -->
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="r in rematesFiltrados"
            :key="r.id"
            class="tm-surface overflow-hidden flex flex-col transition-all hover:shadow-md"
            :class="{ 'opacity-75': r.remate_aplicado }"
          >
            <!-- Header -->
            <div
              class="px-4 py-3 flex items-center gap-3"
              :class="bgRemateHeader(r)"
            >
              <div
                class="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center font-extrabold text-h3 text-white shadow-sm"
                :class="bgRemateSeveridad(r)"
              >
                {{ r.dias_restantes < 0 ? "!" : r.dias_restantes }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-h4 font-extrabold text-neutral-800 leading-tight line-clamp-1">
                  {{ r.producto_nombre }}
                </p>
                <p class="text-caption-xs text-neutral-700/80 tabular mt-0.5">
                  Lote {{ r.numero_lote ?? `#${r.id}` }} · {{ r.cantidad_actual }} u.
                  <span class="mx-1 text-white/30">·</span>
                  Vence {{ formatFecha(r.fecha_vencimiento) }}
                </p>
              </div>
              <TmBadge
                size="md"
                :tone="r.sugerencia.tono"
                :dot="!r.remate_aplicado"
                pulse
              >
                {{ r.sugerencia.etiqueta }}
              </TmBadge>
            </div>

            <!-- Cuerpo comparativa -->
            <div class="p-4 flex-1">
              <div class="grid grid-cols-3 gap-3">
                <div class="tm-surface-soft p-3 rounded-lg">
                  <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">
                    Original
                  </p>
                  <p class="text-caption tabular font-semibold text-neutral-600 line-through mt-1">
                    {{ fmtMoney(r.precio_original) }}
                  </p>
                </div>
                <div class="p-3 rounded-lg bg-secondary-50 border border-secondary-200">
                  <p class="text-micro font-bold uppercase tracking-wide text-secondary-700">
                    Remate
                  </p>
                  <p class="text-h3 tabular font-extrabold text-secondary-800 mt-1">
                    {{ fmtMoney(r.precio_sugerido) }}
                  </p>
                  <p class="text-micro tabular font-bold text-secondary-700 mt-0.5">
                    -{{ r.sugerencia.porcentaje }}%
                  </p>
                </div>
                <div
                  class="p-3 rounded-lg border flex flex-col justify-between"
                  :class="r.remate_aplicado ? 'bg-success-50 border-success-200' : 'bg-warning-50 border-warning-200'"
                >
                  <p
                    class="text-micro font-bold uppercase tracking-wide"
                    :class="r.remate_aplicado ? 'text-success-700' : 'text-warning-700'"
                  >
                    {{ r.remate_aplicado ? "Activo" : "Pérdida" }}
                  </p>
                  <p
                    v-if="r.remate_aplicado"
                    class="text-caption tabular font-extrabold text-success-800 mt-1"
                  >
                    -{{ r.remate_pct_usado }}% usado
                  </p>
                  <p
                    v-else
                    class="text-caption tabular font-extrabold text-warning-800 mt-1"
                  >
                    {{ fmtMoney(r.perdida_si_vence) }}
                  </p>
                  <p
                    class="text-micro font-semibold mt-0.5 tabular"
                    :class="r.remate_aplicado ? 'text-success-700' : 'text-warning-700'"
                  >
                    {{ r.remate_aplicado ? `x${r.cantidad_actual} u.` : `x${r.cantidad_actual} u. sin vender` }}
                  </p>
                </div>
              </div>

              <!-- Slider personalizar porcentaje -->
              <div v-if="!r.remate_aplicado" class="mt-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-caption-xs font-bold text-neutral-700">
                    % de descuento sugerido
                  </span>
                  <span class="text-caption font-extrabold tabular text-secondary-700">
                    {{ pctRemateById[r.id] ?? r.sugerencia.porcentaje }}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="5"
                  :value="pctRemateById[r.id] ?? r.sugerencia.porcentaje"
                  @input="setPctRemate(r.id, Number($event.target.value))"
                  class="w-full accent-secondary-500"
                />
                <div class="flex items-center justify-between mt-1 text-micro text-neutral-500 tabular">
                  <span>0%</span>
                  <span class="font-semibold text-neutral-700">
                    Nuevo precio {{ fmtMoney(r.precio_original * (1 - (pctRemateById[r.id] ?? r.sugerencia.porcentaje) / 100)) }}
                  </span>
                  <span>80%</span>
                </div>
              </div>
            </div>

            <!-- Footer acción -->
            <div class="px-4 py-3 border-t border-border flex items-center gap-2">
              <template v-if="r.remate_aplicado">
                <TmBadge tone="success" :size="'md'" dot class="flex-1">
                  Remate activo en caja
                </TmBadge>
                <TmButton
                  size="sm"
                  variant="outline"
                  :icon="EyeIcon"
                  @click="irACombo(r.remate_id)"
                >
                  Ver combo
                </TmButton>
              </template>
              <template v-else>
                <TmButton
                  size="md"
                  variant="secondary"
                  tone="secondary"
                  block
                  :icon="SparklesIcon"
                  :loading="remateProcesandoId === r.id"
                  @click="aplicarRemate(r)"
                >
                  Aplicar remate
                </TmButton>
              </template>
            </div>
          </div>
        </div>

        <div
          v-if="rematesFiltrados.length === 0"
          class="tm-surface p-12 text-center"
        >
          <component :is="PartyPopperIcon" class="w-14 h-14 text-success-500 mx-auto mb-3" />
          <p class="text-h3 font-bold text-neutral-800">
            {{ remateFiltro === "aplicados" ? "Aún no hay remates aplicados" : remateFiltro === "pendientes" ? "¡No hay lotes pendientes de remate!" : "No hay lotes en riesgo en este momento" }}
          </p>
          <p class="text-caption text-neutral-500 mt-1">
            Volvé a revisar en unos días o aplicá remates automáticamente en 1 clic.
          </p>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- TAB 3: COMBOS                                                -->
      <!-- ============================================================ -->
      <div v-else-if="tab.value === 'combos'" class="p-5 pt-4">
        <!-- Filtros -->
        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4"
        >
          <div class="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <TmSearch
              v-model="store.filtroCombos.q"
              placeholder="Buscar combo por nombre o descripción"
              class="max-w-md"
              @input="() => store.recargarCombos()"
              @clear="() => { store.filtroCombos.q = ''; store.recargarCombos(); }"
            />
            <select
              v-model="store.filtroCombos.activo"
              class="!w-40 !h-9"
              @change="store.recargarCombos()"
            >
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
            <select
              v-model="store.filtroCombos.tipo"
              class="!w-48 !h-9"
              @change="store.recargarCombos()"
            >
              <option value="">Todos los tipos</option>
              <option value="precio_fijo">Precio fijo</option>
              <option value="descuento_porcentual">% Descuento</option>
              <option value="combo">Combo común</option>
            </select>
          </div>
        </div>

        <!-- Grid combos -->
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="c in store.combos"
            :key="c.id"
            class="tm-surface overflow-hidden flex flex-col transition-all hover:shadow-md"
            :class="c.es_remate ? '!border-secondary-300 !bg-gradient-to-br !from-secondary-50/40 !to-white' : ''"
          >
            <div class="px-4 py-3 border-b border-border flex items-start gap-3">
              <div
                class="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
                :class="[
                  c.es_remate
                    ? 'bg-secondary-100 text-secondary-700'
                    : c.tipo === 'descuento_porcentual'
                    ? 'bg-danger-50 text-danger-600'
                    : 'bg-primary-50 text-primary-700',
                ]"
              >
                <component
                  :is="
                    c.es_remate ? SparklesIcon :
                    c.tipo === 'descuento_porcentual' ? PercentIcon : GiftIcon
                  "
                  class="w-5.5 h-5.5"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h4 class="text-h4 font-extrabold text-neutral-800 leading-tight">
                    {{ c.nombre }}
                  </h4>
                  <TmBadge
                    v-if="c.es_remate"
                    tone="secondary"
                    size="sm"
                    dot
                  >Remate</TmBadge>
                  <TmBadge
                    v-else
                    :tone="c.tipo === 'descuento_porcentual' ? 'danger' : 'primary'"
                    size="sm"
                  >
                    {{ labelTipo(c.tipo) }}
                  </TmBadge>
                </div>
                <p
                  v-if="c.descripcion"
                  class="text-caption text-neutral-500 mt-1 line-clamp-2"
                >
                  {{ c.descripcion }}
                </p>
              </div>
            </div>

            <!-- Detalle productos -->
            <div class="p-4 flex-1">
              <ul class="space-y-1.5 mb-4">
                <li
                  v-for="d in c.detalles.slice(0, 5)"
                  :key="d.id"
                  class="flex items-center justify-between text-caption"
                >
                  <span class="text-neutral-700 truncate">
                    <span class="tabular font-bold text-neutral-800">×{{ d.cantidad }}</span>
                    {{ d.producto_nombre }}
                  </span>
                  <span class="tabular font-semibold text-neutral-500 ml-2 shrink-0">
                    {{ fmtMoney(d.precio_unitario) }}
                  </span>
                </li>
                <li
                  v-if="(c.detalles.length || 0) > 5"
                  class="text-micro text-neutral-500 italic pl-1"
                >
                  +{{ (c.detalles.length || 0) - 5 }} productos más…
                </li>
              </ul>

              <!-- Ahorro -->
              <div class="grid grid-cols-3 gap-2">
                <div class="tm-surface-soft p-2.5 rounded-lg">
                  <p class="text-micro font-bold uppercase text-neutral-500">Normal</p>
                  <p class="text-caption tabular font-semibold line-through text-neutral-500 mt-0.5">
                    {{ fmtMoney(c.precio_original) }}
                  </p>
                </div>
                <div class="p-2.5 rounded-lg bg-success-50 border border-success-200">
                  <p class="text-micro font-bold uppercase text-success-700">
                    {{ c.tipo === 'descuento_porcentual' ? `Valor` : 'Combo' }}
                  </p>
                  <p v-if="c.tipo === 'descuento_porcentual'" class="text-caption tabular font-extrabold text-success-800 mt-0.5">
                    -{{ c.valor }}%
                  </p>
                  <p v-else class="text-caption tabular font-extrabold text-success-800 mt-0.5">
                    {{ fmtMoney(c.valor) }}
                  </p>
                </div>
                <div class="p-2.5 rounded-lg bg-secondary-50 border border-secondary-200">
                  <p class="text-micro font-bold uppercase text-secondary-700">Ahorrá</p>
                  <p class="text-caption tabular font-extrabold text-secondary-800 mt-0.5">
                    {{ fmtMoney(c.ahorro_absoluto) }}
                  </p>
                  <p class="text-micro tabular font-bold text-secondary-700">
                    {{ c.ahorro_porcentual }}%
                  </p>
                </div>
              </div>

              <!-- Vigencia -->
              <div class="mt-3 flex items-center gap-2 text-micro text-neutral-600">
                <component :is="CalendarClockIcon" class="w-3.5 h-3.5" />
                {{ formatFecha(c.fecha_inicio) }}
                <span class="text-neutral-400">→</span>
                {{ c.fecha_fin ? formatFecha(c.fecha_fin) : "sin fin" }}
                <span
                  class="ml-auto tabular"
                  :class="vigenciaTone(c)"
                >
                  {{ vigenciaLabel(c) }}
                </span>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-4 py-3 border-t border-border flex items-center gap-2">
              <label
                class="inline-flex items-center gap-2 cursor-pointer select-none text-caption font-bold text-neutral-700"
              >
                <input
                  type="checkbox"
                  :checked="!!c.activo"
                  @change="toggleCombo(c.id, $event.target.checked)"
                  class="!w-4 !h-4"
                />
                {{ c.activo ? "Activo" : "Inactivo" }}
              </label>
              <div class="ml-auto flex items-center gap-1">
                <TmButton
                  size="sm"
                  variant="ghost"
                  :icon="CopyIcon"
                  @click="duplicarCombo(c)"
                  title="Duplicar"
                />
                <TmButton
                  size="sm"
                  variant="ghost"
                  :icon="EditIcon"
                  @click="abrirComboEditor(c)"
                  title="Editar"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="store.combos.length === 0"
          class="tm-surface p-12 text-center"
        >
          <component :is="GiftIcon" class="w-14 h-14 text-neutral-300 mx-auto mb-3" />
          <p class="text-h3 font-bold text-neutral-700">No hay combos</p>
          <p class="text-caption text-neutral-500 mt-1">
            Creá tu primer combo para incentivar más unidades por venta.
          </p>
          <TmButton
            class="mt-5"
            variant="primary"
            :icon="PlusIcon"
            @click="abrirComboEditor()"
          >
            Crear combo
          </TmButton>
        </div>
      </div>
    </TmCard>

    <!-- ============================================================== -->
    <!-- MODAL EDITOR DE ESCALAS (PRECIOS POR VOLUMEN)                  -->
    <!-- ============================================================== -->
    <TmModal
      v-model="showEscalaModal"
      :title="escalaEditando?.id ? 'Editar escala' : 'Nueva escala de precio por volumen'"
      :subtitle="escalaProducto?.nombre ?? (escalaEditando?.producto?.nombre || 'Asociar escala a un producto')"
      :icon="LayersIcon"
      :icon-tone="'primary'"
      :size="'lg'"
    >
      <div class="space-y-4">
        <div
          v-if="!escalaProducto"
        >
          <Label>Producto</Label>
          <select
            v-model.number="escalaForm.producto_id"
            class="w-full"
          >
            <option :value="null" disabled>Seleccionar producto…</option>
            <option
              v-for="p in store.productosSelect"
              :key="p.id"
              :value="p.id"
            >
              {{ p.nombre }} — SKU {{ p.sku }} · {{ fmtMoney(p.precio_unitario) }}
            </option>
          </select>
          <p
            v-if="referenciaPrecioNormal > 0"
            class="text-micro text-neutral-500 mt-1 tabular"
          >
            Precio normal: <span class="font-bold text-neutral-700">{{ fmtMoney(referenciaPrecioNormal) }}</span>
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Cantidad mínima</Label>
            <input
              v-model.number="escalaForm.cantidad_minima"
              type="number"
              min="1"
              class="w-full tabular !font-bold !text-h4"
            />
          </div>
          <div>
            <Label>Precio especial ($)</Label>
            <input
              v-model.number="escalaForm.precio_especial"
              type="number"
              min="0"
              step="0.01"
              class="w-full tabular !font-extrabold !text-h4 !text-primary-700"
            />
          </div>
          <div class="flex flex-col justify-end">
            <div
              class="tm-surface-soft p-3 rounded-lg h-[46px] flex items-center justify-between"
            >
              <span class="text-micro font-semibold text-neutral-500">
                Ahorro unitario
              </span>
              <TmBadge
                tone="secondary"
                size="md"
                dot
                v-if="escalaForm.precio_especial > 0 && referenciaPrecioNormal > 0"
              >
                -{{ fmtMoney(Math.max(0, referenciaPrecioNormal - escalaForm.precio_especial)) }}
                <span class="tabular ml-1 opacity-80">
                  ({{ Math.round(Math.max(0, referenciaPrecioNormal - escalaForm.precio_especial) / referenciaPrecioNormal * 100) }}%)
                </span>
              </TmBadge>
            </div>
          </div>
        </div>

        <label
          class="inline-flex items-center gap-2 cursor-pointer select-none text-caption font-bold text-neutral-700"
        >
          <input
            v-model="escalaForm.activo"
            type="checkbox"
            class="!w-4 !h-4"
          />
          Escala activa (se usará en caja)
        </label>
      </div>

      <template #footer>
        <TmButton variant="ghost" @click="showEscalaModal = false">Cancelar</TmButton>
        <TmButton
          variant="primary"
          :icon="SaveIcon"
          :loading="guardandoEscala"
          :disabled="!escalaValida"
          @click="guardarEscala"
        >
          Guardar escala
        </TmButton>
      </template>
    </TmModal>

    <!-- ============================================================== -->
    <!-- MODAL TODAS LAS ESCALAS POR PRODUCTO                           -->
    <!-- ============================================================== -->
    <TmModal
      v-model="showEscalasPorProductoModal"
      :title="escalaProducto?.nombre ?? 'Escalas por producto'"
      :subtitle="`SKU ${escalaProducto?.sku ?? ''} · ${escalaProducto?.codigo_barras ?? ''}`"
      :icon="PackageIcon"
      :icon-tone="'primary'"
      :size="'lg'"
    >
      <div
        v-if="escalaProducto"
        class="space-y-4"
      >
        <div
          class="tm-surface-soft p-3 rounded-lg flex items-center justify-between"
        >
          <span class="text-caption text-neutral-600">Precio normal (1 unidad)</span>
          <span class="tabular font-bold text-neutral-700 text-h4">{{ fmtMoney(escalaProducto.precio_unitario) }}</span>
        </div>

        <ul class="space-y-2">
          <li
            v-for="(esc, i) in escalasProductoActual"
            :key="esc.id ?? i"
            class="flex items-center gap-3 p-3 rounded-xl tm-surface-soft border-border"
          >
            <div class="w-9 h-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center shrink-0 font-extrabold tabular">
              {{ i + 1 }}
            </div>
            <div class="flex-1">
              <p class="text-caption font-bold text-neutral-800">
                A partir de <span class="text-primary-700">{{ esc.cantidad_minima }}</span> unidades
              </p>
              <p class="text-micro text-neutral-500 tabular">
                Precio unitario
              </p>
            </div>
            <input
              type="number"
              :value="esc.cantidad_minima"
              @change="actualizarEscalaLocal(esc, 'cantidad_minima', Number($event.target.value))"
              class="!w-24 !h-9 tabular !text-caption !font-bold text-center"
            />
            <input
              type="number"
              :value="esc.precio_especial"
              @change="actualizarEscalaLocal(esc, 'precio_especial', Number($event.target.value))"
              class="!w-28 !h-9 tabular !text-caption !font-bold text-center !text-primary-700"
            />
            <TmButton
              size="xs"
              variant="ghost"
              :icon="PowerIcon"
              @click="desactivarEscalaLista(esc)"
              class="text-danger-600 hover:!bg-danger-50"
              title="Desactivar"
              v-if="esc.activo"
            />
          </li>
        </ul>

        <TmButton
          variant="outline"
          size="sm"
          :icon="PlusIcon"
          block
          @click="agregarEscalaEnLista"
        >
          Agregar nueva escala
        </TmButton>
      </div>
      <template #footer>
        <TmButton variant="ghost" @click="showEscalasPorProductoModal = false">Cerrar</TmButton>
        <TmButton
          variant="primary"
          :icon="SaveIcon"
          :loading="guardandoEscalasProd"
          :disabled="escalasProductoActual.length === 0"
          @click="guardarTodasLasEscalasProducto"
        >
          Guardar todas
        </TmButton>
      </template>
    </TmModal>

    <!-- ============================================================== -->
    <!-- MODAL EDITOR DE COMBO                                          -->
    <!-- ============================================================== -->
    <TmModal
      v-model="showComboModal"
      :title="comboEditando?.id ? `Editar combo #${comboEditando.id}` : 'Nuevo combo'"
      :subtitle="
        comboEditando?.id
          ? (comboEditando?.descripcion ?? '')
          : 'Armá un combo, establecé valor y vigencia'
      "
      :icon="GiftIcon"
      :icon-tone="'secondary'"
      :size="'xl'"
    >
      <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
        <!-- Lado izq: formulario + productos -->
        <div class="space-y-4">
          <div>
            <Label>Nombre del combo</Label>
            <input
              v-model="comboForm.nombre"
              type="text"
              class="w-full !text-h4 !font-extrabold"
              placeholder="ej: Pack familiar - 10% OFF en quesos"
            />
          </div>
          <div>
            <Label>Descripción breve</Label>
            <textarea
              v-model="comboForm.descripcion"
              rows="2"
              class="w-full resize-none"
              placeholder="(opcional) se mostrará junto al combo"
            />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Tipo de combo</Label>
              <select
                v-model="comboForm.tipo"
                class="w-full"
              >
                <option value="precio_fijo">Precio fijo del combo</option>
                <option value="descuento_porcentual">% Descuento sobre total</option>
                <option value="combo">Combo (agrupador, sin valor)</option>
              </select>
            </div>
            <div>
              <Label>
                {{
                  comboForm.tipo === 'descuento_porcentual'
                    ? 'Porcentaje de descuento (%)'
                    : comboForm.tipo === 'precio_fijo'
                    ? 'Precio fijo del combo ($)'
                    : 'Valor asociado (opcional)'
                }}
              </Label>
              <input
                v-model.number="comboForm.valor"
                type="number"
                min="0"
                :max="comboForm.tipo === 'descuento_porcentual' ? 100 : undefined"
                step="0.01"
                class="w-full !font-bold tabular"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha inicio</Label>
              <input
                v-model="comboForm.fecha_inicio"
                type="date"
                class="w-full"
              />
            </div>
            <div>
              <Label>Fecha fin</Label>
              <input
                v-model="comboForm.fecha_fin"
                type="date"
                class="w-full"
              />
            </div>
          </div>
          <label
            class="inline-flex items-center gap-2 cursor-pointer select-none text-caption font-bold text-neutral-700"
          >
            <input
              v-model="comboForm.activo"
              type="checkbox"
              class="!w-4 !h-4"
            />
            Combo activo (visible en caja)
          </label>

          <!-- Detalle productos -->
          <div class="pt-2">
            <div class="flex items-center justify-between mb-2">
              <Label style="margin-bottom:0">Productos incluidos</Label>
              <TmButton
                size="xs"
                variant="outline"
                :icon="PlusIcon"
                @click="agregarProductoAlCombo"
              >
                Agregar producto
              </TmButton>
            </div>
            <ul class="space-y-2">
              <li
                v-for="(pd, idx) in comboForm.detalles"
                :key="idx"
                class="flex items-center gap-2 p-2 rounded-lg tm-surface-soft border-border"
              >
                <select
                  v-model.number="pd.producto_id"
                  class="!h-10 flex-1"
                >
                  <option :value="null" disabled>Producto…</option>
                  <option
                    v-for="p in store.productosSelect"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.nombre }} — {{ fmtMoney(p.precio_unitario) }}
                  </option>
                </select>
                <input
                  v-model.number="pd.cantidad"
                  type="number"
                  min="1"
                  class="!w-20 !h-10 tabular !text-center !font-bold"
                />
                <span
                  class="tabular font-bold text-neutral-600 text-caption w-24 text-right shrink-0"
                >
                  {{ fmtMoney(precioProducto(pd.producto_id) * pd.cantidad) }}
                </span>
                <TmButton
                  size="xs"
                  variant="ghost"
                  :icon="TrashIcon"
                  @click="quitarProductoCombo(idx)"
                  class="text-danger-600 hover:!bg-danger-50"
                />
              </li>
              <li
                v-if="comboForm.detalles.length === 0"
                class="p-4 text-center text-caption text-neutral-500 tm-surface-soft rounded-lg"
              >
                Agregá al menos un producto.
              </li>
            </ul>
          </div>
        </div>

        <!-- Lado der: previsualización / resumen -->
        <aside class="space-y-4">
          <div
            class="tm-surface p-5 rounded-2xl border-secondary-200 bg-gradient-to-br from-secondary-50/60 to-white"
          >
            <div class="flex items-center justify-between mb-3">
              <p class="text-caption-xs font-bold uppercase tracking-wider text-secondary-700">
                Vista previa de ahorro
              </p>
              <component :is="SparklesIcon" class="w-4 h-4 text-secondary-500" />
            </div>
            <div class="space-y-1.5 mb-3">
              <div class="flex items-center justify-between text-caption text-neutral-600">
                <span>Precio original combinado</span>
                <span class="tabular font-semibold line-through">{{ fmtMoney(previewNormal) }}</span>
              </div>
              <div class="flex items-center justify-between text-caption text-danger-700 font-semibold">
                <span>{{ previewLabelDescuento }}</span>
                <span class="tabular">-{{ fmtMoney(Math.max(0, previewNormal - previewFinal)) }}</span>
              </div>
              <div class="tm-divider my-2 !my-2" />
              <div class="flex items-end justify-between">
                <span class="text-h4 font-bold text-neutral-800">
                  Total combo
                </span>
                <span
                  class="text-display-2 tabular font-extrabold text-secondary-700 leading-none"
                >
                  {{ fmtMoney(previewFinal) }}
                </span>
              </div>
            </div>
            <div class="flex items-center justify-center gap-1 mt-2">
              <TmBadge tone="secondary" :size="'md'" dot>
                Ahorro {{ previewPct }}%
              </TmBadge>
            </div>
          </div>

          <div class="tm-surface p-4 rounded-xl space-y-2">
            <p class="text-caption-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
              Checklist
            </p>
            <Check
              v-for="item in checklistCombo"
              :key="item.label"
              :ok="item.ok"
              :label="item.label"
            />
          </div>
        </aside>
      </div>

      <template #footer>
        <TmButton variant="ghost" @click="showComboModal = false">Cancelar</TmButton>
        <TmButton
          variant="secondary"
          tone="secondary"
          :icon="CopyIcon"
          :disabled="!comboEditando?.id"
          @click="duplicarCombo(comboEditando)"
        >
          Duplicar
        </TmButton>
        <TmButton
          variant="primary"
          :icon="SaveIcon"
          :loading="guardandoCombo"
          :disabled="!comboValido"
          @click="guardarCombo"
        >
          {{ comboEditando?.id ? "Guardar cambios" : "Crear combo" }}
        </TmButton>
      </template>
    </TmModal>
  </div>
</template>

<script setup>
import { computed, h, inject, onMounted, reactive, ref, watch } from "vue";
import {
  RefreshCw as RefreshIcon,
  Plus as PlusIcon,
  Layers as LayersIcon,
  TrendingUp as TrendingUpIcon,
  PiggyBank as PiggyBankIcon,
  Award as AwardIcon,
  Package as PackageIcon,
  Edit3 as EditIcon,
  Settings as SettingsIcon,
  Power as PowerIcon,
  AlertTriangle as AlertTriangleIcon,
  TrendingDown as TrendingDownIcon,
  Wallet as WalletIcon,
  Sparkles as SparklesIcon,
  Eye as EyeIcon,
  Gift as GiftIcon,
  Percent as PercentIcon,
  CalendarClock as CalendarClockIcon,
  Copy as CopyIcon,
  Save as SaveIcon,
  Trash2 as TrashIcon,
  PartyPopper as PartyPopperIcon,
} from "lucide-vue-next";
import { useRouter } from "vue-router";

import { TmButton, TmCard, TmBadge, TmModal, TmDataTable, TmSearch, TmTabs } from "@/components/ui";
import { usePromocionesStore } from "@/stores/promociones.js";

const store = usePromocionesStore();
const toast = inject("$toast");
const router = useRouter();

// --- Tabs ---
const TABS = [
  { value: "precios-volumen", label: "Precios por volumen", icon: LayersIcon, tone: "primary" },
  { value: "remate", label: "Remate por vencimiento", icon: AlertTriangleIcon, tone: "danger", badge: () => store.rematesPendientes.length > 0 ? String(store.rematesPendientes.length) : undefined },
  { value: "combos", label: "Combos & descuentos", icon: GiftIcon, tone: "secondary" },
];
const tab = ref({ value: "precios-volumen" });

// --- PV filtro ---
const pvBuscar = ref("");

// --- Remate filtros y estado ---
const remateFiltro = ref("todos");
const pctRemateById = reactive({});
const remateProcesandoId = ref(null);

// --- Modales ---
const showEscalaModal = ref(false);
const showEscalasPorProductoModal = ref(false);
const showComboModal = ref(false);

// PV editor
const escalaProducto = ref(null);
const escalaEditando = ref(null);
const escalasProductoActual = ref([]);
const escalaForm = reactive({
  producto_id: null, cantidad_minima: 2, precio_especial: 0, activo: true,
});
const guardandoEscala = ref(false);
const guardandoEscalasProd = ref(false);
const escalaValida = computed(() =>
  (escalaProducto.value?.id || escalaForm.producto_id) &&
  Number(escalaForm.cantidad_minima) >= 1 &&
  Number(escalaForm.precio_especial) > 0,
);
const referenciaPrecioNormal = computed(() => {
  const prod = escalaProducto.value ||
    store.productosSelect.find((p) => p.id === escalaForm.producto_id);
  return prod ? Number(prod.precio_unitario) : 0;
});

// Combo editor
const comboEditando = ref(null);
const comboForm = reactive({
  nombre: "",
  descripcion: "",
  tipo: "precio_fijo",
  valor: null,
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_fin: "",
  activo: true,
  detalles: [{ producto_id: null, cantidad: 1 }],
  es_remate: false,
  lote_id: null,
});
const guardandoCombo = ref(false);

const comboValido = computed(() => {
  const base =
    comboForm.nombre.trim().length >= 2 &&
    comboForm.fecha_inicio &&
    (!comboForm.fecha_fin || comboForm.fecha_fin >= comboForm.fecha_inicio) &&
    comboForm.detalles.length > 0 &&
    comboForm.detalles.every((d) => d.producto_id && d.cantidad >= 1);
  if (!base) return false;
  if (comboForm.tipo === "descuento_porcentual") return Number(comboForm.valor) > 0 && Number(comboForm.valor) <= 100;
  if (comboForm.tipo === "precio_fijo") return Number(comboForm.valor) > 0;
  return true;
});

const previewNormal = computed(() =>
  comboForm.detalles.reduce(
    (acc, d) => acc + precioProducto(d.producto_id) * (Number(d.cantidad) || 0),
    0,
  ),
);
const previewFinal = computed(() => {
  if (comboForm.tipo === "precio_fijo") return Number(comboForm.valor) || previewNormal.value;
  if (comboForm.tipo === "descuento_porcentual") {
    const pct = Number(comboForm.valor) || 0;
    return Math.round(previewNormal.value * (1 - pct / 100) * 100) / 100;
  }
  return previewNormal.value;
});
const previewPct = computed(() => {
  if (previewNormal.value <= 0) return 0;
  return Math.round(((previewNormal.value - previewFinal.value) / previewNormal.value) * 100);
});
const previewLabelDescuento = computed(() => {
  if (comboForm.tipo === "descuento_porcentual")
    return `Descuento ${comboForm.valor ?? 0}%`;
  if (comboForm.tipo === "precio_fijo") return "Ahorro por precio fijo";
  return "Agrupación (sin descuento)";
});

const checklistCombo = computed(() => [
  { label: "Tiene nombre", ok: comboForm.nombre.trim().length >= 2 },
  { label: "Al menos 1 producto con cantidad", ok: comboForm.detalles.every((d) => d.producto_id && d.cantidad >= 1) },
  { label:
      (comboForm.tipo === "descuento_porcentual" || comboForm.tipo === "precio_fijo")
        ? "Valor establecido correctamente"
        : "Tipo combo establecido",
    ok:
      comboForm.tipo === "precio_fijo"
        ? Number(comboForm.valor) > 0
        : comboForm.tipo === "descuento_porcentual"
        ? Number(comboForm.valor) > 0 && Number(comboForm.valor) <= 100
        : true,
  },
  { label: "Vigencia válida", ok: !comboForm.fecha_fin || comboForm.fecha_fin >= comboForm.fecha_inicio },
  { label: "Genera ahorro", ok: previewFinal.value < previewNormal.value && previewNormal.value > 0 },
]);

// --- Columnas PV ---
const COL_PV = [
  { key: "producto", label: "Producto", width: 380 },
  { key: "cantidad_minima", label: "A partir de", width: 130, align: "center" },
  { key: "precio_original", label: "Precio normal", width: 150 },
  { key: "precio_especial", label: "Precio especial", width: 160 },
  { key: "ahorro_unitario", label: "Ahorro", width: 230 },
  { key: "acciones", label: "", width: 150, align: "right" },
];

const COL_PV_EXT = COL_PV.map(col =>
  col.key === "precio_especial"
    ? {
        ...col,
        formatCell: (v) => h("p", { class: "tabular font-extrabold text-h4 text-primary-700" }, fmtMoney(v)),
      }
    : col,
);

const cantProductosConPV = computed(() => {
  const set = new Set(store.preciosVolumen.map((p) => p._groupKey || p.producto_id));
  return set.size;
});
const ahorroPromedio = computed(() => {
  if (store.preciosVolumen.length === 0) return 0;
  const total = store.preciosVolumen.reduce((s, x) => s + Number(x.ahorro_unitario), 0);
  return Math.round(total / store.preciosVolumen.length);
});
const topProducto = computed(() => {
  const countBy = {};
  for (const row of store.preciosVolumen) {
    const key = row._groupKey || row.producto_id;
    if (!countBy[key]) countBy[key] = { nombre: row.producto.nombre, _count: 0 };
    countBy[key]._count += 1;
  }
  const list = Object.values(countBy).sort((a, b) => b._count - a._count);
  return list[0] ?? null;
});

const pvFiltrados = computed(() => {
  if (!pvBuscar.value.trim()) return store.preciosVolumen;
  const q = pvBuscar.value.trim().toLowerCase();
  return store.preciosVolumen.filter((r) =>
    r.producto.nombre.toLowerCase().includes(q) ||
    (r.producto.sku || "").toLowerCase().includes(q) ||
    (r.producto.codigo_barras || "").includes(q),
  );
});

const rematesFiltrados = computed(() => {
  if (remateFiltro.value === "pendientes") return store.rematesPendientes;
  if (remateFiltro.value === "aplicados") return store.rematesAplicados;
  return store.remates;
});

// --- Helpers ---
const CURRENCY = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
function fmtMoney(v) { return CURRENCY.format(Number(v) || 0); }
function formatFecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function pctAhorro(row) {
  const ori = Number(row.producto.precio_unitario);
  if (ori <= 0) return 0;
  return Math.round((Number(row.ahorro_unitario) / ori) * 100);
}
function bgRemateSeveridad(r) {
  const t = r.sugerencia.tono;
  return (
    t === "danger" ? "bg-gradient-to-br from-danger-500 to-danger-700" :
    t === "warning" ? "bg-gradient-to-br from-warning-500 to-warning-700" :
    t === "info" ? "bg-gradient-to-br from-primary-500 to-primary-700" :
    "bg-gradient-to-br from-success-500 to-success-700"
  );
}
function bgRemateHeader(r) {
  const t = r.sugerencia.tono;
  return (
    t === "danger" ? "bg-gradient-to-br from-danger-50 to-warning-50 border-b border-danger-100" :
    t === "warning" ? "bg-gradient-to-br from-warning-50 to-info-50 border-b border-warning-100" :
    t === "info" ? "bg-gradient-to-br from-primary-50 to-info-50 border-b border-primary-100" :
    "bg-gradient-to-br from-success-50 to-primary-50 border-b border-success-100"
  );
}
function labelTipo(tipo) {
  return (
    tipo === "precio_fijo" ? "Precio fijo" :
    tipo === "descuento_porcentual" ? "% Descuento" :
    "Combo"
  );
}
function vigenciaLabel(c) {
  const h = new Date().toISOString().slice(0, 10);
  if (!c.activo) return "Inactivo";
  if (c.fecha_fin && c.fecha_fin < h) return "Vencido";
  if (c.fecha_inicio && c.fecha_inicio > h) return "Aún no activo";
  return "Vigente";
}
function vigenciaTone(c) {
  const label = vigenciaLabel(c);
  return (
    label === "Vigente" ? "text-success-700 font-bold" :
    label === "Vencido" || label === "Inactivo" ? "text-danger-700 font-bold" :
    "text-warning-700 font-bold"
  );
}
function precioProducto(pid) {
  const p = store.productosSelect.find((x) => x.id === Number(pid));
  return p ? Number(p.precio_unitario) : 0;
}

// --- Acciones ---
async function recargarTodo() {
  await store.cargarTodo();
  toast?.info?.("Actualizado", "Promociones y lotes recargados");
}

onMounted(() => store.cargarTodo());

// Escalas modal
function abrirEscalaEditor(row = null) {
  escalaEditando.value = row;
  escalaProducto.value = row?.producto ?? null;
  Object.assign(escalaForm, {
    producto_id: row?.producto?.id ?? escalaForm.producto_id ?? null,
    cantidad_minima: row?.cantidad_minima ?? 2,
    precio_especial: row?.precio_especial ?? 0,
    activo: row?.activo ?? true,
  });
  showEscalaModal.value = true;
}
async function guardarEscala() {
  guardandoEscala.value = true;
  try {
    const productoId = Number(escalaProducto.value?.id ?? escalaForm.producto_id);
    await store.guardarEscala(productoId, {
      id: escalaEditando.value?.id ?? null,
      cantidad_minima: escalaForm.cantidad_minima,
      precio_especial: escalaForm.precio_especial,
      activo: escalaForm.activo,
    });
    toast?.success?.("Escala guardada", `≥${escalaForm.cantidad_minima} u. a ${fmtMoney(escalaForm.precio_especial)}`);
    showEscalaModal.value = false;
  } finally {
    guardandoEscala.value = false;
  }
}
async function desactivarEscala(row) {
  await store.desactivarEscala(row.producto_id, row.id);
  toast?.info?.("Escala desactivada", row.producto?.nombre);
}

async function abrirEscalasPorProducto(prod) {
  escalaProducto.value = prod;
  const lista = await store.cargarPreciosVolumenProducto(prod.id);
  escalasProductoActual.value = (lista || []).map((x) => ({ ...x }));
  showEscalasPorProductoModal.value = true;
}
function agregarEscalaEnLista() {
  const proxCant = escalasProductoActual.value.reduce(
    (m, x) => Math.max(m, Number(x.cantidad_minima) || 0),
    0,
  );
  const precioRef = escalaProducto.value ? Number(escalaProducto.value.precio_unitario) : 0;
  escalasProductoActual.value.push({
    id: null,
    cantidad_minima: Math.max(2, proxCant + 6),
    precio_especial: Math.round(precioRef * 0.92 * 100) / 100 || 0,
    activo: true,
  });
}
function actualizarEscalaLocal(esc, field, value) {
  const target = escalasProductoActual.value.find((x) => x.id === esc.id && x.cantidad_minima === esc.cantidad_minima) || esc;
  target[field] = value;
  Object.assign(esc, target);
}
async function desactivarEscalaLista(esc) {
  const idxCancel = escalasProductoActual.value.findIndex((x) => x.id === esc.id);
  if (esc.id && idxCancel >= 0) {
    await store.desactivarEscala(escalaProducto.value.id, esc.id);
    escalasProductoActual.value.splice(idxCancel, 1);
    toast?.info?.("Escala eliminada");
  } else if (idxCancel >= 0) {
    escalasProductoActual.value.splice(idxCancel, 1);
  }
}
async function guardarTodasLasEscalasProducto() {
  guardandoEscalasProd.value = true;
  try {
    for (const esc of escalasProductoActual.value) {
      await store.guardarEscala(escalaProducto.value.id, {
        id: esc.id || null,
        cantidad_minima: esc.cantidad_minima,
        precio_especial: Number(esc.precio_especial),
        activo: !!esc.activo,
      });
    }
    toast?.success?.("Escalas guardadas", `${escalasProductoActual.value.length} tramos`);
    showEscalasPorProductoModal.value = false;
  } finally {
    guardandoEscalasProd.value = false;
  }
}

// Remate
function setPctRemate(id, pct) {
  pctRemateById[id] = pct;
}
async function aplicarRemate(r) {
  remateProcesandoId.value = r.id;
  try {
    const pct = pctRemateById[r.id] ?? r.sugerencia.porcentaje;
    const creado = await store.aplicarRemate(r.id, {
      porcentaje: pct,
      producto_id: r.producto_id,
      dias_restantes: r.dias_restantes,
    });
    if (creado) {
      toast?.success?.(
        "¡Remate aplicado!",
        `${r.producto_nombre} · -${pct}% · visible en caja`
      );
    }
  } finally {
    remateProcesandoId.value = null;
  }
}
async function aplicarTodosLosRematesSugeridos() {
  const pendientes = store.rematesPendientes.slice();
  for (const r of pendientes) {
    const pct = pctRemateById[r.id] ?? r.sugerencia.porcentaje;
    await store.aplicarRemate(r.id, {
      porcentaje: pct,
      producto_id: r.producto_id,
      dias_restantes: r.dias_restantes,
    });
  }
  toast?.success?.(
    "¡Remates automáticos aplicados!",
    `${pendientes.length} lotes pasaron a promoción`
  );
}
function irACombo(id) {
  tab.value = "combos";
}

// Combos
function abrirComboEditor(combo = null) {
  comboEditando.value = combo;
  if (combo) {
    Object.assign(comboForm, {
      nombre: combo.nombre,
      descripcion: combo.descripcion ?? "",
      tipo: combo.tipo,
      valor: combo.valor ? Number(combo.valor) : null,
      fecha_inicio: combo.fecha_inicio ? String(combo.fecha_inicio).slice(0, 10) : new Date().toISOString().slice(0, 10),
      fecha_fin: combo.fecha_fin ? String(combo.fecha_fin).slice(0, 10) : "",
      activo: combo.activo,
      es_remate: !!combo.es_remate,
      lote_id: combo.lote_id ?? null,
      detalles: (combo.detalles || []).map((d) => ({
        producto_id: d.producto_id,
        cantidad: Number(d.cantidad),
      })),
    });
  } else {
    Object.assign(comboForm, {
      nombre: "",
      descripcion: "",
      tipo: "precio_fijo",
      valor: null,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: "",
      activo: true,
      es_remate: false,
      lote_id: null,
      detalles: [{ producto_id: null, cantidad: 1 }],
    });
  }
  showComboModal.value = true;
}
function agregarProductoAlCombo() {
  comboForm.detalles.push({ producto_id: null, cantidad: 1 });
}
function quitarProductoCombo(i) {
  if (comboForm.detalles.length <= 1) return;
  comboForm.detalles.splice(i, 1);
}
async function guardarCombo() {
  guardandoCombo.value = true;
  try {
    const payload = {
      nombre: comboForm.nombre.trim(),
      descripcion: comboForm.descripcion?.trim() || null,
      tipo: comboForm.tipo,
      valor: comboForm.valor != null ? Number(comboForm.valor) : null,
      fecha_inicio: comboForm.fecha_inicio,
      fecha_fin: comboForm.fecha_fin || null,
      activo: comboForm.activo,
      es_remate: comboForm.es_remate,
      lote_id: comboForm.lote_id ?? null,
      detalles: comboForm.detalles.map((d) => ({
        producto_id: Number(d.producto_id),
        cantidad: Number(d.cantidad),
      })),
    };
    const res = await store.guardarCombo({
      id: comboEditando.value?.id ?? null,
      payload,
    });
    if (res) {
      toast?.success?.(
        comboEditando.value?.id ? "Combo actualizado" : "Combo creado",
        `${res.nombre}`
      );
    }
    showComboModal.value = false;
  } finally {
    guardandoCombo.value = false;
  }
}
async function toggleCombo(id, activo) {
  await store.toggleComboActivo(id, activo);
  toast?.info?.(activo ? "Combo activado" : "Combo desactivado");
}
function duplicarCombo(c) {
  if (!c) return;
  const payload = {
    nombre: c.nombre + " (copia)",
    descripcion: c.descripcion ?? "",
    tipo: c.tipo,
    valor: c.valor,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: c.fecha_fin ? String(c.fecha_fin).slice(0, 10) : "",
    activo: true,
    es_remate: !!c.es_remate,
    lote_id: c.lote_id ?? null,
    detalles: (c.detalles || []).map((d) => ({
      producto_id: d.producto_id,
      cantidad: d.cantidad,
    })),
  };
  comboEditando.value = null;
  Object.assign(comboForm, payload);
  showComboModal.value = true;
}

// --- Subcomponentes inline ---
const Label = (_, { slots }) => h(
  "label",
  { class: "block text-caption-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5" },
  slots.default?.(),
);

const Kpi = {
  props: ["title", "value", "subValue", "delta", "icon", "tone", "bad", "to"],
  setup(p) {
    const tones = {
      primary: "bg-primary-50 text-primary-700",
      secondary: "bg-secondary-50 text-secondary-700",
      success: "bg-success-50 text-success-700",
      warning: "bg-warning-50 text-warning-700",
      danger: "bg-danger-50 text-danger-700",
      info: "bg-primary-50 text-primary-700",
    };
    return () => {
      const wrap = h("div", { class: ["tm-stat", p.to ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200" : ""] }, [
        h("div", { class: ["tm-stat-icon", tones[p.tone] ?? tones.primary] }, [
          h(p.icon, { class: "w-[18px] h-[18px]" }),
        ]),
        h("p", { class: "tm-stat-label mt-4" }, p.title),
        h("p", { class: "tm-stat-value mt-1" }, p.value),
        p.subValue ? h("p", { class: "text-caption-xs text-neutral-500 mt-0.5" }, p.subValue) : null,
      ]);
      return p.to
        ? h("div", { onClick: () => router.push(p.to) }, [wrap])
        : wrap;
    };
  },
};

const Check = {
  props: ["ok", "label"],
  setup(p) {
    return () => h("div", { class: "flex items-center gap-2" }, [
      h(
        "span",
        {
          class: [
            "w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0",
            p.ok ? "bg-success-500 text-white" : "bg-neutral-200 text-neutral-500",
          ],
        },
        p.ok
          ? h("svg", { class: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
              [h("path", { d: "M5 13l4 4L19 7", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" })],
            )
          : h("svg", { class: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
              [h("path", { d: "M6 6l12 12M18 6L6 18", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" })],
            ),
      ),
      h("span", { class: ["text-caption", p.ok ? "text-neutral-700 font-semibold" : "text-neutral-500"] }, p.label),
    ]);
  },
};
</script>

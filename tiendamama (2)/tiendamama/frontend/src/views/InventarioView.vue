SIF¿G<template>
  <div class="flex flex-col gap-gap-card min-w-0">
    <!-- ========== INDICADOR LOTES EN RIESGO ========== -->
    <Transition name="slide-down">
      <section
        v-if="riesgosVisibles && store.lotesEnRiesgo.length > 0"
        class="tm-surface overflow-hidden border-danger-200 bg-gradient-to-br from-danger-50/70 to-warning-50/60"
      >
        <div
          class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-5"
        >
          <div class="flex items-start gap-4 min-w-0">
            <div
              class="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-danger-500 to-warning-500
                     text-white flex items-center justify-center shadow-sm"
            >
              <component :is="ShieldAlertIcon" class="w-7 h-7" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <h3 class="text-h3 font-extrabold text-danger-800 leading-none">
                  {{ store.lotesEnRiesgo.length }} lote{{ store.lotesEnRiesgo.length === 1 ? "" : "s" }} en riesgo
                </h3>
                <TmBadge tone="danger" :size="'md'" pulse dot>
                  Vencen en ≤ 5 días
                </TmBadge>
              </div>
              <p class="text-caption text-danger-700/80">
                Aplica remates o promociones para evitar pérdidas. Estos lotes saldrán primero por PEPS.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <TmButton
              variant="secondary"
              tone="danger"
              size="md"
              :icon="TagsIcon"
              to="/promociones"
            >
              Ir a promociones
            </TmButton>
            <TmButton
              variant="ghost"
              size="icon"
              :icon="ChevronUpIcon"
              @click="riesgosVisibles = false"
              title="Ocultar"
            />
          </div>
        </div>

        <!-- Lista rápida de riesgos -->
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-5 pt-0"
        >
          <div
            v-for="riesgo in store.lotesEnRiesgo.slice(0, 8)"
            :key="riesgo.id"
            class="flex items-center gap-3 p-3 rounded-xl bg-white/80 border border-border
                   hover:shadow-sm transition-all cursor-pointer group"
            @click="abrirDetalleDesdeRiesgo(riesgo)"
          >
            <div
              class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
              :class="bgRiesgo(riesgo.dias_restantes)"
            >
              <component
                :is="CalendarClockIcon"
                class="w-5 h-5"
                :class="textRiesgo(riesgo.dias_restantes)"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-caption font-bold text-neutral-800 truncate">
                {{ riesgo.producto_nombre }}
              </p>
              <p class="text-caption-xs text-neutral-500 tabular">
                Lote {{ riesgo.numero_lote }} · {{ riesgo.cantidad_actual }} u.
              </p>
            </div>
            <TmBadge
              size="sm"
              :tone="store.riesgoTone(riesgo.dias_restantes)"
              dot
            >
              {{ badgeDias(riesgo.dias_restantes) }}
            </TmBadge>
          </div>
        </div>

        <div
          v-if="store.lotesEnRiesgo.length > 8"
          class="px-5 pb-5"
        >
          <button
            type="button"
            class="text-caption-xs font-bold text-primary-700 hover:text-primary-800
                   inline-flex items-center gap-1.5"
            @click="soloRiesgoToggle = !soloRiesgoToggle"
          >
            <component :is="soloRiesgoToggle ? ChevronUpIcon : ChevronDownIcon" class="w-3.5 h-3.5" />
            {{ soloRiesgoToggle ? "Quitar filtro de riesgo" : `Ver ${store.lotesEnRiesgo.length - 8} más y filtrar` }}
          </button>
        </div>
      </section>
    </Transition>

    <div v-if="!riesgosVisibles" class="flex justify-end">
      <button
        type="button"
        v-show="store.lotesEnRiesgo.length > 0"
        class="text-caption-xs font-bold text-danger-700 inline-flex items-center gap-1.5
               h-8 px-3 rounded-lg bg-danger-50 border border-danger-200"
        @click="riesgosVisibles = true"
      >
        <component :is="ShieldAlertIcon" class="w-3.5 h-3.5" />
        {{ store.lotesEnRiesgo.length }} lotes en riesgo — mostrar
      </button>
    </div>

    <!-- ========== KPIs ========== -->
    <section class="tm-stat-grid">
      <Kpi
        title="Productos activos"
        :value="String(store.cantidadTotalProductos || store.productos.length)"
        :sub-value="`${store.productos.length} mostrados`"
        :icon="PackageIcon"
        tone="primary"
      />
      <Kpi
        title="Stock bajo"
        :value="String(store.productosConStockBajo)"
        :delta="-store.productosConStockBajo"
        label="requieren reposición"
        :icon="AlertTriangleIcon"
        tone="warning"
        :bad="true"
      />
      <Kpi
        title="Próximo a vencer"
        :value="String(store.productosProximoVencer)"
        sub-value="Ventana 7 días"
        :icon="CalendarClockIcon"
        tone="info"
      />
      <Kpi
        title="Lotes en riesgo ≤5d"
        :value="String(store.lotesEnRiesgo.length)"
        :icon="ShieldAlertIcon"
        tone="danger"
        :bad="true"
      />
    </section>

    <!-- ========== FILTROS + TABLA ========== -->
    <TmCard padding="none" class="overflow-hidden">
      <!-- Toolbar filtros + acciones -->
      <div
        class="flex flex-col xl:flex-row xl:items-center justify-between gap-3
               p-5 border-b border-border bg-surface-muted/40"
      >
        <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap flex-1 min-w-0">
          <div class="w-full sm:max-w-sm">
            <TmSearch
              v-model="filtroBusqueda"
              placeholder="Buscar producto, SKU o código"
              shortcutKey="/"
              @clear="store.setFiltro('q', '')"
            />
          </div>
          <select
            v-model="filtroCategoria"
            class="w-full sm:!w-48 !h-10"
          >
            <option :value="null">Todas las categorías</option>
            <option
              v-for="c in store.categorias"
              :key="c.id"
              :value="c.id"
            >{{ c.nombre }}</option>
          </select>
          <select
            v-model="filtroEstado"
            class="w-full sm:!w-48 !h-10"
          >
            <option value="">Todo estado de stock</option>
            <option value="ok">Stock normal</option>
            <option value="stock_bajo">Stock bajo</option>
            <option value="vencimiento_proximo">Próximo a vencer</option>
            <option value="fuera_stock">Sin stock</option>
          </select>
          <label
            class="inline-flex items-center gap-2 cursor-pointer select-none
                   h-10 px-3 rounded-lg bg-surface-elevated border border-border
                   hover:border-primary-300 transition-colors"
          >
            <input
              type="checkbox"
              v-model="filtroAVencer"
              class="!w-4 !h-4"
            />
            <span class="text-caption font-bold text-neutral-700 whitespace-nowrap">
              Sólo a vencer ≤7d
            </span>
          </label>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <TmButton
            variant="warning"
            size="md"
            :icon="DownloadIcon"
            @click="modalBackup = true"
          >
            ⚠️ Backup
          </TmButton>
          <TmButton
            variant="outline"
            size="md"
            :icon="RefreshIcon"
            @click="store.cargarTodo()"
          >
            Actualizar
          </TmButton>
          <TmButton
            variant="primary"
            size="md"
            :icon="PlusIcon"
            @click="modalNuevoProducto = true"
          >
            Nuevo producto
          </TmButton>
          <TmButton
            variant="secondary"
            size="md"
            :icon="PackagePlusIcon"
            @click="openNuevoLote()"
          >
            Nuevo lote
          </TmButton>
          <TmButton
            variant="outline"
            size="md"
            :icon="Trash2Icon"
            @click="openMerma()"
          >
            Merma
          </TmButton>
        </div>
      </div>

      <!-- Tabla -->
      <TmDataTable
        :rows="store.productos"
        :columns="COLUMNAS"
        :paginated="true"
        :per-page="12"
        :loading="store.loading"
        :searchable="false"
        empty-text="No hay productos que coincidan con los filtros."
        class="!tm-surface !rounded-none !border-0 !shadow-none"
      >
        <template #cell:producto="{ row }">
          <button
            type="button"
            class="flex items-start gap-3 text-left group"
            @click="abrirDetalle(row)"
          >
            <div
              class="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-neutral-100
                     group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors"
            >
              <component :is="PackageIcon" class="w-5 h-5 text-neutral-500 group-hover:text-primary-600" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-body-sm font-bold text-neutral-800 leading-snug line-clamp-1 group-hover:text-primary-700">
                {{ row.nombre }}
              </p>
              <p class="text-caption-xs text-neutral-500 tabular mt-0.5 truncate">
                SKU {{ row.sku }}
                <span v-if="row.codigo_barras" class="mx-1.5 text-neutral-300">·</span>
                <span v-if="row.codigo_barras">{{ row.codigo_barras }}</span>
              </p>
            </div>
          </button>
        </template>

        <template #cell:categoria="{ row }">
          <span
            class="inline-flex items-center h-6 px-2 rounded-full text-caption-xs font-semibold
                   bg-neutral-100 text-neutral-700"
          >
            {{ store.categoriaPorId(row.categoria_id)?.nombre ?? "-" }}
          </span>
        </template>

        <template #cell:stock="{ row }">
          <div class="flex flex-col">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="tabular font-extrabold"
                :class="[
                  row.stock_total === 0 ? 'text-danger-700' :
                  row.stock_total <= row.stock_minimo ? 'text-warning-700' : 'text-neutral-800',
                ]"
              >
                {{ row.stock_total }}
              </span>
              <span class="text-caption-xs text-neutral-400 tabular">
                / míntmo {{ row.stock_minimo }}
              </span>
              <TmBadge
                v-if="unidadesReservadas(row.id) > 0"
                size="sm"
                tone="primary"
              >
                {{ unidadesReservadas(row.id) }} reservada(s)
              </TmBadge>
              <TmBadge
                size="sm"
                :tone="toneStock(row)"
                dot
              >
                {{ labelStock(row) }}
              </TmBadge>
            </div>
            <!-- Barra stock visual -->
            <div class="mt-1.5 h-1.5 rounded-full bg-neutral-200 overflow-hidden max-w-[160px]">
              <div
                class="h-full rounded-full transition-all"
                :class="[
                  pctStock(row) < 25 ? 'bg-danger-500' :
                  pctStock(row) < 60 ? 'bg-warning-500' : 'bg-success-500',
                ]"
                :style="{ width: Math.min(100, pctStock(row)) + '%' }"
              />
            </div>
            <p
              v-if="unidadesReservadas(row.id) > 0"
              class="text-micro tabular font-semibold text-primary-700 mt-1"
            >
              Disponible real: {{ Math.max(0, Number(row.stock_total) - unidadesReservadas(row.id)) }} u.
            </p>
          </div>
        </template>

        <template #cell:vencimiento="{ row }">
          <div v-if="row.proximo_vencimiento" class="flex items-center gap-2">
            <p class="text-caption tabular font-semibold text-neutral-700">
              {{ formatFecha(row.proximo_vencimiento) }}
            </p>
            <TmBadge
              size="sm"
              :tone="store.riesgoTone(store.diasRestantes(row.proximo_vencimiento))"
              dot
            >
              {{ badgeDias(store.diasRestantes(row.proximo_vencimiento)) }}
            </TmBadge>
          </div>
          <p v-else class="text-caption-xs text-neutral-400">Sin lotes</p>
        </template>

        <template #cell:precio="{ row }">
          <p class="tabular font-extrabold text-h4 text-primary-700">
            {{ fmtMoney(row.precio_unitario) }}
          </p>
        </template>

        <template #cell:acciones="{ row }">
          <div class="flex items-center gap-1 justify-end">
            <TmButton
              size="xs"
              variant="ghost"
              :icon="EyeIcon"
              @click="abrirDetalle(row)"
              title="Ver lotes y detalle"
            />
            <TmButton
              size="xs"
              variant="ghost"
              :icon="PackagePlusIcon"
              @click="openNuevoLote(row)"
              title="Ingresar lote"
            />
            <TmButton
              size="xs"
              variant="ghost"
              :icon="Trash2Icon"
              @click="openMerma(row)"
              title="Registrar merma"
              class="text-warning-600 hover:!bg-warning-50"
            />
            <TmButton
              size="xs"
              variant="ghost"
              :icon="TrashIcon"
              @click="confirmarBorrarProducto(row)"
              title="Borrar producto"
              class="text-danger-600 hover:!bg-danger-50"
            />
          </div>
        </template>
      </TmDataTable>
    </TmCard>

    <!-- ============================================================== -->
    <!-- MODAL DETALLE PRODUCTO (Lotes PEPS + editar stock mínimo)      -->
    <!-- ============================================================== -->
    <TmModal
      v-model="modalDetalle"
      :title="store.productoSeleccionado?.nombre ?? 'Detalle del producto'"
      :subtitle="`SKU ${store.productoSeleccionado?.sku ?? ''}`"
      :icon="PackageIcon"
      :icon-tone="'primary'"
      :size="'xl'"
    >
      <div
        v-if="store.productoSeleccionado"
        class="grid grid-cols-1 lg:grid-cols-3 gap-5"
      >
        <!-- Info producto -->
        <div class="space-y-4">
          <div class="tm-surface p-5 rounded-xl">
            <div class="flex items-start gap-3 mb-4">
              <div
                class="w-14 h-14 rounded-2xl bg-primary-50 text-primary-700
                       flex items-center justify-center shrink-0"
              >
                <component :is="PackageIcon" class="w-7 h-7" />
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="text-h4 font-extrabold text-neutral-800 leading-tight">
                  {{ store.productoSeleccionado.nombre }}
                </h4>
                <p class="text-caption text-neutral-500 mt-0.5">
                  {{ store.categoriaPorId(store.productoSeleccionado.categoria_id)?.nombre }}
                </p>
              </div>
            </div>
            <dl class="grid grid-cols-2 gap-3">
              <Dato label="SKU" :value="store.productoSeleccionado.sku" />
              <Dato label="Código" :value="store.productoSeleccionado.codigo_barras ?? '—'" />
              <Dato label="Precio venta">
                <span class="text-primary-700 tabular font-extrabold text-h4">
                  {{ fmtMoney(store.productoSeleccionado.precio_unitario) }}
                </span>
              </Dato>
              <Dato label="Unidad" :value="store.productoSeleccionado.unidad_medida" />
            </dl>
          </div>

          <!-- Editar stock mínimo -->
          <div class="tm-surface p-5 rounded-xl">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h5 class="text-body-sm font-bold text-neutral-800">Stock mínimo</h5>
                <p class="text-caption-xs text-neutral-500 mt-0.5">
                  Alerta de reposición al llegar a este nivel.
                </p>
              </div>
              <div
                class="w-9 h-9 rounded-lg bg-warning-50 text-warning-600
                       flex items-center justify-center shrink-0"
              >
                <component :is="AlertTriangleIcon" class="w-4.5 h-4.5" />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="number"
                v-model.number="editStockMinimo"
                min="0"
                class="!h-11 !text-h4 !font-bold tabular !text-center w-24"
              />
              <TmButton
                variant="primary"
                :icon="SaveIcon"
                :disabled="editStockMinimo === store.productoSeleccionado.stock_minimo"
                :loading="guardandoStockMinimo"
                @click="guardarStockMinimo"
              >
                Guardar
              </TmButton>
            </div>
          </div>

          <!-- Editar código de barras -->
          <div class="tm-surface p-5 rounded-xl">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h5 class="text-body-sm font-bold text-neutral-800">Código de barras</h5>
                <p class="text-caption-xs text-neutral-500 mt-0.5">
                  Código escaneable del producto (opcional).
                </p>
              </div>
              <div
                class="w-9 h-9 rounded-lg bg-primary-50 text-primary-600
                       flex items-center justify-center shrink-0"
              >
                <component :is="SearchIcon" class="w-4.5 h-4.5" />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="text"
                v-model="editCodigoBarras"
                class="!h-11 !text-body-sm font-bold tabular flex-1"
                placeholder="Ej: 7791234567890"
              />
              <TmButton
                variant="primary"
                :icon="SaveIcon"
                :disabled="editCodigoBarras === (store.productoSeleccionado.codigo_barras ?? '')"
                :loading="guardandoCodigoBarras"
                @click="guardarCodigoBarras"
              >
                Guardar
              </TmButton>
            </div>
          </div>

          <!-- Acciones rápidas -->
          <div class="grid grid-cols-1 gap-2">
            <TmButton
              variant="outline"
              block
              :icon="EditIcon"
              @click="abrirEditarProducto"
            >
              Editar producto
            </TmButton>
            <div class="grid grid-cols-2 gap-2">
              <TmButton
                variant="outline"
                block
                :icon="PackagePlusIcon"
                @click="openNuevoLote(store.productoSeleccionado)"
              >
                Ingresar lote
              </TmButton>
              <TmButton
                variant="warning"
                block
                :icon="Trash2Icon"
                @click="openMerma(store.productoSeleccionado)"
              >
                Merma
              </TmButton>
            </div>
          </div>
        </div>

        <!-- Lotes -->
        <div class="lg:col-span-2 tm-surface rounded-xl overflow-hidden">
          <div
            class="flex items-center justify-between p-4 border-b border-border
                   bg-surface-muted/50"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg bg-info/10 text-primary-700
                       bg-primary-50 flex items-center justify-center shrink-0"
              >
                <component :is="LayersIcon" class="w-5 h-5" />
              </div>
              <div>
                <h5 class="text-h4 font-bold text-neutral-800 leading-tight">
                  Lotes (PEPS visible)
                </h5>
                <p class="text-caption-xs text-neutral-500">
                  Orden de consumo: los que vencen primero salen primero
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1.5 text-caption-xs font-semibold">
              <span class="h-2.5 w-2.5 rounded-full bg-success-500"></span>OK
              <span class="h-2.5 w-2.5 rounded-full bg-warning-500 ml-2"></span>5d
              <span class="h-2.5 w-2.5 rounded-full bg-danger-500 ml-2"></span>2d
            </div>
          </div>

          <!-- PEPS items -->
          <div class="divide-y divide-border/80 max-h-[520px] overflow-y-auto scrollbar-thin">
            <div
              v-for="(lote, idx) in store.productoSeleccionadoLotes"
              :key="lote.id"
              class="flex items-center gap-4 p-4 transition-colors"
              :class="[
                lote.estado === 'activo' ? 'bg-white' : 'bg-neutral-50/70 opacity-80',
              ]"
            >
              <!-- Ícono lote + idx peps -->
              <div class="relative shrink-0">
                <div
                  class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-h3 shadow-sm"
                  :class="loteBg(lote)"
                >
                  {{ idx + 1 }}
                </div>
                <TmBadge
                  v-if="idx === 0 && lote.estado === 'activo' && lote.cantidad_actual > 0"
                  size="sm"
                  tone="primary"
                  class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 shadow-sm"
                >
                  1° PEPS
                </TmBadge>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <p class="text-body-sm font-bold text-neutral-800">
                    Lote {{ lote.numero_lote ?? `#${lote.id}` }}
                  </p>
                  <TmBadge
                    size="sm"
                    :tone="toneLoteEstado(lote.estado)"
                    dot
                  >
                    {{ labelLoteEstado(lote.estado) }}
                  </TmBadge>
                </div>
                <div class="flex items-center gap-3 flex-wrap text-caption-xs text-neutral-500 tabular">
                  <span class="inline-flex items-center gap-1">
                    <component :is="CalendarInIcon" class="w-3.5 h-3.5" />
                    Ingreso: {{ formatFecha(lote.fecha_ingreso, { dateStyle: "short" }) }}
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <component :is="CalendarXIcon" class="w-3.5 h-3.5" />
                    Vence: {{ formatFecha(lote.fecha_vencimiento) }}
                  </span>
                  <span v-if="lote.proveedor_id">
                    Prov. #{{ lote.proveedor_id }}
                  </span>
                </div>
              </div>

              <!-- Cantidades + costo -->
              <div class="text-right shrink-0 min-w-[140px]">
                <div class="flex items-baseline justify-end gap-2">
                  <p
                    class="tabular font-extrabold text-h3 leading-none"
                    :class="[
                      lote.cantidad_actual === 0 ? 'text-neutral-400 line-through' :
                      lote.cantidad_actual < lote.cantidad_inicial * 0.25 ? 'text-warning-700' :
                      'text-neutral-800',
                    ]"
                  >
                    {{ lote.cantidad_actual }}
                  </p>
                  <p class="text-caption-xs text-neutral-400 tabular">
                    / {{ lote.cantidad_inicial }}
                  </p>
                </div>
                <p class="text-caption-xs text-neutral-500 tabular mt-1">
                  Costo: {{ fmtMoney(lote.costo_unitario) }} c/u
                </p>
                <TmBadge
                  v-if="lote.estado === 'activo' && lote.cantidad_actual > 0"
                  size="sm"
                  :tone="store.riesgoTone(store.diasRestantes(lote.fecha_vencimiento))"
                  class="mt-1.5"
                  dot
                >
                  {{ badgeDias(store.diasRestantes(lote.fecha_vencimiento)) }}
                </TmBadge>
              </div>

              <!-- Barra consumo -->
              <div class="hidden lg:block w-28 shrink-0">
                <div class="h-2 rounded-full bg-neutral-200 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :style="{ width: pctLote(lote) + '%' }"
                    :class="[
                      pctLote(lote) === 0 ? 'bg-neutral-300' :
                      pctLote(lote) < 25 ? 'bg-danger-500' :
                      pctLote(lote) < 60 ? 'bg-warning-500' : 'bg-primary-500',
                    ]"
                  />
                </div>
                <p class="text-micro text-neutral-400 tabular mt-1 text-right">
                  {{ pctLote(lote).toFixed(0) }}% disp.
                </p>
              </div>
            </div>

            <div
              v-if="store.productoSeleccionadoLotes.length === 0"
              class="p-10 text-center text-neutral-500"
            >
              <component :is="PackageIcon" class="w-12 h-12 mx-auto mb-3 text-neutral-300" />
              <p class="text-body-sm font-semibold">Sin lotes para este producto</p>
              <p class="text-caption mt-1">Ingresa el primer lote para comenzar a vender.</p>
              <TmButton
                size="sm"
                variant="primary"
                class="mt-4"
                :icon="PlusIcon"
                @click="openNuevoLote(store.productoSeleccionado)"
              >
                Ingresar lote
              </TmButton>
            </div>
          </div>
        </div>
      </div>
    </TmModal>

    <!-- ============================================================== -->
    <!-- MODAL NUEVO PRODUCTO                                           -->
    <!-- ============================================================== -->
    <TmModal
      v-model="modalNuevoProducto"
      title="Nuevo producto"
      subtitle="Crea la ficha maestra del producto y su stock mínimo."
      :icon="PlusIcon"
      :icon-tone="'primary'"
      :size="'lg'"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <Label>Nombre del producto</Label>
          <input v-model="np.nombre" type="text" class="w-full" placeholder="ej: Queso Cremón Tandil 1kg" />
        </div>
        <div>
          <Label>SKU</Label>
          <input v-model="np.sku" type="text" class="w-full" placeholder="ej: QUE-CRE-001" />
        </div>
        <div>
          <Label>Código de barras</Label>
          <div class="flex gap-2">
            <input
              v-model="np.codigo_barras"
              ref="barcodeInputRef"
              @keydown.enter.prevent="onBarcodeScan"
              type="text"
              class="w-full"
              placeholder="Escanea o escribe (opcional)"
            />
            <TmButton
              variant="outline"
              size="md"
              :icon="SearchIcon"
              @click="focusBarcodeInput"
              title="Escanear código de barras"
            />
          </div>
          <p class="text-caption-xs text-neutral-500 mt-1">
            Escanea con la pistola de código de barras y presiona Enter
          </p>
        </div>
        <div>
          <Label>Categoría</Label>
          <select v-model.number="np.categoria_id" class="w-full">
            <option :value="null" disabled>Seleccionar categoría…</option>
            <option v-for="c in store.categorias" :key="c.id" :value="c.id">
              {{ c.nombre }}
            </option>
          </select>
        </div>
        <div>
          <Label>Unidad de medida</Label>
          <select v-model="np.unidad_medida" class="w-full">
            <option value="unidad">Unidad</option>
            <option value="pack">Pack</option>
            <option value="caja">Caja</option>
            <option value="kg">Kilo</option>
            <option value="g">Gramos</option>
            <option value="litro">Litro</option>
            <option value="ml">ml</option>
          </select>
        </div>
        <div>
          <Label>Precio unitario de venta ($)</Label>
          <input v-model.number="np.precio_unitario" type="number" min="0" step="0.01" class="w-full tabular font-bold" />
        </div>
        <div>
          <Label>Stock mínimo</Label>
          <input v-model.number="np.stock_minimo" type="number" min="0" class="w-full tabular" />
        </div>
      </div>
      <template #footer>
        <TmButton variant="ghost" @click="modalNuevoProducto = false">Cancelar</TmButton>
        <TmButton
          variant="primary"
          :icon="SaveIcon"
          :loading="guardandoProducto"
          :disabled="!npValido"
          @click="guardarNuevoProducto"
        >
          Crear producto
        </TmButton>
      </template>
    </TmModal>

    <!-- ============================================================== -->
    <!-- MODAL EDITAR PRODUCTO                                         -->
    <!-- ============================================================== -->
    <TmModal
      v-model="modalEditarProducto"
      title="Editar producto"
      subtitle="Modifica los datos del producto seleccionado."
      :icon="EditIcon"
      :icon-tone="'primary'"
      :size="'lg'"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <Label>Nombre del producto</Label>
          <input v-model="ep.nombre" type="text" class="w-full" placeholder="ej: Queso Cremón Tandil 1kg" />
        </div>
        <div>
          <Label>SKU</Label>
          <input v-model="ep.sku" type="text" class="w-full" placeholder="ej: QUE-CRE-001" />
        </div>
        <div>
          <Label>Código de barras</Label>
          <div class="flex gap-2">
            <input
              v-model="ep.codigo_barras"
              ref="editBarcodeInputRef"
              @keydown.enter.prevent="onEditBarcodeScan"
              type="text"
              class="w-full"
              placeholder="Escanea o escribe (opcional)"
            />
            <TmButton
              variant="outline"
              size="md"
              :icon="SearchIcon"
              @click="focusEditBarcodeInput"
              title="Escanear código de barras"
            />
          </div>
          <p class="text-caption-xs text-neutral-500 mt-1">
            Escanea con la pistola de código de barras y presiona Enter
          </p>
        </div>
        <div>
          <Label>Categoría</Label>
          <select v-model.number="ep.categoria_id" class="w-full">
            <option :value="null" disabled>Seleccionar categoría…</option>
            <option v-for="c in store.categorias" :key="c.id" :value="c.id">
              {{ c.nombre }}
            </option>
          </select>
        </div>
        <div>
          <Label>Unidad de medida</Label>
          <select v-model="ep.unidad_medida" class="w-full">
            <option value="unidad">Unidad</option>
            <option value="pack">Pack</option>
            <option value="caja">Caja</option>
            <option value="kg">Kilo</option>
            <option value="g">Gramos</option>
            <option value="litro">Litro</option>
            <option value="ml">ml</option>
          </select>
        </div>
        <div>
          <Label>Precio unitario de venta ($)</Label>
          <input v-model.number="ep.precio_unitario" type="number" min="0" step="0.01" class="w-full tabular font-bold" />
        </div>
        <div>
          <Label>Stock mínimo</Label>
          <input v-model.number="ep.stock_minimo" type="number" min="0" class="w-full tabular" />
        </div>
      </div>
      <template #footer>
        <TmButton variant="ghost" @click="modalEditarProducto = false">Cancelar</TmButton>
        <TmButton
          variant="primary"
          :icon="SaveIcon"
          :loading="guardandoEdicionProducto"
          :disabled="!epValido"
          @click="guardarEdicionProducto"
        >
          Guardar cambios
        </TmButton>
      </template>
    </TmModal>

    <!-- ============================================================== -->
    <!-- MODAL NUEVO LOTE (entrada mercadería)                          -->
    <!-- ============================================================== -->
    <TmModal
      v-model="modalNuevoLote"
      title="Ingresar lote de mercadería"
      :subtitle="loteSelProducto?.nombre ?? 'Selecciona producto y completa los datos'"
      :icon="PackagePlusIcon"
      :icon-tone="'info'"
      :size="'lg'"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <Label>Producto</Label>
          <select
            v-model.number="nl.producto_id"
            class="w-full"
            :disabled="!!loteSelProducto"
          >
            <option :value="null" disabled>Seleccionar…</option>
            <option v-for="p in store.productos" :key="p.id" :value="p.id">
              {{ p.nombre }} — (SKU {{ p.sku }})
            </option>
          </select>
        </div>
        <div>
          <Label>Número de lote (proveedor)</Label>
          <input v-model="nl.numero_lote" type="text" class="w-full" placeholder="ej: LS-2410-001" />
        </div>
        <div>
          <Label>Cantidad (unidades)</Label>
          <input v-model.number="nl.cantidad_inicial" type="number" min="1" class="w-full tabular font-bold" />
        </div>
        <div>
          <Label>Costo unitario de compra ($)</Label>
          <input v-model.number="nl.costo_unitario" type="number" min="0" step="0.01" class="w-full tabular" />
        </div>
        <div>
          <Label>Fecha de vencimiento</Label>
          <input v-model="nl.fecha_vencimiento" type="date" class="w-full" />
        </div>
        <div>
          <Label>Fecha de ingreso</Label>
          <input v-model="nl.fecha_ingreso" type="date" class="w-full" />
        </div>
        <div>
          <Label>Proveedor (id)</Label>
          <input v-model.number="nl.proveedor_id" type="number" class="w-full tabular" placeholder="(opcional)" />
        </div>
      </div>
      <div
        v-if="nl.producto_id && nl.cantidad_inicial > 0 && nl.costo_unitario > 0"
        class="mt-5 tm-surface-soft p-4 rounded-xl flex items-center justify-between"
      >
        <span class="text-caption font-semibold text-neutral-600">Costo total del lote</span>
        <span class="text-h3 tabular font-extrabold text-primary-700">
          {{ fmtMoney(nl.cantidad_inicial * nl.costo_unitario) }}
        </span>
      </div>
      <template #footer>
        <TmButton variant="ghost" @click="modalNuevoLote = false">Cancelar</TmButton>
        <TmButton
          variant="primary"
          :icon="PackagePlusIcon"
          :loading="guardandoLote"
          :disabled="!nlValido"
          @click="guardarNuevoLote"
        >
          Registrar ingreso
        </TmButton>
      </template>
    </TmModal>

    <!-- ============================================================== -->
    <!-- MODAL REGISTRAR MERMA                                          -->
    <!-- ============================================================== -->
    <TmModal
      v-model="modalMerma"
      title="Registrar merma"
      subtitle="Da de baja unidades y actualiza automáticamente los reportes."
      :icon="Trash2Icon"
      :icon-tone="'warning'"
      :size="'lg'"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <Label>Producto</Label>
          <select
            v-model.number="mr.producto_id"
            class="w-full"
            :disabled="!!mermaSelProducto"
            @change="onMermaProductoChange"
          >
            <option :value="null" disabled>Seleccionar…</option>
            <option v-for="p in store.productos" :key="p.id" :value="p.id">
              {{ p.nombre }} — Stock: {{ p.stock_total }}
            </option>
          </select>
        </div>
        <div>
          <Label>Motivo de baja</Label>
          <select v-model="mr.motivo" class="w-full">
            <option value="danado">Dañado / roto</option>
            <option value="vencido">Vencido</option>
            <option value="robo">Robo / pérdida</option>
            <option value="error_stock">Error de conteo</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <Label>Cantidad a dar de baja</Label>
          <input v-model.number="mr.cantidad" type="number" min="1" class="w-full tabular font-bold" />
        </div>
        <div class="sm:col-span-2">
          <div class="flex items-center justify-between mb-2">
            <Label>Descontar de lote específico (opcional)</Label>
            <label class="inline-flex items-center gap-1.5 text-caption-xs font-semibold text-neutral-600 cursor-pointer">
              <input type="checkbox" v-model="mermaManual" class="!w-3.5 !h-3.5" />
              Seleccionar lote manual
            </label>
          </div>
          <select
            v-if="mermaManual"
            v-model.number="mr.lote_id"
            class="w-full"
          >
            <option :value="null">Auto (PEPS)</option>
            <option
              v-for="l in mermaLotesDisponibles"
              :key="l.id"
              :value="l.id"
              :disabled="l.cantidad_actual <= 0"
            >
              Lote {{ l.numero_lote ?? `#${l.id}` }} · Vence {{ formatFecha(l.fecha_vencimiento) }} · {{ l.cantidad_actual }} u.
            </option>
          </select>
          <p v-else class="text-caption-xs text-neutral-500">
            Por defecto, el sistema descuenta usando PEPS (primero en vencer, primero en salir).
          </p>
        </div>
        <div class="sm:col-span-2">
          <Label>Observaciones (opcional)</Label>
          <textarea
            v-model="mr.observaciones"
            rows="2"
            class="w-full resize-none"
            placeholder="Detalle el motivo, ejemplo: 2 unidades con envaje roto al recibir mercadería"
          />
        </div>
      </div>
      <template #footer>
        <TmButton variant="ghost" @click="modalMerma = false">Cancelar</TmButton>
        <TmButton
          variant="warning"
          :icon="Trash2Icon"
          :loading="guardandoMerma"
          :disabled="!mrValido"
          @click="guardarMerma"
        >
          Confirmar baja
        </TmButton>
      </template>
    </TmModal>

    <!-- ============================================================== -->
    <!-- MODAL BACKUP/RESTORE                                         -->
    <!-- ============================================================== -->
    <TmModal
      v-model="modalBackup"
      title="Backup de datos"
      subtitle="Exporta o importa tus datos para no perderlos al actualizar."
      :icon="DownloadIcon"
      :icon-tone="'primary'"
      :size="'md'"
    >
      <div class="space-y-4">
        <div class="tm-surface p-4 rounded-xl">
          <h5 class="text-body-sm font-bold text-neutral-800 mb-2">Exportar datos</h5>
          <p class="text-caption text-neutral-600 mb-3">
            Descarga una copia de seguridad de todos tus productos, ventas y configuraciones.
          </p>
          <TmButton
            variant="primary"
            block
            :icon="DownloadIcon"
            @click="exportarBackup"
          >
            Descargar backup
          </TmButton>
        </div>

        <div class="tm-surface p-4 rounded-xl">
          <h5 class="text-body-sm font-bold text-neutral-800 mb-2">Importar datos</h5>
          <p class="text-caption text-neutral-600 mb-3">
            Restaura una copia de seguridad desde un archivo JSON.
          </p>
          <input
            type="file"
            accept=".json"
            @change="onFileSelected"
            class="w-full mb-3"
          />
          <TmButton
            variant="secondary"
            block
            :icon="UploadIcon"
            :disabled="!backupImportText"
            :loading="backupImportando"
            @click="importarBackup"
          >
            Restaurar backup
          </TmButton>
        </div>
      </div>
      <template #footer>
        <TmButton variant="ghost" @click="modalBackup = false">Cerrar</TmButton>
      </template>
    </TmModal>
  </div>
</template>

<script setup>
import { computed, h, inject, nextTick, onMounted, reactive, ref, watch } from "vue";
import {
  Package as PackageIcon,
  AlertTriangle as AlertTriangleIcon,
  CalendarClock as CalendarClockIcon,
  ShieldAlert as ShieldAlertIcon,
  RefreshCw as RefreshIcon,
  Plus as PlusIcon,
  PackagePlus as PackagePlusIcon,
  Trash2 as Trash2Icon,
  Trash as TrashIcon,
  Search as SearchIcon,
  Eye as EyeIcon,
  Save as SaveIcon,
  Layers as LayersIcon,
  CalendarPlus as CalendarInIcon,
  CalendarX as CalendarXIcon,
  Tags as TagsIcon,
  ChevronUp as ChevronUpIcon,
  ChevronDown as ChevronDownIcon,
  Edit3 as EditIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
} from "lucide-vue-next";

import { TmButton, TmCard, TmBadge, TmModal, TmDataTable, TmSearch } from "@/components/ui";
import { useInventarioStore } from "@/stores/inventario.js";
import { useCotizacionesStore } from "@/stores/cotizaciones.js";
import { useRouter } from "vue-router";
import { exportarDatos, importarDatos, tieneDatosGuardados } from "@/api/localDb.js";

const cotizacionesStore = useCotizacionesStore();
function unidadesReservadas(productoId) {
  return cotizacionesStore.reservasMap.get(Number(productoId)) || 0;
}

// Fix íconos que pueden no existir
const CalendarInIcon2 = CalendarInIcon || LayersIcon;

const store = useInventarioStore();
const toast = inject("$toast");
const router = useRouter();

const COLUMNAS = [
  { key: "producto", label: "Producto", width: 340 },
  { key: "categoria", label: "Categoría", width: 150 },
  { key: "stock", label: "Stock actual / mínimo", width: 220 },
  { key: "vencimiento", label: "Próx. vencimiento", width: 200 },
  { key: "precio", label: "Precio", width: 120, align: "right" },
  { key: "acciones", label: "", width: 140, align: "right" },
];

// --- Filtros locales (bindean con store reactivamente vía watch) ---
const filtroBusqueda = ref("");
const filtroCategoria = ref(null);
const filtroEstado = ref("");
const filtroAVencer = ref(false);
const soloRiesgoToggle = ref(false);

watch(
  [filtroBusqueda, filtroCategoria, filtroEstado, filtroAVencer, soloRiesgoToggle],
  async () => {
    store.setFiltro("q", filtroBusqueda.value);
    store.setFiltro("categoria_id", filtroCategoria.value);
    store.setFiltro("estado_stock", filtroEstado.value);
    store.setFiltro("solo_a_vencer", filtroAVencer.value || soloRiesgoToggle.value);
    await store.cargarProductos();
  },
);

// --- Riesgos ---
const riesgosVisibles = ref(true);

// --- Modales ---
const modalDetalle = ref(false);
const modalNuevoProducto = ref(false);
const modalNuevoLote = ref(false);
const modalMerma = ref(false);
const modalBackup = ref(false);

// Backup
const backupImportText = ref("");
const backupImportando = ref(false);

// Editar stock mínimo
const editStockMinimo = ref(0);
const guardandoStockMinimo = ref(false);

// Editar código de barras
const editCodigoBarras = ref("");
const guardandoCodigoBarras = ref(false);

// Scanner de código de barras para nuevo producto
const barcodeInputRef = ref(null);

function focusBarcodeInput() {
  nextTick(() => {
    barcodeInputRef.value?.focus?.();
    barcodeInputRef.value?.select?.();
  });
}

function onBarcodeScan() {
  // Flash visual de éxito
  toast?.success?.("Código escaneado", np.codigo_barras);
}

// Scanner de código de barras para editar producto
const editBarcodeInputRef = ref(null);

function focusEditBarcodeInput() {
  nextTick(() => {
    editBarcodeInputRef.value?.focus?.();
    editBarcodeInputRef.value?.select?.();
  });
}

function onEditBarcodeScan() {
  toast?.success?.("Código escaneado", ep.codigo_barras);
}

// Editar producto completo
const modalEditarProducto = ref(false);
const ep = reactive({
  nombre: "", sku: "", codigo_barras: "",
  categoria_id: null, unidad_medida: "unidad",
  precio_unitario: null, stock_minimo: 5,
});
const guardandoEdicionProducto = ref(false);
const epValido = computed(() =>
  ep.nombre.trim().length >= 2 &&
  ep.sku.trim().length >= 2 &&
  ep.categoria_id != null &&
  Number(ep.precio_unitario) > 0,
);

// Nuevo producto
const np = reactive({
  nombre: "", sku: "", codigo_barras: "",
  categoria_id: null, unidad_medida: "unidad",
  precio_unitario: null, stock_minimo: 5,
});
const guardandoProducto = ref(false);
const npValido = computed(() =>
  np.nombre.trim().length >= 2 &&
  np.sku.trim().length >= 2 &&
  np.categoria_id != null &&
  Number(np.precio_unitario) > 0,
);

// Nuevo lote
const loteSelProducto = ref(null);
const nl = reactive({
  producto_id: null,
  numero_lote: "",
  cantidad_inicial: null,
  costo_unitario: 0,
  fecha_vencimiento: "",
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  proveedor_id: null,
});
const guardandoLote = ref(false);
const nlValido = computed(() =>
  nl.producto_id != null &&
  Number(nl.cantidad_inicial) >= 1 &&
  Number(nl.costo_unitario) >= 0 &&
  nl.fecha_vencimiento !== "",
);

// Merma
const mermaSelProducto = ref(null);
const mermaManual = ref(false);
const mermaLotesDisponibles = ref([]);
const mr = reactive({
  producto_id: null,
  lote_id: null,
  cantidad: null,
  motivo: "danado",
  observaciones: "",
});
const guardandoMerma = ref(false);
const mrValido = computed(() =>
  mr.producto_id != null &&
  Number(mr.cantidad) >= 1,
);

watch(
  () => modalDetalle.value,
  async (v) => {
    if (!v) store.limpiarDetalle();
  },
);

onMounted(async () => {
  await store.cargarTodo();
});

// --- Helpers ---
const CURRENCY = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
function fmtMoney(v) { return CURRENCY.format(Number(v) || 0); }
function formatFecha(iso, opts) {
  if (!iso) return "—";
  const optsDef = opts || { day: "2-digit", month: "2-digit", year: "numeric" };
  try { return new Date(iso).toLocaleDateString("es-AR", optsDef); }
  catch { return iso; }
}

function toneStock(p) {
  if (p.stock_total === 0) return "danger";
  if (p.estado === "vencimiento_proximo") return "warning";
  if (p.estado === "stock_bajo") return "warning";
  return "success";
}
function labelStock(p) {
  if (p.stock_total === 0) return "Sin stock";
  if (p.estado === "vencimiento_proximo") return "Vence pronto";
  if (p.estado === "stock_bajo") return "Stock bajo";
  return "OK";
}
function pctStock(p) {
  const min = Number(p.stock_minimo) || 1;
  const ref = Math.max(min * 3, 20);
  return Math.round((Number(p.stock_total) / ref) * 100);
}
function pctLote(l) {
  const init = Math.max(1, Number(l.cantidad_inicial));
  return Math.round((Number(l.cantidad_actual) / init) * 100);
}

function badgeDias(d) {
  if (d < 0) return `Vencido ${-d}d`;
  if (d === 0) return "HOY vence";
  if (d === 1) return "Falta 1 día";
  return `Faltan ${d}d`;
}
function bgRiesgo(d) { return store.riesgoTone(d) === "danger" ? "bg-danger-50" : "bg-warning-50"; }
function textRiesgo(d) { return store.riesgoTone(d) === "danger" ? "text-danger-600" : "text-warning-600"; }

function loteBg(l) {
  if (l.estado !== "activo") return "bg-neutral-400";
  const d = store.diasRestantes(l.fecha_vencimiento);
  if (d < 0) return "bg-danger-600";
  if (d <= 2) return "bg-gradient-to-br from-danger-500 to-danger-600";
  if (d <= 5) return "bg-gradient-to-br from-warning-500 to-warning-600";
  if (d <= 15) return "bg-gradient-to-br from-primary-500 to-primary-600";
  return "bg-gradient-to-br from-success-500 to-success-600";
}
function toneLoteEstado(e) {
  return ({ activo: "success", agotado: "neutral", mermado: "warning", vencido: "danger" })[e] ?? "neutral";
}
function labelLoteEstado(e) {
  return ({ activo: "Activo", agotado: "Agotado", mermado: "Mermado", vencido: "Vencido" })[e] ?? e;
}

// --- Acciones detalle / KPI ---
async function abrirDetalle(row) {
  await store.cargarDetalleProducto(row.id);
  editStockMinimo.value = store.productoSeleccionado?.stock_minimo ?? 5;
  editCodigoBarras.value = store.productoSeleccionado?.codigo_barras ?? "";
  modalDetalle.value = true;
}
function abrirDetalleDesdeRiesgo(riesgo) {
  abrirDetalle({ id: riesgo.producto_id, nombre: riesgo.producto_nombre });
}
async function guardarStockMinimo() {
  guardandoStockMinimo.value = true;
  try {
    await store.actualizarStockMinimo(store.productoSeleccionado.id, editStockMinimo.value);
    toast?.success?.("Stock mínimo actualizado", `Nuevo mínimo: ${editStockMinimo.value} u.`);
  } finally { guardandoStockMinimo.value = false; }
}
async function guardarCodigoBarras() {
  guardandoCodigoBarras.value = true;
  try {
    await store.actualizarCodigoBarras(store.productoSeleccionado.id, editCodigoBarras.value);
    toast?.success?.("Código de barras actualizado", editCodigoBarras.value ? `Nuevo código: ${editCodigoBarras.value}` : "Código eliminado");
  } finally { guardandoCodigoBarras.value = false; }
}

// Editar producto completo
function abrirEditarProducto() {
  if (!store.productoSeleccionado) return;
  Object.assign(ep, {
    nombre: store.productoSeleccionado.nombre,
    sku: store.productoSeleccionado.sku,
    codigo_barras: store.productoSeleccionado.codigo_barras ?? "",
    categoria_id: store.productoSeleccionado.categoria_id,
    unidad_medida: store.productoSeleccionado.unidad_medida,
    precio_unitario: store.productoSeleccionado.precio_unitario,
    stock_minimo: store.productoSeleccionado.stock_minimo,
  });
  modalEditarProducto.value = true;
}

async function guardarEdicionProducto() {
  guardandoEdicionProducto.value = true;
  try {
    const actualizado = await store.actualizarProducto(store.productoSeleccionado.id, {
      nombre: ep.nombre.trim(),
      sku: ep.sku.trim(),
      codigo_barras: ep.codigo_barras?.trim() || null,
      categoria_id: ep.categoria_id,
      unidad_medida: ep.unidad_medida,
      precio_unitario: parseFloat(Number(ep.precio_unitario).toFixed(2)),
      stock_minimo: Number(ep.stock_minimo) || 0,
    });
    toast?.success?.("Producto actualizado", `${actualizado.nombre}`);
    modalEditarProducto.value = false;
    await store.cargarProductos();
    await store.cargarDetalleProducto(store.productoSeleccionado.id);
  } finally { guardandoEdicionProducto.value = false; }
}

// Backup/Restore
function exportarBackup() {
  const exito = exportarDatos();
  if (exito) {
    toast?.success?.("Backup exportado", "Se ha descargado el archivo de backup correctamente.");
  } else {
    toast?.error?.("Error al exportar", "No se pudo generar el archivo de backup.");
  }
}

function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    backupImportText.value = e.target.result;
  };
  reader.readAsText(file);
}

async function importarBackup() {
  if (!backupImportText.value) return;
  backupImportando.value = true;
  try {
    const exito = importarDatos(backupImportText.value);
    if (exito) {
      toast?.success?.("Backup restaurado", "Tus datos han sido restaurados correctamente.");
      await store.cargarTodo();
      modalBackup.value = false;
      backupImportText.value = "";
    } else {
      toast?.error?.("Error al importar", "El archivo de backup no es válido o está corrupto.");
    }
  } finally {
    backupImportando.value = false;
  }
}

// --- Nuevo producto ---
function resetNP() {
  Object.assign(np, {
    nombre: "", sku: "", codigo_barras: "",
    categoria_id: null, unidad_medida: "unidad",
    precio_unitario: null, stock_minimo: 5,
  });
}
watch(modalNuevoProducto, (v) => { if (!v) resetNP(); });
async function guardarNuevoProducto() {
  guardandoProducto.value = true;
  try {
    const creado = await store.crearProducto({
      nombre: np.nombre.trim(),
      sku: np.sku.trim(),
      codigo_barras: np.codigo_barras?.trim() || null,
      categoria_id: np.categoria_id,
      unidad_medida: np.unidad_medida,
      precio_unitario: parseFloat(Number(np.precio_unitario).toFixed(2)),
      stock_minimo: Number(np.stock_minimo) || 0,
      activo: true,
    });
    toast?.success?.("Producto creado", `${creado.nombre}`);
    modalNuevoProducto.value = false;
    await abrirDetalle(creado);
  } finally { guardandoProducto.value = false; }
}

// --- Nuevo lote ---
function openNuevoLote(rowOrNull = null) {
  loteSelProducto.value = rowOrNull ? store.productos.find(p => p.id === rowOrNull.id) ?? rowOrNull : null;
  Object.assign(nl, {
    producto_id: rowOrNull ? rowOrNull.id : null,
    numero_lote: "",
    cantidad_inicial: null,
    costo_unitario: 0,
    fecha_vencimiento: "",
    fecha_ingreso: new Date().toISOString().slice(0, 10),
    proveedor_id: null,
  });
  modalNuevoLote.value = true;
}
watch(modalNuevoLote, (v) => { if (!v) loteSelProducto.value = null; });
async function guardarNuevoLote() {
  guardandoLote.value = true;
  try {
    const creado = await store.crearLote({
      producto_id: nl.producto_id,
      proveedor_id: nl.proveedor_id || null,
      numero_lote: nl.numero_lote?.trim() || null,
      cantidad_inicial: Number(nl.cantidad_inicial),
      costo_unitario: Number(nl.costo_unitario) || 0,
      fecha_vencimiento: nl.fecha_vencimiento,
      fecha_ingreso: nl.fecha_ingreso ? new Date(nl.fecha_ingreso).toISOString() : undefined,
    });
    toast?.success?.("Lote ingresado", `Lote ${creado.numero_lote ?? "#" + creado.id}`);
    modalNuevoLote.value = false;
  } finally { guardandoLote.value = false; }
}

// --- Merma ---
function openMerma(rowOrNull = null) {
  mermaSelProducto.value = rowOrNull
    ? store.productos.find(p => p.id === rowOrNull.id) ?? rowOrNull
    : null;
  Object.assign(mr, {
    producto_id: rowOrNull ? rowOrNull.id : null,
    lote_id: null,
    cantidad: null,
    motivo: "danado",
    observaciones: "",
  });
  mermaManual.value = false;
  mermaLotesDisponibles.value = [];
  modalMerma.value = true;
  if (rowOrNull) onMermaProductoChange();
}
watch(modalMerma, (v) => { if (!v) mermaSelProducto.value = null; });
async function onMermaProductoChange() {
  if (!mr.producto_id) { mermaLotesDisponibles.value = []; return; }
  const lotes = await store.cargarLotesPorProducto(mr.producto_id, { forzar: true });
  mermaLotesDisponibles.value = (lotes || []).filter(
    (l) => l.estado === "activo" && l.cantidad_actual > 0,
  );
}
async function guardarMerma() {
  guardandoMerma.value = true;
  try {
    const payload = {
      producto_id: mr.producto_id,
      cantidad: Number(mr.cantidad),
      motivo: mr.motivo,
      observaciones: mr.observaciones?.trim() || null,
    };
    if (mermaManual.value && mr.lote_id) payload.lote_id = mr.lote_id;
    await store.registrarMerma(payload);
    toast?.success?.(
      "Merma registrada",
      `${mr.cantidad} u. dado(s) de baja · motivo: ${mr.motivo}`,
    );
    modalMerma.value = false;
  } finally { guardandoMerma.value = false; }
}

// --- Borrar producto ---
async function confirmarBorrarProducto(row) {
  if (!confirm(`¿Estás seguro de borrar el producto "${row.nombre}"?\n\nEsta acción también borrará todos los lotes asociados.`)) {
    return;
  }
  try {
    await store.borrarProducto(row.id);
    toast?.success?.("Producto borrado", `${row.nombre} eliminado correctamente`);
  } catch (err) {
    toast?.error?.("Error al borrar", err?.message || "No se pudo eliminar el producto");
  }
}

// --- Subcomponentes inline (siguiendo patrón DashboardView) ---
const Label = (_, { slots }) => h(
  "label",
  { class: "block text-caption-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5" },
  slots.default?.(),
);

const Dato = {
  props: ["label"],
  setup(p, { slots }) {
    return () => h("div", { class: "tm-surface-soft p-2.5 rounded-lg" }, [
      h("p", { class: "text-caption-xs font-semibold uppercase tracking-wide text-neutral-500" }, p.label),
      h(
        "p",
        { class: "text-body-sm font-bold text-neutral-700 mt-0.5 tabular break-words" },
        slots.default?.() ?? "",
      ),
    ]);
  },
};

const Kpi = {
  props: ["title", "value", "subValue", "delta", "label", "icon", "tone", "bad", "to"],
  setup(p) {
    const tones = {
      primary:   "bg-primary-50 text-primary-700",
      secondary: "bg-secondary-50 text-secondary-700",
      success:   "bg-success-50 text-success-700",
      warning:   "bg-warning-50 text-warning-700",
      danger:    "bg-danger-50 text-danger-700",
      info:      "bg-primary-50 text-primary-700",
    };
    return () => {
      const delta = Number(p.delta ?? 0);
      const hasDelta = p.delta !== undefined && p.delta !== null;
      const good = p.bad ? delta > 0 : delta >= 0;
      const deltaColor = good
        ? "text-success-700 bg-success-50"
        : "text-danger-700 bg-danger-50";
      const deltaSign = delta > 0 ? "+" : "";
      const wrap = h("div", { class: ["tm-stat", p.to ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200" : ""] }, [
        h("div", { class: ["tm-stat-icon", tones[p.tone] ?? tones.primary] }, [
          h(p.icon, { class: "w-[18px] h-[18px]" }),
        ]),
        h("p", { class: "tm-stat-label mt-4" }, p.title),
        h("p", { class: "tm-stat-value mt-1" }, p.value),
        p.subValue ? h("p", { class: "text-caption-xs text-neutral-500 mt-0.5" }, p.subValue) : null,
        hasDelta ? h("div", {
          class: ["h-6 px-2 rounded-full text-caption-xs font-bold tabular inline-flex items-center gap-1 mt-2", deltaColor],
        }, [
          `${deltaSign}${Math.abs(Number(p.delta))}${p.label ? ` · ${p.label}` : ""}`,
        ]) : null,
      ]);
      return p.to
        ? h("div", { onClick: () => router.push(p.to) }, [wrap])
        : wrap;
    };
  },
};
</script>

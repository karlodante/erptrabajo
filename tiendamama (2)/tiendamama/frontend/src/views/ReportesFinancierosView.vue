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
            No se pudo cargar Reportes financieros y arqueos
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
          <details v-if="errorDetalle" class="mt-4">
            <summary class="font-bold cursor-pointer text-danger-700 text-caption">Detalle técnico</summary>
            <div class="font-mono text-xs whitespace-pre-wrap border p-3 rounded bg-white/60 mt-2">
              {{ errorDetalle }}
            </div>
          </details>
        </div>
      </div>
    </div>

    <TmCard v-else-if="(store.loadingReporte || store.loadingArqueos) && store.ventasFiltradas.length === 0" class="p-6">
      <div class="flex items-center gap-3 text-neutral-500">
        <component :is="RefreshIcon" class="w-5 h-5 animate-spin" />
        <p class="text-caption font-bold">Cargando...</p>
      </div>
    </TmCard>

    <TmCard v-else padding="none" class="overflow-hidden">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4
               px-5 pt-5 pb-0 border-b border-border"
      >
        <div>
          <h2 class="text-h2 font-extrabold text-neutral-800">
            Administración y Control Financiero
          </h2>
          <p class="text-caption text-neutral-500 mt-1">
            Reportes de ventas, apertura/cierre de caja e historial de arqueos.
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
            variant="outline"
            size="md"
            :icon="TrashIcon"
            @click="limpiarDatosFinancieros"
          >
            Limpiar datos financieros
          </TmButton>
        </div>
      </div>

      <div class="px-5 pt-4">
        <TmTabs v-model="tab.value" :tabs="TABS" />
      </div>

      <!-- ============================================================ -->
      <!-- TAB 1: REPORTES DE VENTAS                                    -->
      <!-- ============================================================ -->
      <div v-if="tab.value === 'reportes'" class="p-5 pt-4">
        <!-- KPIs -->
        <div class="tm-stat-grid mb-6">
          <Kpi
            title="Total vendido"
            :value="fmtMoney(store.kpiReporte.total)"
            sub-value="en el período seleccionado"
            :icon="ReceiptIcon"
            tone="primary"
          />
          <Kpi
            title="Tickets emitidos"
            :value="String(store.kpiReporte.tickets)"
            :sub-value="`Promedio: ${fmtMoney(store.kpiReporte.ticket_promedio)}`"
            :icon="TicketIcon"
            tone="secondary"
          />
          <Kpi
            title="Forma de pago dominante"
            :value="formaPagoDominante.label"
            sub-value="de los tickets en el período"
            :icon="CreditCardIcon"
            tone="info"
          />
          <Kpi
            title="Día pico"
            :value="diaPico?.label ?? '—'"
            :sub-value="diaPico ? `${fmtMoney(diaPico.total)} · ${diaPico.tickets} tickets` : undefined"
            :icon="TrendingUpIcon"
            tone="success"
          />
        </div>

        <!-- Filtros reporte -->
        <div class="tm-surface p-4 mb-5">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div class="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100/70 w-fit border border-border">
              <button
                v-for="g in GRANULARIDADES"
                :key="g.value"
                type="button"
                @click="cambiarGranularidad(g.value)"
                class="h-9 px-4 rounded-lg text-caption font-bold transition-all"
                :class="
                  store.filtroVentas.granularidad === g.value
                    ? 'bg-white text-neutral-900 shadow-sm border border-border'
                    : 'text-neutral-500 hover:text-neutral-800'
                "
              >
                {{ g.label }}
              </button>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <TmSearch
                v-model="filtroTextoDetalle"
                placeholder="Buscar en tickets (n°, obs.)"
                class="max-w-xs"
              />
              <div class="flex items-center gap-1.5">
                <input
                  type="date"
                  :value="store.filtroVentas.fechaDesde"
                  @change="cambiarFecha('fechaDesde', $event.target.value)"
                  class="!h-9 !w-auto"
                />
                <span class="text-caption text-neutral-400">→</span>
                <input
                  type="date"
                  :value="store.filtroVentas.fechaHasta"
                  @change="cambiarFecha('fechaHasta', $event.target.value)"
                  class="!h-9 !w-auto"
                />
                <TmButton
                  size="sm"
                  variant="ghost"
                  @click="limpiarRangoFechas"
                  :icon="RotateCcwIcon"
                  title="Limpiar filtros de fecha"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Gráfico -->
        <TmCard class="mb-5">
          <template #header>
            <div class="flex items-center justify-between w-full gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                  <component :is="BarChart3Icon" class="w-[22px] h-[22px]" />
                </div>
                <div class="min-w-0">
                  <h3 class="text-h4 text-neutral-800 leading-tight">Evolución de ventas</h3>
                  <p class="text-caption text-neutral-500">
                    Monto vendido y tickets · {{ granularidadLabel }}
                  </p>
                </div>
              </div>
            </div>
          </template>
          <div class="h-[320px] mt-1">
            <Bar v-if="chartVentasData" :data="chartVentasData" :options="chartVentasOptions" />
          </div>
        </TmCard>

        <!-- Tabla detalle ventas -->
        <TmCard padding="none" class="!border-0">
          <template #header>
            <div class="flex items-center justify-between w-full px-5 py-4 border-b border-border">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-xl bg-secondary-50 text-secondary-700 flex items-center justify-center shrink-0">
                  <component :is="ListIcon" class="w-[22px] h-[22px]" />
                </div>
                <div>
                  <h3 class="text-h4 text-neutral-800 leading-tight">Detalle de tickets</h3>
                  <p class="text-caption text-neutral-500 tabular">
                    Mostrando {{ store.ventas.length }} de {{ store.ventasTotal }}
                  </p>
                </div>
              </div>
            </div>
          </template>
          <TmDataTable
            :rows="ventasFiltradasDetalle"
            :columns="COL_VENTAS"
            :searchable="false"
            :per-page="15"
            empty-text="No hay ventas que coincidan con los filtros."
          >
            <template #cell:numero="{ row }">
              <button
                type="button"
                class="tabular font-extrabold text-caption text-primary-700 hover:text-primary-900 hover:underline"
                @click="abrirVenta(row)"
              >
                #{{ row.numero_comprobante }}
              </button>
              <p class="text-micro tabular text-neutral-500 mt-0.5">
                {{ formatFechaHora(row.fecha_hora) }}
              </p>
            </template>
            <template #cell:items="{ row }">
              <span class="tabular font-bold text-caption text-neutral-700">
                {{ (row.detalle_ventas || []).reduce((s, i) => s + Number(i.cantidad || 0), 0) }} u.
              </span>
              <span class="text-micro text-neutral-500 ml-2">
                {{ (row.detalle_ventas || []).length }} ítems
              </span>
            </template>
            <template #cell:pagos="{ row }">
              <div class="flex flex-wrap gap-1">
                <TmBadge
                  v-for="p in (row.pagos || []).slice(0, 2)"
                  :key="p.id"
                  size="sm"
                  :tone="fpTone(p.forma_pago)"
                >
                  {{ fpLabel(p.forma_pago) }} · {{ fmtMoney(p.monto) }}
                </TmBadge>
                <TmBadge
                  v-if="(row.pagos || []).length > 2"
                  size="sm"
                  tone="info"
                >
                  +{{ (row.pagos || []).length - 2 }}
                </TmBadge>
              </div>
            </template>
            <template #cell:estado="{ row }">
              <TmBadge :tone="estadoVentaTone(row.estado)" dot :size="'sm'">
                {{ estadoVentaLabel(row.estado) }}
              </TmBadge>
            </template>
            <template #cell:total="{ row }">
              <p class="tabular text-h4 font-extrabold text-neutral-800">
                {{ fmtMoney(row.total) }}
              </p>
              <p v-if="Number(row.descuento_total) > 0" class="text-micro text-danger-600 tabular mt-0.5">
                −{{ fmtMoney(row.descuento_total) }} dto.
              </p>
            </template>
          </TmDataTable>
        </TmCard>
      </div>

      <!-- ============================================================ -->
      <!-- TAB 2: CAJA ACTUAL (apertura / movimientos / cierre)        -->
      <!-- ============================================================ -->
      <div v-else-if="tab.value === 'caja'" class="p-5 pt-4">
        <!-- Sin caja abierta: formulario de apertura -->
        <div v-if="!store.cajaAbierta" class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-5">
          <TmCard class="p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 rounded-2xl bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
                <component :is="LockIcon" class="w-6 h-6" />
              </div>
              <div class="min-w-0">
                <h3 class="text-h3 font-extrabold text-neutral-800 leading-tight">Caja cerrada</h3>
                <p class="text-caption text-neutral-500 mt-0.5">
                  Registrá el monto inicial para comenzar la jornada.
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_200px] gap-4">
              <div>
                <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
                  Monto inicial de caja ($) *
                </label>
                <input
                  v-model.number="formApertura.montoInicial"
                  type="number"
                  min="0"
                  step="0.01"
                  class="!h-[60px] !text-h3 !tabular w-full"
                  placeholder="25.000,00"
                  @keydown.enter.prevent="confirmarApertura"
                />
                <div class="flex items-center gap-2 mt-3 flex-wrap">
                  <button
                    v-for="v in SUGGESTION_MONTOS"
                    :key="v"
                    type="button"
                    class="h-9 px-3 rounded-lg bg-neutral-100 text-caption font-bold tabular text-neutral-700 hover:bg-primary-50 hover:text-primary-700"
                    @click="formApertura.montoInicial = v"
                  >
                    ${{ v.toLocaleString("es-AR") }}
                  </button>
                </div>
              </div>
              <div>
                <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
                  Fecha (opcional)
                </label>
                <input
                  v-model="formApertura.fecha"
                  type="date"
                  class="!h-[60px] w-full"
                />
              </div>
            </div>

            <div class="mt-6 flex items-center gap-3">
              <TmButton
                size="lg"
                variant="primary"
                :icon="UnlockIcon"
                :loading="procesandoApertura"
                :disabled="Number(formApertura.montoInicial) < 0"
                @click="confirmarApertura"
              >
                Abrir caja
              </TmButton>
              <span v-if="store.arqueos.length > 0" class="text-caption text-neutral-500 tabular ml-1">
                Último cierre: {{ store.arqueos.find(a => a.estado === 'cerrado') ? formatFecha(store.arqueos.find(a => a.estado === 'cerrado').fecha) : '—' }}
              </span>
            </div>
          </TmCard>

          <!-- Tarjeta resumen último arqueo -->
          <TmCard class="p-5">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                <component :is="HistoryIcon" class="w-5 h-5" />
              </div>
              <h3 class="text-h4 font-extrabold text-neutral-800">Último arqueo cerrado</h3>
            </div>
            <div v-if="ultimoArqueoCerrado" class="space-y-3">
              <div>
                <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">Fecha</p>
                <p class="text-caption font-bold tabular text-neutral-800 mt-0.5">
                  {{ formatFecha(ultimoArqueoCerrado.fecha) }} · {{ hora(ultimoArqueoCerrado.hora_cierre) }}
                </p>
              </div>
              <div>
                <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">Esperado vs. Contado</p>
                <div class="flex items-baseline gap-2 mt-1">
                  <p class="tabular font-bold text-caption text-neutral-700 line-through">
                    {{ fmtMoney(ultimoArqueoCerrado.monto_esperado) }}
                  </p>
                  <p class="tabular text-h4 font-extrabold text-neutral-900">
                    {{ fmtMoney(ultimoArqueoCerrado.monto_efectivo_contado) }}
                  </p>
                </div>
                <TmBadge
                  v-if="Number(ultimoArqueoCerrado.diferencia) !== 0"
                  class="mt-2"
                  :tone="Number(ultimoArqueoCerrado.diferencia) > 0 ? 'success' : 'danger'"
                  size="sm"
                >
                  {{ Number(ultimoArqueoCerrado.diferencia) > 0 ? 'Sobrante' : 'Faltante' }}
                  · {{ fmtMoney(Math.abs(Number(ultimoArqueoCerrado.diferencia))) }}
                </TmBadge>
              </div>
            </div>
            <p v-else class="text-caption text-neutral-500">Aún no hay arqueos cerrados.</p>
          </TmCard>
        </div>

        <!-- Caja ABIERTA -->
        <div v-else class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5">
          <!-- Col izq: KPIs + movimientos -->
          <div class="flex flex-col gap-4 min-w-0">
            <!-- Estado apertura -->
            <section class="tm-surface p-5 border-success-200 bg-gradient-to-br from-success-50/50 to-primary-50/30">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-start gap-4 min-w-0">
                  <div class="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-success-500 to-primary-500 text-white flex items-center justify-center shadow-sm">
                    <component :is="UnlockIcon" class="w-7 h-7" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <h3 class="text-h3 font-extrabold text-neutral-900 leading-tight">Caja abierta</h3>
                      <TmBadge tone="success" :size="'sm'" dot pulse>
                        EN LÍNEA
                      </TmBadge>
                    </div>
                    <p class="text-caption text-neutral-600 tabular">
                      Apertura: {{ formatFecha(store.arqueoAbierto.fecha) }} · {{ hora(store.arqueoAbierto.hora_apertura) }}
                      <span class="mx-1.5 text-neutral-300">·</span>
                      Arqueo N° {{ store.arqueoAbierto.id }}
                    </p>
                  </div>
                </div>
                <TmButton
                  variant="danger"
                  size="md"
                  :icon="LockIcon"
                  @click="abrirModalCierre"
                >
                  Cerrar caja
                </TmButton>
              </div>
            </section>

            <!-- 4 KPIs -->
            <div class="tm-stat-grid">
              <Kpi
                title="Fondo inicial"
                :value="fmtMoney(store.arqueoAbierto.monto_inicial)"
                :icon="BanknoteIcon"
                tone="info"
              />
              <Kpi
                title="Ventas en efectivo"
                :value="fmtMoney(store.totalEfectivoVentasAbierto)"
                sub-value="solo efectivo (QR/TC no incl.)"
                :icon="CoinsIcon"
                tone="success"
              />
              <Kpi
                title="Ingresos − Egresos"
                :value="fmtMoney(Number(store.ingresosManualesAbierto) - Number(store.egresosManualesAbierto))"
                :sub-value="`+${fmtMoney(store.ingresosManualesAbierto)} / −${fmtMoney(store.egresosManualesAbierto)}`"
                :icon="ArrowLeftRightIcon"
                tone="secondary"
              />
              <Kpi
                title="Saldo esperado"
                :value="fmtMoney(store.saldoEsperadoAbierto ?? 0)"
                sub-value="debería haber en caja ahora"
                :icon="WalletIcon"
                tone="primary"
              />
            </div>

            <!-- Movimientos -->
            <section class="tm-surface p-5">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-secondary-50 text-secondary-600 flex items-center justify-center shrink-0">
                    <component :is="ScrollTextIcon" class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="text-h4 font-extrabold text-neutral-800">Movimientos de hoy</h3>
                    <p class="text-caption text-neutral-500 tabular">{{ store.movimientos.length }} registros en este arqueo</p>
                  </div>
                </div>
                <TmButton
                  size="md"
                  variant="outline"
                  :icon="PlusIcon"
                  @click="showNuevoMovimiento = true"
                >
                  Nuevo movimiento
                </TmButton>
              </div>

              <TmDataTable
                :rows="store.movimientos"
                :columns="COL_MOVIMIENTOS"
                :searchable="false"
                :per-page="8"
                empty-text="No hay movimientos aún."
              >
                <template #cell:tipo="{ row }">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      :class="row.tipo === 'ingreso' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'"
                    >
                      <component :is="row.tipo === 'ingreso' ? TrendingUpIcon : TrendingDownIcon" class="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p class="text-caption font-bold"
                         :class="row.tipo === 'ingreso' ? 'text-success-700' : 'text-danger-700'">
                        {{ row.tipo === 'ingreso' ? 'Ingreso' : 'Egreso' }}
                      </p>
                      <p class="text-micro text-neutral-500">{{ categoriaLabel(row.categoria) }}</p>
                    </div>
                  </div>
                </template>
                <template #cell:monto="{ row }">
                  <p
                    class="tabular text-h4 font-extrabold"
                    :class="row.tipo === 'ingreso' ? 'text-success-700' : 'text-danger-700'"
                  >
                    {{ row.tipo === 'ingreso' ? '+' : '−' }}{{ fmtMoney(row.monto) }}
                  </p>
                </template>
                <template #cell:fecha_hora="{ row }">
                  <p class="tabular text-caption font-bold text-neutral-700">{{ hora(row.fecha_hora) }}</p>
                  <p class="text-micro text-neutral-500 tabular">{{ formatFecha(row.fecha_hora) }}</p>
                </template>
              </TmDataTable>
            </section>
          </div>

          <!-- Col der: Formulario cierre + quick actions -->
          <aside class="space-y-4">
            <!-- Resumen arqueo actual -->
            <TmCard class="p-5">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                  <component :is="ReceiptIcon" class="w-5 h-5" />
                </div>
                <h3 class="text-h4 font-extrabold text-neutral-800">Arqueo rápido (estimación)</h3>
              </div>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-caption text-neutral-500">1. Fondo inicial</span>
                  <span class="tabular font-bold text-neutral-800">
                    {{ fmtMoney(store.arqueoAbierto.monto_inicial) }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-caption text-neutral-500">2. Ventas (efectivo)</span>
                  <span class="tabular font-bold text-success-700">
                    + {{ fmtMoney(store.totalEfectivoVentasAbierto) }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-caption text-neutral-500">3. Ingresos manuales</span>
                  <span class="tabular font-bold text-success-700">
                    + {{ fmtMoney(store.ingresosManualesAbierto) }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-caption text-neutral-500">4. Egresos manuales</span>
                  <span class="tabular font-bold text-danger-700">
                    − {{ fmtMoney(store.egresosManualesAbierto) }}
                  </span>
                </div>
                <div class="pt-3 border-t-2 border-neutral-900 flex items-end justify-between">
                  <span class="text-caption font-bold text-neutral-800">ESPERADO</span>
                  <span class="tabular text-h2 font-black text-neutral-900 leading-none">
                    {{ fmtMoney(store.saldoEsperadoAbierto ?? 0) }}
                  </span>
                </div>
              </div>
            </TmCard>

            <div class="grid grid-cols-1 gap-3">
              <TmButton
                size="lg"
                variant="danger"
                block
                :icon="LockIcon"
                @click="abrirModalCierre"
              >
                Cerrar caja y hacer arqueo
              </TmButton>
            </div>
          </aside>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- TAB 3: HISTORIAL DE ARQUEOS                                 -->
      <!-- ============================================================ -->
      <div v-else-if="tab.value === 'historial'" class="p-5 pt-4">
        <div class="tm-stat-grid mb-6">
          <Kpi
            title="Arqueos cerrados"
            :value="String(store.totalArqueosCerrados)"
            :icon="FolderCheckIcon"
            tone="info"
          />
          <Kpi
            title="Faltantes"
            :value="String(store.totalFaltantes)"
            :icon="TrendingDownIcon"
            tone="danger"
          />
          <Kpi
            title="Sobrantes"
            :value="String(store.totalSobrantes)"
            :icon="TrendingUpIcon"
            tone="success"
          />
          <Kpi
            title="Diferencia total |$|"
            :value="fmtMoney(store.totalDiferenciaAbsoluta)"
            sub-value="sin signo, todos los cierres"
            :icon="AlertTriangleIcon"
            tone="warning"
          />
        </div>

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2 flex-wrap">
            <select
              v-model="historialFiltroEstado"
              class="!w-40 !h-9"
            >
              <option value="">Todos los estados</option>
              <option value="cerrado">Cerrados</option>
              <option value="abierto">Abiertos</option>
            </select>
            <div class="flex items-center gap-1.5">
              <input
                type="date"
                v-model="historialFechaDesde"
                @change="store.cargarArqueos({ fechaDesde: historialFechaDesde, fechaHasta: historialFechaHasta })"
                class="!h-9 !w-auto"
              />
              <span class="text-caption text-neutral-400">→</span>
              <input
                type="date"
                v-model="historialFechaHasta"
                @change="store.cargarArqueos({ fechaDesde: historialFechaDesde, fechaHasta: historialFechaHasta })"
                class="!h-9 !w-auto"
              />
            </div>
          </div>
        </div>

        <TmDataTable
          :rows="arqueosFiltrados"
          :columns="COL_ARQUEOS"
          :loading="store.loading"
          :searchable="false"
          :per-page="10"
          empty-text="No hay arqueos registrados."
        >
          <template #cell:arqueo="{ row }">
            <div class="min-w-0">
              <p class="text-caption font-extrabold tabular text-neutral-800">Arqueo N° {{ row.id }}</p>
              <p class="text-micro text-neutral-500 tabular mt-0.5">
                {{ formatFecha(row.fecha) }} · {{ hora(row.hora_apertura) }} a {{ row.hora_cierre ? hora(row.hora_cierre) : '—' }}
              </p>
            </div>
          </template>
          <template #cell:estado="{ row }">
            <TmBadge :tone="row.estado === 'cerrado' ? 'success' : 'warning'" dot :size="'md'">
              {{ row.estado === 'cerrado' ? 'Cerrado' : 'Abierto' }}
            </TmBadge>
          </template>
          <template #cell:esperado_contado="{ row }">
            <div v-if="row.estado === 'cerrado'">
              <p class="tabular font-bold text-caption text-neutral-700 line-through">
                {{ fmtMoney(row.monto_esperado) }}
              </p>
              <p class="tabular text-h4 font-extrabold text-neutral-900 mt-0.5">
                {{ fmtMoney(row.monto_efectivo_contado) }}
              </p>
            </div>
            <div v-else class="tm-surface-soft rounded-lg px-3 py-2">
              <p class="text-caption text-neutral-500 tabular">En curso…</p>
              <p class="text-caption font-extrabold tabular text-primary-700 mt-0.5">
                {{ fmtMoney(row.monto_inicial) }} inicial
              </p>
            </div>
          </template>
          <template #cell:diferencia="{ row }">
            <template v-if="row.estado === 'cerrado'">
              <p
                class="tabular text-h4 font-extrabold"
                :class="
                  Number(row.diferencia) === 0 ? 'text-neutral-800' :
                  Number(row.diferencia) > 0 ? 'text-success-700' : 'text-danger-700'
                "
              >
                {{ Number(row.diferencia) > 0 ? '+' : '' }}{{ fmtMoney(row.diferencia) }}
              </p>
              <p
                v-if="Number(row.diferencia) !== 0"
                class="text-micro font-bold mt-0.5"
                :class="Number(row.diferencia) > 0 ? 'text-success-600' : 'text-danger-600'"
              >
                {{ Number(row.diferencia) > 0 ? 'SOBRANTE' : 'FALTANTE' }}
              </p>
              <TmBadge
                v-else
                tone="success"
                size="xs"
                class="mt-1"
              >
                Arqueo perfecto ✓
              </TmBadge>
            </template>
            <span v-else class="text-micro text-neutral-400">—</span>
          </template>
          <template #cell:acciones="{ row }">
            <div class="flex items-center justify-end gap-1">
              <TmButton
                size="xs"
                variant="ghost"
                :icon="EyeIcon"
                @click="verDetalleArqueo(row)"
                title="Ver detalle del arqueo"
              />
            </div>
          </template>
        </TmDataTable>
      </div>
    </TmCard>

    <!-- Modal: nuevo movimiento -->
    <TmModal v-model="showNuevoMovimiento" :title="formMovimiento.tipo === 'ingreso' ? 'Nuevo ingreso de caja' : 'Nuevo egreso de caja'" :size="'md'">
      <div class="space-y-4 py-2">
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            @click="formMovimiento.tipo = 'ingreso'"
            class="p-4 rounded-2xl border-2 transition-all text-left"
            :class="formMovimiento.tipo === 'ingreso'
              ? 'border-success-400 bg-success-50 shadow-sm'
              : 'border-border hover:border-success-200'"
          >
            <p class="text-caption font-extrabold" :class="formMovimiento.tipo === 'ingreso' ? 'text-success-700' : 'text-neutral-600'">INGRESO</p>
            <p class="text-micro text-neutral-500 mt-1">Entra dinero a caja</p>
          </button>
          <button
            type="button"
            @click="formMovimiento.tipo = 'egreso'"
            class="p-4 rounded-2xl border-2 transition-all text-left"
            :class="formMovimiento.tipo === 'egreso'
              ? 'border-danger-400 bg-danger-50 shadow-sm'
              : 'border-border hover:border-danger-200'"
          >
            <p class="text-caption font-extrabold" :class="formMovimiento.tipo === 'egreso' ? 'text-danger-700' : 'text-neutral-600'">EGRESO</p>
            <p class="text-micro text-neutral-500 mt-1">Sale dinero de caja</p>
          </button>
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Categoría
          </label>
          <select v-model="formMovimiento.categoria" class="!h-11 w-full">
            <option
              v-for="c in categoriasFiltradas"
              :key="c.value"
              :value="c.value"
            >
              {{ c.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Monto ($) *
          </label>
          <input
            v-model.number="formMovimiento.monto"
            type="number"
            min="0"
            step="0.01"
            class="!h-14 !text-h3 !tabular w-full"
            placeholder="0,00"
          />
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Motivo / detalle
          </label>
          <textarea
            v-model="formMovimiento.motivo"
            rows="2"
            class="!resize-none"
            :placeholder="formMovimiento.tipo === 'ingreso' ? 'Ej.: Reintegro de caja chica, cobro deuda pendiente…' : 'Ej.: Pago proveedor Sancor, compra útiles…'"
          />
        </div>
      </div>
      <template #footer>
        <TmButton variant="ghost" size="md" @click="showNuevoMovimiento = false">
          Cancelar
        </TmButton>
        <TmButton
          variant="primary"
          size="md"
          :icon="SaveIcon"
          :loading="guardandoMovimiento"
          :disabled="Number(formMovimiento.monto) <= 0"
          @click="guardarMovimiento"
        >
          Registrar movimiento
        </TmButton>
      </template>
    </TmModal>

    <!-- Modal: cerrar caja -->
    <TmModal v-model="showCierreCaja" title="Cierre de caja y arqueo" :size="'lg'">
      <div class="space-y-4 py-2">
        <TmBadge tone="warning" :size="'lg'" dot pulse>
          Revisá dos veces — una vez cerrado no se puede reabrir
        </TmBadge>

        <div class="tm-surface-soft p-4 rounded-2xl space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-caption text-neutral-600">Monto inicial</span>
            <span class="tabular font-bold">{{ fmtMoney(store.arqueoAbierto?.monto_inicial ?? 0) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-caption text-neutral-600">Efectivo cobrado (ventas)</span>
            <span class="tabular font-bold text-success-700">+ {{ fmtMoney(store.totalEfectivoVentasAbierto) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-caption text-neutral-600">Ingresos manuales</span>
            <span class="tabular font-bold text-success-700">+ {{ fmtMoney(store.ingresosManualesAbierto) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-caption text-neutral-600">Egresos manuales</span>
            <span class="tabular font-bold text-danger-700">− {{ fmtMoney(store.egresosManualesAbierto) }}</span>
          </div>
          <div class="pt-3 border-t border-border flex items-end justify-between gap-3">
            <div>
              <p class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500">Monto esperado</p>
              <p class="tabular text-h3 font-black text-primary-700 leading-tight mt-0.5">
                {{ fmtMoney(store.saldoEsperadoAbierto ?? 0) }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500">Diferencia</p>
              <p
                class="tabular text-h3 font-black leading-tight mt-0.5"
                :class="diferenciaPreviewTone"
              >
                {{ diferenciaPreviewSigno }}{{ fmtMoney(Math.abs(diferenciaPreview)) }}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Monto en caja contado físicamente ($) *
          </label>
          <input
            v-model.number="formCierre.montoEfectivo"
            type="number"
            min="0"
            step="0.01"
            class="!h-[64px] !text-h2 !tabular !font-black w-full"
            :placeholder="fmtMoney(store.saldoEsperadoAbierto ?? 0).replace('$','')"
            @input="formCierre.montoEfectivo = Number($event.target.value)"
          />
          <div class="flex items-center gap-2 mt-3 flex-wrap">
            <button
              v-for="p in CTE_ASUETO"
              :key="p"
              type="button"
              class="h-9 px-3 rounded-lg bg-neutral-100 text-caption font-bold tabular text-neutral-700 hover:bg-primary-50 hover:text-primary-700"
              @click="formCierre.montoEfectivo = ajustarMontoEsperado(p)"
            >
              {{ p === 0 ? 'Exacto' : (p > 0 ? `+${p}` : `${p}`) }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 items-center gap-3 p-4 rounded-2xl border-2 transition-colors"
             :class="
               Math.abs(diferenciaPreview) === 0 ? 'border-success-300 bg-success-50' :
               Math.abs(diferenciaPreview) <= 200 ? 'border-warning-300 bg-warning-50' :
                                                 'border-danger-300 bg-danger-50'
             "
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
              :class="
                Math.abs(diferenciaPreview) === 0 ? 'bg-success-500 text-white' :
                Math.abs(diferenciaPreview) <= 200 ? 'bg-warning-500 text-white' :
                                                    'bg-danger-500 text-white'
              "
            >
              <component
                :is="Math.abs(diferenciaPreview) === 0 ? CheckCircleIcon : AlertTriangleIcon"
                class="w-5 h-5"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-caption font-extrabold"
                 :class="
                   Math.abs(diferenciaPreview) === 0 ? 'text-success-800' :
                   Math.abs(diferenciaPreview) <= 200 ? 'text-warning-800' :
                                                       'text-danger-800'
                 "
              >
                {{
                  Math.abs(diferenciaPreview) === 0 ? 'Arqueo perfecto — coincide con el esperado' :
                  Math.abs(diferenciaPreview) <= 200 ? 'Diferencia tolerable — revisar si es necesario' :
                    (diferenciaPreview > 0 ? 'SOBRANTE importante — explicá el motivo' :
                                            'FALTANTE importante — explicá el motivo')
                }}
              </p>
              <p class="text-micro text-neutral-600 mt-0.5" v-if="Math.abs(diferenciaPreview) > 0">
                La diferencia se guarda y la revisaremos en reportes.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Observaciones {{ Math.abs(diferenciaPreview) > 0 ? '(recomendado)' : '' }}
          </label>
          <textarea
            v-model="formCierre.observaciones"
            rows="3"
            class="!resize-none"
            placeholder="Ej.: Faltante atribuido a errores de cambio. Sobrante por ingresos sin ticket. Recuento realizado por XXXX."
          />
        </div>
      </div>
      <template #footer>
        <TmButton variant="ghost" size="md" @click="showCierreCaja = false">
          Seguir operando
        </TmButton>
        <TmButton
          variant="danger"
          size="md"
          :icon="LockIcon"
          :loading="cerrandoCaja"
          @click="confirmarCierreCaja"
        >
          Confirmar cierre de caja
        </TmButton>
      </template>
    </TmModal>

    <!-- Modal: detalle arqueo (solo info) -->
    <TmModal v-model="showDetalleArqueo" title="Detalle de arqueo" :size="'lg'">
      <div v-if="detalleArqueoActual" class="space-y-4 py-1">
        <div class="tm-surface-soft p-4 rounded-2xl">
          <div class="grid grid-cols-2 gap-3 tabular text-caption">
            <div><p class="text-micro text-neutral-500 uppercase tracking-wide">N° Arqueo</p><p class="font-extrabold text-neutral-800 mt-0.5">#{{ detalleArqueoActual.id }}</p></div>
            <div><p class="text-micro text-neutral-500 uppercase tracking-wide">Fecha</p><p class="font-bold text-neutral-800 mt-0.5">{{ formatFecha(detalleArqueoActual.fecha) }}</p></div>
            <div><p class="text-micro text-neutral-500 uppercase tracking-wide">Apertura</p><p class="font-bold text-neutral-800 mt-0.5">{{ hora(detalleArqueoActual.hora_apertura) }}</p></div>
            <div><p class="text-micro text-neutral-500 uppercase tracking-wide">Cierre</p><p class="font-bold text-neutral-800 mt-0.5">{{ detalleArqueoActual.hora_cierre ? hora(detalleArqueoActual.hora_cierre) : '—' }}</p></div>
            <div><p class="text-micro text-neutral-500 uppercase tracking-wide">Inicial</p><p class="font-bold mt-0.5">{{ fmtMoney(detalleArqueoActual.monto_inicial) }}</p></div>
            <div><p class="text-micro text-neutral-500 uppercase tracking-wide">Estado</p>
              <TmBadge
                :tone="detalleArqueoActual.estado === 'cerrado' ? 'success' : 'warning'"
                size="sm"
                dot
                class="mt-1"
              >
                {{ detalleArqueoActual.estado === 'cerrado' ? 'Cerrado' : 'Abierto' }}
              </TmBadge>
            </div>
          </div>
        </div>
        <div v-if="detalleArqueoActual.estado === 'cerrado'" class="grid grid-cols-3 gap-3">
          <div class="tm-surface p-3 rounded-2xl">
            <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">Esperado</p>
            <p class="tabular text-h4 font-extrabold text-neutral-700 line-through mt-1">{{ fmtMoney(detalleArqueoActual.monto_esperado) }}</p>
          </div>
          <div class="tm-surface p-3 rounded-2xl">
            <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">Contado</p>
            <p class="tabular text-h4 font-black text-neutral-900 mt-1">{{ fmtMoney(detalleArqueoActual.monto_efectivo_contado) }}</p>
          </div>
          <div
            class="tm-surface p-3 rounded-2xl border-2"
            :class="
              Number(detalleArqueoActual.diferencia) === 0 ? 'border-success-300' :
              Number(detalleArqueoActual.diferencia) > 0 ? 'border-success-300' :
                                                        'border-danger-300'
            "
          >
            <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">Diferencia</p>
            <p
              class="tabular text-h4 font-black mt-1"
              :class="
                Number(detalleArqueoActual.diferencia) === 0 ? 'text-success-700' :
                Number(detalleArqueoActual.diferencia) > 0 ? 'text-success-700' :
                                                          'text-danger-700'
              "
            >
              {{ Number(detalleArqueoActual.diferencia) > 0 ? '+' : '' }}{{ fmtMoney(detalleArqueoActual.diferencia) }}
            </p>
          </div>
        </div>
        <div v-if="detalleArqueoActual.observaciones" class="p-4 rounded-2xl bg-neutral-50 border border-border">
          <p class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-2">Observaciones</p>
          <p class="text-caption text-neutral-700 leading-relaxed whitespace-pre-wrap">
            {{ detalleArqueoActual.observaciones }}
          </p>
        </div>
      </div>
    </TmModal>

    <!-- Modal: detalle venta -->
    <TmModal v-model="showDetalleVenta" title="Detalle de ticket" :size="'lg'">
      <div v-if="ventaSeleccionada" class="space-y-4 py-1">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">Ticket</p>
            <p class="text-h3 font-black tabular text-neutral-900 mt-0.5">#{{ ventaSeleccionada.numero_comprobante }}</p>
          </div>
          <TmBadge :tone="estadoVentaTone(ventaSeleccionada.estado)" :size="'md'" dot>
            {{ estadoVentaLabel(ventaSeleccionada.estado) }}
          </TmBadge>
        </div>
        <TmDataTable
          :rows="ventaSeleccionada.detalle_ventas || []"
          :columns="COL_DETALLE_VENTA"
          :searchable="false"
          :per-page="50"
          empty-text="Sin items."
        >
          <template #cell:producto="{ row }">
            <p class="text-caption font-bold text-neutral-800">{{ row.producto_nombre }}</p>
            <p class="text-micro text-neutral-500 tabular mt-0.5">SKU {{ row.sku }}</p>
          </template>
          <template #cell:total_linea="{ row }">
            <p class="tabular font-extrabold text-caption text-neutral-800">{{ fmtMoney(Number(row.subtotal) ?? Number(row.precio_unitario) * Number(row.cantidad)) }}</p>
          </template>
        </TmDataTable>
        <div class="space-y-2 pt-3 border-t border-border">
          <div class="flex justify-between text-caption">
            <span class="text-neutral-500">Subtotal</span>
            <span class="tabular font-bold text-neutral-800">{{ fmtMoney(ventaSeleccionada.subtotal) }}</span>
          </div>
          <div v-if="Number(ventaSeleccionada.descuento_total) > 0" class="flex justify-between text-caption">
            <span class="text-danger-600">Descuento</span>
            <span class="tabular font-bold text-danger-700">−{{ fmtMoney(ventaSeleccionada.descuento_total) }}</span>
          </div>
          <div v-for="p in (ventaSeleccionada.pagos || [])" :key="p.id" class="flex justify-between text-caption">
            <span class="text-neutral-500">{{ fpLabel(p.forma_pago) }}<span v-if="p.referencia" class="ml-2 text-micro text-neutral-400 tabular">{{ p.referencia }}</span></span>
            <span class="tabular font-bold text-neutral-800">{{ fmtMoney(p.monto) }}</span>
          </div>
          <div class="flex justify-between pt-2 border-t-2 border-neutral-900">
            <span class="text-caption font-bold text-neutral-800">TOTAL</span>
            <span class="tabular text-h3 font-black text-neutral-900">{{ fmtMoney(ventaSeleccionada.total) }}</span>
          </div>
        </div>
      </div>
    </TmModal>
  </div>
</template>

<script setup>
import { computed, h, inject, onMounted, reactive, ref, watch } from "vue";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar } from "vue-chartjs";
import {
  RefreshCw as RefreshIcon,
  BarChart3 as BarChart3Icon,
  Receipt as ReceiptIcon,
  Ticket as TicketIcon,
  CreditCard as CreditCardIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  List as ListIcon,
  Search as SearchIcon,
  FileText as FileTextIcon,
  History as HistoryIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Plus as PlusIcon,
  Save as SaveIcon,
  Eye as EyeIcon,
  Wallet as WalletIcon,
  Coins as CoinsIcon,
  Banknote as BanknoteIcon,
  ArrowLeftRight as ArrowLeftRightIcon,
  ScrollText as ScrollTextIcon,
  AlertTriangle as AlertTriangleIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  FolderCheck as FolderCheckIcon,
  RotateCcw as RotateCcwIcon,
  Calendar as CalendarIcon,
  Trash2 as TrashIcon,
} from "lucide-vue-next";
import { TmButton, TmCard, TmBadge, TmDataTable, TmModal, TmSearch, TmTabs } from "@/components/ui";
import { useCajaStore } from "@/stores/caja.js";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
);

const store = useCajaStore();
const toast = inject("$toast");

const viewError = ref(null);
const errorDetalle = ref(null);
async function forzarRecarga() {
  viewError.value = null;
  errorDetalle.value = null;
  try {
    await (store.cargarTodo ? store.cargarTodo() : (store.cargarTodasLasListas ? store.cargarTodasLasListas() : Promise.resolve()));
  } catch (err) {
    viewError.value = err?.message || "Error desconocido al cargar los datos.";
    errorDetalle.value = err?.stack || String(err);
  }
}

const TABS = [
  { value: "reportes", label: "Reportes de ventas", icon: BarChart3Icon, tone: "primary" },
  { value: "caja", label: "Caja actual", icon: WalletIcon, tone: "success" },
  { value: "historial", label: "Historial arqueos", icon: FileTextIcon, tone: "info" },
];
const tab = ref({ value: "reportes" });

const GRANULARIDADES = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

const SUGGESTION_MONTOS = [20000, 25000, 30000, 50000];
const CTE_ASUETO = [-500, -100, 0, 100, 500];

const granularidadLabel = computed(() => GRANULARIDADES.find(g => g.value === store.filtroVentas.granularidad)?.label ?? "Día");

const filtroTextoDetalle = ref("");

// Filtros historial
const historialFiltroEstado = ref("");
const historialFechaDesde = ref("");
const historialFechaHasta = ref("");

const arqueosFiltrados = computed(() => {
  let rows = store.arqueos;
  if (historialFiltroEstado.value) {
    rows = rows.filter(a => a.estado === historialFiltroEstado.value);
  }
  return rows;
});

const ventasFiltradasDetalle = computed(() => {
  const q = filtroTextoDetalle.value.trim().toLowerCase();
  if (!q) return store.ventas;
  return store.ventas.filter(v =>
    String(v.numero_comprobante).includes(q) ||
    (v.observaciones || "").toLowerCase().includes(q),
  );
});

const formaPagoDominante = computed(() => {
  const m = new Map();
  for (const v of store.ventas) {
    for (const p of (v.pagos || [])) {
      m.set(p.forma_pago, (m.get(p.forma_pago) || 0) + 1);
    }
  }
  let best = { key: "efectivo", count: 0 };
  for (const [k, c] of m) if (c > best.count) best = { key: k, count: c };
  return { label: fpLabel(best.key), count: best.count };
});

const diaPico = computed(() => {
  const data = store.reporteVentasAgrupado;
  if (!data || data.length === 0) return null;
  return [...data].sort((a, b) => Number(b.total) - Number(a.total))[0];
});

const ultimoArqueoCerrado = computed(() =>
  store.arqueos.filter(a => a.estado === "cerrado").sort((a, b) => new Date(b.hora_cierre) - new Date(a.hora_cierre))[0] ?? null,
);

// Forms UI
const formApertura = reactive({ montoInicial: 25000, fecha: new Date().toISOString().slice(0, 10) });
const procesandoApertura = ref(false);

const showNuevoMovimiento = ref(false);
const guardandoMovimiento = ref(false);
const formMovimiento = reactive({
  tipo: "egreso",
  categoria: "gasto_menor",
  monto: 0,
  motivo: "",
});
const categoriasFiltradas = computed(() =>
  store.categoriasMov.filter(c => c.defaultTipo === formMovimiento.tipo || c.value === "otro")
);

const showCierreCaja = ref(false);
const cerrandoCaja = ref(false);
const formCierre = reactive({ montoEfectivo: 0, observaciones: "" });
const diferenciaPreview = computed(() =>
  Math.round((Number(formCierre.montoEfectivo ?? 0) - Number(store.saldoEsperadoAbierto ?? 0)) * 100) / 100
);
const diferenciaPreviewTone = computed(() => {
  if (diferenciaPreview.value === 0) return "text-success-700";
  return diferenciaPreview.value > 0 ? "text-success-700" : "text-danger-700";
});
const diferenciaPreviewSigno = computed(() => diferenciaPreview.value > 0 ? "+" : "");
function ajustarMontoEsperado(delta) {
  return Math.round((Number(store.saldoEsperadoAbierto ?? 0) + Number(delta)) * 100) / 100;
}

// Modales detalle
const showDetalleArqueo = ref(false);
const detalleArqueoActual = ref(null);
const showDetalleVenta = ref(false);
const ventaSeleccionada = ref(null);

// ----------- Columnas -----------
const COL_VENTAS = [
  { key: "numero", label: "N° Ticket / Fecha", width: "22%" },
  { key: "items", label: "Items", width: "14%" },
  { key: "pagos", label: "Pagos", width: "24%" },
  { key: "estado", label: "Estado", width: "12%" },
  { key: "total", label: "Total", width: "14%", align: "right" },
];
const COL_DETALLE_VENTA = [
  { key: "producto", label: "Producto", width: "40%" },
  { key: "cantidad", label: "Cantidad", width: "12%" },
  { key: "precio_unitario", label: "P. Unitario", width: "18%" },
  { key: "total_linea", label: "Subtotal", width: "20%", align: "right" },
];
const COL_MOVIMIENTOS = [
  { key: "tipo", label: "Tipo / Categoría", width: "38%" },
  { key: "monto", label: "Monto", width: "18%" },
  { key: "motivo", label: "Motivo / detalle", width: "30%" },
  { key: "fecha_hora", label: "Hora", width: "14%" },
];
const COL_ARQUEOS = [
  { key: "arqueo", label: "N° / Horario", width: "25%" },
  { key: "estado", label: "Estado", width: "12%" },
  { key: "esperado_contado", label: "Esperado / Contado", width: "22%" },
  { key: "diferencia", label: "Diferencia", width: "18%" },
  { key: "acciones", label: "", width: "80px", align: "right" },
];

// ----------- Helpers format -----------
const CUR = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
function fmtMoney(v) { return CUR.format(Number(v || 0)); }
function formatFecha(iso) {
  if (!iso) return "—";
  return new Date(String(iso).slice(0, 10) + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}
function formatFechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function hora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function fpLabel(k) {
  return ({ efectivo: "Efectivo", qr: "QR", debito: "Débito", credito: "Crédito", transferencia: "Transf.", cheque: "Cheque", cuenta_corriente: "C/C" })[k] ?? k;
}
function fpTone(k) {
  return ({ efectivo: "success", qr: "info", debito: "primary", credito: "warning", transferencia: "secondary", cheque: "info", cuenta_corriente: "info" })[k] ?? "info";
}
function estadoVentaLabel(k) { return ({ pagada: "Pagada", pendiente: "Pendiente", anulada: "Anulada" })[k] ?? k; }
function estadoVentaTone(k) { return ({ pagada: "success", pendiente: "warning", anulada: "secondary" })[k] ?? "info"; }
function categoriaLabel(c) {
  const obj = ({ pago_proveedor: "Pago a proveedor", gasto_menor: "Gasto menor", fondo_inicial: "Fondo inicial", ajuste: "Ajuste", otro: "Otro" })[c];
  return obj ?? c;
}

// ----------- Gráfico ventas -----------
const chartVentasData = computed(() => {
  const labels = store.reporteVentasAgrupado.map(d => d.label);
  const montos = store.reporteVentasAgrupado.map(d => Number(d.total || 0));
  const tickets = store.reporteVentasAgrupado.map(d => Number(d.tickets || 0));
  return {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Monto vendido",
        data: montos,
        backgroundColor: "rgba(13, 138, 114, 0.72)",
        borderColor: "rgba(13, 138, 114, 1)",
        borderWidth: 1.5,
        borderRadius: 10,
        borderSkipped: false,
        yAxisID: "y",
      },
      {
        type: "line",
        label: "Tickets emitidos",
        data: tickets,
        borderColor: "#F04E1C",
        backgroundColor: "rgba(240, 78, 28, 0.12)",
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#F04E1C",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: "y1",
      },
    ],
  };
});
const chartVentasOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      position: "top",
      align: "end",
      labels: {
        usePointStyle: true,
        boxWidth: 9,
        padding: 14,
        font: { size: 12, weight: "bold" },
        color: "#404040",
      },
    },
    tooltip: {
      backgroundColor: "rgba(20, 20, 20, 0.96)",
      padding: 12,
      cornerRadius: 10,
      titleFont: { weight: "bold" },
      callbacks: {
        label: (c) => c.dataset.label === "Tickets emitidos"
          ? ` ${c.dataset.label}: ${c.parsed.y} tickets`
          : ` ${c.dataset.label}: ${CUR.format(c.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#6b7280", font: { size: 11, weight: "bold" } },
    },
    y: {
      type: "linear",
      position: "left",
      beginAtZero: true,
      grid: { color: "rgba(0,0,0,0.05)" },
      ticks: {
        color: "#374151",
        font: { size: 11, weight: "bold" },
        callback: (v) => "$" + (v / 1000).toFixed(0) + "k",
      },
    },
    y1: {
      type: "linear",
      position: "right",
      beginAtZero: true,
      grid: { drawOnChartArea: false },
      ticks: {
        color: "#F04E1C",
        font: { size: 11, weight: "bold" },
        stepSize: 5,
      },
    },
  },
};

// ----------- Acciones -----------
async function recargarTodo() {
  await store.cargarTodo();
  toast?.success("Listo", "Datos financieros actualizados.");
}

async function cambiarGranularidad(val) {
  store.setFiltroVenta("granularidad", val);
  await store.cargarReporteVentas();
}

async function cambiarFecha(clave, valor) {
  store.setFiltroVenta(clave, valor);
  await Promise.all([store.cargarReporteVentas(), store.cargarVentasDetalle()]);
}
async function limpiarRangoFechas() {
  store.setFiltroVenta("fechaDesde", "");
  store.setFiltroVenta("fechaHasta", "");
  await Promise.all([store.cargarReporteVentas(), store.cargarVentasDetalle()]);
}

async function confirmarApertura() {
  if (Number(formApertura.montoInicial) < 0) {
    toast?.error("Monto inválido", "Ingresá un monto válido para el fondo inicial.");
    return;
  }
  procesandoApertura.value = true;
  try {
    const creado = await store.abrirArqueo({
      monto_inicial: Number(formApertura.montoInicial),
      fecha: formApertura.fecha || undefined,
    });
    if (creado) {
      toast?.success("Caja abierta", `Fondo inicial: ${fmtMoney(creado.monto_inicial)} · Arqueo N° ${creado.id}`);
    } else {
      toast?.error("No se pudo abrir", "Ya existe una caja abierta o el servidor no respondió.");
    }
  } finally {
    procesandoApertura.value = false;
  }
}

function abrirModalCierre() {
  if (!store.cajaAbierta) return;
  formCierre.montoEfectivo = Number(store.saldoEsperadoAbierto ?? 0);
  formCierre.observaciones = "";
  showCierreCaja.value = true;
}
async function confirmarCierreCaja() {
  if (!store.arqueoAbierto?.id) return;
  if (Number(formCierre.montoEfectivo) < 0) {
    toast?.error("Monto inválido");
    return;
  }
  cerrandoCaja.value = true;
  try {
    const cerrado = await store.cerrarArqueo(store.arqueoAbierto.id, {
      monto_efectivo_contado: Number(formCierre.montoEfectivo),
      observaciones: formCierre.observaciones || null,
    });
    if (cerrado) {
      showCierreCaja.value = false;
      if (Number(cerrado.diferencia) === 0) {
        toast?.success("Cierre exitoso", `Arqueo perfecto · ${fmtMoney(cerrado.monto_efectivo_contado)} contados.`);
      } else {
        const sobrante = Number(cerrado.diferencia) > 0;
        toast?.warning(
          sobrante ? "Cierre con sobrante" : "Cierre con faltante",
          `Diferencia: ${sobrante ? '+' : ''}${fmtMoney(cerrado.diferencia)}`,
        );
      }
      tab.value = "historial";
    } else {
      toast?.error("No se pudo cerrar caja");
    }
  } finally {
    cerrandoCaja.value = false;
  }
}

async function guardarMovimiento() {
  if (Number(formMovimiento.monto) <= 0) {
    toast?.warning("Ingresá un monto válido.");
    return;
  }
  guardandoMovimiento.value = true;
  try {
    const m = await store.registrarMovimiento({
      tipo: formMovimiento.tipo,
      categoria: formMovimiento.categoria,
      monto: Number(formMovimiento.monto),
      motivo: formMovimiento.motivo?.trim() || null,
    });
    if (m) {
      showNuevoMovimiento.value = false;
      formMovimiento.monto = 0;
      formMovimiento.motivo = "";
      toast?.success(
        formMovimiento.tipo === "ingreso" ? "Ingreso registrado" : "Egreso registrado",
        `${categoriaLabel(m.categoria)} · ${fmtMoney(m.monto)}`,
      );
    }
  } finally {
    guardandoMovimiento.value = false;
  }
}

async function verDetalleArqueo(row) {
  detalleArqueoActual.value = row;
  showDetalleArqueo.value = true;
}

async function limpiarDatosFinancieros() {
  if (!confirm("¿Estás seguro de limpiar todos los datos financieros? Esto borrará ventas, arqueos, movimientos, combos y precios por volumen. Los productos y lotes se mantendrán.")) {
    return;
  }
  try {
    // Limpiar localStorage
    localStorage.removeItem("tiendamama:localdb:v1");
    
    toast?.success("Datos financieros limpiados", "Recargando la página...");
    
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (err) {
    toast?.error("Error al limpiar datos", String(err));
  }
}

async function abrirVenta(row) {
  ventaSeleccionada.value = row;
  showDetalleVenta.value = true;
}

// Watchers sincronía
watch(historialFiltroEstado, async () => {
  await store.cargarArqueos({ fechaDesde: historialFechaDesde.value, fechaHasta: historialFechaHasta.value });
});

watch(
  () => [store.filtroVentas.page, store.filtroVentas.perPage, store.filtroVentas.estado],
  async () => { await store.cargarVentasDetalle(); },
);

onMounted(async () => {
  await store.cargarTodo();
});

// ----------- Kpi inline -----------
const Kpi = {
  props: ["title", "value", "subValue", "icon", "tone"],
  setup(p) {
    const tones = {
      primary:   "bg-primary-50 text-primary-700",
      secondary: "bg-secondary-50 text-secondary-700",
      success:   "bg-success-50 text-success-700",
      warning:   "bg-warning-50 text-warning-700",
      danger:    "bg-danger-50 text-danger-700",
      info:      "bg-primary-50 text-primary-700",
    };
    return () =>
      h("div", { class: "tm-stat" }, [
        h("div", { class: ["tm-stat-icon", tones[p.tone] ?? tones.primary] }, [
          h(p.icon, { class: "w-[18px] h-[18px]" }),
        ]),
        h("p", { class: "tm-stat-label mt-4" }, p.title),
        h("p", { class: "tm-stat-value mt-1" }, p.value),
        p.subValue ? h("p", { class: "text-caption-xs text-neutral-500 mt-0.5" }, p.subValue) : null,
      ]);
  },
};
</script>

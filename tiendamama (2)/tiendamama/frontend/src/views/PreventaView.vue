<template>
  <div class="flex flex-col gap-gap-card min-w-0">
    <!-- ERROR BOUNDARY VISIBLE: fallback si la carga falla -->
    <div
      v-if="viewError"
      class="rounded-2xl border border-danger-200 bg-danger-50 p-6 text-danger-800"
    >
      <div class="flex items-start gap-3">
        <component :is="XCircleIcon" class="w-6 h-6 text-danger-500 shrink-0 mt-0.5" />
        <div class="min-w-0 flex-1">
          <h3 class="text-h4 font-extrabold text-danger-900 mb-1">
            No se pudo cargar la pantalla de Preventa
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

    <!-- SKELETON / CARGA INICIAL -->
    <TmCard v-else-if="store.loading && store.cotizaciones.length === 0" class="p-6">
      <div class="flex items-center gap-3 text-neutral-500">
        <component :is="RefreshIcon" class="w-5 h-5 animate-spin" />
        <p class="text-caption font-bold">Cargando cotizaciones, clientes y productos…</p>
      </div>
    </TmCard>

    <TmCard v-else padding="none" class="overflow-hidden">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4
               px-5 pt-5 pb-0 border-b border-border"
      >
        <div>
          <h2 class="text-h2 font-extrabold text-neutral-800">
            Preventa & Cotizador Mayorista
          </h2>
          <p class="text-caption text-neutral-500 mt-1">
            Creá cotizaciones para clientes mayoristas, reservá stock y confirmá pedidos con PEPS.
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
            v-if="tab !== 'nueva'"
            variant="primary"
            size="md"
            :icon="PlusIcon"
            @click="tab = 'nueva'; store.resetFormulario();"
          >
            Nueva cotización
          </TmButton>
        </div>
      </div>

      <div class="px-5 pt-4">
        <TmTabs v-model="tab" :tabs="TABS" />
      </div>

      <!-- ============================================================ -->
      <!-- TAB 1: NUEVA COTIZACIÓN                                     -->
      <!-- ============================================================ -->
      <div v-if="tab === 'nueva'" class="p-5 pt-4">
        <!-- Resumen KPIs -->
        <div class="tm-stat-grid mb-6">
          <Kpi
            title="Items agregados"
            :value="String(store.formulario.items.length)"
            :icon="ShoppingCartIcon"
            tone="primary"
          />
          <Kpi
            title="Subtotal"
            :value="fmtMoney(store.formSubtotal)"
            :icon="CalculatorIcon"
            tone="info"
          />
          <Kpi
            title="Ahorro por volumen"
            :value="fmtMoney(store.formAhorroItems)"
            sub-value="aplicado en los items"
            :icon="PiggyBankIcon"
            tone="success"
          />
          <Kpi
            title="Total a cotizar"
            :value="fmtMoney(store.formTotal)"
            sub-value="(menos descuento global)"
            :icon="WalletIcon"
            tone="secondary"
          />
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5">
          <!-- Col izq: Datos cliente + productos -->
          <div class="flex flex-col gap-4 min-w-0">
            <section class="tm-surface p-5">
              <h3 class="text-h4 font-extrabold text-neutral-800 mb-4 flex items-center gap-2">
                <component :is="UserIcon" class="w-5 h-5 text-primary-600" />
                Datos del cliente y vigencia
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2">
                  <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
                    Cliente *
                  </label>
                  <div class="relative">
                    <input
                      v-model="clienteBusqueda"
                      @focus="clienteDropdownAbierto = true"
                      @input="clienteDropdownAbierto = true"
                      type="text"
                      :placeholder="store.formulario.cliente_id ? '' : 'Buscar cliente por nombre, CUIT o teléfono…'"
                      class="!h-[46px] w-full !pr-20"
                      :value="
                        store.formulario.cliente_id
                          ? (clientesAll.find(c => c.id === store.formulario.cliente_id)?.nombre_rs ?? '')
                          : clienteBusqueda
                      "
                    />
                    <button
                      type="button"
                      @click="mostrarCrearCliente = true"
                      class="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-700 text-caption font-bold flex items-center gap-1"
                    >
                      <component :is="PlusIcon" class="w-4 h-4" />
                      Nuevo
                    </button>
                    <Transition name="dropdown">
                      <div
                        v-if="clienteDropdownAbierto && clientesFiltrados.length > 0"
                        class="absolute left-0 right-0 top-full mt-2 z-30 bg-white rounded-2xl shadow-lg border border-border overflow-hidden max-h-64 overflow-y-auto scrollbar-thin"
                      >
                        <div
                          v-for="c in clientesFiltrados"
                          :key="c.id"
                          @click="seleccionarCliente(c)"
                          class="px-4 py-3 hover:bg-primary-50 cursor-pointer border-b border-border last:border-b-0"
                          :class="{ 'bg-primary-50/70': c.id === store.formulario.cliente_id }"
                        >
                          <p class="text-caption font-bold text-neutral-800">{{ c.nombre_rs }}</p>
                          <p class="text-micro text-neutral-500 tabular mt-0.5">
                            <span v-if="c.dni_cuit">{{ c.dni_cuit }}</span>
                            <span v-if="c.telefono && c.dni_cuit" class="mx-1.5 text-neutral-300">·</span>
                            <span v-if="c.telefono">{{ c.telefono }}</span>
                            <span class="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase"
                                  :class="c.tipo === 'mayorista' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'">
                              {{ c.tipo }}
                            </span>
                          </p>
                        </div>
                      </div>
                    </Transition>
                  </div>
                  <p
                    v-if="clienteSeleccionadoDetalle"
                    class="text-micro text-neutral-500 mt-2"
                  >
                    {{ clienteSeleccionadoDetalle.direccion ?? "Sin dirección registrada" }}
                    <span v-if="clienteSeleccionadoDetalle.limite_credito" class="ml-2 tabular text-primary-700 font-semibold">
                      Crédito: {{ fmtMoney(clienteSeleccionadoDetalle.limite_credito) }}
                    </span>
                  </p>
                </div>
                <div>
                  <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
                    Validez hasta *
                  </label>
                  <input
                    v-model="store.formulario.validez_hasta"
                    type="date"
                    class="!h-[46px] w-full"
                  />
                </div>
              </div>
            </section>

            <section class="tm-surface p-5">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-h4 font-extrabold text-neutral-800 flex items-center gap-2">
                  <component :is="PackageIcon" class="w-5 h-5 text-primary-600" />
                  Productos de la cotización
                </h3>
              </div>

              <!-- Buscador productos -->
              <div class="relative mb-4">
                <component :is="SearchIcon" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 z-10" />
                <input
                  v-model="productoBusqueda"
                  @focus="productoDropdownAbierto = true"
                  @input="productoDropdownAbierto = true"
                  @keydown.esc="productoDropdownAbierto = false"
                  @keydown.enter.prevent="confirmarPrimerProducto"
                  type="text"
                  class="!pl-12 !h-[48px] w-full !bg-primary-50/40 !border-primary-200 focus:!border-primary-500"
                  placeholder="Buscá productos por nombre, SKU o código. Enter para agregar el primero…"
                />
                <kbd
                  class="absolute right-4 top-1/2 -translate-y-1/2 h-8 px-3 items-center gap-1
                         text-caption-xs font-mono text-primary-700 bg-white
                         border border-primary-200 rounded shadow-sm hidden md:inline-flex"
                >
                  /
                </kbd>
                <Transition name="dropdown">
                  <div
                    v-if="productoDropdownAbierto && productosFiltrados.length > 0"
                    class="absolute left-0 right-0 top-full mt-2 z-30 bg-white rounded-2xl shadow-lg border border-border overflow-hidden max-h-80 overflow-y-auto scrollbar-thin"
                  >
                    <div
                      v-for="(p, idx) in productosFiltrados.slice(0, 8)"
                      :key="p.id"
                      @click="agregarProducto(p)"
                      class="px-4 py-3 hover:bg-primary-50 cursor-pointer border-b border-border last:border-b-0 flex items-center gap-3"
                      :class="{ 'bg-primary-50/70': idx === 0 }"
                    >
                      <div class="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 shrink-0 flex items-center justify-center">
                        <component :is="PackageIcon" class="w-5 h-5" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-caption font-bold text-neutral-800 leading-snug line-clamp-1">
                          {{ p.nombre }}
                        </p>
                        <p class="text-micro text-neutral-500 tabular mt-0.5">
                          SKU {{ p.sku }}
                          <span v-if="p.codigo_barras" class="mx-1.5 text-neutral-300">·</span>
                          <span v-if="p.codigo_barras">{{ p.codigo_barras }}</span>
                        </p>
                      </div>
                      <div class="text-right shrink-0">
                        <p class="text-h4 font-extrabold tabular text-primary-700">{{ fmtMoney(p.precio_unitario ?? p.precio) }}</p>
                        <p
                          class="text-micro tabular mt-0.5"
                          :class="stockReservadoOcupado(p.id) > 0 ? 'text-warning-700' : 'text-neutral-500'"
                        >
                          Disp.: {{ store.stockDisponible(p.id) }}
                          <span v-if="stockReservadoOcupado(p.id) > 0">
                            (+{{ stockReservadoOcupado(p.id) }} reserv.)
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>

              <!-- Tabla items -->
              <div v-if="store.formulario.items.length === 0" class="py-14 text-center tm-surface-soft rounded-2xl">
                <component :is="PackageOpenIcon" class="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p class="text-body-sm font-semibold text-neutral-600">Aún no agregaste productos a la cotización.</p>
                <p class="text-caption text-neutral-500 mt-1">Usá el buscador o el código de barras para agregar productos.</p>
              </div>

              <TmDataTable
                v-else
                :rows="store.formulario.items"
                :columns="COL_ITEMS"
                :searchable="false"
                :per-page="50"
                empty-text=""
              >
                <template #cell:producto="{ row }">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                      <component :is="PackageIcon" class="w-4.5 h-4.5" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-caption font-bold text-neutral-800 leading-snug line-clamp-1">
                        {{ row.producto_nombre }}
                      </p>
                      <p class="text-micro text-neutral-500 tabular mt-0.5">
                        SKU {{ row.sku }}
                      </p>
                    </div>
                  </div>
                </template>
                <template #cell:cantidad="{ row, index }">
                  <div class="inline-flex items-center gap-1.5 rounded-xl border border-border overflow-hidden bg-white">
                    <button
                      type="button"
                      class="w-8 h-9 text-neutral-600 hover:bg-neutral-100"
                      @click="store.actualizarCantidadItem(index, Number(row.cantidad) - 1)"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      :value="row.cantidad"
                      @change="store.actualizarCantidadItem(index, $event.target.value)"
                      class="w-16 h-9 text-center tabular text-caption font-bold border-x border-border focus:outline-none"
                    />
                    <button
                      type="button"
                      class="w-8 h-9 text-neutral-600 hover:bg-neutral-100"
                      @click="store.actualizarCantidadItem(index, Number(row.cantidad) + 1)"
                    >
                      +
                    </button>
                  </div>
                </template>
                <template #cell:precio_original="{ row }">
                  <p class="tabular text-neutral-500 line-through text-caption">
                    {{ fmtMoney(row.precio_original) }}
                  </p>
                </template>
                <template #cell:precio_acordado="{ row, index }">
                  <div class="flex items-center gap-2">
                    <span class="tabular text-caption font-bold text-primary-700">{{ fmtMoney(row.precio_acordado) }}</span>
                    <button
                      type="button"
                      class="w-7 h-7 rounded-lg hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-500"
                      @click="abrirEditorPrecio(index)"
                    >
                      <component :is="EditIcon" class="w-4 h-4" />
                    </button>
                  </div>
                </template>
                <template #cell:subtotal="{ row }">
                  <p class="tabular text-h4 font-extrabold text-neutral-800">
                    {{ fmtMoney(Number(row.precio_acordado) * Number(row.cantidad)) }}
                  </p>
                  <p v-if="Number(row.precio_original) > Number(row.precio_acordado)"
                     class="text-micro tabular font-bold text-success-600 mt-0.5">
                    Ahorra {{ fmtMoney((Number(row.precio_original) - Number(row.precio_acordado)) * Number(row.cantidad)) }}
                  </p>
                </template>
                <template #cell:acciones="{ index }">
                  <div class="flex items-center justify-end gap-1">
                    <TmButton
                      size="xs"
                      variant="ghost"
                      :icon="TrashIcon"
                      class="text-danger-600 hover:!bg-danger-50"
                      @click="store.quitarItemForm(index)"
                    />
                  </div>
                </template>
              </TmDataTable>
            </section>
          </div>

          <!-- Col der: Totales + confirmación -->
          <aside class="flex flex-col gap-4">
            <section class="tm-surface p-5">
              <h3 class="text-h4 font-extrabold text-neutral-800 mb-4 flex items-center gap-2">
                <component :is="ReceiptIcon" class="w-5 h-5 text-secondary-600" />
                Resumen y opciones
              </h3>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-caption text-neutral-500">Subtotal</span>
                  <span class="tabular font-bold text-neutral-800">{{ fmtMoney(store.formSubtotal) }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-caption text-neutral-500">Ahorro por volumen</span>
                  <span class="tabular font-bold text-success-600">− {{ fmtMoney(store.formAhorroItems) }}</span>
                </div>
                <div class="pt-3 border-t border-border">
                  <div class="flex items-center justify-between gap-3 mb-2">
                    <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500">
                      Descuento global ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      :max="store.formSubtotal"
                      v-model.number="store.formulario.descuento_total"
                      class="!w-32 !h-9 text-right tabular"
                    />
                  </div>
                  <div
                    v-if="Number(store.formulario.descuento_total) > 0"
                    class="flex justify-between items-center text-caption"
                  >
                    <span class="text-danger-600">Descuento aplicado</span>
                    <span class="tabular font-bold text-danger-600">− {{ fmtMoney(store.formulario.descuento_total) }}</span>
                  </div>
                </div>
                <div class="pt-3 border-t-2 border-neutral-900 flex items-end justify-between">
                  <span class="text-caption font-bold text-neutral-800">TOTAL</span>
                  <span class="tabular text-h2 font-black text-neutral-900 leading-none">
                    {{ fmtMoney(store.formTotal) }}
                  </span>
                </div>
              </div>
            </section>

            <section class="tm-surface p-5">
              <h3 class="text-h4 font-extrabold text-neutral-800 mb-3 flex items-center gap-2">
                <component :is="CalendarIcon" class="w-5 h-5 text-warning-600" />
                Opciones de entrega
              </h3>
              <label class="flex items-start gap-3 cursor-pointer py-2 group">
                <input
                  type="checkbox"
                  v-model="store.formulario.stock_reservado"
                  class="mt-1 w-4 h-4 accent-primary-600"
                />
                <div>
                  <p class="text-caption font-bold text-neutral-800 group-hover:text-primary-700">
                    Reservar stock ahora
                  </p>
                  <p class="text-micro text-neutral-500 mt-0.5 leading-snug">
                    Bloquea visualmente unidades para este cliente hasta confirmar o vencer.
                    No descuenta inventario hasta entrega.
                  </p>
                </div>
              </label>
            </section>

            <section class="tm-surface p-5">
              <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-2 block">
                Observaciones internas
              </label>
              <textarea
                v-model="store.formulario.observaciones"
                rows="3"
                placeholder="Ej.: Retira X cliente. Hablar con Ana. Precios sujetos a cambio sin previo aviso…"
                class="!resize-none"
              />
            </section>

            <!-- Validación y botones -->
            <div class="space-y-2">
              <div
                v-for="v in validacionesForm"
                :key="v.id"
                class="flex items-start gap-2 px-3 py-2 rounded-xl"
                :class="v.tone === 'ok' ? 'bg-success-50 text-success-800' : v.tone === 'warn' ? 'bg-warning-50 text-warning-800' : 'bg-danger-50 text-danger-800'"
              >
                <component
                  :is="v.tone === 'ok' ? CheckCircleIcon : v.tone === 'warn' ? AlertTriangleIcon : XCircleIcon"
                  class="w-4 h-4 mt-0.5 shrink-0"
                />
                <p class="text-caption font-semibold leading-snug">{{ v.msg }}</p>
              </div>
              <TmButton
                size="lg"
                variant="primary"
                block
                :icon="SaveIcon"
                :loading="guardando"
                :disabled="!puedeGuardar"
                @click="guardarCotizacion"
              >
                {{ store.formulario.stock_reservado ? 'Guardar y reservar stock' : 'Guardar cotización' }}
              </TmButton>
              <TmButton
                size="md"
                variant="ghost"
                block
                :icon="RotateCcwIcon"
                @click="limpiarFormulario"
              >
                Limpiar todo
              </TmButton>
            </div>
          </aside>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- TAB 2: LISTADO DE COTIZACIONES                              -->
      <!-- ============================================================ -->
      <div v-else-if="tab === 'listado'" class="p-5 pt-4">
        <div class="tm-stat-grid mb-6">
          <Kpi
            title="Pendientes"
            :value="String(store.cotPendientes)"
            :icon="ClockIcon"
            tone="warning"
          />
          <Kpi
            title="Confirmadas"
            :value="String(store.cotConfirmadas)"
            :icon="CheckCircleIcon"
            tone="success"
          />
          <Kpi
            title="Confirmadas este mes"
            :value="fmtMoney(store.montoTotalMes)"
            sub-value="monto total facturado"
            :icon="TrendingUpIcon"
            tone="primary"
          />
          <Kpi
            title="Vencidas / Canceladas"
            :value="String(store.cotVencidas + store.cotCanceladas)"
            sub-value="cotizaciones cerradas"
            :icon="XCircleIcon"
            tone="danger"
          />
        </div>

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <TmSearch
              v-model="store.filtros.q"
              placeholder="Buscar por N° o cliente…"
              class="max-w-sm"
              @keyup.enter="store.cargarCotizaciones()"
              @clear="() => { store.filtros.q = ''; store.cargarCotizaciones(); }"
            />
            <select
              v-model="store.filtros.estado"
              @change="store.cargarCotizaciones()"
              class="!w-44 !h-9"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="confirmada">Confirmadas</option>
              <option value="cancelada">Canceladas</option>
              <option value="vencida">Vencidas</option>
            </select>
            <div class="flex items-center gap-1.5">
              <input
                type="date"
                v-model="store.filtros.fecha_desde"
                class="!h-9 !w-auto"
                @change="store.cargarCotizaciones()"
              />
              <span class="text-caption text-neutral-400">→</span>
              <input
                type="date"
                v-model="store.filtros.fecha_hasta"
                class="!h-9 !w-auto"
                @change="store.cargarCotizaciones()"
              />
            </div>
          </div>
        </div>

        <TmDataTable
          :rows="store.cotizaciones"
          :columns="COL_LISTADO"
          :loading="store.loading"
          :searchable="false"
          :per-page="20"
          empty-text="No hay cotizaciones con estos filtros."
        >
          <template #cell:numero_cotizacion="{ row }">
            <button
              type="button"
              @click="abrirDetalle(row.id)"
              class="text-caption font-extrabold tabular text-primary-700 hover:text-primary-900 hover:underline"
            >
              {{ row.numero_cotizacion }}
            </button>
          </template>
          <template #cell:cliente="{ row }">
            <div class="min-w-0">
              <p class="text-caption font-bold text-neutral-800 leading-snug line-clamp-1">
                {{ row.cliente_nombre }}
              </p>
              <p class="text-micro text-neutral-500 tabular mt-0.5">
                {{ formatFechaHora(row.fecha_hora) }}
              </p>
            </div>
          </template>
          <template #cell:estado="{ row }">
            <TmBadge :tone="badgeTone(row.estado)" dot :size="'md'">
              {{ estadoLabel(row.estado) }}
            </TmBadge>
            <div v-if="row.stock_reservado && row.estado !== 'cancelada'" class="mt-1">
              <TmBadge tone="primary" :size="'sm'">
                Stock reservado
              </TmBadge>
            </div>
          </template>
          <template #cell:vigencia="{ row }">
            <div>
              <p
                class="tabular text-caption font-bold"
                :class="estaVencida(row.validez_hasta) ? 'text-danger-600' : 'text-neutral-700'"
              >
                {{ formatFecha(row.validez_hasta) }}
              </p>
              <p class="text-micro text-neutral-500 mt-0.5">
                {{ estaVencida(row.validez_hasta) ? 'Vencida' : diasRestantesLabel(row.validez_hasta) }}
              </p>
            </div>
          </template>
          <template #cell:items="{ row }">
            <p class="tabular text-caption font-bold text-neutral-700">
              {{ (row.detalle_cotizacion || []).length }} ítems
            </p>
            <p class="text-micro text-neutral-500 tabular mt-0.5">
              {{ (row.detalle_cotizacion || []).reduce((s, i) => s + Number(i.cantidad), 0) }} u. totales
            </p>
          </template>
          <template #cell:total="{ row }">
            <p class="tabular text-h4 font-extrabold text-neutral-800">
              {{ fmtMoney(row.total) }}
            </p>
            <p v-if="Number(row.descuento_total) > 0" class="text-micro text-danger-600 tabular mt-0.5">
              −{{ fmtMoney(row.descuento_total) }} desc.
            </p>
          </template>
          <template #cell:acciones="{ row }">
            <div class="flex items-center gap-1 justify-end">
              <TmButton
                size="xs"
                variant="ghost"
                :icon="EyeIcon"
                @click="abrirDetalle(row.id)"
                title="Ver detalle"
              />
              <TmButton
                v-if="row.estado === 'pendiente' && !estaVencida(row.validez_hasta)"
                size="xs"
                variant="ghost"
                :icon="CheckCircleIcon"
                class="text-success-600 hover:!bg-success-50"
                @click="confirmarCotizacion(row)"
                title="Confirmar (descontar stock PEPS)"
              />
              <TmButton
                v-if="row.estado === 'pendiente'"
                size="xs"
                variant="ghost"
                :icon="XCircleIcon"
                class="text-danger-600 hover:!bg-danger-50"
                @click="cancelarCotizacion(row)"
                title="Cancelar cotización"
              />
            </div>
          </template>
        </TmDataTable>
      </div>

      <!-- ============================================================ -->
      <!-- TAB 3: DETALLE                                              -->
      <!-- ============================================================ -->
      <div v-else-if="tab === 'detalle'" class="p-5 pt-4">
        <div v-if="!store.detalle" class="tm-surface p-14 text-center">
          <component :is="FileQuestionIcon" class="w-16 h-16 mx-auto mb-3 text-neutral-300" />
          <p class="text-h3 font-bold text-neutral-700">Seleccioná una cotización para ver el detalle.</p>
          <p class="text-caption text-neutral-500 mt-2">Podés abrirla desde el listado o inmediatamente después de crearla.</p>
          <div class="mt-5 flex justify-center">
            <TmButton variant="outline" size="md" :icon="ListIcon" @click="tab = 'listado'">
              Ir al listado
            </TmButton>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5">
          <div class="flex flex-col gap-4 min-w-0">
            <section class="tm-surface p-6">
              <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-3 mb-2">
                    <TmBadge :tone="badgeTone(store.detalle.estado)" dot :size="'md'">
                      {{ estadoLabel(store.detalle.estado) }}
                    </TmBadge>
                    <span v-if="store.detalle.stock_reservado" class="inline-block px-2 py-1 rounded-lg bg-primary-50 text-primary-700 text-[11px] font-extrabold uppercase tracking-wide">
                      Stock reservado
                    </span>
                  </div>
                  <p class="text-h2 font-black text-neutral-900 tabular">{{ store.detalle.numero_cotizacion }}</p>
                  <p class="text-caption text-neutral-500 mt-1">
                    Emitida el {{ formatFechaHora(store.detalle.fecha_hora) }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <TmButton
                    size="md"
                    variant="outline"
                    :icon="PrinterIcon"
                    disabled
                  >
                    Exportar PDF
                  </TmButton>
                  <TmButton
                    size="md"
                    variant="outline"
                    :icon="ShareIcon"
                    disabled
                  >
                    Compartir
                  </TmButton>
                  <TmButton
                    size="md"
                    variant="ghost"
                    :icon="RotateCcwIcon"
                    @click="() => store.cargarDetalle(store.detalle.id)"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-border">
                <div>
                  <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">Cliente</p>
                  <p class="text-caption font-extrabold text-neutral-800 mt-1 leading-snug">{{ store.detalle.cliente_nombre }}</p>
                  <p v-if="store.detalle.cliente?.telefono" class="text-micro text-neutral-500 tabular mt-0.5">
                    {{ store.detalle.cliente.telefono }}
                  </p>
                  <p v-if="store.detalle.cliente?.direccion" class="text-micro text-neutral-500 mt-1">
                    {{ store.detalle.cliente.direccion }}
                  </p>
                </div>
                <div>
                  <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">Vigencia</p>
                  <p
                    class="text-caption font-extrabold mt-1 tabular"
                    :class="estaVencida(store.detalle.validez_hasta) ? 'text-danger-600' : 'text-neutral-800'"
                  >
                    Hasta {{ formatFecha(store.detalle.validez_hasta) }}
                  </p>
                  <p class="text-micro text-neutral-500 mt-0.5">
                    {{ estaVencida(store.detalle.validez_hasta) ? 'Cotización vencida' : diasRestantesLabel(store.detalle.validez_hasta) }}
                  </p>
                </div>
                <div>
                  <p class="text-micro font-bold uppercase tracking-wide text-neutral-500">Condición</p>
                  <p class="text-caption font-bold text-neutral-800 mt-1">
                    {{ store.detalle.cliente?.condicion_iva ?? 'Consumidor Final' }}
                  </p>
                  <p v-if="store.detalle.cliente?.dni_cuit" class="text-micro text-neutral-500 tabular mt-0.5">
                    {{ store.detalle.cliente.dni_cuit }}
                  </p>
                </div>
              </div>
            </section>

            <section class="tm-surface p-5">
              <h3 class="text-h4 font-extrabold text-neutral-800 mb-4">Detalle de productos</h3>
              <TmDataTable
                :rows="store.detalle.detalle_cotizacion || []"
                :columns="COL_DETALLE"
                :searchable="false"
                :per-page="50"
                empty-text="Sin productos."
              >
                <template #cell:producto="{ row }">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                      <component :is="PackageIcon" class="w-4.5 h-4.5" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-caption font-bold text-neutral-800 leading-snug line-clamp-1">
                        {{ row.producto_nombre }}
                      </p>
                      <p class="text-micro text-neutral-500 tabular mt-0.5">
                        SKU {{ row.sku }}
                      </p>
                    </div>
                  </div>
                </template>
                <template #cell:precio_original="{ row }">
                  <p class="tabular text-neutral-500 line-through text-caption">
                    {{ fmtMoney(row.precio_original ?? row.precio_acordado) }}
                  </p>
                </template>
                <template #cell:subtotal_item="{ row }">
                  <p class="tabular text-caption font-extrabold text-neutral-800">
                    {{ fmtMoney(Number(row.subtotal) ?? Number(row.precio_acordado) * Number(row.cantidad)) }}
                  </p>
                </template>
              </TmDataTable>
            </section>

            <section v-if="store.detalle.observaciones" class="tm-surface p-5">
              <h3 class="text-h4 font-extrabold text-neutral-800 mb-2 flex items-center gap-2">
                <component :is="StickyNoteIcon" class="w-5 h-5 text-neutral-500" />
                Observaciones
              </h3>
              <p class="text-caption text-neutral-600 leading-relaxed whitespace-pre-wrap">
                {{ store.detalle.observaciones }}
              </p>
            </section>
          </div>

          <!-- Totales detalle -->
          <aside class="flex flex-col gap-4">
            <section class="tm-surface p-5">
              <h3 class="text-h4 font-extrabold text-neutral-800 mb-4 flex items-center gap-2">
                <component :is="ReceiptIcon" class="w-5 h-5 text-secondary-600" />
                Totales
              </h3>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-caption text-neutral-500">Subtotal</span>
                  <span class="tabular font-bold text-neutral-800">{{ fmtMoney(store.detalle.subtotal) }}</span>
                </div>
                <div
                  v-if="Number(store.detalle.descuento_total) > 0"
                  class="flex justify-between items-center text-danger-700"
                >
                  <span class="text-caption font-semibold">Descuento global</span>
                  <span class="tabular font-bold">− {{ fmtMoney(store.detalle.descuento_total) }}</span>
                </div>
                <div class="pt-3 border-t-2 border-neutral-900 flex items-end justify-between">
                  <span class="text-caption font-bold text-neutral-800">TOTAL</span>
                  <span class="tabular text-h2 font-black text-neutral-900 leading-none">
                    {{ fmtMoney(store.detalle.total) }}
                  </span>
                </div>
              </div>
            </section>

            <!-- Acciones detalle -->
            <section class="tm-surface p-5 space-y-2">
              <TmButton
                v-if="store.detalle.estado === 'pendiente' && !estaVencida(store.detalle.validez_hasta)"
                size="lg"
                variant="primary"
                block
                :icon="CheckCircleIcon"
                :loading="accionProcesando"
                @click="confirmarCotizacion(store.detalle)"
              >
                Confirmar cotización (descontar stock PEPS)
              </TmButton>
              <TmButton
                v-if="store.detalle.estado === 'pendiente'"
                size="md"
                variant="outline"
                tone="danger"
                block
                :icon="XCircleIcon"
                :loading="accionProcesando"
                @click="cancelarCotizacion(store.detalle)"
              >
                Cancelar cotización
              </TmButton>
              <TmButton
                v-if="store.detalle.estado === 'confirmada'"
                size="md"
                variant="outline"
                block
                :icon="ShoppingBagIcon"
                disabled
              >
                Ir a Venta (proximamente)
              </TmButton>
              <TmButton
                size="md"
                variant="ghost"
                block
                :icon="ListIcon"
                @click="tab = 'listado'"
              >
                Volver al listado
              </TmButton>
            </section>
          </aside>
        </div>
      </div>
    </TmCard>

    <!-- Modal edición precio -->
    <TmModal v-model="showEditorPrecio" title="Editar precio acordado" :size="'sm'">
      <div class="space-y-4 py-2">
        <div v-if="precioEditandoData">
          <p class="text-caption font-bold text-neutral-800">{{ precioEditandoData.producto_nombre }}</p>
          <p class="text-micro text-neutral-500 tabular mt-0.5">Cantidad: {{ precioEditandoData.cantidad }} · Precio original: {{ fmtMoney(precioEditandoData.precio_original) }}</p>
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Precio por unidad ($)
          </label>
          <input
            v-model.number="precioEditandoValor"
            type="number"
            min="0"
            class="!h-12 !text-h3 !tabular w-full"
          />
          <p v-if="precioEditandoData" class="text-micro mt-2 text-neutral-500">
            Subtotal: <span class="tabular font-bold text-neutral-800">{{ fmtMoney(precioEditandoValor * (precioEditandoData?.cantidad || 1)) }}</span>
          </p>
        </div>
      </div>
      <template #footer>
        <TmButton variant="ghost" size="md" @click="showEditorPrecio = false">
          Cancelar
        </TmButton>
        <TmButton variant="primary" size="md" :icon="SaveIcon" @click="guardarPrecioEditando">
          Aplicar
        </TmButton>
      </template>
    </TmModal>

    <!-- Modal crear cliente -->
    <TmModal v-model="mostrarCrearCliente" title="Nuevo cliente" :size="'lg'">
      <div class="space-y-4 py-1">
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Nombre o razón social *
          </label>
          <input
            v-model="nuevoCliente.nombre_rs"
            type="text"
            class="!h-[46px] w-full"
            placeholder="Ej: Juan Pérez Distribuidora"
          />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
              DNI / CUIT
            </label>
            <input
              v-model="nuevoCliente.dni_cuit"
              type="text"
              class="!h-[46px] w-full"
              placeholder="Ej: 20-12345678-9"
            />
          </div>
          <div>
            <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
              Teléfono
            </label>
            <input
              v-model="nuevoCliente.telefono"
              type="text"
              class="!h-[46px] w-full"
              placeholder="Ej: 11-4455-6677"
            />
          </div>
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Email
          </label>
          <input
            v-model="nuevoCliente.email"
            type="email"
            class="!h-[46px] w-full"
            placeholder="Ej: cliente@email.com"
          />
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Dirección
          </label>
          <input
            v-model="nuevoCliente.direccion"
            type="text"
            class="!h-[46px] w-full"
            placeholder="Ej: Calle 123, Ciudad"
          />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
              Tipo de cliente *
            </label>
            <select v-model="nuevoCliente.tipo" class="!h-[46px] w-full">
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </div>
          <div>
            <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
              Límite de crédito
            </label>
            <input
              v-model.number="nuevoCliente.limite_credito"
              type="number"
              min="0"
              class="!h-[46px] w-full"
              placeholder="0 para sin límite"
            />
          </div>
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Notas
          </label>
          <textarea
            v-model="nuevoCliente.notas"
            class="w-full"
            rows="3"
            placeholder="Notas adicionales sobre el cliente..."
          />
        </div>
      </div>
      <template #footer>
        <div class="flex items-center gap-2 justify-end">
          <TmButton variant="ghost" @click="mostrarCrearCliente = false">
            Cancelar
          </TmButton>
          <TmButton variant="primary" @click="crearCliente">
            Crear cliente
          </TmButton>
        </div>
      </template>
    </TmModal>
  </div>
</template>

<script setup>
// IMPORTS PRIMERO (obligatorio en ES modules + SFC <script setup>)
import { computed, h, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  RefreshCw as RefreshIcon,
  Plus as PlusIcon,
  FileText as FileTextIcon,
  ListOrdered as ListIcon,
  PackagePlus as PackagePlusIcon,
  User as UserIcon,
  Package as PackageIcon,
  PackageOpen as PackageOpenIcon,
  Search as SearchIcon,
  ShoppingCart as ShoppingCartIcon,
  Calculator as CalculatorIcon,
  PiggyBank as PiggyBankIcon,
  Wallet as WalletIcon,
  Receipt as ReceiptIcon,
  Calendar as CalendarIcon,
  Save as SaveIcon,
  RotateCcw as RotateCcwIcon,
  Clock as ClockIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  TrendingUp as TrendingUpIcon,
  AlertTriangle as AlertTriangleIcon,
  Eye as EyeIcon,
  FileQuestion as FileQuestionIcon,
  Printer as PrinterIcon,
  Share2 as ShareIcon,
  Edit3 as EditIcon,
  Trash2 as TrashIcon,
  StickyNote as StickyNoteIcon,
  ShoppingBag as ShoppingBagIcon,
} from "lucide-vue-next";
import { TmButton, TmBadge, TmCard, TmDataTable, TmModal, TmSearch, TmTabs } from "@/components/ui";
import { useCotizacionesStore } from "@/stores/cotizaciones.js";

// ==============================
// Store + manejo de errores visible
// ==============================
const store = useCotizacionesStore();
const route = useRoute();
const toast = inject("$toast");
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

// =========
// Tabs (¡FIX BUG-B ANTERIORMENTE: tab ANTES ERA ref({value:"nueva"}) - objeto anidado
// Ahora REF DIRECTO. En template auto-unwrap: `tab` y compara DIRECTAMENTE contra string)
// =========
const TABS = [
  { value: "nueva", label: "Nueva cotización", icon: PackagePlusIcon, tone: "primary" },
  { value: "listado", label: "Listado", icon: ListIcon, tone: "info", badge: () => store.cotPendientes > 0 ? String(store.cotPendientes) : undefined },
  { value: "detalle", label: "Detalle", icon: FileTextIcon, tone: "secondary" },
];
const tab = ref("nueva");

// --- Estado UI ---
const clienteBusqueda = ref("");
const clienteDropdownAbierto = ref(false);
const productoBusqueda = ref("");
const productoDropdownAbierto = ref(false);
const guardando = ref(false);
const accionProcesando = ref(false);

const showEditorPrecio = ref(false);
const precioEditandoIdx = ref(null);
const precioEditandoValor = ref(0);

// Modal crear cliente
const mostrarCrearCliente = ref(false);
const nuevoCliente = ref({
  nombre_rs: "",
  dni_cuit: "",
  telefono: "",
  email: "",
  direccion: "",
  tipo: "minorista",
  limite_credito: 0,
  notas: "",
});

const clientesAll = computed(() => store.clientesSelect || []);
const clientesFiltrados = computed(() => {
  const q = clienteBusqueda.value.trim().toLowerCase();
  if (!q) return clientesAll.value.slice(0, 15);
  return clientesAll.value.filter((c) =>
    c.nombre_rs.toLowerCase().includes(q) ||
    (c.dni_cuit || "").includes(q) ||
    (c.telefono || "").includes(q),
  ).slice(0, 15);
});

const clienteSeleccionadoDetalle = computed(() =>
  clientesAll.value.find((c) => c.id === store.formulario.cliente_id) ?? null,
);

const productosFiltrados = computed(() => {
  const q = productoBusqueda.value.trim().toLowerCase();
  if (!q) return store.productosSelect.slice(0, 8);
  return store.productosSelect.filter((p) =>
    p.nombre.toLowerCase().includes(q) ||
    (p.sku || "").toLowerCase().includes(q) ||
    (p.codigo_barras || "").includes(q),
  );
});

function stockReservadoOcupado(productoId) {
  const m = store.reservasMap;
  return m.get(Number(productoId)) || 0;
}

function seleccionarCliente(c) {
  store.formulario.cliente_id = c.id;
  clienteBusqueda.value = "";
  clienteDropdownAbierto.value = false;
}

function agregarProducto(p) {
  if (store.agregarItemForm(p)) {
    const existente = store.formulario.items.find((i) => i.producto_id === p.id);
    toast?.success("Producto agregado", existente
      ? `${p.nombre} · ahora ${existente.cantidad} u.`
      : `${p.nombre} agregado a la cotización`,
    );
  }
  productoBusqueda.value = "";
  productoDropdownAbierto.value = false;
}

function confirmarPrimerProducto() {
  const p = productosFiltrados.value[0];
  if (p) agregarProducto(p);
}

function abrirEditorPrecio(idx) {
  const row = store.formulario.items[idx];
  if (!row) return;
  precioEditandoIdx.value = idx;
  precioEditandoValor.value = Number(row.precio_acordado);
  showEditorPrecio.value = true;
}
const precioEditandoData = computed(() => store.formulario.items[precioEditandoIdx.value] || null);
function guardarPrecioEditando() {
  if (precioEditandoIdx.value == null) return;
  store.actualizarPrecioItem(precioEditandoIdx.value, precioEditandoValor.value);
  showEditorPrecio.value = false;
  toast?.info("Precio actualizado");
}

async function recargarTodo() {
  await store.cargarTodo();
  toast?.success("Listo", "Cotizaciones actualizadas.");
}

function limpiarFormulario() {
  store.resetFormulario();
  clienteBusqueda.value = "";
  productoBusqueda.value = "";
  toast?.info("Formulario limpiado");
}

async function crearCliente() {
  if (!nuevoCliente.value.nombre_rs.trim()) {
    toast?.error("Error", "El nombre del cliente es obligatorio");
    return;
  }
  
  try {
    const ok = await store.crearCliente(nuevoCliente.value);
    if (ok) {
      toast?.success("Cliente creado", nuevoCliente.value.nombre_rs);
      mostrarCrearCliente.value = false;
      nuevoCliente.value = {
        nombre_rs: "",
        dni_cuit: "",
        telefono: "",
        email: "",
        direccion: "",
        tipo: "minorista",
        limite_credito: 0,
        notas: "",
      };
      await store.cargarTodo();
    }
  } catch (err) {
    toast?.error("Error al crear cliente", String(err));
  }
}

// --- Validación formulario ---
const puedeGuardar = computed(() => {
  const f = store.formulario;
  return !!(
    f.cliente_id &&
    f.validez_hasta &&
    f.items.length > 0 &&
    Number(store.formTotal) >= 0
  );
});

const validacionesForm = computed(() => {
  const out = [];
  const f = store.formulario;
  if (f.cliente_id) {
    out.push({ id: "cli", tone: "ok", msg: "Cliente seleccionado correctamente." });
  } else {
    out.push({ id: "cli", tone: "danger", msg: "Seleccioná un cliente antes de guardar." });
  }
  if (f.validez_hasta && !estaVencida(f.validez_hasta)) {
    out.push({ id: "vig", tone: "ok", msg: `Vigencia ${diasRestantesLabel(f.validez_hasta)}.` });
  } else if (estaVencida(f.validez_hasta)) {
    out.push({ id: "vig", tone: "danger", msg: "La fecha de vigencia debe ser futura." });
  } else {
    out.push({ id: "vig", tone: "danger", msg: "Definí la fecha de vigencia." });
  }
  if (f.items.length > 0) {
    out.push({ id: "it", tone: "ok", msg: `${f.items.length} producto(s) · ${store.formSubtotal > 0 ? fmtMoney(store.formSubtotal) : '$0'} subtotal.` });
  } else {
    out.push({ id: "it", tone: "warn", msg: "Agregá al menos 1 producto para armar la cotización." });
  }
  if (Number(f.descuento_total) > 0) {
    if (Number(f.descuento_total) > Number(store.formSubtotal)) {
      out.push({ id: "desc", tone: "danger", msg: "El descuento global excede el subtotal." });
    } else {
      out.push({ id: "desc", tone: "warn", msg: `Aplicando descuento global de ${fmtMoney(Number(f.descuento_total))}.` });
    }
  }
  return out;
});

async function guardarCotizacion() {
  if (!puedeGuardar.value) return;
  guardando.value = true;
  try {
    const creada = await store.guardarCotizacion();
    if (creada) {
      toast?.success(
        "Cotización guardada",
        store.formulario.stock_reservado
          ? `${creada.numero_cotizacion} · Stock reservado ✓`
          : `${creada.numero_cotizacion} · Lista para confirmar.`,
      );
      await store.cargarDetalle(creada.id);
      tab.value = "detalle";
      store.resetFormulario();
    } else {
      toast?.error("No se pudo guardar", "Revisá los datos e intentá nuevamente.");
    }
  } finally {
    guardando.value = false;
  }
}

async function abrirDetalle(id) {
  await store.cargarDetalle(id);
  tab.value = "detalle";
}

async function confirmarCotizacion(cot) {
  if (!cot?.id) return;
  accionProcesando.value = true;
  try {
    const r = await store.confirmarCotizacion(cot.id);
    if (r && r.estado === "confirmada") {
      toast?.success("Cotización confirmada", `Stock descontado por PEPS · ${r.numero_cotizacion}`);
    } else if (r && r.estado === "vencida") {
      toast?.warning("Cotización vencida", "Renová la vigencia antes de confirmar.");
    } else {
      toast?.error("No se pudo confirmar");
    }
  } finally {
    accionProcesando.value = false;
  }
}

async function cancelarCotizacion(cot) {
  if (!cot?.id) return;
  accionProcesando.value = true;
  try {
    const r = await store.cancelarCotizacion(cot.id);
    if (r) toast?.info("Cotización cancelada", r.numero_cotizacion);
    else toast?.error("No se pudo cancelar");
  } finally {
    accionProcesando.value = false;
  }
}

// --- Columnas tablas ---
const COL_ITEMS = [
  { key: "producto", label: "Producto", width: "40%" },
  { key: "cantidad", label: "Cantidad", width: "18%" },
  { key: "precio_original", label: "P. Original", width: "14%" },
  { key: "precio_acordado", label: "P. Acordado", width: "14%" },
  { key: "subtotal", label: "Subtotal", width: "14%" },
  { key: "acciones", label: "", width: "50px", align: "right" },
];

const COL_LISTADO = [
  { key: "numero_cotizacion", label: "N° Cotización", width: "18%" },
  { key: "cliente", label: "Cliente / Fecha", width: "24%" },
  { key: "estado", label: "Estado", width: "15%" },
  { key: "vigencia", label: "Vigencia", width: "14%" },
  { key: "items", label: "Items", width: "10%" },
  { key: "total", label: "Total", width: "12%" },
  { key: "acciones", label: "", width: "90px", align: "right" },
];

const COL_DETALLE = [
  { key: "producto", label: "Producto", width: "38%" },
  { key: "cantidad", label: "Cantidad", width: "10%" },
  { key: "precio_original", label: "P. Lista", width: "14%" },
  { key: "precio_acordado", label: "P. Acordado", width: "14%" },
  { key: "subtotal_item", label: "Subtotal", width: "12%", align: "right" },
];

// --- Helpers presentación ---
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
function fmtMoney(v) {
  const n = Number(v || 0);
  return money.format(n);
}
function formatFecha(iso) {
  if (!iso) return "—";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}
function formatFechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function estaVencida(fechaStr) {
  if (!fechaStr) return false;
  const d = new Date(String(fechaStr).slice(0, 10));
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return d < hoy;
}
function diasRestantes(fechaStr) {
  if (!fechaStr) return 0;
  const d = new Date(String(fechaStr).slice(0, 10));
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - h.getTime()) / 86400000);
}
function diasRestantesLabel(fechaStr) {
  const d = diasRestantes(fechaStr);
  if (d < 0) return `Vencida hace ${-d} día(s)`;
  if (d === 0) return "Vence HOY";
  if (d === 1) return "Vence mañana";
  return `Faltan ${d} días`;
}
function estadoLabel(estado) {
  return ({
    pendiente: "Pendiente",
    confirmada: "Confirmada",
    cancelada: "Cancelada",
    vencida: "Vencida",
  })[estado] || estado;
}
function badgeTone(estado) {
  return ({
    pendiente: "warning",
    confirmada: "success",
    cancelada: "secondary",
    vencida: "danger",
  })[estado] || "info";
}

// --- Kpi inline ---
const Kpi = {
  props: ["title", "value", "subValue", "icon", "tone"],
  setup(p) {
    const tones = {
      primary: "bg-primary-50 text-primary-700",
      secondary: "bg-secondary-50 text-secondary-700",
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
        p.subValue ? h("p", { class: "text-caption-xs text-neutral-500 mt-0.5" }, p.subValue) : null,
      ]);
  },
};

// --- Clicks fuera para cerrar dropdowns + carga inicial con manejo de errores visible ---
let _clickOutsideHandler = null;
onMounted(async () => {
  try {
    await store.cargarTodo();
    const clienteQuery = route.query.cliente;
    if (clienteQuery) {
      tab.value = "nueva";
      store.formulario.cliente_id = Number(clienteQuery);
    }
  } catch (err) {
    viewError.value = err?.message || "Error al cargar cotizaciones, clientes o productos.";
    errorDetalle.value = err?.stack || String(err);
  }
  _clickOutsideHandler = (ev) => {
    if (!ev.target.closest) return;
    if (!ev.target.closest('[class*="relative"]') && !ev.target.closest(".tm-surface input")) {
      clienteDropdownAbierto.value = false;
      productoDropdownAbierto.value = false;
    }
  };
  document.addEventListener("click", _clickOutsideHandler);
});
onBeforeUnmount(() => {
  if (_clickOutsideHandler) document.removeEventListener("click", _clickOutsideHandler);
  if (typeof window !== "undefined") window.removeEventListener("keydown", onKeyGlobal);
});

// --- Atajos de teclado POS-style ---
function onKeyGlobal(e) {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) {
    if (e.key === "/" && tab.value === "nueva" && !e.target.value) {
      e.preventDefault();
      productoDropdownAbierto.value = true;
    }
    return;
  }
  if (e.key === "/" && tab.value === "nueva") {
    e.preventDefault();
    productoDropdownAbierto.value = true;
  }
}
if (typeof window !== "undefined") window.addEventListener("keydown", onKeyGlobal);
</script>
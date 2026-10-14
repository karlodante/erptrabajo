<template>
  <div v-if="viewError" class="bg-danger-50 border-danger-200 text-danger-800 flex items-start gap-3 p-6 rounded-2xl">
    <component :is="XCircleIcon" class="w-6 h-6 text-danger-500 shrink-0 mt-0.5" />
    <div class="min-w-0 flex-1">
      <h3 class="text-h4 font-extrabold text-danger-900">No se pudo cargar Punto de Venta</h3>
      <p class="text-caption font-semibold mb-3">{{ viewError }}</p>
      <div class="flex gap-2">
        <TmButton variant="primary" @click="forzarRecarga">Reintentar</TmButton>
        <TmButton variant="ghost" @click="viewError = null; errorDetalle = null">Cerrar</TmButton>
      </div>
      <details v-if="errorDetalle" class="mt-4">
        <summary class="font-bold cursor-pointer text-danger-700 text-caption">Detalle técnico</summary>
        <div class="font-mono text-xs bg-white/60 p-3 border rounded-lg mt-2 whitespace-pre-wrap">{{ errorDetalle }}</div>
      </details>
    </div>
  </div>

  <div v-else-if="store.loading && store.items.length === 0" class="p-6 flex items-center gap-3 text-neutral-500">
    <component :is="RefreshIcon" class="w-5 h-5 animate-spin" />
    <p class="text-caption font-bold">Cargando ...</p>
  </div>

  <div v-else class="pos-wrapper h-[calc(100vh-64px-64px)] -mx-5 lg:-mx-8 -my-6">
    <Transition name="flash">
      <div
        v-if="store.lastFlash"
        class="flash-overlay pointer-events-none fixed inset-0 z-[90] mix-blend-overlay"
        :class="
          store.lastFlash.tipo === 'ok'
            ? 'bg-success-500/10'
            : 'bg-danger-500/15'
        "
      />
    </Transition>

    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] h-full">
      <!-- COLUMNA IZQUIERDA: Escaneo + Carrito -->
      <div class="flex flex-col min-w-0 h-full border-r border-border">
        <!-- Barra de escaneo principal -->
        <section
          class="shrink-0 p-5 border-b border-border bg-surface-elevated"
        >
          <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div class="flex-1 relative">
              <div
                class="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl
                       bg-primary-50 text-primary-600 flex items-center justify-center
                       shrink-0 z-10"
              >
                <component :is="ScanLineIcon" class="w-5 h-5" />
              </div>
              <input
                ref="scanInputRef"
                v-model="scanValue"
                @keydown.enter.prevent="onScanSubmit"
                type="text"
                class="!pl-16 !h-[60px] !text-h4 !rounded-xl w-full border-2
                       !border-primary-200 focus:!border-primary-500 bg-primary-50/40
                       focus:!shadow-[0_0_0_4px_rgba(13,138,114,0.12)] font-bold"
                :class="{
                  'animate-flash-success': flashScanSuccess,
                  'animate-flash-error': flashScanError,
                }"
                placeholder="Escanea el código de barras o SKU y presiona Enter…"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
              />
              <kbd
                class="absolute right-4 top-1/2 -translate-y-1/2 h-8 px-3 items-center gap-1
                       text-caption-xs font-mono text-primary-700 bg-white
                       border border-primary-200 rounded shadow-sm hidden sm:inline-flex"
              >
                Enter
              </kbd>
            </div>

            <div class="relative w-full sm:w-[400px]">
              <div
                class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 z-10"
              >
                <component :is="SearchIcon" class="w-5 h-5" />
              </div>
              <input
                v-model="buscadorManual"
                @input="onBuscarManual"
                @keydown.esc="store.limpiarBusqueda()"
                @keydown.down.prevent="navResult(1)"
                @keydown.up.prevent="navResult(-1)"
                @keydown.enter.prevent="confirmarResultado"
                type="text"
                class="!pl-12 !h-[60px] !rounded-xl w-full !bg-surface-elevated"
                placeholder="Buscar por nombre (o pulsa /)"
                autocomplete="off"
              />
              <button
                v-if="buscadorManual"
                type="button"
                @click="limpiarBuscador"
                class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
                       text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100
                       inline-flex items-center justify-center"
              >
                <component :is="XIcon" class="w-4 h-4" />
              </button>

              <!-- Dropdown resultados -->
              <Transition name="dropdown">
                <div
                  v-if="
                    store.resultadosBusqueda.length > 0 && buscadorManual.trim()
                  "
                  class="absolute left-0 right-0 top-full mt-2 bg-surface-elevated
                         rounded-2xl shadow-lg border border-border overflow-hidden
                         z-40 max-h-80 overflow-y-auto scrollbar-thin"
                >
                  <div
                    v-for="(prod, idx) in store.resultadosBusqueda.slice(0, 8)"
                    :key="prod.id"
                    @click="seleccionarProducto(prod)"
                    class="flex items-center gap-3 px-4 py-3 cursor-pointer
                           border-b border-border/60 last:border-b-0 transition-colors"
                    :class="
                      idx === navIndex
                        ? 'bg-primary-50'
                        : 'hover:bg-neutral-50'
                    "
                  >
                    <div
                      class="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-500
                             shrink-0 flex items-center justify-center"
                    >
                      <component :is="PackageIcon" class="w-5 h-5" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-body-sm font-bold text-neutral-800 truncate">
                        {{ prod.nombre }}
                      </p>
                      <p
                        class="text-caption-xs text-neutral-500 tabular truncate"
                      >
                        SKU {{ prod.sku }}
                        <span
                          v-if="prod.codigo_barras"
                          class="mx-2 text-neutral-300"
                        >·</span>
                        <span v-if="prod.codigo_barras">{{
                          prod.codigo_barras
                        }}</span>
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-h4 font-extrabold text-primary-700 tabular">
                        {{ fmtMoney(prod.precio_unitario) }}
                      </p>
                      <TmBadge
                        size="sm"
                        :tone="prod.stock_total <= prod.stock_minimo ? 'warning' : 'success'"
                      >
                        Stock {{ prod.stock_total }}
                      </TmBadge>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <div class="flex gap-2 shrink-0">
              <TmButton
                variant="ghost"
                size="lg"
                :icon="TagsIcon"
                @click="showCombosModal = true"
              >
                Combos
              </TmButton>
            </div>
          </div>

          <!-- Accesos rápidos / atajos -->
          <div class="mt-4 flex flex-wrap items-center gap-2 text-caption-xs">
            <span
              class="h-5 px-2 rounded bg-neutral-100 text-neutral-600 font-semibold inline-flex items-center"
            >
              <kbd class="font-mono mr-1">Enter</kbd> escanear
            </span>
            <span
              class="h-5 px-2 rounded bg-neutral-100 text-neutral-600 font-semibold inline-flex items-center"
            >
              <kbd class="font-mono mr-1">/</kbd> buscar
            </span>
            <span
              class="h-5 px-2 rounded bg-neutral-100 text-neutral-600 font-semibold inline-flex items-center"
            >
              <kbd class="font-mono mr-1">F5</kbd> limpiar
            </span>
            <span
              class="h-5 px-2 rounded bg-neutral-100 text-neutral-600 font-semibold inline-flex items-center"
            >
              <kbd class="font-mono mr-1">F10</kbd> finalizar
            </span>
            <span
              class="h-5 px-2 rounded bg-neutral-100 text-neutral-600 font-semibold inline-flex items-center"
            >
              <kbd class="font-mono mr-1">Esc</kbd> cancelar
            </span>
          </div>
        </section>

        <!-- Carrito -->
        <section
          class="flex-1 min-h-0 flex flex-col bg-surface overflow-hidden"
        >
          <!-- Header carrito -->
          <div
            class="shrink-0 px-5 py-3 border-b border-border bg-surface-elevated/60
                   flex items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-10 h-10 rounded-lg bg-primary-50 text-primary-700
                       flex items-center justify-center shrink-0"
              >
                <component :is="ShoppingCartIcon" class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <p class="text-h4 text-neutral-800 font-bold leading-tight">
                  Carrito
                </p>
                <p class="text-caption-xs text-neutral-500">
                  <span class="tabular font-bold text-neutral-700"
                    >{{ store.cantidadTotalItems }}</span
                  >
                  ítems
                  <span v-if="store.items.length > 0" class="mx-1.5 text-neutral-300"
                    >·</span
                  >
                  <span v-if="store.items.length > 0"
                    >{{ store.items.length }} producto{{
                      store.items.length === 1 ? "" : "s"
                    }}</span
                  >
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <TmButton
                variant="ghost"
                size="sm"
                :icon="TrashIcon"
                :disabled="store.carritoVacio"
                @click="onVaciarCarrito"
              >
                Vaciar
              </TmButton>
            </div>
          </div>

          <!-- Cuerpo carrito -->
          <div
            class="flex-1 overflow-y-auto scrollbar-thin px-5 py-3"
            ref="cartScrollRef"
          >
            <!-- Estado vacío -->
            <div
              v-if="store.carritoVacio"
              class="h-full flex flex-col items-center justify-center py-20 text-center"
            >
              <div
                class="w-24 h-24 rounded-3xl bg-neutral-100 text-neutral-400
                       flex items-center justify-center mb-5"
              >
                <component :is="ShoppingBagIcon" class="w-12 h-12" />
              </div>
              <h3 class="text-h3 text-neutral-700 mb-2">Carrito vacío</h3>
              <p class="text-body-sm text-neutral-500 max-w-md">
                Escanea un producto con el lector de código de barras o
                búscalo manualmente para comenzar la venta.
              </p>
              <div class="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-2xl">
                <button
                  v-for="prod in quickProducts"
                  :key="prod.id"
                  type="button"
                  @click="onQuickProduct(prod)"
                  class="tm-surface-soft p-3 rounded-xl text-left
                         hover:bg-primary-50 hover:border-primary-200
                         transition-all group"
                >
                  <p class="text-caption font-bold text-neutral-700 truncate group-hover:text-primary-700">
                    {{ prod.nombre }}
                  </p>
                  <p class="text-h4 text-primary-700 tabular font-extrabold mt-1">
                    {{ fmtMoney(prod.precio_unitario) }}
                  </p>
                </button>
              </div>
            </div>

            <!-- Lista de ítems -->
            <ul
              v-else
              class="flex flex-col gap-2 divide-y divide-border/60"
            >
              <li
                v-for="item in store.items"
                :key="item.id"
                class="cart-item group py-3 flex items-center gap-4 rounded-xl
                       px-3 -mx-3 transition-colors"
                :class="{ 'bg-primary-50/50': item.precio_volumen_aplicado }"
              >
                <div
                  class="w-12 h-12 shrink-0 rounded-xl bg-white border border-border
                         shadow-sm flex items-center justify-center"
                  :class="
                    item.precio_volumen_aplicado
                      ? 'border-secondary-200 bg-secondary-50'
                      : ''
                  "
                >
                  <component
                    :is="PackageIcon"
                    class="w-6 h-6"
                    :class="
                      item.precio_volumen_aplicado
                        ? 'text-secondary-600'
                        : 'text-neutral-500'
                    "
                  />
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-3">
                    <p
                      class="text-body-sm font-bold text-neutral-800 leading-snug line-clamp-2"
                    >
                      {{ item.producto.nombre }}
                    </p>
                    <p
                      class="text-h4 tabular font-extrabold text-neutral-800 shrink-0"
                    >
                      {{ fmtMoney(item.precio_aplicado * item.cantidad) }}
                    </p>
                  </div>

                  <div class="mt-1.5 flex items-center gap-2 flex-wrap">
                    <!-- Control de cantidad -->
                    <div
                      class="inline-flex items-center rounded-lg border border-border
                             bg-white overflow-hidden shadow-sm shrink-0"
                    >
                      <button
                        type="button"
                        @click="store.incrementarCantidad(item.id, -1)"
                        class="w-8 h-8 text-neutral-500 hover:bg-neutral-100
                               hover:text-neutral-800 inline-flex items-center justify-center
                               transition-colors"
                      >
                        <component :is="MinusIcon" class="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        v-model.number="item.cantidad"
                        @change="store.actualizarPrecioSegunCantidad(item.id)"
                        class="w-14 h-8 !border-0 !p-0 text-center !text-caption
                               font-bold tabular !bg-transparent !rounded-none !shadow-none"
                        min="1"
                      />
                      <button
                        type="button"
                        @click="store.incrementarCantidad(item.id, 1)"
                        class="w-8 h-8 text-neutral-500 hover:bg-primary-50
                               hover:text-primary-700 inline-flex items-center justify-center
                               transition-colors"
                      >
                        <component :is="PlusIcon" class="w-4 h-4" />
                      </button>
                    </div>

                    <!-- Precio unitario -->
                    <span class="text-caption-xs text-neutral-500 tabular">
                      @ {{ fmtMoney(item.precio_aplicado) }}
                      <span
                        v-if="
                          item.precio_aplicado !==
                          Number(item.producto.precio_unitario)
                        "
                        class="ml-1 line-through opacity-60"
                      >
                        ({{ fmtMoney(item.producto.precio_unitario) }})
                      </span>
                    </span>

                    <!-- Badge precio mayorista -->
                    <TmBadge
                      v-if="item.precio_volumen_aplicado"
                      size="sm"
                      tone="secondary"
                      :icon="SparklesIcon"
                    >
                      Precio mayorista
                    </TmBadge>

                    <!-- Stock -->
                    <TmBadge
                      v-else-if="item.producto.stock_total - item.cantidad <= item.producto.stock_minimo"
                      size="sm"
                      tone="warning"
                    >
                      Quedan {{ item.producto.stock_total - item.cantidad }}
                    </TmBadge>
                  </div>
                </div>

                <!-- Remover -->
                <button
                  type="button"
                  @click="store.removerItem(item.id)"
                  class="shrink-0 w-9 h-9 rounded-lg text-neutral-400
                         hover:bg-danger-50 hover:text-danger-600
                         inline-flex items-center justify-center opacity-0
                         group-hover:opacity-100 transition-all"
                  title="Remover"
                >
                  <component :is="TrashIcon" class="w-[18px] h-[18px]" />
                </button>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <!-- COLUMNA DERECHA: Totales + Cobro -->
      <aside class="flex flex-col h-full bg-surface-elevated min-w-0">
        <!-- Totales -->
        <section class="shrink-0 p-5 border-b border-border">
          <p
            class="text-caption-xs font-bold uppercase tracking-wider text-neutral-500 mb-3"
          >
            Resumen de la venta
          </p>
          <div class="space-y-2.5">
            <div class="flex items-center justify-between text-body-sm">
              <span class="text-neutral-600">Subtotal</span>
              <span class="tabular font-semibold text-neutral-700">{{
                fmtMoney(store.subtotalBruto)
              }}</span>
            </div>
            <div
              v-if="store.descuentoTotal > 0"
              class="flex items-center justify-between text-body-sm"
            >
              <span class="text-secondary-700 font-semibold inline-flex items-center gap-1.5">
                <component :is="SparklesIcon" class="w-4 h-4" />
                Descuentos / mayorista
              </span>
              <span class="tabular font-bold text-secondary-600">
                -{{ fmtMoney(store.descuentoTotal) }}
              </span>
            </div>
            <div class="tm-divider my-2 !my-3" />
            <div class="flex items-end justify-between">
              <span class="text-h4 font-bold text-neutral-800">Total</span>
              <span
                class="text-display-1 tabular font-extrabold text-primary-700 leading-none"
              >
                {{ fmtMoney(store.totalVenta) }}
              </span>
            </div>
          </div>
        </section>

        <!-- Panel de cobro -->
        <section class="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-5">
          <!-- Tabs de pago -->
          <div
            class="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 rounded-xl mb-5"
          >
            <button
              type="button"
              @click="tabPago = 'efectivo'"
              class="py-2.5 rounded-lg text-caption font-bold transition-all
                     inline-flex items-center justify-center gap-2"
              :class="
                tabPago === 'efectivo'
                  ? 'bg-white text-neutral-800 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              "
            >
              <component :is="BanknoteIcon" class="w-4 h-4" />
              Efectivo
            </button>
            <button
              type="button"
              @click="tabPago = 'qr'"
              class="py-2.5 rounded-lg text-caption font-bold transition-all
                     inline-flex items-center justify-center gap-2"
              :class="
                tabPago === 'qr'
                  ? 'bg-white text-neutral-800 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              "
            >
              <component :is="QrCodeIcon" class="w-4 h-4" />
              QR
            </button>
          </div>

          <!-- Efectivo -->
          <div v-show="tabPago === 'efectivo'" class="space-y-4">
            <div>
              <label
                class="text-caption-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 block"
              >
                Monto recibido
              </label>
              <div class="relative">
                <span
                  class="absolute left-4 top-1/2 -translate-y-1/2 text-h3
                         text-neutral-500 font-bold z-10"
                >$</span>
                <input
                  v-model.number="montoEfectivoInput"
                  @input="onEfectivoChange"
                  type="number"
                  min="0"
                  step="0.01"
                  class="!pl-12 !h-14 !text-h3 !rounded-xl !font-extrabold tabular w-full"
                  :class="cambio > 0 ? '!border-success-300 !bg-success-50/40' : ''"
                  placeholder="0,00"
                  ref="efectivoInputRef"
                />
              </div>
              <!-- Botones rápidos -->
              <div class="mt-3 grid grid-cols-4 gap-2">
                <button
                  v-for="val in quickAmounts"
                  :key="val"
                  type="button"
                  @click="onQuickAmount(val)"
                  class="h-10 rounded-lg border border-border bg-white text-caption font-bold tabular
                         text-neutral-700 hover:bg-primary-50 hover:border-primary-300
                         hover:text-primary-700 transition-all"
                >
                  ${{ val }}
                </button>
                <button
                  type="button"
                  @click="onQuickAmount(Math.ceil(store.totalVenta))"
                  class="h-10 rounded-lg border border-primary-200 bg-primary-50
                         text-caption font-bold tabular text-primary-700
                         hover:bg-primary-100 transition-all"
                  :disabled="store.carritoVacio"
                >
                  Exacto
                </button>
              </div>
            </div>

            <!-- Cambio -->
            <Transition name="slide-down">
              <div
                v-if="store.pagoEfectivo > 0 && !store.carritoVacio"
                class="tm-surface p-4 rounded-xl overflow-hidden"
                :class="
                  cambio > 0
                    ? 'border-success-200 bg-success-50/40'
                    : store.pagoEfectivo >= store.totalVenta
                    ? 'border-primary-200 bg-primary-50/40'
                    : 'border-warning-200 bg-warning-50/40'
                "
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-caption-xs text-neutral-500 font-semibold">
                      {{ cambio > 0 ? "Cambio a devolver" : "Abonado" }}
                    </p>
                    <p
                      class="text-display-2 tabular font-extrabold mt-1"
                      :class="
                        cambio > 0
                          ? 'text-success-700'
                          : store.pagoEfectivo >= store.totalVenta
                          ? 'text-primary-700'
                          : 'text-warning-700'
                      "
                    >
                      {{
                        fmtMoney(
                          cambio > 0 ? cambio : Math.max(0, store.totalVenta - store.pagoEfectivo),
                        )
                      }}
                    </p>
                    <p
                      v-if="cambio === 0 && store.pagoEfectivo > 0"
                      class="text-caption-xs text-success-700 font-bold mt-1"
                    >
                      Pago exacto
                    </p>
                    <p
                      v-else-if="store.pagoEfectivo < store.totalVenta"
                      class="text-caption-xs text-warning-700 font-bold mt-1"
                    >
                      Faltan {{ fmtMoney(store.totalVenta - store.pagoEfectivo) }}
                    </p>
                  </div>
                  <div
                    class="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center"
                    :class="
                      cambio > 0
                        ? 'bg-success-500/15 text-success-600'
                        : store.pagoEfectivo >= store.totalVenta
                        ? 'bg-primary-500/15 text-primary-600'
                        : 'bg-warning-500/15 text-warning-600'
                    "
                  >
                    <component
                      :is="
                        cambio > 0
                          ? WalletIcon
                          : store.pagoEfectivo >= store.totalVenta
                          ? CheckCircleIcon
                          : AlertTriangleIcon
                      "
                      class="w-7 h-7"
                    />
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- QR -->
          <div v-show="tabPago === 'qr'" class="space-y-4">
            <div
              class="tm-surface p-5 rounded-xl border-2 border-dashed border-primary-200
                     text-center flex flex-col items-center"
            >
              <div
                class="w-40 h-40 rounded-2xl bg-white border border-border
                       shadow-sm flex items-center justify-center mb-4 relative"
              >
                <component
                  v-if="!qrGenerado"
                  :is="QrCodeIcon"
                  class="w-28 h-28 text-neutral-300"
                />
                <div
                  v-else
                  class="w-full h-full rounded-2xl flex items-center justify-center
                         bg-grid-soft p-3"
                >
                  <div
                    class="w-full h-full rounded-xl bg-white border border-border
                           flex items-center justify-center relative overflow-hidden"
                  >
                    <div
                      class="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-0.5 p-4"
                    >
                      <div
                        v-for="n in 64"
                        :key="n"
                        class="rounded-sm"
                        :class="qrPattern[n % 7] ? 'bg-neutral-800' : 'bg-transparent'"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <p class="text-body-sm font-bold text-neutral-800 mb-1">
                {{ qrGenerado ? "Esperando pago…" : "Escanea para pagar" }}
              </p>
              <p class="text-caption text-neutral-500 mb-4">
                Monto a cobrar:
                <span class="tabular font-extrabold text-neutral-800">{{
                  fmtMoney(store.totalVenta)
                }}</span>
              </p>
              <div class="flex gap-2 w-full">
                <TmButton
                  v-if="!qrGenerado"
                  variant="primary"
                  block
                  :icon="SendIcon"
                  :disabled="store.carritoVacio || store.totalVenta === 0"
                  @click="generarQR"
                >
                  Generar QR
                </TmButton>
                <template v-else>
                  <TmButton
                    variant="outline"
                    block
                    :icon="RefreshIcon"
                    @click="qrGenerado = false"
                  >
                    Cancelar
                  </TmButton>
                  <TmButton
                    variant="success"
                    block
                    :icon="CheckCircleIcon"
                    :loading="confirmandoQR"
                    @click="confirmarPagoQR"
                  >
                    Confirmar pago
                  </TmButton>
                </template>
              </div>
            </div>

            <TmBadge
              v-if="store.qrPendiente"
              size="lg"
              tone="warning"
              pulse
              dot
              class="w-full justify-center"
            >
              Pago QR pendiente de confirmación
            </TmBadge>
            <TmBadge
              v-else-if="store.qrConfirmado"
              size="lg"
              tone="success"
              dot
              class="w-full justify-center"
            >
              Pago QR confirmado
            </TmBadge>
          </div>

          <!-- Pagos aplicados -->
          <div v-if="store.pagos.length > 0" class="mt-6">
            <p
              class="text-caption-xs font-bold uppercase tracking-wider text-neutral-500 mb-2"
            >
              Pagos aplicados
            </p>
            <ul class="space-y-1.5">
              <li
                v-for="p in store.pagos"
                :key="p.forma_pago"
                class="flex items-center justify-between py-2 px-3 rounded-lg
                       bg-neutral-50 border border-border/60"
              >
                <span class="inline-flex items-center gap-2 text-caption font-semibold text-neutral-700">
                  <component
                    :is="p.forma_pago === 'efectivo' ? BanknoteIcon : QrCodeIcon"
                    class="w-4 h-4"
                  />
                  {{ p.forma_pago === "efectivo" ? "Efectivo" : "QR" }}
                  <TmBadge
                    v-if="p.estado === 'pendiente'"
                    size="sm"
                    tone="warning"
                  >
                    pendiente
                  </TmBadge>
                </span>
                <span class="tabular font-bold text-neutral-800">{{
                  fmtMoney(p.monto)
                }}</span>
              </li>
            </ul>
          </div>
        </section>

        <!-- Footer: acción finalizar -->
        <section class="shrink-0 p-5 border-t border-border bg-surface-muted/50">
          <div class="grid grid-cols-2 gap-3">
            <TmButton
              variant="ghost"
              size="lg"
              :icon="XCircleIcon"
              :disabled="store.carritoVacio && store.pagos.length === 0"
              @click="onVaciarCarrito"
            >
              Cancelar
            </TmButton>
            <TmButton
              variant="primary"
              size="lg"
              :icon="ReceiptIcon"
              block
              :loading="store.loading"
              :disabled="!puedeFinalizarHabilitado"
              @click="onFinalizarVenta"
              class="text-base !h-12"
            >
              Finalizar venta
              <span
                v-if="cambioFaltante <= 0 && store.totalVenta > 0"
                class="ml-2 text-caption font-bold opacity-80 tabular"
                >F10</span
              >
            </TmButton>
          </div>
          <p
            v-if="store.totalVenta > 0 && !puedeFinalizarHabilitado && !store.qrPendiente"
            class="text-caption-xs text-danger-600 font-bold mt-3 text-center"
          >
            Faltan {{ fmtMoney(Math.max(0, store.totalVenta - store.pagadoTotal)) }} para completar el pago
          </p>
        </section>
      </aside>
    </div>

    <!-- Modal Combos / Promociones -->
    <TmModal
      v-model="showCombosModal"
      title="Combos y promociones activas"
      subtitle="Aplícalos a la venta actual con un clic"
      :icon="TagsIcon"
      icon-tone="secondary"
      :size="'lg'"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          v-for="combo in combosActivos"
          :key="combo.id"
          class="tm-surface-soft p-4 rounded-xl border-border hover:border-secondary-300
                 hover:shadow-md transition-all cursor-pointer group"
          @click="aplicarCombo(combo)"
        >
          <div class="flex items-start gap-3 mb-3">
            <div
              class="w-12 h-12 rounded-xl bg-secondary-50 text-secondary-600
                     shrink-0 flex items-center justify-center"
            >
              <component :is="SparklesIcon" class="w-6 h-6" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-h4 font-bold text-neutral-800 group-hover:text-secondary-700">
                {{ combo.nombre }}
              </p>
              <p class="text-caption text-neutral-500 mt-0.5">
                {{ combo.descripcion }}
              </p>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <TmBadge tone="secondary" :size="'sm'">
              Ahorrá {{ fmtMoney(combo.ahorro) }}
            </TmBadge>
            <p class="text-h4 tabular font-extrabold text-secondary-700">
              {{ fmtMoney(combo.precioCombo) }}
            </p>
          </div>
        </div>
        <div
          v-if="combosActivos.length === 0"
          class="col-span-full text-center py-10 text-neutral-500"
        >
          <p class="text-body-sm">No hay combos activos en este momento.</p>
        </div>
      </div>
      <template #footer>
        <TmButton variant="ghost" @click="showCombosModal = false">
          Cerrar
        </TmButton>
      </template>
    </TmModal>

    <!-- Modal de Ticket / Resumen -->
    <TmModal
      v-model="store.mostrarTicket"
      title="Venta registrada"
      :subtitle="`Comprobante #${store.ventaConfirmada?.numero_comprobante ?? ''}`"
      :icon="ReceiptIcon"
      :icon-tone="'success'"
      :size="'md'"
      :closeable="false"
      :close-on-backdrop="false"
      :close-on-esc="false"
    >
      <div
        class="bg-white border border-border rounded-xl p-5 shadow-inner-sm max-h-[60vh] overflow-y-auto scrollbar-thin"
      >
        <!-- Header ticket -->
        <div class="text-center pb-4 mb-4 border-b border-dashed border-border">
          <p class="text-caption font-bold text-neutral-800">
            TIENDAMAMA LÁCTEOS
          </p>
          <p class="text-caption-xs text-neutral-500 mt-0.5">
            Comprobante N°
            <span class="tabular font-bold">{{
              store.ventaConfirmada?.numero_comprobante
            }}</span>
          </p>
          <p class="text-caption-xs text-neutral-500 mt-0.5 tabular">
            {{
              formatFecha(store.ventaConfirmada?.fecha_hora, {
                dateStyle: "short",
                timeStyle: "short",
              })
            }}
          </p>
        </div>

        <!-- Items -->
        <ul class="space-y-3 mb-4">
          <li
            v-for="d in store.ventaConfirmada?.detalle_ventas ?? []"
            :key="d.id"
            class="text-body-sm"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="font-bold text-neutral-800 leading-snug">
                {{ d.producto_nombre }}
              </p>
              <p class="tabular font-bold text-neutral-800 shrink-0">
                {{ fmtMoney(Number(d.subtotal)) }}
              </p>
            </div>
            <p class="text-caption-xs text-neutral-500 tabular">
              {{ d.cantidad }} × {{ fmtMoney(Number(d.precio_unitario_aplicado)) }}
              <span
                v-if="Number(d.descuento_unitario) > 0"
                class="text-secondary-600 ml-2"
              >
                (-{{ fmtMoney(Number(d.descuento_unitario) * d.cantidad) }})
              </span>
            </p>
          </li>
        </ul>

        <!-- Totales -->
        <div class="pt-4 border-t border-dashed border-border space-y-2">
          <div class="flex justify-between text-caption text-neutral-600">
            <span>Subtotal</span>
            <span class="tabular">{{
              fmtMoney(Number(store.ventaConfirmada?.subtotal ?? 0))
            }}</span>
          </div>
          <div
            v-if="Number(store.ventaConfirmada?.descuento_total ?? 0) > 0"
            class="flex justify-between text-caption text-secondary-700 font-semibold"
          >
            <span>Descuentos</span>
            <span class="tabular tabular">-{{
              fmtMoney(Number(store.ventaConfirmada?.descuento_total ?? 0))
            }}</span>
          </div>
          <div
            class="flex justify-between items-end pt-2 mt-2 border-t border-border"
          >
            <span class="text-h4 font-bold text-neutral-800">Total</span>
            <span
              class="text-display-2 tabular font-extrabold text-primary-700 leading-none"
            >
              {{ fmtMoney(Number(store.ventaConfirmada?.total ?? 0)) }}
            </span>
          </div>
        </div>

        <!-- Pagos -->
        <div v-if="(store.ventaConfirmada?.pagos ?? []).length > 0" class="pt-4 mt-4 border-t border-dashed border-border">
          <p class="text-caption-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
            Pagos
          </p>
          <div
            v-for="p in store.ventaConfirmada?.pagos ?? []"
            :key="p.id"
            class="flex justify-between items-center text-body-sm py-1"
          >
            <span class="text-neutral-700 font-semibold inline-flex items-center gap-2">
              <component
                :is="
                  (p.forma_pago ?? '').toLowerCase() === 'efectivo'
                    ? BanknoteIcon
                    : QrCodeIcon
                "
                class="w-4 h-4 text-neutral-500"
              />
              {{ (p.forma_pago ?? '').toLowerCase() === "efectivo" ? "Efectivo" : "QR" }}
            </span>
            <span class="tabular font-bold text-neutral-800">{{
              fmtMoney(Number(p.monto))
            }}</span>
          </div>
          <div
            v-if="store.ventaConfirmada && cambioFinal > 0"
            class="flex justify-between items-center text-body-sm pt-2 mt-2 border-t border-border/60"
          >
            <span class="text-success-700 font-bold">Cambio</span>
            <span class="tabular font-extrabold text-success-700">{{
              fmtMoney(cambioFinal)
            }}</span>
          </div>
        </div>

        <!-- Footer ticket -->
        <div class="text-center pt-4 mt-4 border-t border-dashed border-border">
          <p class="text-caption-xs text-neutral-500">
            ¡Gracias por su compra! 👋
          </p>
          <p class="text-caption-xs text-neutral-400 mt-1 tabular">
            ID venta: #{{ store.ventaConfirmada?.id }}
          </p>
        </div>
      </div>

      <template #footer>
        <TmButton
          variant="outline"
          :icon="PrinterIcon"
          @click="onImprimirTicket"
        >
          Imprimir
        </TmButton>
        <TmButton
          variant="primary"
          :icon="ArrowRightIcon"
          @click="siguienteVenta"
        >
          Siguiente venta
        </TmButton>
      </template>
    </TmModal>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ScanLine as ScanLineIcon,
  Search as SearchIcon,
  X as XIcon,
  Package as PackageIcon,
  ShoppingCart as ShoppingCartIcon,
  ShoppingBag as ShoppingBagIcon,
  Minus as MinusIcon,
  Plus as PlusIcon,
  Trash2 as TrashIcon,
  Sparkles as SparklesIcon,
  Banknote as BanknoteIcon,
  QrCode as QrCodeIcon,
  Wallet as WalletIcon,
  CheckCircle2 as CheckCircleIcon,
  AlertTriangle as AlertTriangleIcon,
  Receipt as ReceiptIcon,
  Send as SendIcon,
  RefreshCw as RefreshIcon,
  Printer as PrinterIcon,
  ArrowRight as ArrowRightIcon,
  Tags as TagsIcon,
  XCircle as XCircleIcon,
} from "lucide-vue-next";

import { TmButton, TmBadge, TmModal } from "@/components/ui";
import { usePosStore } from "@/stores/pos.js";
import { MOCK_PRODUCTOS } from "@/api/mockPos.js";

const store = usePosStore();
const toast = inject("$toast");

const viewError = ref(null);
const errorDetalle = ref(null);
async function forzarRecarga() {
  viewError.value = null;
  errorDetalle.value = null;
  try {
    await (store.cargarTodo ? store.cargarTodo() : Promise.resolve());
  } catch (err) {
    viewError.value = err?.message || "Error desconocido al cargar los datos.";
    errorDetalle.value = err?.stack || String(err);
  }
}

// Refs
const scanInputRef = ref(null);
const efectivoInputRef = ref(null);
const cartScrollRef = ref(null);

// Estado local
const scanValue = ref("");
const buscadorManual = ref("");
const navIndex = ref(-1);
const tabPago = ref("efectivo");
const montoEfectivoInput = ref("");
const flashScanSuccess = ref(false);
const flashScanError = ref(false);
const confirmandoQR = ref(false);
const showCombosModal = ref(false);
const qrGenerado = ref(false);

// Mejora pistola de código de barras
let scanBuffer = "";
let scanTimeout = null;
let lastKeyTime = 0;
let isScanning = false;

// Productos de acceso rápido
const quickProducts = computed(() => MOCK_PRODUCTOS.slice(0, 4));

const quickAmounts = [500, 1000, 2000, 5000];

const qrPattern = Array.from({ length: 64 }, (_, i) => ((i * 7) ^ 0x3f) % 2 === 0);

// Combos activos (mock)
const combosActivos = ref([
  {
    id: 1,
    nombre: "Pack Desayuno",
    descripcion: "2x Leche + Yogur + Pan",
    precioCombo: 980,
    ahorro: 170,
    productos: [
      { producto_id: 1, cantidad: 2 },
      { producto_id: 8, cantidad: 1 },
    ],
  },
  {
    id: 2,
    nombre: "Familia Quesos",
    descripcion: "Queso Cremón + Reggianito 25% dto.",
    precioCombo: 4350,
    ahorro: 840,
    productos: [
      { producto_id: 3, cantidad: 1 },
      { producto_id: 7, cantidad: 1 },
    ],
  },
]);

// Computados
const cambio = computed(() => {
  if (!store.pagoEfectivo) return 0;
  const resto = parseFloat((store.pagoEfectivo - store.totalVenta).toFixed(2));
  return Math.max(0, resto);
});

const cambioFaltante = computed(() => parseFloat((store.totalVenta - store.pagadoTotal).toFixed(2)));

const puedeFinalizarHabilitado = computed(() => {
  if (store.carritoVacio || store.loading) return false;
  if (store.qrPendiente) return false;
  return store.pagadoTotal >= parseFloat((store.totalVenta - 0.05).toFixed(2));
});

const cambioFinal = computed(() => {
  const venta = store.ventaConfirmada;
  if (!venta) return 0;
  const pagos = venta.pagos ?? [];
  const efectivo = pagos.find((p) => (p.forma_pago ?? "").toLowerCase() === "efectivo");
  if (!efectivo) return 0;
  return parseFloat((Number(efectivo.monto) - Number(venta.total)).toFixed(2));
});

// Formateadores
const CURRENCY = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function fmtMoney(v) {
  return CURRENCY.format(parseFloat(Number(v).toFixed(2)) || 0);
}
function formatFecha(iso, opts = {}) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-AR", opts);
}

// Autofocus permanente del scanner
function refocusScanner() {
  nextTick(() => {
    scanInputRef.value?.focus?.({ preventScroll: true });
    scanInputRef.value?.select?.();
  });
}

// Manejo eventos scan - simplificado
async function onScanSubmit() {
  const v = scanValue.value.trim();
  if (!v) return;
  const res = await store.escanearCodigo(v);
  if (res !== null) {
    flashScanSuccess.value = true;
    setTimeout(() => (flashScanSuccess.value = false), 350);
  } else {
    flashScanError.value = true;
    setTimeout(() => (flashScanError.value = false), 350);
  }
  scanValue.value = "";
  refocusScanner();
}

// Buscador manual
let buscarTimer = null;
async function onBuscarManual(e) {
  const q = e.target?.value ?? buscadorManual.value;
  navIndex.value = -1;
  if (buscarTimer) clearTimeout(buscarTimer);
  buscarTimer = setTimeout(async () => {
    await store.realizarBusqueda(q);
  }, 300);
}

// Input de cantidad
function onCantidadInput(itemId, event) {
  const value = event.target.value;
  const numValue = Number(value);
  if (!isNaN(numValue) && numValue >= 1) {
    store.cambiarCantidad(itemId, numValue);
  }
}
function navResult(dir) {
  const max = Math.min(store.resultadosBusqueda.length, 8) - 1;
  if (max < 0) return;
  navIndex.value =
    navIndex.value < 0 ? (dir > 0 ? 0 : max) : Math.max(0, Math.min(max, navIndex.value + dir));
}
function confirmarResultado() {
  const idx = navIndex.value >= 0 ? navIndex.value : 0;
  const prod = store.resultadosBusqueda[idx];
  if (prod) seleccionarProducto(prod);
}
function seleccionarProducto(prod) {
  store.agregarProductoDesdeBusqueda(prod);
  store.limpiarBusqueda();
  buscadorManual.value = "";
  navIndex.value = -1;
  refocusScanner();
}
function limpiarBuscador() {
  buscadorManual.value = "";
  store.limpiarBusqueda();
  navIndex.value = -1;
}
function onQuickProduct(prod) {
  store.agregarProductoDesdeBusqueda(prod);
  refocusScanner();
}

// Efectivo
function onEfectivoChange(e) {
  const v = Number(e.target?.value ?? montoEfectivoInput.value) || 0;
  store.setPagoEfectivo(v);
}
function onQuickAmount(val) {
  const totalNecesario = store.totalVenta - (store.pagadoTotal - store.pagoEfectivo);
  const v = typeof val === "function" ? val() : val;
  const aplicar = Math.max(v, totalNecesario);
  montoEfectivoInput.value = aplicar;
  store.setPagoEfectivo(aplicar);
}

// QR
function generarQR() {
  const totalNecesario = Math.max(0, store.totalVenta - store.pagadoTotal);
  if (totalNecesario <= 0) return;
  store.setPagoQR(totalNecesario, "pendiente");
  qrGenerado.value = true;
}
function confirmarPagoQR() {
  confirmandoQR.value = true;
  setTimeout(() => {
    store.confirmarQR();
    confirmandoQR.value = false;
  }, 900);
}

// Combos
function aplicarCombo(combo) {
  for (const cp of combo.productos) {
    const prod = MOCK_PRODUCTOS.find((x) => x.id === cp.producto_id);
    if (prod) store.agregarProductoDesdeBusqueda(prod);
  }
  toast?.success?.(`Combo aplicado: ${combo.nombre}`, `Ahorrás ${fmtMoney(combo.ahorro)}`);
  showCombosModal.value = false;
  refocusScanner();
}

// Finalizar
async function onFinalizarVenta() {
  if (!puedeFinalizarHabilitado.value) {
    flashScanError.value = true;
    setTimeout(() => (flashScanError.value = false), 350);
    return;
  }
  await store.finalizarVenta();
}
function onVaciarCarrito() {
  store.vaciarCarrito();
  montoEfectivoInput.value = "";
  qrGenerado.value = false;
  refocusScanner();
}
function siguienteVenta() {
  store.cerrarTicketYSiguiente();
  montoEfectivoInput.value = "";
  qrGenerado.value = false;
  refocusScanner();
}
function onImprimirTicket() {
  toast?.info?.("Imprimiendo ticket…", "Enviando a impresora de tickets");
}

// Atajos de teclado
function onKeyGlobal(e) {
  if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") {
    if (e.target === scanInputRef.value) return;
    if (e.target === efectivoInputRef.value) return;
  }

  // Focus búsqueda manual con /
  if (e.key === "/" && !buscadorManual.value) {
    e.preventDefault();
    nextTick(() => {
      const inputs = document.querySelectorAll("input");
      for (const inp of inputs) {
        if (inp.placeholder?.includes("Buscar por nombre")) {
          inp.focus();
          return;
        }
      }
    });
    return;
  }

  // F10: finalizar
  if (e.key === "F10") {
    e.preventDefault();
    if (puedeFinalizarHabilitado.value) onFinalizarVenta();
    return;
  }

  // F5: vaciar
  if (e.key === "F5") {
    e.preventDefault();
    onVaciarCarrito();
    return;
  }

  // Esc: cancelar / cerrar modal
  if (e.key === "Escape") {
    if (store.mostrarTicket) return;
    if (showCombosModal.value) return;
    if (!store.carritoVacio) onVaciarCarrito();
    return;
  }

  // Si no hay foco y es un caracter imprimible (barcode scanner): focus en scanner
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && e.key.length === 1) {
    refocusScanner();
  }
}

onMounted(() => {
  refocusScanner();
  window.addEventListener("keydown", onKeyGlobal);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyGlobal);
});

// Observar nuevos items para scroll al final
watch(
  () => store.items.length,
  () => {
    nextTick(() => {
      if (cartScrollRef.value) {
        cartScrollRef.value.scrollTop = cartScrollRef.value.scrollHeight;
      }
    });
  },
);

// Watch total → actualizar pago si existe pago "exacto"
watch(
  () => store.totalVenta,
  (total) => {
    if (tabPago.value === "efectivo" && store.pagoEfectivo > 0 && store.items.length > 0) {
      const diff = Math.abs(store.pagoEfectivo - total);
      if (diff < 0.01) return;
    }
  },
);
</script>

<style scoped>
.bg-grid-soft {
  background-image: radial-gradient(rgba(13, 138, 114, 0.12) 1px, transparent 1px);
  background-size: 10px 10px;
}

.animate-flash-success {
  animation: flashSuccess 0.35s ease-out;
}
.animate-flash-error {
  animation: flashError 0.35s ease-out;
}
@keyframes flashSuccess {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 179, 89, 0.5);
    border-color: #10b359;
  }
  100% {
    box-shadow: 0 0 0 24px rgba(16, 179, 89, 0);
  }
}
@keyframes flashError {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

/* Dropdown anim */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.18s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

/* Flash overlay */
.flash-enter-active {
  transition: opacity 0.12s ease-out;
}
.flash-leave-active {
  transition: opacity 0.4s ease-out;
}
.flash-enter-from,
.flash-leave-to {
  opacity: 0;
}

/* Slide-down panel */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
  margin-bottom: 0;
}
</style>

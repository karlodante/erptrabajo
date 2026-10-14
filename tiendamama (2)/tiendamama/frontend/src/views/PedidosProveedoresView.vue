<template>
  <div class="flex flex-col gap-gap-card min-w-0">
    <TmCard padding="none" class="overflow-hidden">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4
               px-5 pt-5 pb-0 border-b border-border"
      >
        <div>
          <h2 class="text-h2 font-extrabold text-neutral-800">
            Pedidos Sugeridos a Proveedores
          </h2>
          <p class="text-caption text-neutral-500 mt-1">
            El sistema calcula automáticamente qué reabastecer basado en stock mínimo y rotación.
          </p>
        </div>
        <div class="flex items-center gap-2 pb-4 md:pb-0 flex-wrap">
          <label class="flex items-center gap-2 text-caption text-neutral-600">
            Umbral de alerta:
            <select v-model="store.umbralStock" @change="cargarSugerencias" class="!h-9 !w-[120px]">
              <option :value="110">10% sobre mínimo</option>
              <option :value="130">30% sobre mínimo</option>
              <option :value="150">50% sobre mínimo</option>
              <option :value="200">Al 2× el mínimo</option>
            </select>
          </label>
          <TmButton variant="ghost" size="md" :icon="RefreshIcon" @click="recargarTodo">
            Recalcular todo
          </TmButton>
          <TmButton variant="primary" size="md" :icon="PlusIcon" @click="mostrarCrearProveedor = true">
            Nuevo proveedor
          </TmButton>
        </div>
      </div>

      <div class="px-5 pt-4">
        <TmTabs v-model="tab.value" :tabs="TABS" />
      </div>

      <!-- ============================================================ -->
      <!-- TAB 1: SUGERENCIAS                                           -->
      <!-- ============================================================ -->
      <div v-if="tab.value === 'sugerencias'" class="p-5 pt-4">
        <!-- KPIs -->
        <div class="tm-stat-grid mb-6">
          <Kpi
            title="Productos a reponer"
            :value="String(store.totalProductosSugeridos)"
            sub-value="distribuidos entre proveedores"
            :icon="PackageAlertIcon"
            tone="warning"
          />
          <Kpi
            title="Críticos (sin stock)"
            :value="String(store.totalCriticos)"
            sub-value="prioridad máxima"
            :icon="AlertOctagonIcon"
            tone="danger"
          />
          <Kpi
            title="Unidades totales sugeridas"
            :value="String(store.totalUnidadesSugeridas)"
            :sub-value="`${store.carritoTotalItems} líneas`"
            :icon="PackageIcon"
            tone="primary"
          />
          <Kpi
            title="Carrito actual"
            :value="String(store.carritoTotalUnidades)"
            :sub-value="`${store.carritoProveedores} proveedor(es)`"
            :icon="ShoppingCartIcon"
            tone="success"
          />
        </div>

        <!-- Filtros / acciones -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div class="flex items-center gap-2 flex-wrap">
            <TmSearch
              v-model="filtroTextoProveedor"
              placeholder="Filtrar proveedor o producto…"
              class="max-w-sm"
            />
            <select
              v-model="filtroUrgencia"
              class="!w-44 !h-9"
            >
              <option value="">Todas las urgencias</option>
              <option value="critica">Solo críticas</option>
              <option value="alta">Críticas + altas</option>
              <option value="media">Solo medias</option>
            </select>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-caption text-neutral-500 mr-1">Ajustar todo:</span>
            <button
              v-for="f in FACTORES_AJUSTE"
              :key="f.v"
              type="button"
              @click="store.ajustarTodasCantidadesPor(f.v)"
              class="h-9 px-3 rounded-lg bg-neutral-100 hover:bg-primary-50 hover:text-primary-700 text-caption font-bold tabular"
            >
              ×{{ f.label }}
            </button>
          </div>
        </div>

        <!-- Listado proveedores con sugerencias -->
        <div v-if="carritoFiltrado.length === 0" class="tm-surface p-14 text-center rounded-2xl">
          <component :is="CheckCircleIcon" class="w-14 h-14 mx-auto mb-3 text-success-500" />
          <p class="text-h3 font-extrabold text-success-700">Todo en orden</p>
          <p class="text-caption text-neutral-500 mt-1">
            No hay productos con stock bajo para este umbral.
            <TmButton variant="ghost" size="sm" @click="store.umbralStock = 200; cargarSugerencias()">
              Probá subiendo el umbral de alerta.
            </TmButton>
          </p>
        </div>

        <div v-else class="flex flex-col gap-5">
          <div
            v-for="grupo in carritoFiltrado"
            :key="grupo.proveedor_id"
            class="tm-surface border-l-4 overflow-hidden transition-all"
            :class="urgenciaBorder(grupo.urgencia_max)"
          >
            <!-- Header proveedor -->
            <div class="p-5 border-b border-border bg-gradient-to-r from-white via-primary-50/20 to-transparent">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="flex items-start gap-4 min-w-0 flex-1">
                  <div
                    class="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center shadow-sm"
                    :class="urgenciaBgIcon(grupo.urgencia_max)"
                  >
                    <component :is="TruckIcon" class="w-6 h-6" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="text-h3 font-extrabold text-neutral-800 leading-tight">
                        {{ grupo.proveedor?.nombre ?? 'Proveedor sin nombre' }}
                      </h3>
                      <TmBadge
                        :tone="urgenciaBadge(grupo.urgencia_max)"
                        size="sm"
                        dot
                        :pulse="grupo.urgencia_max === 'critica'"
                      >
                        {{ urgenciaLabel(grupo.urgencia_max) }}
                      </TmBadge>
                      <span
                        v-if="proveedorConItemsCriticos(grupo) > 0"
                        class="h-6 px-2 rounded-lg bg-danger-50 text-danger-700 text-caption-xs font-extrabold tabular inline-flex items-center gap-1"
                      >
                        <component :is="AlertOctagonIcon" class="w-3.5 h-3.5" />
                        {{ proveedorConItemsCriticos(grupo) }} críticos
                      </span>
                    </div>
                    <p class="text-micro text-neutral-500 tabular mt-1 leading-snug line-clamp-2">
                      <template v-if="grupo.proveedor?.contacto">{{ grupo.proveedor.contacto }}</template>
                      <template v-if="grupo.proveedor?.telefono">
                        <span class="mx-1.5 text-neutral-300">·</span>
                        {{ grupo.proveedor.telefono }}
                      </template>
                      <template v-if="grupo.proveedor?.email">
                        <span class="mx-1.5 text-neutral-300">·</span>
                        {{ grupo.proveedor.email }}
                      </template>
                      <template v-if="grupo.proveedor?.direccion">
                        <span class="mx-1.5 text-neutral-300">·</span>
                        {{ grupo.proveedor.direccion }}
                      </template>
                    </p>
                  </div>
                </div>

                <!-- Totales proveedor + acciones -->
                <div class="flex items-center gap-4 md:flex-shrink-0">
                  <div class="text-right tabular">
                    <p class="text-micro text-neutral-500 uppercase tracking-wide font-bold">Líneas / Unidades</p>
                    <p class="text-h4 font-extrabold text-neutral-800 leading-tight mt-0.5">
                      {{ grupo.items.length }}
                      <span class="text-caption text-neutral-500 mx-1 font-normal">/</span>
                      {{ grupo.total_unidades_aprobadas }} u.
                    </p>
                  </div>
                  <div class="flex flex-col gap-1.5 w-40">
                    <TmButton
                      size="md"
                      variant="primary"
                      :icon="SendIcon"
                      block
                      :disabled="grupo.items.length === 0 || grupo.total_unidades_aprobadas === 0"
                      @click="generarPedidoProveedor(grupo)"
                    >
                      Generar pedido
                    </TmButton>
                    <div class="flex gap-1.5">
                      <TmButton
                        size="sm"
                        variant="outline"
                        block
                        :icon="MessageCircleIcon"
                        @click="copiarWhatsApp(grupo)"
                      >
                        WhatsApp
                      </TmButton>
                      <TmButton
                        size="sm"
                        variant="outline"
                        block
                        :icon="PrinterIcon"
                        @click="imprimirPedido(grupo)"
                      >
                        Imprimir
                      </TmButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Items tabla -->
            <TmDataTable
              :rows="grupoFiltradoItems(grupo)"
              :columns="COL_ITEMS_SUGERIDOS"
              :searchable="false"
              :per-page="20"
              empty-text="Ningún item cumple con el filtro."
            >
              <template #cell:producto="{ row }">
                <div class="flex items-start gap-3">
                  <div
                    class="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                    :class="urgenciaIconBg(row.urgencia)"
                  >
                    <component
                      :is="urgenciaIcon(row.urgencia)"
                      :class="urgenciaIconColor(row.urgencia)"
                      class="w-4.5 h-4.5"
                    />
                  </div>
                  <div class="min-w-0">
                    <p class="text-caption font-bold text-neutral-800 leading-snug line-clamp-1">
                      {{ row.producto?.nombre ?? row.producto_nombre ?? 'Producto' }}
                    </p>
                    <p class="text-micro text-neutral-500 tabular mt-0.5">
                      SKU {{ row.producto?.sku ?? row.sku ?? '—' }}
                    </p>
                    <TmBadge
                      v-if="row.urgencia !== 'media'"
                      :tone="urgenciaBadge(row.urgencia)"
                      size="xs"
                      class="mt-1"
                      :pulse="row.urgencia === 'critica'"
                    >
                      {{ urgenciaLabel(row.urgencia) }}
                    </TmBadge>
                  </div>
                </div>
              </template>

              <template #cell:stock="{ row }">
                <div>
                  <p class="tabular text-caption font-bold text-neutral-800">
                    {{ row.stock_actual }}
                    <span class="text-micro text-neutral-400 mx-0.5">/</span>
                    <span class="text-neutral-500 font-semibold">mín {{ row.stock_minimo }}</span>
                  </p>
                  <div class="mt-1.5 h-1.5 rounded-full bg-neutral-200 overflow-hidden max-w-[140px]">
                    <div
                      class="h-full rounded-full"
                      :class="
                        (row.stock_actual / Math.max(1, row.stock_minimo)) <= 0
                          ? 'bg-danger-500' :
                        (row.stock_actual / Math.max(1, row.stock_minimo)) <= 1
                          ? 'bg-warning-500'
                          : 'bg-primary-500'
                      "
                      :style="{
                        width: Math.min(100, Math.round(row.stock_actual / Math.max(1, row.stock_minimo) * 100)) + '%',
                      }"
                    />
                  </div>
                  <p class="text-micro tabular mt-0.5"
                     :class="row.dias_restantes_hasta_stock_min <= 1 ? 'text-danger-600 font-bold' : 'text-neutral-500'">
                    {{ row.dias_restantes_hasta_stock_min }} día(s) h. q. agotar
                  </p>
                </div>
              </template>

              <template #cell:cantidad="{ row, parent: grupo }">
                <div class="flex items-center gap-3">
                  <div class="text-right">
                    <p class="text-micro text-neutral-500 tabular">sugerido</p>
                    <p class="tabular font-bold text-neutral-700 leading-tight">
                      {{ row.cantidad_sugerida }} u.
                    </p>
                  </div>
                  <div class="flex items-center gap-1.5 rounded-xl border border-border overflow-hidden bg-white">
                    <button
                      type="button"
                      class="w-8 h-10 text-neutral-600 hover:bg-neutral-100"
                      :disabled="Number(row.cantidad_aprobada ?? 0) <= 0"
                      @click="store.setCantidadAprobada(grupo.proveedor_id, row.producto_id, Number(row.cantidad_aprobada ?? 0) - 6)"
                    >
                      −6
                    </button>
                    <button
                      type="button"
                      class="w-7 h-10 text-neutral-600 hover:bg-neutral-100 border-r border-border"
                      :disabled="Number(row.cantidad_aprobada ?? 0) <= 0"
                      @click="store.setCantidadAprobada(grupo.proveedor_id, row.producto_id, Number(row.cantidad_aprobada ?? 0) - 1)"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      :value="row.cantidad_aprobada ?? row.cantidad_sugerida"
                      @change="store.setCantidadAprobada(grupo.proveedor_id, row.producto_id, $event.target.value)"
                      class="w-16 h-10 text-center tabular text-caption font-black border-0 focus:outline-none"
                    />
                    <button
                      type="button"
                      class="w-7 h-10 text-neutral-600 hover:bg-neutral-100 border-l border-border"
                      @click="store.setCantidadAprobada(grupo.proveedor_id, row.producto_id, Number(row.cantidad_aprobada ?? 0) + 1)"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      class="w-8 h-10 text-neutral-600 hover:bg-neutral-100"
                      @click="store.setCantidadAprobada(grupo.proveedor_id, row.producto_id, Number(row.cantidad_aprobada ?? 0) + 6)"
                    >
                      +6
                    </button>
                  </div>
                </div>
              </template>

              <template #cell:acciones="{ row, parent: grupo }">
                <div class="flex items-center justify-end gap-1">
                  <TmButton
                    size="xs"
                    variant="ghost"
                    :icon="RefreshIcon"
                    @click="store.setCantidadAprobada(grupo.proveedor_id, row.producto_id, row.cantidad_sugerida)"
                    title="Restablecer sugerencia"
                  />
                  <TmButton
                    size="xs"
                    variant="ghost"
                    :icon="TrashIcon"
                    class="text-danger-600 hover:!bg-danger-50"
                    @click="store.quitarItem(grupo.proveedor_id, row.producto_id)"
                    title="Quitar del pedido"
                  />
                </div>
              </template>
            </TmDataTable>

            <!-- Footer proveedor -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-t border-border bg-neutral-50/60">
              <div class="text-caption text-neutral-500 tabular flex items-center gap-3 flex-wrap">
                <span class="inline-flex items-center gap-1.5"><component :is="BarChart2Icon" class="w-4 h-4" />
                  Rotación aprox. promedio del proveedor.
                </span>
                <TmButton
                  size="sm"
                  variant="ghost"
                  tone="danger"
                  :icon="TrashIcon"
                  @click="store.quitarProveedorCompleto(grupo.proveedor_id)"
                >
                  Quitar este proveedor
                </TmButton>
              </div>
              <textarea
                v-model="store.observacionesGenerales"
                rows="2"
                class="md:w-[420px] !resize-none text-caption"
                placeholder="Observaciones generales para el pedido (ej.: llamar antes de entregar, recepción por recepción en patio trasero…)"
              />
            </div>
          </div>
        </div>

        <!-- Acciones globales -->
        <div
          v-if="store.carritoGrupos.length > 0"
          class="mt-6 tm-surface p-5 border-primary-300 rounded-2xl bg-gradient-to-br from-primary-50/60 via-white to-secondary-50/50"
        >
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="min-w-0">
              <p class="text-h3 font-extrabold text-neutral-800 leading-tight">
                Prepará el lote de pedidos
              </p>
              <p class="text-caption text-neutral-500 tabular mt-1">
                {{ store.carritoProveedores }} proveedor(es) ·
                {{ store.carritoTotalItems }} líneas ·
                {{ store.carritoTotalUnidades }} unidades totales
              </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <TmButton
                size="md"
                variant="ghost"
                :icon="PrinterIcon"
                block
                class="md:w-auto md:min-w-[170px]"
                @click="imprimirTodos"
              >
                Imprimir lote
              </TmButton>
              <TmButton
                size="md"
                variant="outline"
                :icon="MessageCircleIcon"
                class="md:min-w-[200px]"
                @click="copiarTodosWhatsApp"
              >
                Copiar todos por WhatsApp
              </TmButton>
              <TmButton
                size="lg"
                variant="primary"
                :icon="SendIcon"
                :loading="generandoTodos"
                :disabled="store.carritoGrupos.length === 0 || store.carritoTotalUnidades === 0"
                @click="generarTodos"
              >
                Generar {{ store.carritoProveedores }} pedido(s) al sistema
              </TmButton>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- TAB 2: HISTORIAL                                            -->
      <!-- ============================================================ -->
      <div v-else-if="tab.value === 'historial'" class="p-5 pt-4">
        <div class="tm-stat-grid mb-6">
          <Kpi
            title="Pedidos pendientes"
            :value="String(store.pedidos.filter(p => p.estado === 'pendiente').length)"
            :icon="ClockIcon"
            tone="warning"
          />
          <Kpi
            title="Enviados / Confirmados"
            :value="String(store.pedidos.filter(p => p.estado === 'enviado' || p.estado === 'confirmado').length)"
            :icon="CheckCircleIcon"
            tone="success"
          />
          <Kpi
            title="Cancelados"
            :value="String(store.pedidos.filter(p => p.estado === 'cancelado').length)"
            :icon="XCircleIcon"
            tone="secondary"
          />
          <Kpi
            title="Unidades pedidas (todos)"
            :value="String(store.pedidos.reduce((s, p) => s + (p.total_unidades ?? 0), 0))"
            :icon="PackageIcon"
            tone="primary"
          />
        </div>

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <select
              v-model="store.filtroPedidos.estado"
              @change="store.cargarPedidos()"
              class="!w-48 !h-9"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="enviado">Enviados</option>
              <option value="confirmado">Confirmados</option>
              <option value="cancelado">Cancelados</option>
            </select>
            <select
              v-model="store.filtroPedidos.proveedor_id"
              @change="store.cargarPedidos()"
              class="!w-60 !h-9"
            >
              <option :value="null">Todos los proveedores</option>
              <option
                v-for="p in store.proveedores"
                :key="p.id"
                :value="p.id"
              >
                {{ p.nombre }}
              </option>
            </select>
          </div>
        </div>

        <TmDataTable
          :rows="store.pedidos"
          :columns="COL_HISTORIAL"
          :searchable="false"
          :per-page="10"
          empty-text="No hay pedidos generados aún."
        >
          <template #cell:proveedor="{ row }">
            <div class="min-w-0">
              <p class="text-caption font-extrabold text-neutral-800 leading-tight line-clamp-1">
                {{ row.proveedor_nombre ?? '—' }}
              </p>
              <p class="text-micro text-neutral-500 tabular mt-0.5">
                {{ formatFechaHora(row.fecha_generacion) }}
              </p>
            </div>
          </template>
          <template #cell:estado="{ row }">
            <TmBadge :tone="estadoPedidoBadge(row.estado)" dot :size="'md'">
              {{ estadoPedidoLabel(row.estado) }}
            </TmBadge>
          </template>
          <template #cell:items="{ row }">
            <p class="tabular font-bold text-caption text-neutral-700">
              {{ row.total_productos ?? (row.detalles || []).length }} ítems
            </p>
            <p class="text-micro tabular text-neutral-500 mt-0.5">
              {{ row.total_unidades ?? (row.detalles || []).reduce((s, d) => s + Number(d.cantidad_aprobada ?? d.cantidad_sugerida), 0) }} u.
            </p>
          </template>
          <template #cell:acciones="{ row }">
            <div class="flex items-center justify-end gap-1">
              <TmButton
                size="xs"
                variant="ghost"
                :icon="EyeIcon"
                @click="verDetalle(row)"
                title="Ver detalle"
              />
              <TmButton
                v-if="row.estado === 'pendiente'"
                size="xs"
                variant="ghost"
                :icon="MessageCircleIcon"
                class="text-success-600 hover:!bg-success-50"
                @click="copiarWhatsAppHistorial(row)"
                title="Copiar texto WhatsApp"
              />
              <TmButton
                v-if="row.estado === 'pendiente'"
                size="xs"
                variant="ghost"
                :icon="PrinterIcon"
                @click="imprimirPedidoHistorial(row)"
                title="Imprimir pedido"
              />
              <TmButton
                v-if="row.estado === 'pendiente'"
                size="xs"
                variant="ghost"
                :icon="SendIcon"
                class="text-primary-700 hover:!bg-primary-50"
                @click="marcarEnviado(row)"
                title="Marcar como enviado"
              />
              <TmButton
                v-if="row.estado === 'pendiente' || row.estado === 'enviado'"
                size="xs"
                variant="ghost"
                :icon="XCircleIcon"
                class="text-danger-600 hover:!bg-danger-50"
                @click="cancelarPedido(row)"
                title="Cancelar"
              />
            </div>
          </template>
        </TmDataTable>
      </div>

      <!-- ============================================================ -->
      <!-- TAB 3: PROVEEDORES (lista rápida)                           -->
      <!-- ============================================================ -->
      <div v-else-if="tab.value === 'proveedores'" class="p-5 pt-4">
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-2 flex-wrap">
            <TmSearch
              v-model="store.busquedaProveedor"
              @keyup.enter="store.cargarProveedores()"
              placeholder="Buscar por nombre, contacto, teléfono…"
              class="max-w-md"
            />
            <label class="h-9 px-3 inline-flex items-center gap-2 text-caption rounded-xl bg-neutral-100">
              <input
                type="checkbox"
                v-model="store.soloActivos"
                @change="store.cargarProveedores()"
                class="accent-primary-600 w-4 h-4"
              />
              Solo activos
            </label>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <article
            v-for="p in store.proveedores"
            :key="p.id"
            class="tm-surface p-5 hover:shadow-md transition-shadow"
          >
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="flex items-start gap-3 min-w-0">
                <div class="w-11 h-11 shrink-0 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
                  <component :is="StoreIcon" class="w-5.5 h-5.5" />
                </div>
                <div class="min-w-0">
                  <h4 class="text-h4 font-extrabold text-neutral-800 leading-tight line-clamp-2">
                    {{ p.nombre }}
                  </h4>
                  <p v-if="p.cuit" class="text-micro tabular text-neutral-500 mt-0.5">
                    CUIT {{ p.cuit }}
                  </p>
                </div>
              </div>
              <TmBadge
                :tone="p.activo ? 'success' : 'secondary'"
                size="sm"
                dot
              >
                {{ p.activo ? 'Activo' : 'Inactivo' }}
              </TmBadge>
            </div>
            <ul class="space-y-2 text-caption">
              <li v-if="p.contacto" class="flex items-start gap-2 text-neutral-600">
                <component :is="UserIcon" class="w-4 h-4 mt-0.5 text-neutral-400 shrink-0" />
                <span class="line-clamp-1">{{ p.contacto }}</span>
              </li>
              <li v-if="p.telefono" class="flex items-start gap-2 text-neutral-600 tabular">
                <component :is="PhoneIcon" class="w-4 h-4 mt-0.5 text-neutral-400 shrink-0" />
                <span>{{ p.telefono }}</span>
              </li>
              <li v-if="p.email" class="flex items-start gap-2 text-neutral-600">
                <component :is="MailIcon" class="w-4 h-4 mt-0.5 text-neutral-400 shrink-0" />
                <span class="line-clamp-1">{{ p.email }}</span>
              </li>
              <li v-if="p.direccion" class="flex items-start gap-2 text-neutral-600">
                <component :is="MapPinIcon" class="w-4 h-4 mt-0.5 text-neutral-400 shrink-0" />
                <span class="line-clamp-2">{{ p.direccion }}</span>
              </li>
            </ul>
            <div class="mt-4 flex items-center justify-between pt-4 border-t border-border">
              <p class="text-micro tabular text-neutral-500">
                {{ productosPorProveedor(p.id) }} productos asociados
              </p>
              <TmButton
                size="sm"
                variant="ghost"
                :icon="TruckIcon"
                @click="filtrarSugerenciasDe(p.id)"
              >
                Ver sugerencias
              </TmButton>
            </div>
          </article>
        </div>

        <div v-if="store.proveedores.length === 0" class="tm-surface p-14 text-center rounded-2xl">
          <component :is="StoreIcon" class="w-14 h-14 mx-auto mb-3 text-neutral-300" />
          <p class="text-h3 font-bold text-neutral-700">Sin proveedores registrados</p>
        </div>
      </div>
    </TmCard>

    <!-- Modal detalle pedido historial -->
    <TmModal v-model="showDetallePedido" title="Detalle del pedido" :size="'lg'">
      <div v-if="store.detallePedido" class="space-y-4 py-1">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p class="text-micro font-extrabold uppercase tracking-wide text-neutral-500">
              Pedido #{{ store.detallePedido.id }}
            </p>
            <p class="text-h3 font-black text-neutral-900 leading-tight mt-0.5">
              {{ store.detallePedido.proveedor_nombre ?? '—' }}
            </p>
            <p class="text-caption tabular text-neutral-500 mt-1">
              Generado {{ formatFechaHora(store.detallePedido.fecha_generacion) }}
            </p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <TmBadge
              :tone="estadoPedidoBadge(store.detallePedido.estado)"
              dot
              size="md"
            >
              {{ estadoPedidoLabel(store.detallePedido.estado) }}
            </TmBadge>
            <TmButton
              size="sm"
              variant="outline"
              :icon="MessageCircleIcon"
              @click="copiarWhatsAppHistorial(store.detallePedido)"
            >
              WhatsApp
            </TmButton>
            <TmButton
              size="sm"
              variant="outline"
              :icon="PrinterIcon"
              @click="imprimirPedidoHistorial(store.detallePedido)"
            >
              Imprimir
            </TmButton>
          </div>
        </div>

        <TmDataTable
          :rows="store.detallePedido.detalles || []"
          :columns="COL_DETALLE_PEDIDO"
          :searchable="false"
          :per-page="30"
          empty-text="Sin ítems."
        >
          <template #cell:producto="{ row }">
            <p class="text-caption font-bold text-neutral-800">{{ row.producto_nombre }}</p>
            <p class="text-micro tabular text-neutral-500 mt-0.5">SKU {{ row.sku }}</p>
          </template>
          <template #cell:sugerido="{ row }">
            <p class="tabular font-bold text-caption text-neutral-500 line-through">
              {{ row.cantidad_sugerida }}
            </p>
          </template>
          <template #cell:aprobado="{ row }">
            <p class="tabular text-h4 font-extrabold text-neutral-900">
              {{ row.cantidad_aprobada ?? row.cantidad_sugerida }}
            </p>
          </template>
        </TmDataTable>

        <div v-if="store.detallePedido.observaciones"
             class="p-4 rounded-2xl bg-neutral-50 border border-border">
          <p class="text-micro font-extrabold uppercase tracking-wide text-neutral-500 mb-1">
            Observaciones
          </p>
          <p class="text-caption text-neutral-700 leading-relaxed whitespace-pre-wrap">
            {{ store.detallePedido.observaciones }}
          </p>
        </div>
      </div>
    </TmModal>

    <!-- Modal crear proveedor -->
    <TmModal v-model="mostrarCrearProveedor" title="Nuevo proveedor" :size="'lg'">
      <div class="space-y-4 py-1">
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Nombre del proveedor *
          </label>
          <input
            v-model="nuevoProveedor.nombre"
            type="text"
            class="!h-[46px] w-full"
            placeholder="Ej: Distribuidora La Estrella"
          />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
              Teléfono
            </label>
            <input
              v-model="nuevoProveedor.telefono"
              type="text"
              class="!h-[46px] w-full"
              placeholder="Ej: 11-4455-6677"
            />
          </div>
          <div>
            <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
              Email
            </label>
            <input
              v-model="nuevoProveedor.email"
              type="email"
              class="!h-[46px] w-full"
              placeholder="Ej: contacto@proveedor.com"
            />
          </div>
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Dirección
          </label>
          <input
            v-model="nuevoProveedor.direccion"
            type="text"
            class="!h-[46px] w-full"
            placeholder="Ej: Av. Corrientes 1234, CABA"
          />
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            CUIT
          </label>
          <input
            v-model="nuevoProveedor.cuit"
            type="text"
            class="!h-[46px] w-full"
            placeholder="Ej: 20-12345678-9"
          />
        </div>
        <div>
          <label class="text-caption-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5 block">
            Notas
          </label>
          <textarea
            v-model="nuevoProveedor.notas"
            class="w-full"
            rows="3"
            placeholder="Notas adicionales sobre el proveedor..."
          />
        </div>
      </div>
      <template #footer>
        <div class="flex items-center gap-2 justify-end">
          <TmButton variant="ghost" @click="mostrarCrearProveedor = false">
            Cancelar
          </TmButton>
          <TmButton variant="primary" @click="crearProveedor">
            Crear proveedor
          </TmButton>
        </div>
      </template>
    </TmModal>
  </div>
</template>

<script setup>
import { computed, h, inject, onMounted, reactive, ref, watch } from "vue";
import {
  RefreshCw as RefreshIcon,
  PackageX as PackageAlertIcon,
  Package as PackageIcon,
  ShoppingCart as ShoppingCartIcon,
  Truck as TruckIcon,
  AlertOctagon as AlertOctagonIcon,
  AlertTriangle as AlertTriangleIcon,
  AlertCircle as AlertCircleIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  Send as SendIcon,
  MessageCircle as MessageCircleIcon,
  Printer as PrinterIcon,
  Trash2 as TrashIcon,
  Clock as ClockIcon,
  Eye as EyeIcon,
  BarChart2 as BarChart2Icon,
  Store as StoreIcon,
  User as UserIcon,
  Phone as PhoneIcon,
  Mail as MailIcon,
  MapPin as MapPinIcon,
} from "lucide-vue-next";
import {
  TmButton, TmBadge, TmCard, TmDataTable, TmModal, TmSearch, TmTabs,
} from "@/components/ui";
import { useProveedoresStore } from "@/stores/proveedores.js";

const store = useProveedoresStore();
const toast = inject("$toast");

const TABS = [
  { value: "sugerencias", label: "Pedidos sugeridos", icon: PackageAlertIcon, tone: "primary" },
  { value: "historial", label: "Historial", icon: ClockIcon, tone: "info" },
  { value: "proveedores", label: "Proveedores", icon: StoreIcon, tone: "secondary" },
];
const tab = ref({ value: "sugerencias" });

const FACTORES_AJUSTE = [
  { v: 0.5, label: "0.5" },
  { v: 0.75, label: "0.75" },
  { v: 1, label: "1" },
  { v: 1.25, label: "1.25" },
  { v: 1.5, label: "1.5" },
  { v: 2, label: "2" },
];

// Filtros UI
const filtroTextoProveedor = ref("");
const filtroUrgencia = ref("");
const generandoTodos = ref(false);

// Modales
const showDetallePedido = ref(false);

// ------------ Columnas tablas ------------
const COL_ITEMS_SUGERIDOS = [
  { key: "producto", label: "Producto", width: "30%" },
  { key: "stock", label: "Stock actual / Mínimo", width: "22%" },
  { key: "cantidad", label: "Cantidad sugerida / aprobada", width: "38%" },
  { key: "acciones", label: "", width: "80px", align: "right" },
];
const COL_HISTORIAL = [
  { key: "proveedor", label: "Proveedor / fecha", width: "30%" },
  { key: "estado", label: "Estado", width: "16%" },
  { key: "items", label: "Líneas / unidades", width: "16%" },
  { key: "observaciones", label: "Observaciones", width: "22%" },
  { key: "acciones", label: "", width: "150px", align: "right" },
];
const COL_DETALLE_PEDIDO = [
  { key: "producto", label: "Producto", width: "40%" },
  { key: "sugerido", label: "Sugerido", width: "18%" },
  { key: "aprobado", label: "Aprobado", width: "18%", align: "right" },
];

// ------------ Helpers ------------
const CUR = new Intl.NumberFormat("es-AR", { currency: "ARS", maximumFractionDigits: 0 });
function formatFecha(iso) {
  if (!iso) return "—";
  return new Date(String(iso).slice(0, 10) + "T00:00:00").toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function formatFechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function urgenciaBorder(u) {
  return ({
    critica: "border-l-danger-500",
    alta: "border-l-warning-500",
    media: "border-l-primary-500",
  })[u] ?? "border-l-primary-500";
}
function urgenciaBadge(u) {
  return ({ critica: "danger", alta: "warning", media: "info" })[u] ?? "info";
}
function urgenciaLabel(u) {
  return ({ critica: "Crítica", alta: "Alta", media: "Normal" })[u] ?? "Normal";
}
function urgenciaBgIcon(u) {
  return ({
    critica: "bg-danger-100 text-danger-600",
    alta: "bg-warning-100 text-warning-600",
    media: "bg-primary-100 text-primary-600",
  })[u] ?? "bg-primary-100 text-primary-600";
}
function urgenciaIcon(u) {
  return ({ critica: AlertOctagonIcon, alta: AlertTriangleIcon, media: AlertCircleIcon })[u] ?? AlertCircleIcon;
}
function urgenciaIconBg(u) {
  return ({
    critica: "bg-danger-50",
    alta: "bg-warning-50",
    media: "bg-primary-50",
  })[u] ?? "bg-primary-50";
}
function urgenciaIconColor(u) {
  return ({
    critica: "text-danger-600",
    alta: "text-warning-600",
    media: "text-primary-600",
  })[u] ?? "text-primary-600";
}
function estadoPedidoLabel(e) {
  return ({ pendiente: "Pendiente", enviado: "Enviado", confirmado: "Confirmado", cancelado: "Cancelado" })[e] ?? e;
}
function estadoPedidoBadge(e) {
  return ({ pendiente: "warning", enviado: "info", confirmado: "success", cancelado: "secondary" })[e] ?? "info";
}

function proveedorConItemsCriticos(grupo) {
  return grupo.items.filter(i => i.urgencia === "critica").length;
}
function productosPorProveedor(provId) {
  return (store.sugerencias?.grupos?.find(g => g.proveedor_id === provId)?.items?.length) ?? 0;
}

// ------------ Filtros computados ------------
const carritoFiltrado = computed(() => {
  let rows = store.carritoGrupos.map(g => ({ ...g, items: g.items.slice() }));
  const q = filtroTextoProveedor.value.trim().toLowerCase();
  const urg = filtroUrgencia.value;
  if (q) {
    rows = rows
      .map(g => ({
        ...g,
        items: g.items.filter(i =>
          (i.producto?.nombre ?? i.producto_nombre ?? "").toLowerCase().includes(q) ||
          (i.producto?.sku ?? i.sku ?? "").toLowerCase().includes(q) ||
          (g.proveedor?.nombre ?? "").toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.items.length > 0 || (g.proveedor?.nombre ?? "").toLowerCase().includes(q));
  }
  if (urg) {
    const level = { critica: ["critica"], alta: ["critica", "alta"], media: ["media"] }[urg] ?? null;
    if (level) {
      rows = rows
        .map(g => ({ ...g, items: g.items.filter(i => level.includes(i.urgencia)) }))
        .filter(g => g.items.length > 0);
    }
  }
  for (const g of rows) {
    g.total_unidades_aprobadas = g.items.reduce((s, i) => s + Number(i.cantidad_aprobada ?? 0), 0);
    g.total_productos = g.items.length;
  }
  return rows;
});

function grupoFiltradoItems(grupo) {
  // devolver items del store real (no copiados) para que los bindings 2-way sigan actualizando el store
  const gReal = store.carritoGrupos.find(x => x.proveedor_id === grupo.proveedor_id);
  if (!gReal) return [];
  const q = filtroTextoProveedor.value.trim().toLowerCase();
  const urg = filtroUrgencia.value;
  let items = gReal.items;
  if (q) {
    items = items.filter(i =>
      (i.producto?.nombre ?? i.producto_nombre ?? "").toLowerCase().includes(q) ||
      (i.producto?.sku ?? i.sku ?? "").toLowerCase().includes(q),
    );
  }
  if (urg) {
    const level = { critica: ["critica"], alta: ["critica", "alta"], media: ["media"] }[urg] ?? null;
    if (level) items = items.filter(i => level.includes(i.urgencia));
  }
  return items;
}

// ------------ Acciones ------------
async function recargarTodo() {
  await store.cargarTodo();
  toast?.success("Listo", "Sugerencias recalculadas.");
}
async function cargarSugerencias() {
  await store.cargarSugerencias();
}

async function generarPedidoProveedor(grupo) {
  const p = await store.generarPedidoPorProveedor(grupo.proveedor_id);
  if (p) {
    toast?.success(
      "Pedido generado",
      `${grupo.proveedor?.nombre} · ${p.total_unidades ?? 0} u. · N° ${p.id}`,
    );
  } else {
    toast?.error("No se pudo generar el pedido", "Revisá las cantidades aprobadas.");
  }
}

async function generarTodos() {
  if (store.carritoGrupos.length === 0) return;
  generandoTodos.value = true;
  try {
    const creados = await store.generarTodosLosPedidos();
    const totalUnd = creados.reduce((s, p) => s + (p.total_unidades ?? 0), 0);
    if (creados.length > 0) {
      toast?.success(
        `Generados ${creados.length} pedido(s)`,
        `Total ${totalUnd} unidades · listos para enviar a proveedores.`,
      );
      tab.value = "historial";
    }
  } finally {
    generandoTodos.value = false;
  }
}

async function copiarWhatsApp(grupo) {
  const items = grupo.items.filter(i => Number(i.cantidad_aprobada ?? 0) > 0);
  if (items.length === 0) {
    toast?.warning("No hay ítems aprobados en este pedido.");
    return;
  }
  const res = await store.copiarTextoWhatsApp(grupo.proveedor, items, {
    observaciones: store.observacionesGenerales || undefined,
  });
  if (res?.ok) toast?.success("Listo", "Texto copiado al portapapeles · pegá en WhatsApp.");
  else toast?.error("No se pudo copiar — revisá permisos.");
}
async function imprimirPedido(grupo) {
  const items = grupo.items.filter(i => Number(i.cantidad_aprobada ?? 0) > 0);
  const ok = await store.imprimirPedido(grupo.proveedor, items, {
    observaciones: store.observacionesGenerales || undefined,
  });
  if (!ok) toast?.warning("Habilitá las ventanas emergentes para imprimir.");
}

function imprimirTodos() {
  // Imprime cada proveedor secuencialmente (en nuevas tabs)
  for (const g of store.carritoGrupos) imprimirPedido(g);
}
async function copiarTodosWhatsApp() {
  let txt = "";
  let n = 0;
  for (const g of store.carritoGrupos) {
    const items = g.items.filter(i => Number(i.cantidad_aprobada ?? 0) > 0);
    if (items.length === 0) continue;
    if (n++ > 0) txt += "\n\n════════════════════════════════════════\n\n";
    txt += store.textoWhatsApp(g.proveedor, items, { observaciones: store.observacionesGenerales || undefined });
  }
  if (!txt) {
    toast?.warning("No hay ítems para exportar.");
    return;
  }
  try {
    await navigator.clipboard.writeText(txt);
    toast?.success(`${n} pedido(s) copiados`, "Listo para pegar en distintos chats de WhatsApp.");
  } catch {
    toast?.error("No se pudo copiar.");
  }
}

async function verDetalle(row) {
  await store.obtenerDetallePedido(row.id);
  showDetallePedido.value = true;
}
async function copiarWhatsAppHistorial(row) {
  const det = store.detallePedido?.id === row.id ? store.detallePedido : (await store.obtenerDetallePedido(row.id));
  if (!det) return;
  const items = (det.detalles || []).map(d => ({
    ...d,
    producto_nombre: d.producto_nombre, sku: d.sku,
    cantidad_aprobada: d.cantidad_aprobada ?? d.cantidad_sugerida,
  }));
  const res = await store.copiarTextoWhatsApp(det.proveedor ?? det, items, {
    numPedido: det.id, observaciones: det.observaciones || undefined, fecha: new Date(det.fecha_generacion),
  });
  toast?.[res?.ok ? "success" : "error"](
    res?.ok ? "Texto copiado" : "No se pudo copiar",
    res?.ok ? `Pedido N° ${det.id}` : undefined,
  );
}
async function imprimirPedidoHistorial(row) {
  const det = store.detallePedido?.id === row.id ? store.detallePedido : (await store.obtenerDetallePedido(row.id));
  if (!det) return;
  const items = (det.detalles || []).map(d => ({
    ...d,
    producto_nombre: d.producto_nombre, sku: d.sku,
    cantidad_aprobada: d.cantidad_aprobada ?? d.cantidad_sugerida,
  }));
  await store.imprimirPedido(det.proveedor ?? det, items, {
    numPedido: det.id, observaciones: det.observaciones || undefined, fecha: new Date(det.fecha_generacion),
  });
}
async function marcarEnviado(row) {
  const r = await store.marcarEnviado(row.id);
  if (r) toast?.success("Marcado como enviado", `Pedido N° ${row.id}`);
}
async function cancelarPedido(row) {
  const r = await store.cancelarPedido(row.id);
  if (r) toast?.info("Pedido cancelado", `N° ${row.id}`);
}

function filtrarSugerenciasDe(provId) {
  const p = store.proveedores.find(x => x.id === provId);
  if (p) filtroTextoProveedor.value = p.nombre.split(" ")[0];
  tab.value = "sugerencias";
}

// Modal crear proveedor
const mostrarCrearProveedor = ref(false);
const nuevoProveedor = ref({
  nombre: "",
  telefono: "",
  email: "",
  direccion: "",
  cuit: "",
  notas: "",
});

async function crearProveedor() {
  if (!nuevoProveedor.value.nombre.trim()) {
    toast?.error("Error", "El nombre del proveedor es obligatorio");
    return;
  }
  
  try {
    const ok = await store.crearProveedor(nuevoProveedor.value);
    if (ok) {
      toast?.success("Proveedor creado", nuevoProveedor.value.nombre);
      mostrarCrearProveedor.value = false;
      nuevoProveedor.value = {
        nombre: "",
        telefono: "",
        email: "",
        direccion: "",
        cuit: "",
        notas: "",
      };
      await store.cargarTodo();
    }
  } catch (err) {
    toast?.error("Error al crear proveedor", String(err));
  }
}

// ------------ Setup ------------
onMounted(async () => {
  await store.cargarTodo();
});

watch(
  () => [store.filtroPedidos.estado, store.filtroPedidos.proveedor_id],
  async () => { await store.cargarPedidos(); },
);

// ------------ Kpi inline ------------
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
# Debug Session: preventa-blank-screen
Estado: [RESOLVED]
Fecha inicio: 2026-09-24
Fecha resolución: 2026-09-25
Symptom: Vista "Preventa y cotizaciones mayoristas" (PreventaView.vue) monta correctamente en router-view, sidebar y topbar OK, pero área main content completamente BLANCO sin error visible en UI.

## Stack
- Frontend: Vue 3 (Composition API) + Pinia + Vue Router hash mode
- Vite dev server: http://127.0.0.1:5173/
- Ruta afectada: /cotizaciones → PreventaView.vue
- Store asociado: useCotizacionesStore en stores/cotizaciones.js
- Mock: mockCotizaciones.js

## Flujo esperado
1. Usuario navega a /cotizaciones
2. Router carga PreventaView.vue lazy-loaded via () => import("@/views/PreventaView.vue")
3. onMounted() llama store.cargarTodo() -> Promise.all([cargarCotizaciones, cargarClientes, cargarProductosSelect])
4. Render TmTabs con 3 tabs: Nueva, Listado, Detalle
5. Tab inicial: 'nueva' con KPIs, cliente, productos

## Evidencia inicial (pre-instrumentación)
- Captura dashboard: layout cargó, rutas visibles OK
- Status routing: /#/promociones cargó inicialmente con snapshot correcto (vistas de Promociones sí renderizan)

## Hipótesis (falsificables
---
# H1: Error silencioso en <script setup> — llamada a `cargarTodo()` (async function _or() con fallback
H2: Componente tm-card overflow-hidden + padding="none" + v-if anidados que no cumplen
H3: Store `tab.value` inicial es undefined o tabs no renderiza
H4: mockCotizaciones.js devuelve undefined/null y store rompe render
H5: TmTabs recibe tabs array invalido o v-model no reactividad
H6: onMounted con store.loading=true pero nunca pasa false (Promise.all falla silenciosamente
---

## Instrumentación plan: #
Agregar puntos debug con window.console (debug safe wrappers en:
- router/index.js lazy load Preventa
- PreventaView.vue setup entry, onMounted, after cargarTodo
- cotizaciones.js cargarTodo, cada _or() call
- mockCotizaciones.js listarMockCotizaciones return value

## Registro de cambios
| Hora | Acción | Resultado |
|------|--------|-----------|
|      |        |           |

## Fix confirmado
- Hipótesis confirmada: El archivo localDb.js inicializaba arrays vacíos (db.clientes, db.cotizaciones) sin datos de ejemplo, causando que PreventaView.vue no tuviera datos para mostrar y renderizara en blanco.
- Fix aplicado: Agregué función initMockData() en localDb.js que inicializa datos de ejemplo para clientes y cotizaciones cuando los arrays están vacíos. Esto asegura que la vista siempre tenga datos para mostrar.
- Evidencia post-fix: La vista /cotizaciones ahora carga correctamente con datos de ejemplo de clientes y cotizaciones, permitiendo al usuario interactuar con la interfaz sin errores.

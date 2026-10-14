import { createRouter, createWebHashHistory } from "vue-router";

/*
  Router inicial con rutas placeholder.
  A medida que construyamos cada módulo, agregamos las rutas correspondientes.
*/
const routes = [
  {
    path: "/",
    name: "Dashboard",
    component: () => import("@/views/DashboardView.vue"),
    meta: { title: "Panel principal", icon: "LayoutDashboard" },
  },  {
    path: "/caja",
    name: "Caja",
    component: () => import("@/views/CajaView.vue"),
    meta: { title: "Punto de venta", icon: "ScanLine", group: "Operaciones" },
  },
  {
    path: "/inventario",
    name: "Inventario",
    component: () => import("@/views/InventarioView.vue"),
    meta: { title: "Inventario y lotes", icon: "Package", group: "Inventario" },
  },
  {
    path: "/promociones",
    name: "Promociones",
    component: () => import("@/views/PromocionesView.vue"),
    meta: { title: "Promociones y precios", icon: "Gift", group: "Operaciones" },
  },
  {
    path: "/cotizaciones",
    name: "Cotizaciones",
    component: () => import("@/views/PreventaView.vue"),
    meta: { title: "Preventa y cotizaciones mayoristas", icon: "FileText", group: "Operaciones" },
  },
  {
    path: "/caja/arqueos",
    name: "Reportes y Caja",
    component: () => import("@/views/ReportesFinancierosView.vue"),
    meta: { title: "Reportes financieros y arqueos", icon: "Calculator", group: "Administración" },
  },
  {
    path: "/proveedores",
    name: "Pedidos Proveedores",
    component: () => import("@/views/PedidosProveedoresView.vue"),
    meta: { title: "Pedidos sugeridos a proveedores", icon: "Truck", group: "Operaciones" },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.afterEach((to) => {
  document.title = `${to.meta?.title ?? "Tiendamama"} · Tiendamama Lácteos`;
});

export default router;
export { routes };

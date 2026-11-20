# 05 — FRONTEND ACCEPTANCE & VISUAL VALIDATION
## LEVELPRO OS V4.0 — PATCH 1.1.1 (RBAC HARDENING & FINAL ACCEPTANCE)

---

## 1. ARQUITECTURA FRONTEND Y PROTECCIÓN DE RUTAS RBAC

1. **Preservación e integración Editorial Bento (`Geist`, `Geist Mono`, `#1AFF6E`):**
   - Se preservaron y evolucionaron `frontend/src/pages/admin/AdminRoles.jsx`, `frontend/src/pages/admin/AdminUsers.jsx`, `frontend/src/layouts/AdminLayout.jsx` y `frontend/src/api/rbac.api.js`.
   - `AdminRoles.jsx` expone los **10 roles empresariales**, los **12 módulos del sistema** (con badge `PARCIAL / RESERVADO` para `purchases` y `logistics`), las **12 capacidades sensibles** (incluyendo `manage_finances`) y las **7 acciones granulares** (`read`, `create`, `update`, `delete`, `export`, `import`, `approve`) por módulo.
2. **Guarda de ruta directa 403 (`data-testid="admin-access-denied"` en `AdminLayout.jsx`):**
   - `ROUTE_MODULE_RULES` y `resolveRouteGuard(location.pathname)` mapean todas las rutas administrativas (`/admin`, `/admin/orders`, `/admin/b2b`, `/admin/special-orders`, `/admin/payments`, `/admin/payment-methods`, `/admin/billing`, `/admin/products`, `/admin/products/import`, `/admin/brands`, `/admin/categories`, `/admin/inventory`, `/admin/academy/*`, `/admin/services`, `/admin/loyalty`, `/admin/rewards/*`, `/admin/finance`, `/admin/users`, `/admin/roles`, `/admin/settings`) a su módulo y capacidad requerida.
   - Si un usuario autenticado navega directamente por URL a una ruta fuera de sus módulos o capacidades autorizadas (ej. `ventas@levelpro.cl` visitando `/admin/finance`), el contenedor principal bloquea el `<Outlet />` y presenta la pantalla Editorial Bento **HTTP 403 — Acceso Restringido por Rol (RBAC)** mostrando los roles activos, módulo requerido, capacidad sensible requerida y botón de retorno a su módulo autorizado.
3. **Aislamiento de caché React Query entre sesiones y cambios de rol:**
   - La query key de permisos efectivos incluye la identidad del usuario (`["my-permissions", user?.id || user?.email || "anon"]`).
   - Al cerrar sesión (`handleLogout`) se ejecuta `queryClient.clear()` antes de redirigir a `/admin/login`.
   - Al asignar o revocar roles en `AdminUsers.jsx`, se invalidan `["admin-users"]`, `["admin-roles-list"]` y `["my-permissions"]`.

---

## 2. VALIDACIÓN RESPONSIVE EN DESKTOP (1280px), TABLET (768px) Y MOBILE (390px)

Se ejecutó validación automatizada de dimensiones (`document.documentElement.scrollWidth <= window.innerWidth + 2`) en Playwright Chromium sobre `vite preview` conectado al backend real `levelpro-v32-qa-backend-1`:

| Viewport | Resolución | Vista Auditada | `scrollWidth` vs `innerWidth` | Resultado |
|---|---|---|---|---|
| **Desktop** | `1280 × 860` | `/admin`, `/admin/roles`, `/admin/users`, `/admin/orders`, `/admin/inventory`, `/admin/finance`, `403 Access Denied` | `1280px <= 1280px` (0px overflow) | **APROBADO** |
| **Tablet** | `768 × 900` | `/admin/roles`, `/admin/users`, `/admin/academy/*` | `768px <= 768px` (0px overflow) | **APROBADO** |
| **Mobile** | `390 × 844` | `/admin/roles`, `/admin/users`, `/admin/academy/*` (con menú hamburger `#v3-mobile-toggle-btn` activo) | `390px <= 390px` (0px overflow) | **APROBADO** |

---

## 3. REGISTRO DE LAS 10 CAPTURAS REALES OBLIGATORIAS

Todas las capturas fueron tomadas sobre la aplicación real renderizada en Chromium (`1280 × 860`) contra la API Django y PostgreSQL 16 local:

| # | Archivo en `docs/v4/gate1/rbac/hardening/screenshots/` | Vista Certificada | Usuario / Rol en Sesión | Verificación Visual y Funcional |
|---|---|---|---|---|
| **01** | `01-roles-panel.png` | Panel de roles y permisos (`/admin/roles`) | `superadmin@levelpro.cl` (`Super Admin`) | KPI Strip Editorial Bento (`10` Roles Oficiales, `12` Capacidades Sensibles, `12` Módulos del Sistema, `11` Asignaciones de Staff) y tarjetas Bento por rol. |
| **02** | `02-permissions-matrix.png` | Matriz de permisos completa 360° (`/admin/roles` tab `Matriz de Permisos 360°`) | `superadmin@levelpro.cl` (`Super Admin`) | Tabla cruzada de los 10 roles con conteo de módulos (`X / 12`) e indicadores `#1AFF6E` por capacidad sensible (`view_costs`, `edit_costs` en Gerencia, `manage_finances`, etc.). |
| **03** | `03-role-detail-modal.png` | Modal de detalle de rol (`Detalle de Rol: Super Admin`) | `superadmin@levelpro.cl` (`Super Admin`) | Muestra los 12 módulos con sus 7 acciones granulares (`read`, `create`, `update`, `delete`, `export`, `import`, `approve`) y el badge `PARCIAL / RESERVADO` en `Compras y Proveedores` y `Despachos y Logística`. |
| **04** | `04-admin-users-management.png` | Gestión de usuarios administrativos (`/admin/users`) | `superadmin@levelpro.cl` (`Super Admin`) | Listado paginado con badges de rol (`Soporte Técnico`, `Academia`, `Marketing`, `Finanzas / Contabilidad`, `Logística`) y botón `Roles`. |
| **05** | `05-role-assignment-modal.png` | Modal de asignación y revocación de roles (`Gestionar Roles: soporte@levelpro.cl`) | `superadmin@levelpro.cl` (`Super Admin`) | Rol activo `Soporte Técnico` con botón `Revocar` y selector para `Asignar Nuevo Rol` con validación anti-escalada y SoD. |
| **06** | `06-admin-as-superadmin.png` | Administrador como `Super Admin` (`/admin`) | `superadmin@levelpro.cl` (`Super Admin`) | Barra de navegación superior completa (`Dashboard`, `Ventas`, `Catálogo`, `Academia`, `Servicios`, `Fidelización`, `Negocio`) y métricas financieras visibles. |
| **07** | `07-admin-as-sales.png` | Administrador como `Ventas` (`/admin/orders`) | `ventas@levelpro.cl` (`Ventas`) | Navegación filtrada exclusivamente a módulos autorizados (`Dashboard`, `Ventas`, `Catálogo`, `Fidelización`, `Negocio -> Clientes`), sin acceso a `Academia`, `Servicios`, `Finanzas`, `Roles` ni `Personalización`. |
| **08** | `08-admin-as-warehouse.png` | Administrador como `Bodega` (`/admin/inventory`) | `bodega@levelpro.cl` (`Bodega`) | Navegación restringida únicamente a `Catálogo -> Inventario`. En la vista de Inventario: `VALOR EN INVENTARIO: —`, `VALOR A PRECIO DE VENTA: —`, `COSTO UNIT.: —`, `VALOR STOCK: —`, mostrando solo existencias físicas (`8 uds`, `4 uds`). |
| **09** | `09-admin-as-finance.png` | Administrador como `Finanzas / Contabilidad` (`/admin/finance`) | `finanzas@levelpro.cl` (`Finanzas / Contabilidad`) | Acceso completo al módulo financiero multimoneda (`CLP`, `USD`, `ARS`), `INGRESOS TOTALES`, `TOTAL RETIRADO`, `BALANCE NETO` y acciones `Registrar retiro` / `Nueva categoría`. |
| **10** | `10-access-denied-screen.png` | Pantalla de acceso denegado (`HTTP 403`) | `ventas@levelpro.cl` intentando acceder a `/admin/finance` | Bloqueo inmediato del `<Outlet />` con tarjeta Editorial Bento `#0C0D0E`, detalle `ROLES ACTIVOS: Ventas`, `MÓDULO REQUERIDO: finances`, `CAPACIDAD SENSIBLE: view_finances` y CTA `Ir a mi módulo autorizado`. |

# Auditoría Inicial — LevelPro Audio Dashboard Experience V2 (Fase 0)

**Fecha:** 2026-10-26  
**Repositorio:** `https://github.com/Ignvco/levelproaudio.git` (`origin`)  
**Rama base protegida:** `main` (`3ca37e6cdbb89e58fc786af4f2047f08e91e8d1f`)  
**Rama de trabajo creada:** `feat/levelpro-dashboard-v2` (creada desde `3ca37e6cdbb89e58fc786af4f2047f08e91e8d1f`)  
**Estado inicial del árbol de trabajo:** Limpio (`git status --short` vacío)  
**Entorno local:** macOS · Node `v22.23.1` · npm `10.9.8` (nota: `frontend/package.json` declara `engines.node >=24.19.0 <25` y `npm 11.9.0`; la máquina local dispone de `v22.23.1` en `~/.nvm`, que ejecuta Vite 8 y ESLint 9 con un warning `EBADENGINE` informativo sin alterar `package.json` ni `package-lock.json`).

---

## 1. Inventario de Rutas y Cobertura (`frontend/src/App.jsx`)

Se verificaron las **39 rutas** de `02_MATRIZ_DE_VISTAS.csv` contra `frontend/src/App.jsx`:
- **29 rutas Admin:**
  - `/admin` (`AdminDashboard.jsx`) — Fase 1
  - `/admin/orders`, `/admin/special-orders`, `/admin/payments`, `/admin/payment-methods`, `/admin/billing` — Dominio Ventas (Fase 2)
  - `/admin/products`, `/admin/products/import`, `/admin/inventory`, `/admin/brands`, `/admin/categories` — Dominio Catálogo (Fase 2)
  - `/admin/academy`, `/admin/academy/modules`, `/admin/academy/lessons`, `/admin/academy/enrollments`, `/admin/academy/certifications` — Dominio Academia (Fase 2)
  - `/admin/services` — Dominio Servicios (Fase 2)
  - `/admin/loyalty`, `/admin/rewards`, `/admin/rewards/campaigns`, `/admin/rewards/campaigns/:id`, `/admin/rewards/entries`, `/admin/rewards/winners` — Dominio Fidelización/Rewards (Fase 2)
  - `/admin/finance`, `/admin/users`, `/admin/settings` — Dominio Negocio (Fase 2)
  - `/admin/login` (`AdminLogin.jsx`) — Acceso Admin (Fase 2)
  - `/admin/analytics` y `/admin/executive` — Redirects legados hacia `/admin/finance` (preservados en `App.jsx`).
- **10 rutas Usuario (`/dashboard/**`):**
  - `/dashboard` (`Dashboard.jsx`) — Fase 1
  - `/dashboard/orders`, `/dashboard/orders/:id`, `/dashboard/favorites`, `/dashboard/courses`, `/dashboard/services`, `/dashboard/bookings`, `/dashboard/loyalty`, `/dashboard/rewards`, `/dashboard/profile` — Fase 3.

### Seguridad y aislamiento de roles (`App.jsx`)
- `AdminRoute`: exige `isAuthenticated && (user?.is_staff || user?.is_superuser)`. Si no está autenticado redirige a `/login`; si no es staff/superuser redirige a `/`.
- `ProtectedRoute`: exige `isAuthenticated`. Si el usuario autenticado es `is_staff || is_superuser`, redirige automáticamente a `/admin`.
- **Decisión de seguridad (Guardarraíl #9):** El selector `Admin / Usuario` presente en el prototipo HTML es únicamente una simulación de maqueta para previsualizar ambas vistas en un archivo estático. En la aplicación real **no se incluye un switch que eluda roles ni permisos**, manteniendo el aislamiento estricto de `AdminRoute` y `ProtectedRoute`.

---

## 2. Auditoría de Tokens, CSS Efectivo y `StatCard` (Fase 0.E)

### 2.1 Tokens en `frontend/src/index.css`
- Sitio público (raíz `:root`):
  - `--bg: #0a0a0a`, `--surface: #101010`, `--accent: #1aff6e`, `--btn-green: #1a9d4e`
  - `--font-sans: 'Geist'`, `--font-display: 'Geist'`, `--font-mono: 'Geist Mono'`
- Scope `.admin-root` (`index.css` líneas 773–814):
  - `--admin-primary: #1AFF6E`, `--admin-primary-hover: #00E653`, `--admin-primary-soft: rgba(26,255,110,0.12)`, `--admin-primary-text: #0F9940`
  - `--admin-background: #F4F5F7`, `--admin-surface: #FFFFFF`, `--admin-surface-secondary: #F7F8FA`
  - `--admin-border: #ECEEF2`, `--admin-text: #14161A`, `--admin-text-muted: #6B7280`
  - `--admin-radius-lg: 24px`, `--admin-shadow-md: 0 10px 30px rgba(20,30,24,0.07)`

### 2.2 Hallazgo crítico en `StatCard.jsx` y `admin-ui.css`
Al inspeccionar `frontend/src/components/admin/ui/StatCard.jsx` y `frontend/src/styles/admin-ui.css` (líneas 249–282):
1. `StatCard` tiene por defecto `variant = "dark"`.
2. Sin embargo, en `admin-ui.css`, `.admin-root .au-lp` define `background: #FCFCFC; border: 1px solid #FFFFFF; color: #000000;` y **no existe regla `.au-lp--dark`**, por lo que `variant="dark"` renderiza en realidad una tarjeta **blanca/clara**.
3. Además, páginas existentes (`AdminFinance.jsx`, `AdminLoyalty.jsx`, `AdminRewards.jsx`) invocan `<StatCard variant={accent ? "primary" : "dark"} />` o `<StatCard />` (sin `variant`) esperando que `"dark"` sea la tarjeta clara estándar y `"primary"` la tarjeta destacada en verde.
4. Asimismo, `.admin-root .au-lp--primary` actualmente solo coloreaba el círculo del ícono (`.au-lp--primary .au-lp__icon { background: #1AFF6E }`), mientras que en el diseño aprobado (`01_admin_desktop.png` y `02_usuario_desktop.png`) la tarjeta `primary` ("PEDIDOS" en Admin y "PUNTOS LEVELPRO" en Usuario) tiene superficie completa verde `#1AFF6E` con tipografía oscura `#00160b`.
5. **Decisión técnica segura:**
   - Actualizar `.admin-root .au-lp--primary` para que refleje el diseño aprobado de superficie `#1AFF6E` (lo cual beneficia coherentemente a `AdminDashboard`, `Dashboard` y la card de acento único en `AdminRewards`, `AdminLoyalty`, `AdminFinance`).
   - Mantener `.au-lp--light` y `.au-lp--dark` con fondo claro para **no romper ni oscurecer inadvertidamente** las tarjetas de `AdminFinance`, `AdminLoyalty` y `AdminRewards`.
   - Añadir la variante explícita `variant="ink"` (`.admin-root .au-lp--ink`) en `StatCard` / `admin-ui.css` para las tarjetas KPI negras destacadas (`#141517` con texto blanco y tag/ícono en `#1AFF6E`), usada en el KPI de **Ingresos Totales** del Home Admin.

---

## 3. Auditoría de Datos Reales vs. Elementos Ficticios del Concepto

### 3.1 Home Admin (`/admin` — `AdminDashboard.jsx`)
Datos reales provistos por `getAdminDashboard()` (`/api/v1/admin/dashboard/`) y `getAnalytics()` (`/api/v1/admin/analytics/`):
- `revenue`: `{ total, this_month, last_30_days }`
- `orders`: `{ total, pending, today, this_month }`
- `users`: `{ total, new_month, new_week }`
- `products`: `{ total, low_stock, out_of_stock }`
- `academy`: `{ total_enrollments, enrollments_month }`
- `sales_chart`: `[{ date, total, count }]` (últimos 30 días, de `getAdminDashboard`)
- `analytics.sales_by_month`: `[{ month, total, count }]` (últimos 12 meses, de `getAnalytics`)
- `analytics.kpis`: `{ total_revenue, avg_order_value, total_customers, repeat_customers, repeat_rate }`
- `recent_orders`: `[{ id, email, total, status, created }]` (últimas 8 órdenes de cualquier estado)
- `actions`: `{ pending_orders: [...], low_stock: [...], unread_service_requests }`

**Decisiones sobre elementos del prototipo en Home Admin:**
1. **Botón «Exportar»:** No existe endpoint de exportación general del dashboard. Siguiendo la regla obligatoria del Prompt Maestro (*"«Exportar» solo si había/exporta realmente; si no, se omite"*), se omite el botón ficticio «Exportar» y se conserva el botón funcional `SecondaryButton` **«Actualizar»** (`refetch`) junto con el CTA de marca `Button` **«Nuevo producto»** que navega a `/admin/products` (donde reside el CRUD real).
2. **Tabs contextuales debajo del header:** En lugar de tabs sin función, se conectan a rutas reales del panel: `Resumen` (`/admin`), `Ventas` (`/admin/orders`), `Inventario` (`/admin/inventory`), `Finanzas` (`/admin/finance`), más píldora informativa del mes/fecha actual real.
3. **4 KPIs principales (`StatCard`):**
   - `INGRESOS TOTALES` (`variant="ink"`): valor `clp(rev.total)` (o `rev.this_month` en el pie: `Este mes: ${clp(rev.this_month)}`), sin porcentaje de variación ficticio (`↗ 12,8%` eliminado porque el backend no entrega delta mes-contra-mes).
   - `PEDIDOS` (`variant="primary"`): valor `orders.total`, pie `${orders.pending} por gestionar` y `${orders.today} hoy`.
   - `CLIENTES` (`variant="light"`): valor `users.total`, pie `+${users.new_week} esta semana` y `+${users.new_month} este mes`.
   - `CATÁLOGO` (`variant="light"`): valor `products.total`, pie `${activeProducts} activos` y alerta real si `products.low_stock > 0` (`• ${products.low_stock} stock bajo`) o `out_of_stock > 0`.
4. **Gráfico «Rendimiento comercial» (`ChartCard` + Recharts):**
   - Conmutador funcional **Mensual** (diario últimos 30 días vía `data.sales_chart`) / **Anual** (mensual 12 meses vía `analytics.sales_by_month`).
   - Barras redondeadas con estética LevelPro (`#1A9D4E` / `#95CDA9`) y tooltip oscuro real. Sin serie ficticia de "período anterior" ni porcentaje inventado.
5. **Panel derecho junto al gráfico (reemplazo real de «Objetivo del mes»):**
   - El backend no tiene modelo ni endpoint de "meta comercial mensual" (`$28.000.000` / `66%` es ficticio).
   - Cumpliendo el Contrato de Diseño §5 (*"Panel complementario de objetivo mensual solo si esa métrica existe. Si falta fuente, sustituir por una métrica real del backend con peso visual equivalente, sin datos inventados"*), se implementa el panel **« Salud comercial / Resumen del mes »** con el mismo peso visual (anillo de proporción real de órdenes pagadas/completadas sobre el total o distribución real de estados de `analytics.orders_by_status` + ingresos de este mes `rev.this_month`, ticket promedio real `analytics.kpis.avg_order_value` y tasa de recompra `analytics.kpis.repeat_rate`).
6. **Bloque inferior:**
   - Izquierda: **«Últimas órdenes»** (tabla con las órdenes reales de `recent_orders` / `pending_orders`, estado con `StatusBadge`, total formateado y enlace «Ver todas →» a `/admin/orders`).
   - Derecha: **«Requiere tu atención»** (lista interactiva real conectada a `/admin/inventory` para `products.low_stock` productos con stock bajo, `/admin/orders` para `orders.pending` órdenes por gestionar, y `/admin/services` para `actions.unread_service_requests` solicitudes de servicios).

### 3.2 Home Usuario (`/dashboard` — `Dashboard.jsx`)
Datos reales provistos por `getOrders()`, `getEnrollments()`, `getMyLoyalty()`, `getMyEntries()` y `useAuthStore()`:
- **Header:** Eyebrow `LEVELPRO / MI CUENTA`, título `Tu mundo LevelPro.` (o saludo personalizado al usuario), subtítulo `Tus compras, tus cursos y tus beneficios, en un mismo lugar.` y acción secundaria real `Ver mis pedidos` (`/dashboard/orders`).
- **Hero oscuro de marca:** Estética aprobada en `02_usuario_desktop.png` (`● LEVELPRO AUDIO · EXPERIENCIA PERSONAL`, titular «Más que equipos. Todo tu sonido en un lugar.», CTA global `Button` con flecha hacia `/shop` y badge con el nombre/nivel real del cliente).
- **3 KPIs (`StatCard`):**
  1. `MIS PEDIDOS` (`variant="light"`): total `orders.length`, pie con pedidos activos/en curso y link `Ver historial ↗` (`/dashboard/orders`).
  2. `PUNTOS LEVELPRO` (`variant="primary"`): `points.toLocaleString("es-CL") pts`, pie con `Nivel ${loyalty.nivel}` real y link `Ver beneficios ↗` (`/dashboard/loyalty`).
  3. `MI ACADEMIA` (`variant="light"`): `enrollments.length`, pie `Cursos inscritos` y link `Continuar ↗` (`/dashboard/courses`).
- **3 Módulos inferiores (`user-lower-grid`):**
  1. **Seguimiento de pedido:** Muestra el pedido más reciente (`orders[0]`) con su ID real (`#...`), fecha/cantidad de productos, `StatusBadge` y barra de progreso de 4 etapas reales (`Pendiente/Confirmado`, `Pagado/Preparación`, `Enviado/Despacho`, `Completado/Entregado`) mapeada al campo real `order.status`. Si no hay pedidos aún, muestra estado vacío limpio con CTA a `/shop`.
  2. **Sigue aprendiendo (Academy):** Muestra la inscripción más reciente (`enrollments[0]`) con el título real `enrollment.course?.title`, miniatura/ícono, y barra de progreso real (`enrollment.progress_percentage`, que sí viene del backend en `/api/v1/enrollments/`, como usa `MyCourses.jsx`), más botón `Continuar curso →` hacia `/academy/${course.slug}` (o a `/dashboard/courses`). Si no tiene cursos inscritos, muestra estado vacío real con enlace a `/academy`.
  3. **LevelPro Rewards:** Tarjeta oscura de marca con acceso directo a `/dashboard/rewards` (o `/rewards`), mostrando cuántas participaciones activas (`entries`) tiene el usuario si existen datos reales, y botón `Explorar Rewards ↗`.

---

## 4. Condiciones de Reversión y Plan de Rollback

- **Rama aislada:** Todo el trabajo se realiza en `feat/levelpro-dashboard-v2`.
- **Rama `main` intacta:** `main` permanece en `3ca37e6cdbb89e58fc786af4f2047f08e91e8d1f`.
- **Reversión inmediata:** En caso de necesitar revertir cualquier cambio de Fase 1, basta con ejecutar `git checkout main` o `git checkout -- <archivo>` sobre los archivos de `frontend/src/`. Ningún archivo de `backend/`, migraciones ni configuración de despliegue es modificado.

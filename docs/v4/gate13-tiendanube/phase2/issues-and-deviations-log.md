# LEVELPRO OS V4.0 — GATE 13 · PHASE 2
## Issues and Deviations Log

**Estado:** `COMPLETE` (todas las desviaciones funcionales/visuales detectadas durante implementacion fueron resueltas; dos bloqueos de entorno documentados con transparencia).

### Defectos y Regresiones Corregidos en el Código Fuente (A–N)

| ID | Módulo / Archivo | Hallazgo | Corrección Aplicada | Bloque |
| :--- | :--- | :--- | :--- | :---: |
| `ISS-01` | Global Shell (`AdminLayout.jsx`, `DashboardLayout.jsx`) | `DashboardLayout.jsx` comparte `.admin-root`; aplicar estilos Nimbus sobre `.admin-root` habría afectado `/dashboard/*` de clientes | Scoped completo de reglas Nimbus bajo `.admin-precision` (exclusivo de `AdminLayout` y `AdminLogin`) | `Bloque A` |
| `ISS-02` | Identidad visual (`logo.png`) | Logo original es horizontal claro dentro de contenedor oscuro | Renderizado en positivo oscuro mediante CSS `mask-image: url('/logo.png')` sin pastilla negra | `Bloque C` |
| `ISS-03` | `AdminAudit.jsx`, `AdminRoles.jsx` | Contenedores `#14161B` / `#0D0E11` y textos blancos translúcidos / `#1AFF6E` ilegibles sobre UI clara | Reescritura completa a tarjetas `#FFFFFF` / `#FAFAFA`, texto AA `#09090B` / `#0F7A38` y visor en `SideModal` | `Bloque M` |
| `ISS-04` | `AdminRewards.jsx`, `AdminServices.jsx`, `AdminRewardsCampaigns.jsx` | Hero oscuro `.lp-user-hero` en Rewards y emojis Unicode (`🏆`, `🎁`, `🎫`, `🔧`) | Migrado hero de campaña a tarjeta clara Nimbus e iconos Lucide | `Bloque L` |
| `ISS-05` | `Gate9FinancePanels.jsx`, `App.jsx` | Enlace roto hacia `/admin/fiscal` sin ruta definida en `App.jsx` | Corregido a `/admin/billing` + ruta defensiva `/admin/fiscal -> Navigate("/admin/billing")` | `Bloque J` |
| `ISS-06` | `AdminProducts`, `AdminProductDetail`, `AdminPayments`, `AdminSupplierDetail` | Presencia de 4 llamadas nativas `window.confirm` | Eliminadas 100% y migradas a `ConfirmationModal` | `Bloques G/H/I` |
| `ISS-07` | `WmsInventoryTabs`, `AdminProcurement`, `AdminSuppliers`, `AdminUsers`, `AdminOrders` | Modales/drawers `position: "fixed"` ad-hoc e inputs `bentoInput` | Migrados a `FormModal` y `SideModal` con `formInputStyle` blanco `#FFFFFF` | `Bloques G/H/I` |
| `ISS-08` | Responsive `320px..1440px` (`AdminCostPricing`, `Procurement`, `Logistics`, `Rewards*`, `Audit`, `ProductImport`) | `16` desbordamientos horizontales detectados en auditoría `39×6` | Conversión a grillas `minmax(min(100%, ...), 1fr)`, wrappers `.au-tscroll` y `min-width: 0` -> `0/234` overflows | `Bloque N` |
| `ISS-09` | Compatibilidad selector QA móvil (`AdminLayout.jsx`) | `gate13-responsive-and-a11y.browser.mjs` espera `#v3-mobile-toggle-btn` | Añadido `id="v3-mobile-toggle-btn"` junto a `data-testid="admin-mobile-menu"` | `Bloque N` |

### Pendientes / Bloqueos Exclusivos de Entorno Local (No son defectos de UI)

1. **`DEV-ENV-01` (`npm run test:browser` — `BLOCKED`):** Los scripts `*.browser.mjs` llaman `chromium.launch()` sin `executablePath` y falta el binario descargado en cache de Playwright (`chromium_headless_shell-1234`). Con Chrome sistema (`/Applications/Google Chrome.app/...`), Playwright ejecutó `234/234` rutas+viewports sin errores.
2. **`DEV-ENV-02` (Backend `pytest` & Docker PostgreSQL 16 — `NOT_VERIFIED`):** Docker Desktop permanece apagado (`DOCKER_DOWN`) y no hay virtualenv Python / `pytest` instalado en el host actual. `0` archivos backend fueron tocados.

# LEVELPRO OS V4.0 — GATE 13 · PHASE 2.1
## Issues and Deviations Log

**Estado:** `PARTIAL_VERIFIED` — Desviaciones visuales de Phase 2 corregidas (`6299ce2`); hallazgos pre-existentes y cobertura no interactiva documentados con transparencia.

### Defectos y Regresiones Corregidos en Phase 2 & Phase 2.1 (`ISS-01` .. `ISS-09c`)

| ID | Módulo / Archivo | Hallazgo | Corrección Aplicada | Commit |
| :--- | :--- | :--- | :--- | :---: |
| `ISS-01` | Global Shell (`AdminLayout.jsx`, `DashboardLayout.jsx`) | `DashboardLayout.jsx` comparte `.admin-root` | Scoping estricto bajo `.admin-precision` | `c2a1dee..d98ef8b` |
| `ISS-02` | Identidad visual (`logo.png`) | Pastilla oscura sobre topbar/sidebar claro | Renderizado positivo vía `mask-image: url('/logo.png')` | `d98ef8b` |
| `ISS-03` | `AdminAudit.jsx`, `AdminRoles.jsx` | Contenedores oscuros legacy y texto verde claro ilegible | Reescritura a tarjetas blancas `#FFFFFF` + `SideModal` forense | `d98ef8b` |
| `ISS-04` | `AdminRewards*.jsx`, `AdminServices.jsx` | Hero oscuro `.lp-user-hero` y emojis Unicode | Tarjetas claras Nimbus + iconos Lucide | `d98ef8b` |
| `ISS-05` | `Gate9FinancePanels.jsx`, `App.jsx` | Enlace roto `/admin/fiscal` (404) | Apuntado a `/admin/billing` + redirect defensivo | `d98ef8b` |
| `ISS-06` | `Products`, `ProductDetail`, `Payments`, `SupplierDetail` | `4` `window.confirm` nativos | Migrados 100% a `ConfirmationModal` | `d98ef8b` |
| `ISS-07` | `WmsInventoryTabs`, `Procurement`, `Suppliers`, `Users`, `Orders` | Modales `fixed` ad-hoc e inputs `bentoInput` | Migrados a `FormModal` / `SideModal` con `formInputStyle` | `d98ef8b` |
| `ISS-08` | Responsive `320px..3840px` | `16` overflows detectados inicialmente | Grillas `minmax(min(100%, ...), 1fr)` + `.au-tscroll` -> `0/234` | `d98ef8b` |
| `ISS-09a` | `AdminProductDetail.jsx` & `admin-nimbus-tokens.css` (Phase 2.1) | `UnsavedChangesBar` estaba importado pero sin montar en `General & Precios`, y `.au-btn--primary` tapaba el contraste del botón de guardado | Cableado con prop `dirty={tab === "general" && isDirtyGeneral}` y regla `.lp-unsaved-bar .au-btn--primary` en verde `#1AFF6E` / texto `#09090B` | `6299ce2` |
| `ISS-09b` | `AdminOrders.jsx` (Phase 2.1) | `OrderPanel` (`SideModal`) carecía de footer sticky de acciones y leía `item.price` / `items_count` inconsistente en ciertos DTO | Agregado `footer` sticky (`Solicitar RMA`, `Cerrar`, `Guardar transición`) y fallback `order.items_count ?? order.items?.length` + `item.price ?? item.unit_price` | `6299ce2` |
| `ISS-09c` | `AdminLayout.jsx` (Phase 2.1) | Faltaba `className="v3-brand"` sobre el logo link | Restaurado `className="v3-brand"` en `[data-testid="admin-logo-home"]` | `6299ce2` |

### Hallazgos Pre-existentes y Limitaciones Documentadas (`ISS-10` .. `DEV-02`)

1. **`ISS-10` — Pre-existente en `AdminOrders.jsx` (Venta Manual con Productos Multi-Variante):** El selector `[data-testid="manual-product-select"]` en `AdminOrders.jsx` solo permite escoger `Product` sin selector de `variant_id`, provocando rechazo HTTP `400` del backend cuando el producto seleccionado posee variantes activas (se validó `E2E-PG-06` con producto simple `RME ADI-2 DAC P21` para verificar creación de `DraftOrder`, reserva `WarehouseStock`, conversión idempotente y persistencia reload). Se registra sin alterar backend ni rediseñar flujo en esta fase.
2. **`ISS-11` — Regresión de contrato heredada (`tests/v3-2-1-academy.browser.mjs`):** Persisten `10/91` fallas en `npm run test:browser` exclusivas de `v3-2-1-academy.browser.mjs` (`6` por pestaña por defecto `crm` en `/admin/users` desde Gate 8 `dbba436`, `3` por sidebar oculto off-screen en `< 1024px` al evaluar `.v3-brand` y `1` timeout frío inicial Vite de `7000ms` en `Módulos`). Todas las demás suites (`payment-return`, `transfer-instructions`, `jsonld`, `seo`, `routes`, `v3-2-qa-fix04`, `gate2-pim`, `gate13-admin-experience-real-e2e`) pasan `100%`.
3. **`DEV-01` — Entorno Playwright & Docker Restaurados en Phase 2.1:** Ambos bloqueos previos (`DEV-ENV-01` y `DEV-ENV-02`) fueron resueltos en esta intervención instalando Chromium `1.62.1` (`1234`) y levantando Docker Desktop con `levelpro-v32-qa-db-1` (`postgres:16-alpine`) + `levelpro-v32-qa-backend-1`.
4. **`DEV-02` — Superficies secundarias no ejercidas interactivamente (`136/315`):** Los `62` modales/confirmaciones secundarios, `33` tablas de sub-vistas y `23` formularios no alcanzados por los 12 flujos PG16 cuentan con verificación de código fuente (`usesAdminUi=true`, `zero_legacy_bento=true`, build sin errores), clasificados honestamente como `MIGRATED_CODE_ONLY_NOT_EXERCISED` en `full-surface-coverage.json`.

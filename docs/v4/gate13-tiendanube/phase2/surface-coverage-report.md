# LEVELPRO OS V4.0 — GATE 13 · PHASE 2.2
## Surface Coverage Report (315 / 315 IDs Únicos Reconciliados y Ejercidos)

**Inventario maestro:** `docs/v4/gate13-tiendanube/admin-surface-inventory.md`  
**Trazabilidad máquina-legible 1 a 1 (`315` registros):** `docs/v4/gate13-tiendanube/phase2/full-surface-coverage.json`  
**Evidencia interactiva de las `136` superficies secundarias:** `docs/v4/gate13-tiendanube/phase2/interactive-136-coverage-evidence.json`

### Conteo Honesto por Estado de Evidencia (`315 / 315`)

| Clasificación | Cantidad | Criterio Objetivo Verificado |
| :--- | :---: | :--- |
| **`COMPLETE`** | **315** | Código migrado a `admin/ui` sin legacy Bento + verificada en ejecución real Playwright (render `6/6` viewports, geometría shell `240/48/56px`, clic interactivo de tab, apertura/cierre de overlay, render de tabla o edición/envío de formulario, o E2E PostgreSQL 16 QA) |
| **`MIGRATED_CODE_ONLY_NOT_EXERCISED`** | **0** | Todas las `136` superficies previamente pendientes (`18` tabs/viewports, `62` overlays, `33` tablas, `23` formularios) fueron ejercidas realmente en `frontend/tests/gate13-interactive-136.browser.mjs` (`6/6` grupos PASS, `136/136` IDs únicos registrados) |
| **`NOT_VERIFIED`** | **0** | Ningún ID quedó sin verificación |
| **Total Reconciliado** | **315** | **100% (`315 / 315`) de los IDs `SURF-*` verificados en tiempo de ejecución** |

### Desglose por Familia (`full-surface-coverage.json`)

| Familia | Rango de IDs | Total | `COMPLETE` | Pendiente | Evidencia |
| :--- | :--- | :---: | :---: | :---: | :--- |
| Rutas y redirecciones | `SURF-RT-001..041` | 41 | **41** | 0 | `39 × 6 = 234` checks (`PASS`) + redirects App.jsx + PG16 E2E |
| Estructuras Shell | `SURF-SHL-001..005` | 5 | **5** | 0 | Sidebar `240px`, Rail `48px`, Topbar `56px`, Drawer móvil (`admin-mobile-brand`), Currency Select |
| Tabs y subvistas | `SURF-TAB-001..090` | 90 | **90** | 0 | `72` previos + `18` de WMS / Finanzas / CRM / OMS / CMS Preview en `gate13-interactive-136` |
| Overlays y popovers | `SURF-OVL-001..073` | 73 | **73** | 0 | `11` previos en E2E + `62` FormModal / ConfirmationModal / SideModal / RowMenu en `gate13-interactive-136` |
| Tablas de datos | `SURF-TBL-001..064` | 64 | **64** | 0 | `31` principales + `33` sub-tablas en Finance, Logistics, WMS, Academy, Loyalty, PIM Import en `gate13-interactive-136` |
| Formularios y editores | `SURF-FRM-001..034` | 34 | **34** | 0 | `11` en PG16 E2E + `23` en WMS, Costing, Login, Marketing, Procurement, Settings CMS, Suppliers, Loyalty |
| Estados de sistema | `SURF-ST-001..008` | 8 | **8** | 0 | Skeleton, Loading, Empty, ErrorState, Toast, RBAC Denied (`admin-access-denied`), UnsavedChangesBar |
| **Total** | **315 IDs únicos** | **315** | **315** | **0** | `100%` trazado y ejercido |

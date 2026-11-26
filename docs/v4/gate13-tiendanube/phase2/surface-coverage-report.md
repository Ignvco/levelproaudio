# LEVELPRO OS V4.0 — GATE 13 · PHASE 2.1
## Surface Coverage Report (315 IDs Únicos Reconciliados)

**Inventario maestro:** `docs/v4/gate13-tiendanube/admin-surface-inventory.md`  
**Trazabilidad máquina-legible 1 a 1 (`315` registros):** `docs/v4/gate13-tiendanube/phase2/full-surface-coverage.json`

### Conteo Honesto por Estado de Evidencia (`315 / 315`)

| Clasificación | Cantidad | Criterio Objetivo Aplicado |
| :--- | :---: | :--- |
| **`COMPLETE`** | **179** | Código migrado sin legacy Bento + verificada en ejecución real en Playwright (renderizado `6/6` viewports, geometría shell medidas, clic interactivo de pestaña sin crash, o flujo E2E PostgreSQL 16) |
| **`MIGRATED_CODE_ONLY_NOT_EXERCISED`** | **136** | Migrado en código (`admin/ui`, `formInputStyle`, cero Bento, build + ESLint OK), sin ejecución interactiva individual en Playwright (modales secundarios, confirmaciones `ConfirmationModal`, formularios secundarios y `18` controles de subvista/viewport) |
| **`NOT_VERIFIED`** | **0** | Ningún ID quedó sin trazabilidad ni clasificación |
| **Total Reconciliado** | **315** | **100% de los IDs `SURF-*` trazados 1 a 1** |

### Desglose por Familia (`full-surface-coverage.json`)

| Familia | Rango de IDs | Total | `COMPLETE` (Runtime) | `MIGRATED_CODE_ONLY_NOT_EXERCISED` | Evidencia |
| :--- | :--- | :---: | :---: | :---: | :--- |
| Rutas y redirecciones | `SURF-RT-001..041` | 41 | **41** | 0 | `39 × 6 = 234` checks (`PASS`) + redirects App.jsx + PG16 E2E |
| Estructuras Shell | `SURF-SHL-001..005` | 5 | **5** | 0 | Sidebar `240px`, Rail `48px`, Topbar `56px`, Drawer móvil, Currency Select |
| Tabs y subvistas | `SURF-TAB-001..090` | 90 | **72** | 18 | Barrido de clic interactivo Playwright sin ErrorBoundary |
| Overlays y popovers | `SURF-OVL-001..073` | 73 | **11** | 62 | SideModals/FormModals abiertos en E2E + `62` secundarios migrados en código |
| Tablas de datos | `SURF-TBL-001..064` | 64 | **31** | 33 | `31` tablas renderizadas en vistas principales + `33` en tabs secundarias |
| Formularios y editores | `SURF-FRM-001..034` | 34 | **11** | 23 | `11` editores/formularios ejercidos + `23` secundarios estandarizados |
| Estados de sistema | `SURF-ST-001..008` | 8 | **8** | 0 | Skeleton, Loading, Empty, ErrorState, Toast, RBAC Denied, UnsavedChangesBar |
| **Total** | **315 IDs únicos** | **315** | **179** | **136** | Trazado íntegro en `full-surface-coverage.json` |

# LEVELPRO OS V4.0 — GATE 13 · PHASE 2.2
## QA Execution Report (Regresión y Cobertura Interactiva Local)

**Rama:** `feature/v4-gate13-admin-experience`  
**Base Gate 12:** `6fa8254a8de68667aa8f578e40a378b82ba64628` · **Baseline Phase 2 (BEFORE):** `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`  
**Commits previos en Phase 2.1:** `6299ce2cc6f9d8b28f750e8c7266523d05b7c683` (código), `2639c07`, `eba9c3e` (solo evidencias/documentación)  
**Backend alterado desde Gate 12 / `fa53c7f`:** `0` archivos (`git diff --name-only fa53c7f..HEAD -- backend/` vacío; por QA proporcional **no se repitieron los 1.039 tests backend**, manteniéndose pruebas E2E reales sobre Django + PostgreSQL 16 QA).

### Ajustes Mínimos de Phase 2.2 (Sin Alterar Diseño LevelPro Precision ni Nimbus Shell)

1. `frontend/src/layouts/AdminLayout.jsx`: agregado `alt="LevelPro Audio"` y `data-testid="admin-mobile-brand"` en el isotipo de barra móvil `< 1024px`.
2. `frontend/src/pages/admin/AdminUsers.jsx`: restaurado el indicador de paginación `<p className="au-formfield__help">Mostrando {allUsers.length} de {totalCount} usuarios...</p>` sobre la tabla en la pestaña `"rbac"`.
3. `frontend/src/styles/admin-nimbus-tokens.css`: agregado `flex-shrink: 0` en `.admin-precision .au-tabs` para evitar compresión vertical de la barra de pestañas dentro de modales con `scrollableBody`.
4. `frontend/tests/v3-2-1-academy.browser.mjs`: precalentamiento Vite dev, aserción explícita del contrato CRM 360° inicial (`[data-testid="crm-tab-rbac"]`), cobertura RBAC deny (`Bodega / Inventario` -> `admin-access-denied`), y verificación real del drawer móvil Nimbus colapsado/abierto/cerrado con backdrop en `320px/390px/768px`.
5. `frontend/tests/gate13-interactive-136.browser.mjs`: nueva suite automatizada reutilizable que ejerce las `136` superficies secundarias previamente no ejercidas (`18` tabs/modos/sub-viewports, `62` modales/confirmaciones/popovers, `33` tablas y `23` formularios/editores).

### Matriz Completa de Verificación Tras la Última Edición de Código

| Suite / Verificación | Modo de Ejecución | Resultado Real Observado | Estado | Evidencia / Alcance |
| :--- | :--- | :--- | :---: | :--- |
| `npm run lint` (`eslint . --max-warnings=0`) | Estático real | `0` errores, `0` warnings | `PASS` | Sobre el árbol final Phase 2.2 |
| `npm run test:unit` (`node --test`, 12 archivos) | Unitario real | `100 / 100` PASS (`0` fail, `0` skip) | `PASS` | Presupuesto unitario intacto |
| `npm run build` + `npm run check:bundle` | Build producción Vite | Build OK · `initial_js_bytes: 472910` (`gzip: 146492`) | `PASS` | Dentro del presupuesto |
| `npm run test:browser` (`tests/v3-2-1-academy.browser.mjs` + nativa) | Playwright + Chromium (`146,933.77ms`) | **`91 / 91` PASS (`0` fail, `0` skip)** | `PASS` | Resueltas las `10` fallas previas |
| `tests/gate2-pim.browser.mjs` | Playwright PIM (`5,809.29ms`) | **`1 / 1` PASS** | `PASS` | Tienda variantes, BulkEdit, Ficha PIM, Import CSV |
| `tests/gate13-interactive-136.browser.mjs` | Playwright interactivo (`45,997.43ms`) | **`6 / 6` grupos PASS (`136 / 136` IDs únicos)** | `PASS` | Evidencia en `interactive-136-coverage-evidence.json` |
| `tests/gate13-admin-experience-real-e2e.mjs` | Real Playwright -> Django -> PG16 (`88,496.80ms`) | **`1 / 1` PASS** | `PASS` | Navegación + Command Palette + Notification + RBAC Deny |
| Batería E2E PG16 `E2E-PG-01..12` | Real Playwright -> PG16 (`levelpro_v32_qa`) | **`12 / 12` PASS** | `PASS` | `e2e-postgres16-12flows.json` |
| Batería Profunda PG16 Phase 2.2 | Real Playwright -> PG16 (`levelpro_v32_qa`) | `4` `PASS` (`WMS`, `Costing`, `Fiscal->Billing`, `Product Contract`) + `1` `PASS_REPRODUCED_KNOWN_DEFECT` (`ISS-10`, HTTP `400`) | `PASS` / `ISS-10_OPEN` | `e2e-postgres16-deep-phase22.json` |
| Auditoría Responsive + `VIS-BAN-01..08` (`39 × 6`) | Chromium Headless + fixtures deterministas | **`234 / 234` PASS (`0` overflow, `0` JS errors, `0` ErrorBoundary, `0` VIS-BAN)** | `PASS` | `responsive-matrix-234.json` · Shell `240px`/`48px`/`56px` |

### Clasificación Honesta (Fixtures Sintéticos vs Backend Real PostgreSQL 16 QA)

- **Suites con fixtures deterministas:** `npm run test:browser` (`91/91`), `tests/gate2-pim.browser.mjs`, `tests/gate13-interactive-136.browser.mjs` (`136/136`) y matriz responsive `234/234`.
- **Suites contra backend Django + PostgreSQL 16 QA real (`levelpro-v32-qa-backend-1` + `levelpro_v32_qa`):** `tests/gate13-admin-experience-real-e2e.mjs`, `E2E-PG-01..12` y la batería profunda Phase 2.2 (`PG16-DEEP-WMS`, `PG16-DEEP-COSTING`, `PG16-DEEP-FINANCE-BILLING`, `PG16-DEEP-PRODUCT-CONTRACT`, más reproducción `PG16-REPRODUCE-ISS10`). No se disparan pasarelas externas reales ni envíos reales de correo/SII.

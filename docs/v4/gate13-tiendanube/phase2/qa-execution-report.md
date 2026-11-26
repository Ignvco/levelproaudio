# LEVELPRO OS V4.0 — GATE 13 · PHASE 2.1
## QA Execution Report (Reporte Honesto Verificado Localmente)

**Rama:** `feature/v4-gate13-admin-experience` @ `6299ce2cc6f9d8b28f750e8c7266523d05b7c683`  
**Base Gate 12:** `6fa8254a8de68667aa8f578e40a378b82ba64628` · **Baseline Phase 2 (BEFORE):** `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`  
**Backend alterado desde Gate 12 / `fa53c7f`:** `0` archivos (motivo por el cual **no se repitieron los 1.039 tests backend**, manteniéndose verificación E2E real sobre Django + PostgreSQL 16 QA).

### Matriz de Verificación Ejecutada tras la Última Edición (`6299ce2`)

| Suite / Verificación | Modo de Ejecución | Resultado Real Observado | Estado | Notas Exactas |
| :--- | :--- | :--- | :---: | :--- |
| `npm run lint` (`eslint . --max-warnings=0`) | Estático real | `0` errores, `0` warnings | `PASS` | Sobre código final `6299ce2` |
| `npm run test:unit` (`node --test`, 12 suites) | Unitario real | `100 / 100` PASS (`0` fail, `0` skip) | `PASS` | Duración ~`680ms` |
| `npm run build` + `npm run check:bundle` | Build producción Vite | Build OK · `initial_js_bytes: 472910` (`gzip: 146495`) | `PASS` | Presupuesto respetado |
| `npm run test:browser` (Playwright `1.62.1` + Chromium `1234`) | Browser suite nativa del repo | **`81 / 91` PASS · `10` FAIL** (`164,875ms`) | `PARTIAL_FAIL` | Todas las `10` fallas ocurren en `tests/v3-2-1-academy.browser.mjs` (ver desglose debajo) |
| `tests/gate2-pim.browser.mjs` | Browser PIM + Variantes + Importador | `1 / 1` PASS (`5,589ms`) | `PASS` | Flujo PIM + Variantes + BulkEdit OK |
| `tests/gate13-admin-experience-real-e2e.mjs` | Real Playwright -> Django -> PostgreSQL 16 QA (`levelpro-v32-qa-db-1`) | `1 / 1` PASS (`111,845ms`) | `PASS` | E2E A/B/C + Marketing + CMS iframe + RBAC Deny |
| Batería Real PostgreSQL 16 QA `E2E-PG-01..12` | Real Playwright -> Vite Preview -> Django -> PG16 (`levelpro_v32_qa`) | **`12 / 12` PASS · `0` FAIL · `0` JS errors** | `PASS` | Evidencia cruda en `e2e-postgres16-12flows.json` |
| Auditoría Responsive + `VIS-BAN-01..08` (`39 × 6`) | Chromium Headless + fixtures deterministas | **`234 / 234` PASS** (`0` overflow, `0` JS errors, `0` ErrorBoundary, `0` VIS-BAN) | `PASS` | Evidencia cruda por celda en `responsive-matrix-234.json` |
| Evidencia Visual (`BEFORE`/`AFTER` + `Target vs Impl` + Subvistas) | Chromium Headless (`1440×900` / `390×844`) | `25` BEFORE + `25` AFTER + `25` B/A + `11` Target vs Impl + `13` subvistas `ProductDetail/CMS/OMS` | `PASS` | `0` pares B/A idénticos; `/` público oscuro intacto |

### Desglose Verificado de las `10` Fallas en `npm run test:browser` (`tests/v3-2-1-academy.browser.mjs`)

1. **Pre-existente contrato Gate 8 (`dbba436`) en `/admin/users` (`6` fallas):** `v3-2-1-academy.browser.mjs` (líneas `48`, `121`, `385`, `397`, `406` en `1024/1280/1440px`) asume que `/admin/users` abre directamente en el heading `"Usuarios"` y renderiza inmediatamente la tabla heredada `/api/v1/admin/users/`. Desde Gate 8 (`dbba436`), `AdminUsers.jsx` inicia en el tab `"crm"` (*CRM 360°*), ubicando `"Usuarios y Roles RBAC"` en la pestaña `"rbac"`.
2. **Selector `.v3-brand` en drawer colapsado móvil (`3` fallas en `320px`, `390px`, `768px`):** `v3-2-1-academy.browser.mjs` línea `425` evalúa `document.elementFromPoint(...)` sobre el centro de `.v3-brand`. Bajo la arquitectura Tiendanube/Nimbus (`< 1024px`), el sidebar completo se colapsa fuera de viewport (`translateX(-100%)`), por lo que `elementFromPoint` en coordenadas negativas retorna `null` aunque `.au-modal__backdrop` cubre `100vw × 100vh`.
3. **Timeout frío inicial Vite dev server (`1` falla):** `Módulos: loading and failure are distinct from empty, retry recovers` excedió el timeout estricto de `7000ms` durante la primera compilación dev de Vite (`11,290ms`); los tres tests subsecuentes de `Módulos` dentro del mismo archivo pasaron.

### Clasificación Honesta de Verificación E2E

- **Suites con fixtures sintéticos:** `npm run test:browser` (`91` specs), `tests/gate2-pim.browser.mjs`, auditoría responsive `234` celdas y capturas visuales comparativas.
- **Suites contra backend Django + PostgreSQL 16 QA real (`levelpro-v32-qa-backend-1` + `levelpro_v32_qa`):** `tests/gate13-admin-experience-real-e2e.mjs` (`1/1 PASS`) y los `12` flujos `E2E-PG-01..12` (`12/12 PASS`, sin pagos externos reales ni envío de correos/DTE).

# 06 — TEST EXECUTION EVIDENCE & RUNTIME RECONCILIATION
## LEVELPRO OS V4.0 — PATCH 1.1.1 (RBAC HARDENING & FINAL ACCEPTANCE)

---

## 1. RECONCILIACIÓN DEL RUNTIME FRONTEND (`Node 24.19.0 / npm 11.9.0` vs Host macOS)

Durante la auditoría de Gate 1.1 se observó que el host macOS local tenía instalado `Node v22.23.1 / npm 10.9.7`, mientras que `frontend/package.json` y `frontend/Dockerfile` declaran como línea base certificada:
- `engines.node`: `">=24.19.0 <25"`
- `packageManager`: `"npm@11.9.0"`
- `frontend/Dockerfile`: `FROM node:24.19.0-alpine3.24 AS build`

### Solución y Certificación en Runtime Oficial
En PATCH 1.1.1 todas las validaciones de código, linting, pruebas unitarias, compilación de producción (`vite build`), auditoría de presupuesto de bundle (`check:bundle`) y prueba de servidor Nginx (`test:nginx`) se ejecutaron **dentro del contenedor oficial `levelpro-v32-qa-frontend:latest`** (`Node v24.19.0 / npm 11.9.0`):

```text
$ docker run --rm ... levelpro-v32-qa-frontend:latest sh -c "node -v && npm -v && npm run lint && npm run test:unit && npm run build && npm run check:bundle"
v24.19.0
11.9.0
```

| Entorno | Propósito | Versión de Node | Versión de npm | Estado |
|---|---|---|---|---|
| **Contenedor Oficial QA (`levelpro-v32-qa-frontend:latest`)** | Runtime canónico para `lint`, `test:unit`, `vite build`, `check:bundle` y `test:nginx` (idéntico a `frontend/Dockerfile` de producción) | **`v24.19.0`** | **`11.9.0`** | **CERTIFICADO (100% alineado con Gate 0.1 / 1.0)** |
| **Host macOS Local** | Ejecución del binario local de Chromium para pruebas de navegador Playwright (`npm run test:browser` y captura de screenshots) | `v22.23.1` | `10.9.7` | Documentado (uso exclusivo como driver de Chromium en host) |

---

## 2. EVIDENCIA DE EJECUCIÓN — SUITE RBAC (`backend/apps/users/tests_rbac.py`)

- **Comando ejecutado:** `docker exec levelpro-v32-qa-backend-1 pytest apps/users/tests_rbac.py --reuse-db -v`
- **Entorno:** `Python 3.11.18`, `Django 5.2.16`, `PostgreSQL 16.13 (levelpro-v32-qa-db-1)`
- **Resultado:** **`26 passed in 52.89s` (0 fallos)**

```text
============================= test session starts ==============================
platform linux -- Python 3.11.18, pytest-8.3.3, pluggy-1.7.0 -- /usr/local/bin/python3.11
django: version: 5.2.16, settings: config.settings.local_qa (from env)
collecting ... collected 26 items

apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_unclassified_endpoint_denied_by_default_for_all_non_superusers PASSED [  3%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_legacy_staff_without_role_is_denied_everywhere[/api/v1/admin/dashboard/] PASSED [  7%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_legacy_staff_without_role_is_denied_everywhere[/api/v1/admin/products/] PASSED [ 11%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_legacy_staff_without_role_is_denied_everywhere[/api/v1/admin/orders/] PASSED [ 15%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_legacy_staff_without_role_is_denied_everywhere[/api/v1/admin/inventory/summary/] PASSED [ 19%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_legacy_staff_without_role_is_denied_everywhere[/api/v1/admin/finance/summary/?currency=CLP] PASSED [ 23%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_legacy_staff_without_role_is_denied_everywhere[/api/v1/admin/roles/] PASSED [ 26%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_legacy_staff_without_role_is_denied_everywhere[/api/v1/admin/site-settings/] PASSED [ 30%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_legacy_staff_without_role_is_denied_everywhere[/api/schema/] PASSED [ 34%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_inactive_user_and_inactive_superuser_denied PASSED [ 38%]
apps/users/tests_rbac.py::TestDenyByDefaultAndLegacyHardening::test_role_revocation_with_open_session_immediately_revokes_access_and_clears_is_staff PASSED [ 42%]
apps/users/tests_rbac.py::TestGranularActionsAndAtomicFieldProtection::test_sales_cannot_edit_prices_stock_costs_or_delete_products PASSED [ 46%]
apps/users/tests_rbac.py::TestGranularActionsAndAtomicFieldProtection::test_warehouse_can_adjust_stock_only_and_atomic_rejection_on_price_or_cost PASSED [ 50%]
apps/users/tests_rbac.py::TestGranularActionsAndAtomicFieldProtection::test_payment_approval_restricted_to_approve_payments_capability PASSED [ 53%]
apps/users/tests_rbac.py::TestGranularActionsAndAtomicFieldProtection::test_bulk_import_and_csv_export_restrictions PASSED [ 57%]
apps/users/tests_rbac.py::TestGranularActionsAndAtomicFieldProtection::test_marketing_cannot_manage_settings_exchange_rates_or_manual_points PASSED [ 61%]
apps/users/tests_rbac.py::TestGranularActionsAndAtomicFieldProtection::test_b2b_discount_policy_limit_15_percent_for_sales PASSED [ 65%]
apps/users/tests_rbac.py::TestIndirectSensitiveDataLeakProtection::test_inventory_endpoints_mask_cost_and_margin_for_warehouse PASSED [ 69%]
apps/users/tests_rbac.py::TestIndirectSensitiveDataLeakProtection::test_executive_dashboard_and_support_users_mask_profit_and_spend PASSED [ 73%]
apps/users/tests_rbac.py::TestIndirectSensitiveDataLeakProtection::test_private_media_proxy_requires_authentication_and_rbac PASSED [ 76%]
apps/users/tests_rbac.py::TestSuperAdminLifecycleAndSegregationOfDuties::test_segregation_of_duties_prevents_incompatible_role_combinations[Ventas-Finanzas / Contabilidad] PASSED [ 80%]
apps/users/tests_rbac.py::TestSuperAdminLifecycleAndSegregationOfDuties::test_segregation_of_duties_prevents_incompatible_role_combinations[Compras-Finanzas / Contabilidad] PASSED [ 84%]
apps/users/tests_rbac.py::TestSuperAdminLifecycleAndSegregationOfDuties::test_segregation_of_duties_prevents_incompatible_role_combinations[Bodega-Finanzas / Contabilidad] PASSED [ 88%]
apps/users/tests_rbac.py::TestSuperAdminLifecycleAndSegregationOfDuties::test_cannot_revoke_deactivate_or_delete_last_active_super_admin PASSED [ 92%]
apps/users/tests_rbac.py::TestSuperAdminLifecycleAndSegregationOfDuties::test_setup_rbac_is_idempotent_and_non_destructive_to_custom_group_permissions_and_users PASSED [ 96%]
apps/users/tests_rbac.py::TestSuperAdminLifecycleAndSegregationOfDuties::test_permissions_catalog_endpoint_reflects_12_capabilities_and_module_status PASSED [100%]

======================= 26 passed, 7 warnings in 52.89s ========================
```

---

## 3. EVIDENCIA DE EJECUCIÓN — REGRESIÓN COMPLETA BACKEND (`853 passed`)

- **Comando ejecutado:** `docker exec levelpro-v32-qa-backend-1 pytest --reuse-db -q`
- **Resultado:** **`853 passed, 6 skipped in 981.36s (0:16:21)` (0 fallos)**
  - Incluye las 827 pruebas de línea base (con las 6 pruebas opt-in de concurrencia omitidas en corrida rápida y certificadas por separado) + las 26 pruebas RBAC de `tests_rbac.py` = **859 ítems recolectados (853 aprobados, 0 fallidos)**.

---

## 4. EVIDENCIA DE EJECUCIÓN — FRONTEND LINT, UNIT TESTS, BUILD, BUNDLE Y NGINX (`Node v24.19.0 / npm 11.9.0`)

| Suite / Verificación | Comando Ejecutado | Runtime | Resultado |
|---|---|---|---|
| **ESLint (`--max-warnings=0`)** | `npm run lint` | `Node v24.19.0 / npm 11.9.0` | **`0 errors, 0 warnings`** |
| **Pruebas Unitarias Frontend** | `npm run test:unit` | `Node v24.19.0 / npm 11.9.0` | **`100 / 100 passed` (`800.14ms`)** |
| **Build de Producción (`vite build`)** | `npm run build` | `Node v24.19.0 / npm 11.9.0` | **`2504 modules transformed` en `4.68s`** |
| **Presupuesto de Bundle (`check:bundle`)** | `npm run check:bundle` | `Node v24.19.0 / npm 11.9.0` | **`initial_js_bytes: 463,736` (`452.87 KB`) / `initial_js_gzip_bytes: 143,988` (`140.61 KB`, bajo el límite de `180 KB`)** |
| **Pruebas de Navegador Playwright** | `npm run test:browser` | Chromium Headless | **`91 / 91 passed` (`133.05s`)** |
| **Prueba de Proxy / SEO Nginx** | `npm run test:nginx` | `Node v24.19.0` + `nginx` (Alpine 3.24) | **`1 / 1 passed` (`3.38s`)** |
| **Captura y Validación Responsive RBAC** | `node --test capture_rbac_screenshots.mjs` | Chromium + Backend QA Real | **`1 / 1 passed` (`10` capturas reales + `0px` overflow en `1280px`, `768px`, `390px`)** |

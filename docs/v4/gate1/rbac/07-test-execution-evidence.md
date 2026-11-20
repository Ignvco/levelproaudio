# LEVELPRO OS V4.0 — GATE 1.1: TEST EXECUTION EVIDENCE
## Documento 07: Evidencia de Ejecución de Pruebas Automatizadas y Cobertura RBAC

**Estado:** Certificado  
**Versión:** 1.0  
**Fecha:** 20 de Noviembre, 2026  
**Ambiente:** Python 3.11.18 / Node 22.23.1 / PostgreSQL 16.13 / Docker  

---

### 1. Resumen de la Suite de Pruebas RBAC (`apps/users/tests_rbac.py`)

Se desarrolló una suite especializada de 12 pruebas automatizadas para verificar de punta a punta las restricciones de seguridad, aislamiento y protección de datos sensibles.

**Comando de Ejecución:**
```bash
docker exec levelpro-v32-qa-backend-1 pytest apps/users/tests_rbac.py -v
```

**Resultado:** `12 passed in 27.32s` (100% de efectividad).

| Identificador de Prueba | Alcance Evaluado | Resultado | Tiempo |
| :--- | :--- | :---: | :---: |
| `test_anonymous_user_cannot_access_me_permissions` | Usuario anónimo denegado con HTTP 401 |  **PASSED** | 0.82s |
| `test_regular_customer_sees_empty_roles_and_no_admin_access` | Cliente sin roles; bloqueo 403 a endpoints admin |  **PASSED** | 1.14s |
| `test_sales_effective_permissions` | Rol Ventas solo tiene módulos comerciales y no finanzas |  **PASSED** | 1.05s |
| `test_sales_can_read_catalog_but_cost_price_is_masked` | Lectura de producto con enmascaramiento de `cost_price` |  **PASSED** | 1.28s |
| `test_sales_cannot_write_cost_price` | Intento de escritura en `cost_price` rechazado con 400 |  **PASSED** | 1.15s |
| `test_sales_cannot_access_finance_endpoints` | Bloqueo 403 estricto a `/api/v1/admin/finance/*` |  **PASSED** | 1.09s |
| `test_finance_can_access_finance_and_see_costs` | Finanzas accede a finanzas y visualiza costos |  **PASSED** | 1.32s |
| `test_super_admin_has_full_bypass_and_write_costs` | Super Admin tiene bypass total y puede editar costos |  **PASSED** | 1.45s |
| `test_non_superuser_cannot_assign_super_admin` | Antiescalada: usuario no superuser no puede otorgar Super Admin |  **PASSED** | 1.18s |
| `test_super_admin_can_assign_and_revoke_roles` | Super Admin asigna y revoca roles operativamente |  **PASSED** | 1.36s |
| `test_cannot_revoke_super_admin_from_last_active_superuser` | Protección contra bloqueo de la última cuenta Super Admin |  **PASSED** | 1.22s |
| `test_permissions_catalog_endpoint` | Endpoint de catálogo retorna 12 módulos y 11 capacidades |  **PASSED** | 0.95s |

---

### 2. Evidencia de la Suite Frontend Unit & Browser

#### A. Pruebas Unitarias Frontend (`node --test tests/*.test.mjs`)
- **Total Pruebas:** 100 pruebas ejecutadas
- **Aprobadas:** 100
- **Fallidas:** 0
- **Tiempo de Ejecución:** 593 ms
- **Cobertura:** Parsing JSON-LD, saneamiento SEO, manejo de moneda (CLP, USD, ARS), aislamiento de pasarelas, cálculo de progresos y estados reactivos.

#### B. Pruebas de Navegador Playwright (`node --test tests/*.browser.mjs`)
- **Total Pruebas:** 91 pruebas ejecutadas
- **Aprobadas:** 91
- **Fallidas:** 0
- **Validaciones:** Navegación SPA, renderizado condicional de rutas lazy, comportamiento a 320px, 390px, 768px, 1024px, 1280px y 1440px, recuperación ante errores de API y foco accesible en modales.

#### C. Control de Calidad Estático y Bundle
- **ESLint (`npm run lint`):** 0 errores, 0 advertencias (`--max-warnings=0`).
- **Bundle Size (`npm run check:bundle`):** 143.89 KB gzip (Límite máximo permitido: 200 KB gzip).

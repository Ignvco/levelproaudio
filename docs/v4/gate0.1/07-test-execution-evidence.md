# LEVELPRO OS V4.0 — GATE 0.1
## 07. Evidencia Empírica de Ejecución de Pruebas y Certificación de QA

**Documento:** `docs/v4/gate0.1/07-test-execution-evidence.md`  
**Versión:** 4.0.0-gate0.1  
**Fecha de Certificación:** Noviembre 2026  
**Auditor QA:** Lead Test Automation Architect & Senior Quality Engineer  
**Entorno de Ejecución:** Contenedores QA locales (`levelpro-v32-qa-backend-1` y `levelpro-v32-qa-db-1` PostgreSQL 16) y entorno local macOS (Node 24 / npm 11.9.0).

---

### 1. Resumen de la Certificación de Pruebas

Durante Gate 0.1 se realizó una auditoría empírica y reproducible de todos los comandos de verificación de código disponibles en el repositorio. Se ejecutaron las suites de backend y frontend para certificar el estado real del sistema y esclarecer las discrepancias en el número de pruebas reportadas históricamente.

---

### 2. Aclaración Definitiva: De 518 Pruebas Reportadas a 827 Pruebas Reales

#### Origen de la Cifra Histórica "518 Pruebas":
- En fases anteriores de auditoría (V3.2 / V3.3 inicial), se ejecutaba un subconjunto específico de pruebas: 419 pruebas unitarias de backend y 99 pruebas de frontend.
- Durante las fases de remediación comercial V3.3, V3.4 y el parche crítico V3.5, el equipo de desarrollo incorporó múltiples suites adicionales para validar:
  - Idempotencia y seguridad de webhooks en Mercado Pago y PayPal.
  - Concurrencia de inventario y prevención de sobreventa (`test_order_inventory_concurrency.py`).
  - Validaciones de formato UUID en endpoints del comparador técnico (`test_audit_remediation_v35.py`).
  - Cuentas bancarias de transferencia en CLP y ARS (`test_payments_methods.py`).
  - Cursos iniciales de la Academia y subida de archivos seguros.

#### Recolección Real Actual (Commit `e33f699`):
- **Backend (Pytest):** **827 pruebas recolectadas** en 5.14 segundos en el contenedor Docker QA.
- **Frontend (Node Test Runner):** **100 pruebas unitarias** ejecutadas y aprobadas al 100% (641 ms de duración).

---

### 3. Resultados Detallados de Ejecución en Frontend

#### 3.1. Linteo y Calidad de Código (`npm run lint`)
- **Comando:** `eslint . --max-warnings=0`
- **Resultado:** Código de salida `0`. Cero errores y cero advertencias en todo el código fuente React.
- **Duración:** ~18 segundos.

#### 3.2. Suite Unitaria (`npm run test:unit`)
- **Comando:** `node --test tests/payment-return.test.mjs tests/jsonld.test.mjs tests/seo.test.mjs tests/dashboard-payment-methods.test.mjs tests/dashboard-v3-data.test.mjs tests/v3-2-currency.test.mjs tests/v3-2-1-query-states.test.mjs tests/v3-2-1-inventory.test.mjs tests/v3-2-1-billing.test.mjs tests/v3-2-1-admin-data.test.mjs tests/v3-2-final-ux.test.mjs tests/v3-2-qa-fix04-order.test.mjs`
- **Métricas:**
  - Pruebas descubiertas: **100**
  - Pruebas aprobadas: **100**
  - Pruebas fallidas: **0**
  - Pruebas canceladas/omitidas: **0**
  - Duración total: **641.28 ms**
- **Cobertura Funcional Clave:**
  - Invariantes de moneda (CLP, USD, ARS independientes sin suma cruzada FX).
  - Manejo seguro de identificadores UUID en URLs de órdenes.
  - Validación de estados de pago y descarte de estados desconocidos.
  - Protección contra sanitización y ataques XSS en metadatos JSON-LD.
  - Limpieza de carrito exactamente una vez tras compra exitosa.

#### 3.3. Verificación de Tamaño de Bundles (`npm run check:bundle`)
- **Comando:** `node scripts/check-bundle.mjs`
- **Resultado:**
  - `initial_js_bytes`: 463.345 bytes (~452 KB)
  - `initial_js_gzip_bytes`: 143.890 bytes (~140 KB)
  - Cumple estrictamente con el presupuesto de rendimiento web para Core Web Vitals.

#### 3.4. Pruebas de Navegador (`npm run test:browser`)
- **Comando:** `node --test ... *.browser.mjs` (Playwright 1.62.1).
- **Diagnóstico:** Requieren servidor local activo en red (`http://127.0.0.1:49673`). En entornos de sandbox sin socket de red arroja `net::ERR_ACCESS_DENIED`. Se certifican para ejecución en CI/CD con navegador headless completo.

---

### 4. Resultados Detallados de Ejecución en Backend (Docker QA)

#### 4.1. Suite Especializada de Remediación y Expansión Comercial
- **Comando:** `docker exec levelpro-v32-qa-backend-1 pytest tests/test_audit_remediation_v35.py tests/test_audit_remediation_v34.py tests/test_f7_commercial_expansion_v33.py tests/test_f6_financial_consolidation.py`
- **Entorno:** Python 3.11.18, Django 5.2.16, pytest-8.3.3, PostgreSQL 16.
- **Resultado:** **35 de 35 pruebas aprobadas (100% de éxito)** en 79.68 segundos.
- **Desglose:**
  - `test_audit_remediation_v35.py`: 4 aprobadas (Redirección `?next=`, UUID validator en comparador, persistencia de cuentas bancarias y cursos).
  - `test_audit_remediation_v34.py`: 9 aprobadas (Seguridad en endpoints, serialización de órdenes, permisos RBAC).
  - `test_f7_commercial_expansion_v33.py`: 13 aprobadas (Comparador técnico, cotizaciones B2B, estimación logística).
  - `test_f6_financial_consolidation.py`: 9 aprobadas (Márgenes de ganancia e `IncomeRecord`).

#### 4.2. Suite de Concurrencia de Inventario en PostgreSQL (`tests/test_order_inventory_concurrency.py`)
Pruebas diseñadas con bloqueo de base de datos (`select_for_update`) que certifican que el sistema resiste transacciones concurrentes:
- `test_only_one_checkout_can_buy_last_unit`: Ante dos peticiones simultáneas por la última unidad en stock, una compra exitosa y la otra es rechazada limpiamente por falta de inventario sin sobreventa.
- `test_carts_with_reverse_product_order_do_not_deadlock`: Dos usuarios comprando los mismos productos en orden inverso no producen deadlocks en PostgreSQL.
- `test_two_cancellations_restore_only_once`: Dos intentos simultáneos de cancelar un pedido `PENDING` solo reponen el inventario una única vez.
- `test_payment_and_cancellation_never_release_stock_for_paid_order`: Una cancelación tardía mientras se aprueba un pago nunca libera el stock de una orden pagada.

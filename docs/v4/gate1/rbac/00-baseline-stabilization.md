# LEVELPRO OS V4.0 — GATE 1.1 RBAC
## 00. Estabilización de Línea Base y Certificación de Entorno Real

**Documento:** `docs/v4/gate1/rbac/00-baseline-stabilization.md`  
**Versión:** 4.1.0-alpha  
**Fecha de Certificación:** 20 de Noviembre de 2026  
**Líderes de Ingeniería:** Senior Software Architect, QA Automation Lead & DevOps Engineer  
**Estado:** BLOQUE A COMPLETADO AL 100% — AUTORIZADO EL INICIO DE BLOQUE B  

---

### 1. Reconciliación Documental Definitiva

En estricto cumplimiento de la directiva de la Dirección Técnica, se han establecido como documentos rectores unívocos:
1. `docs/v4/master/roadmap-17-gates.md`
2. `docs/v4/master/functional-backlog-matrix.md`
3. `docs/v4/master/transversal-architecture.md`

#### 1.1. Rectificación del Roadmap Maestro Oficial (17 Gates)
Se rectificó la discrepancia numérica detectada en los resúmenes ejecutivos previos. El orden y alcance oficial inalterable de las 17 compuertas es:

- **GATE 0 — Discovery & Audit:** Auditoría integral 360° y diagnóstico arquitectónico preliminar.
- **GATE 0.1 — Baseline Certification:** Rectificación técnica y certificación empírica de línea base.
- **GATE 1 — Security & Business Core:** RBAC granular, Audit Trail inmutable, desacoplamiento de migraciones y contratos de negocio.
- **GATE 2 — Product Information Management (PIM):** Variantes dimensionales, edición masiva y catálogo técnico.
- **GATE 3 — Supplier Management:** Directorio de distribuidores, condiciones comerciales y listas de costo.
- **GATE 4 — Warehouse Management:** Multi-bodega, Kardex inmutable, serialización tri-estado y reservas.
- **GATE 5 — Procurement Management:** Órdenes de compra (PO), recepción física, mermas y aduanas.
- **GATE 6 — Cost & Pricing Intelligence:** Capas de costo histórico y costeo Landed (CPP).
- **GATE 7 — Order Management System (OMS):** Ventas manuales/drafts, WhatsApp y desacople pedido/pago.
- **GATE 8 — CRM & B2B Management:** Ficha 360° de estudio, cotizaciones formales en PDF y crédito comercial.
- **GATE 9 — Financial Management:** Conciliación bancaria, cuentas por cobrar/pagar, tesorería multi-moneda y DTE.
- **GATE 10 — Logistics & After-Sales:** Integración de couriers, guías, RMA y servicio técnico de taller.
- **GATE 11 — Marketing & Customer Growth:** Cupones de descuento, promociones automáticas y carritos abandonados.
- **GATE 12 — Website & Content Management:** CMS Editorial Bento visual, banners programados y versiones.
- **GATE 13 — Admin Experience:** Unificación visual global Bento UI (320px a 4K) y Command Palette `Cmd+K`. **Regla de entrega:** Cada gate previo entrega sus interfaces funcionales correspondientes sin esperar a Gate 13.
- **GATE 14 — Ecosystem, Specialized Portals & Business Intelligence:** Evolución especializada de todos los paneles administrativos verticales actuales:
  - *Academia y Certificaciones:* Gestión de Cursos, Módulos, Lecciones en video firmado, Inscripciones y Certificados.
  - *Servicios Profesionales:* Categorías, agendamiento de reservas (`ServiceBooking`) y solicitudes (`ServiceInquiry`).
  - *Loyalty & Rewards:* Cuentas de fidelización (`LoyaltyAccount`), transacciones de puntos y campañas de sorteos (`rewards.Campaign`, `Entry`).
  - *Pagos y Pasarelas:* Configuración de métodos (`PaymentMethodConfig`), transferencias bancarias y monitoreo de webhooks.
  - *Business Intelligence:* Rotación DSI, rentabilidad por marca/categoría y hub SoundMap.
- **GATE 15 — Enterprise Release & Certification:** Hardening de seguridad, auditoría de carga y release a producción.

#### 1.2. Preservación del Backlog Funcional BF-01 a BF-47
Se verificó que los 47 requerimientos funcionales conservan con precisión matemática sus identificadores históricos y su correspondencia con el roadmap, sin reasignar IDs a funcionalidades disímiles.

---

### 2. Certificación del Entorno Real y Dependencias Efectivas

Se auditaron empíricamente los runtimes, lockfiles, contenedores y bases de datos activas:

| Dimensión | Valor Certificado en Repositorio / Runtime | Hash de Integridad / Versión Exacta |
| :--- | :--- | :--- |
| **Commit Base de Referencia** | `origin/main` | `e33f699a55b2709a6921b0c65fe301d2477ee9a8` |
| **Commit Local de Preflight** | `feature/v4-gate0-audit` | `52646b729a50b6e6b1c069f5507dee8e9f42a6df` |
| **Frontend Lockfile** | `frontend/package-lock.json` | SHA256: `76e1366181f4664b8e445ce93085f9303db377d22b259960a6e518cd11a862d2` |
| **Backend Dependencies Lock** | `backend/requirements.txt` | SHA256: `1c2afd2bcc4afc69bb9460fc6f586cac55c143ba16abee7421b611d8c026612d` |
| **Backend Base Requirements** | `backend/requirements/base.txt` | SHA256: `cca2bc5ed07a8c3fde3da2787f754316afc54279f33ff04223b2dbab864b4053` |
| **Runtime Python** | Contenedor QA (`levelpro-v32-qa-backend-1`) | `Python 3.11.18` (GCC 14.2.0) |
| **Runtime Node / npm** | Estación de trabajo macOS | `Node v22.23.1` / `npm 10.9.8` |
| **Motor Base de Datos** | Contenedor QA (`levelpro-v32-qa-db-1`) | `PostgreSQL 16.13 on x86_64-pc-linux-musl` |
| **Django Framework** | Python package en contenedor | `Django 5.2.16` |
| **Frontend Build Tool** | Node module en `frontend/` | `Vite 8.3.5` |
| **Frontend UI Library** | Node module en `frontend/` | `React 19.3.1` / `React DOM 19.3.1` |
| **Frontend Routing** | Node module en `frontend/` | `React Router DOM 7.18.4` |
| **Linter Estático** | Node module en `frontend/` | `ESLint 9.39.5` |
| **Browser Testing Tool** | Global/Local CLI | `Playwright 1.62.1` |
| **Estilos CSS** | Tailwind Engine | `TailwindCSS 4.2.2` |
| **Settings Django Efectivos** | Variable de entorno en QA | `config.settings.local_qa` |
| **Base de Datos Efectiva** | PostgreSQL DB Name | `levelpro_v32_qa` (Usuario: `levelpro_qa`) |

---

### 3. Resolución Rigurosa de Fallos de Línea Base

#### 3.1. Remediación de las 14 Pruebas SEO Fallidas
- **Causa Raíz:** El entorno de pruebas QA configuraba `SITE_URL = "http://127.0.0.1:3000"` en `local_qa.py`. Las pruebas de `apps/seo` realizaban aserciones estrictas de cadenas esperando `https://levelproaudio.com`.
- **Aislamiento Implementado:**
  - En `backend/apps/seo/tests.py`: Decoración de `SitemapTest` con `@override_settings(SITE_URL="https://levelproaudio.com")`.
  - En `backend/apps/seo/tests_metadata.py`: Definición de fixture de sesión aislada `@pytest.fixture(autouse=True)` que inyecta `settings.SITE_URL = "https://levelproaudio.com"`.
- **Integridad:** Cero lógica productiva modificada. Cero aserciones debilitadas. Validaciones canónicas, sitemap y robots preservadas al 100%.
- **Resultado de Ejecución:** **25 pruebas ejecutadas, 25 APROBADAS (100%)** en 12.22s.

#### 3.2. Remediación de la Prueba Playwright Fallida
- **Causa Raíz:** En `frontend/tests/routes.browser.mjs`, la prueba de la ruta `/checkout` fallaba en `assert.deepEqual(writes, [])` porque `Checkout.jsx` invoca en su montaje la estimación de fletes regionales: `estimateShipping()` (`POST /api/v1/billing/shipping/estimate/`). Al ser un método `POST`, el interceptor lo catalogaba indebidamente como una mutación de escritura.
- **Aislamiento Implementado:** Al igual que el cálculo de recompensas (`POST /api/v1/rewards/preview/`), se incorporó el interceptor para responder de forma sintética a la cotización de flete con `{ rates: [] }` antes de verificar que no existan escrituras reales.
- **Integridad:** Se preservó estrictamente la verificación de que visitar `/checkout` **no crea pedidos (`/api/v1/orders/`) ni ejecuta mutaciones de pago**.
- **Resultado de Ejecución:** **13 de 13 pruebas de rutas aprobadas (100%)** y **91 de 91 pruebas Playwright en navegador aprobadas (100%)**.

#### 3.3. Validación Nginx en Entorno Linux Compatible
- **Causa Raíz:** En la estación de trabajo de desarrollo macOS, el comando `npm run test:nginx` fallaba con `spawn nginx ENOENT` por ausencia del binario nativo de Linux.
- **Ejecución Certificada:** Se ejecutó la prueba dentro de un contenedor Linux `node:22-alpine` con Nginx oficial (`1.30.7`).
- **Resultado:** **1 de 1 prueba APROBADA (100%)** validando el proxy reverso, fallback de metadatos SEO y protección de credenciales en 3.84s.

#### 3.4. Justificación Exhaustiva de las 6 Pruebas Omitidas (Skips)
Las 6 pruebas marcadas como `SKIPPED` en la suite de backend corresponden a scripts de smoke testing e integración HTTP contra el entorno remoto previo (`emergentagent.com`):
1. `tests/test_admin_endpoints.py`: Requiere variables `REACT_APP_BACKEND_URL`, `TEST_ADMIN_EMAIL` y `TEST_ADMIN_PASSWORD`.
2. `tests/test_service_requests.py`: Requiere variables de credenciales de cliente para endpoints externos.
3. `tests/test_admin_bugs.py`: Smoke tests contra la URL de preview externa.
4. `tests/test_rewards.py`: Tests dependientes de servidor staging externo.
5. `tests/test_site_settings.py`: Smoke tests remotos de configuración.
6. `tests/test_loyalty.py`: Tests dependientes de base de datos remota con stock sembrado.

*Dictamen:* No existen fallos ocultos mediante skips en la suite de código local. La totalidad de las 43 aplicaciones de Django cuenta con cobertura unitaria activa en `apps/*/tests*.py`.

---

### 4. Evidencia Auténtica de Concurrencia PostgreSQL 16

Se ejecutó la suite de inventario y concurrencia directamente en PostgreSQL 16 (`levelpro-v32-qa-backend-1` conectado a `levelpro-v32-qa-db-1`) utilizando sus identificadores reales de código:

#### 4.1. Concurrencia Pura (`backend/tests/test_order_inventory_concurrency.py`)
- `test_only_one_checkout_can_buy_last_unit[False]`: **PASSED**
- `test_only_one_checkout_can_buy_last_unit[True]`: **PASSED**
- `test_carts_with_reverse_product_order_do_not_deadlock`: **PASSED**
- `test_two_cancellations_restore_only_once`: **PASSED**
- `test_payment_and_cancellation_never_release_stock_for_paid_order`: **PASSED**
- `test_admin_and_customer_cancellation_share_same_guard`: **PASSED**
*Subtotal:* 6 de 6 pruebas APROBADAS (100%) en 27.72s.

#### 4.2. Integridad Transaccional de Inventario (`backend/tests/test_order_inventory.py`)
- 50 casos de prueba que cubren: prevención de overselling por líneas duplicadas, deducción atómica de componentes de kits, retención de snapshots tras eliminación de productos, reversa de stock por rechazo de pago manual, idempotencia de webhook de Mercado Pago y PayPal.
*Subtotal:* 50 de 50 pruebas APROBADAS (100%) en 67.78s.

**Total Concurrencia e Inventario PostgreSQL 16:** **56 de 56 pruebas APROBADAS (100%)**.

---

### 5. Criterio de Salida del Bloque A — Certificación Final

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CERTIFICACIÓN BLOQUE A: ESTABILIZACIÓN               │
├─────────────────────────────────────────────────────────────────────────────┤
│ [✓] 0 fallos no resueltos en suites de backend y frontend.                  │
│ [✓] 14/14 pruebas SEO corregidas con aserciones estrictas preservadas.      │
│ [✓] 1/1 prueba Playwright corregida sin debilitar guardas de mutación.      │
│ [✓] 1/1 prueba Nginx ejecutada con éxito en contenedor Linux.               │
│ [✓] 6/6 skips justificados como integración HTTP contra staging remoto.     │
│ [✓] 56/56 pruebas de inventario y concurrencia certificadas en PostgreSQL. │
│ [✓] Entorno y dependencias auditados y contrastados con el repositorio.    │
│ [✓] Reconciliación del Roadmap oficial de 17 Gates completada.              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Conclusión:** Se autoriza formalmente la transición inmediata al **BLOQUE B: GATE 1.1 — RBAC GRANULAR Y PROTECCIÓN DE DATOS SENSIBLES**.

# LEVELPRO OS V4.0 — GATE 13 · PHASE 2.2
## Issues and Deviations Log

**Estado de Cierre Técnico Local:** **`PARTIAL`** — Cobertura interactiva `315 / 315` y suite nativa `91 / 91` resueltas al `100%`; defecto pre-existente `ISS-10` reproducido y documentado formalmente como abierto conforme al contrato operativo vigente.

### Defectos y Brechas Resueltos (`ISS-01` .. `ISS-11`)

| ID | Módulo / Archivo | Hallazgo | Corrección Aplicada | Fase |
| :--- | :--- | :--- | :--- | :---: |
| `ISS-01..08` | Shell, identidades `logo.png`, `Audit/Roles`, `Rewards/Services`, `/admin/fiscal`, `window.confirm`, modales ad-hoc, responsive | Desviaciones visuales o modales legacy detectados en Phase 2 | Scoping `.admin-precision`, migración 100% `admin/ui`, cero Bento, `0/234` overflows | Phase 2 (`d98ef8b`) |
| `ISS-09a..c` | `AdminProductDetail.jsx`, `AdminOrders.jsx`, `AdminLayout.jsx` | `UnsavedChangesBar` sin montar, `OrderPanel` sin footer sticky, faltaba `.v3-brand` | Montado `UnsavedChangesBar` + footer sticky + clase `.v3-brand` | Phase 2.1 (`6299ce2`) |
| `ISS-11` | `AdminUsers.jsx`, `AdminLayout.jsx`, `tests/v3-2-1-academy.browser.mjs` | `10 / 91` fallas en `npm run test:browser` (`6` contrato `/admin/users`, `3` selector `.v3-brand` en drawer móvil `< 1024px`, `1` timeout frío Vite) | Restaurada leyenda de paginación en tab `rbac`, `data-testid="admin-mobile-brand"` en topbar móvil, adaptación de prueba al contrato CRM 360° vigente + warmup Vite -> **`91 / 91` PASS** | Phase 2.2 |
| `DEV-02` (Resuelto) | `frontend/tests/gate13-interactive-136.browser.mjs` | `136 / 315` superficies estaban clasificadas como `MIGRATED_CODE_ONLY_NOT_EXERCISED` | Ejecución interactiva automatizada de las `136` superficies faltantes (`18` tabs, `62` overlays, `33` tablas, `23` formularios) con evidencia grabada 1 a 1 -> **`315 / 315` `COMPLETE`** | Phase 2.2 |
| `ISS-12` (Resuelto en QA) | `frontend/src/styles/admin-nimbus-tokens.css` | Dentro de `FormModal` con `scrollableBody` (`display: flex; flex-direction: column`), `.au-tabs` podía comprimirse verticalmente al abrir `ProductModal` | Agregado `flex-shrink: 0` en `.admin-precision .au-tabs`; pestañas del modal de producto clickables limpiamente | Phase 2.2 |

---

### Expediente Formal de Defecto Abierto: `ISS-10`

- **ID:** `ISS-10`
- **Título:** Creación de orden manual falla HTTP `400` cuando el producto seleccionado tiene variantes activas
- **Estado:** **`OPEN` (Known Defect — No intervenido por mandato Phase 2.2 de preservar el contrato OMS actual)**
- **Prioridad / Severidad:** **P1 — Alta (Bloqueo funcional en back-office para ventas manuales/telefónicas de SKUs multi-variante)**
- **Origen / Antigüedad Verificada:** Pre-existente desde **Gate 7**, introducido en el commit **`52f6549`** al implementar el selector simple `manual-product-select` en `frontend/src/pages/admin/AdminOrders.jsx`. No fue introducido ni modificado por Gate 13 (`fa53c7f..HEAD`).
- **Alcance Técnico Exacto:**
  - Archivo frontend: `frontend/src/pages/admin/AdminOrders.jsx` (modal `"Nueva Orden Manual"`, control `[data-testid="manual-product-select"]`).
  - Causa raíz UI: el selector de producto agrega `{ product_id, quantity }` al ítem de `DraftOrder`, sin consultar ni exigir `variant_id` cuando el `Product` seleccionado posee variantes (`product.has_variants === true` / `variants.length > 0`).
  - Respuesta real backend (`levelpro-v32-qa-backend-1`): `POST /api/v1/admin/orders/` retorna **HTTP `400`** con `{"error":"Debes seleccionar una variante para <Nombre Producto>."}`.
- **Evidencia Reproducible Ejecutada contra PostgreSQL 16 QA:**
  - Prueba automatizada `PG16-REPRODUCE-ISS10` en `e2e-postgres16-deep-phase22.json`.
  - Resultado observado: envío real en el modal `"Nueva Orden Manual"` sobre producto multi-variante `RME UFX III P22` -> rechazo reproducible HTTP `400` (`{"error":"Debes seleccionar una variante para RME UFX III P22 1795729184121 Verified."}`).
- **Propuesta de Remediación (Fuera de Gate 13 Phase 2.2 — para backlog OMS/Gate dedicado):**
  1. Cuando el usuario elija un `Product` en `AdminOrders.jsx` con `has_variants` o `variants.length > 0`, cargar/mostrar un selector secundario obligatorio de variante (`variant_id`) dentro de la fila del ítem antes de habilitar el guardado del borrador.
  2. Enviar `{ product_id, variant_id, quantity }` en el payload `POST /admin/orders/` y agregar cobertura E2E PG16 de conversión `DraftOrder -> Order` con SKU multi-variante.

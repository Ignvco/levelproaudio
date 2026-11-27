# LEVELPRO OS V4.0 — GATE 13 (V2.0 HARDENED · PHASE 1)
## PLAN INTEGRAL DE PRUEBAS, QA MULTI-VIEWPORT Y CERTIFICACIÓN BASADA EN EVIDENCIA

- **Repositorio:** `Ignvco/levelproaudio`
- **Rama / HEAD:** `feature/v4-gate13-admin-experience` @ `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`
- **Entorno QA obligatorio para Phase 2:** Frontend Vite 8 / React 19 + Backend Django / DRF conectado a **PostgreSQL 16 QA local** (cero llamadas a pasarelas de pago reales, couriers productivos, SII/AFIP real ni infraestructura de producción).

---

## 1. SEPARACIÓN ESTRICTA DE CATEGORÍAS DE EVIDENCIA (BLINDAJE 5)

Conforme a la Sección 11 del Master Prompt V2.0, Phase 2 producirá **7 tipos de evidencia independientes y no intercambiables**. Queda prohibido presentar una captura con fixtures como si fuera un E2E real, o un smoke test como sustituto de revisión humana:

| # | Categoría de Evidencia | Qué Demuestra Exactamente | Qué NO Sustituye | Artefacto de Salida en Phase 2 |
|---|---|---|---|---|
| **1** | **Screenshot Comparativo (`BEFORE` vs `AFTER`)** | Transformación visual real entre `fa53c7f9` y el rediseño Tiendanube/Nimbus bajo condiciones deterministas idénticas | No prueba persistencia en BD ni ausencia de bugs interactivos | `gate13_v2_tiendanube_before/`, `gate13_v2_tiendanube_after/` + `gate13_v2_tiendanube_manifest.json` (SHA-256) |
| **2** | **Visual Smoke & Anti-Regression DOM Audit** | Ausencia de `ErrorBoundary`, `0` errores JS/consola, `0px` overflow horizontal y `0` anti-patrones prohibidos (`VIS-BAN-01..08`) en las `234` combinaciones | No sustituye interacción de formularios ni transacciones PostgreSQL | `gate13_v2_234_routes_viewports_matrix.json` |
| **3** | **Fixture Sintético Controlado** | Renderizado determinista de estados bordes difíciles de forzar simultáneamente (vacío, error `500`, carga skeleton, multi-moneda `ARS`/`USD`, paginación alta) | **Jamás se declarará como E2E real**; se etiqueta `test_mode: "synthetic_fixture"` | Suite Playwright `admin-states-fixtures.spec.mjs` |
| **4** | **Test Unitario Frontend** | Lógica pura de formateo monetario sin conversión implícita, selectores de dashboard, estados de query, SEO y cálculos auxiliares | No valida renderizado CSS ni integración API | `npm run test:unit` (`12` suites `.test.mjs` existentes + unit tests de nuevos primitivos `ui/`) |
| **5** | **E2E Real (Playwright $\rightarrow$ Vite $\rightarrow$ Django $\rightarrow$ PostgreSQL 16 QA)** | Flujo operativo completo desde clic en el nuevo UI Nimbus hasta escritura transaccional en PostgreSQL 16, asiento en Kardex/Audit Trail y recarga en pantalla | No sustituye la matriz visual de los 6 viewports | Suite `gate13_v2_real_e2e_postgres16.mjs` + reporte JSON con IDs reales creados en BD QA |
| **6** | **Regresión Backend & Bundle Budget** | Integridad de contratos API/dominio Django y cumplimiento del presupuesto de bundle (`< 500 KB`) y linter (`0` warnings) | No evalúa estética ni usabilidad visual | Logs de `python manage.py test`, `npm run lint`, `npm run build` y `npm run check:bundle` |
| **7** | **Revisión Manual del Propietario** | Aprobación ejecutiva humana de fidelidad a Tiendanube e identidad LevelPro Audio sobre las 11 superficies clave | **Irreemplazable e indelegable** (jamás autodeclarada por el agente) | Gate formal de revisión humana |

---

## 2. MATRIZ DE COBERTURA RESPONSIVE: `39 RUTAS × 6 VIEWPORTS = 234 VERIFICACIONES`

### 2.1 Los 6 Viewports Obligatorios (Sección 13)
1. **`320×720`** — Mobile compacto extremo (prueba crítica de no desborde en tablas, tabs, modales y botones).
2. **`390×844`** — Mobile estándar (iPhone 14/15 Pro — drawer lateral `Sidebar` y áreas táctiles $\ge 44\text{px}$).
3. **`768×1024`** — Tablet vertical (iPad — colapso limpio de `Layout` 2 columnas a 1 columna y drawer lateral).
4. **`1280×800`** — Laptop compacta (`>= 1024px` — sidebar fijo `240px` y modo colapsado **`48px`** conforme a `UX13-P1-02` + tablas densas ERP).
5. **`1440×900`** — Desktop administrativo de referencia Tiendanube (`Layout` `2/3 + 1/3` y `SideModal` `580px`).
6. **`3840×2160`** — Monitor 4K / Ultrawide (verifica centrado/contención máxima de `Page.Body` sin estirar líneas de formulario a anchos ilegibles).

### 2.2 Las 39 Rutas Exactas bajo Verificación (`39 × 6 = 234`)
1. `/admin` · 2. `/admin/orders` · 3. `/admin/b2b` · 4. `/admin/special-orders` · 5. `/admin/payments` · 6. `/admin/payment-methods` · 7. `/admin/billing` · 8. `/admin/products` · 9. `/admin/products/:id` · 10. `/admin/products/import` · 11. `/admin/brands` · 12. `/admin/categories` · 13. `/admin/suppliers` · 14. `/admin/suppliers/:id` · 15. `/admin/procurement` · 16. `/admin/procurement?tab=receipts` · 17. `/admin/costing` · 18. `/admin/inventory` · 19. `/admin/logistics` · 20. `/admin/marketing` · 21. `/admin/academy` · 22. `/admin/academy/modules` · 23. `/admin/academy/lessons` · 24. `/admin/academy/enrollments` · 25. `/admin/academy/certifications` · 26. `/admin/services` · 27. `/admin/loyalty` · 28. `/admin/rewards` · 29. `/admin/rewards/campaigns` · 30. `/admin/rewards/campaigns/:id` · 31. `/admin/rewards/entries` · 32. `/admin/rewards/winners` · 33. `/admin/finance` · 34. `/admin/users` · 35. `/admin/roles` · 36. `/admin/audit` · 37. `/admin/settings` · 38. `/admin/login` · 39. `/admin/analytics` *(verifica redirección limpia a `/admin/finance`, más verificación adicional de `/admin/fiscal` $\rightarrow$ `/admin/billing`)*.

### 2.3 Aserciones Automáticas en Cada una de las 234 Celdas
- `pageErrors.length === 0` y `consoleErrors.length === 0`.
- `ErrorBoundary` ausente (`0` pantallas de fallo).
- `document.documentElement.scrollWidth <= viewport.width` (`overflow_px === 0`).
- Controles `VIS-BAN-01..08` cumplidos al 100 %.
- Presencia de `<main>` y `<h1>` único legible (excepto mientras redirige `/admin/analytics`).

---

## 3. PRUEBAS INTERACTIVAS DE COMPONENTES Y NAVEGACIÓN (SECCIÓN 13)

| ID Suite | Componente / Patrón Evaluado | Casos de Prueba Interactivos Obligatorios |
|---|---|---|
| `QA-INT-01` | **Sidebar Expandido (`240px`), Colapsado (`48px`) y Mobile** | 1) Expandir/colapsar acordeones (`Ventas`, `Productos`, `Compras`, `Rewards`, `Academia`, `Configuración`); 2) Persistir acordeón abierto al recargar subruta; 3) Alternar a modo rail **`48px`** (`menuExpanded=false`, verificando `getBoundingClientRect().width === 48`) y comprobar apertura de `Popover`/tooltip al hover/teclado; 4) En `390×844`, abrir drawer desde botón hamburguesa, navegar a una ruta y confirmar cierre automático del drawer + cierre con `Escape`. |
| `QA-INT-02` | **`DataTable` (`64` tablas), Filtros, `Chip`s y `BulkActions`** | 1) Escribir en buscador y limpiar con `×`; 2) Aplicar 2 filtros simultáneos, verificar aparición de `Chip`s y remover uno individualmente; 3) Ordenar columna ascendente/descendente (`aria-sort`); 4) Seleccionar 2 filas con checkbox $\rightarrow$ verificar aparición de barra sticky `BulkActions` $\rightarrow$ abrir acción masiva; 5) Cambiar tamaño de página y navegar con `Pagination`; 6) Verificar `0` cabeceras oscuras sobre las **64 tablas** (`SURF-TBL-001..064`). |
| `QA-INT-03` | **`Tabs` y Modos Internos (`90` elementos)** | Recorrido programático haciendo clic en **cada una de las 84 pestañas internas y 6 selectores de modo/viewport** (`SURF-TAB-001..090`) de los 14 módulos con tabs (`Orders`, `ProductDetail`, `Inventory`, `Finance`, `Logistics`, `Marketing`, `Settings`, `Costing`, `Procurement`, `B2B`, `Users`, `Roles`, `Services`, `Loyalty`), verificando `0` errores JS, `aria-selected="true"` y ausencia de tablas/inputs oscuros ocultos en tabs secundarias. |
| `QA-INT-04` | **Formularios (`34` editores + `42` `FormModal`), Validaciones y Guardado** | 1) Enviar formulario con campo requerido vacío $\rightarrow$ verificar `FormField appearance="danger"` con `aria-invalid="true"`; 2) Modificar campo en `AdminProductDetail` o `AdminSettings` $\rightarrow$ verificar activación de `UnsavedChangesBar`; 3) Guardar y confirmar estado `loading` que impide doble envío + aparición de `Toast`. |
| `QA-INT-05` | **Overlays Unificados (`73` elementos: `Modal`, `SideModal`, `ConfirmationModal`, `Popover`)** | 1) Abrir `SideModal` (`OrderPanel`, `CRM 360°`, `Audit Detail`, `BulkEditModal`) $\rightarrow$ verificar trap de foco con `Tab` / `Shift+Tab` $\rightarrow$ cerrar con `Escape` y comprobar devolución del foco al botón disparador; 2) Abrir `ConfirmationModal` destructivo (incluyendo los `4` flujos migrados desde `window.confirm`) $\rightarrow$ probar `Cancelar` (sin mutación) y `Confirmar`. |
| `QA-INT-06` | **Command Palette (`⌘K`) y Notification Center (`BF-32`)** | 1) Disparar `Meta+K` / `Control+K` desde cualquier vista $\rightarrow$ buscar por SKU/orden/módulo $\rightarrow$ navegar con flechas `↓` + `Enter`; 2) Abrir campana `BF-32` en header $\rightarrow$ filtrar no leídas $\rightarrow$ ejecutar *Marcar todas como leídas* y verificar actualización del `Badge`. |
| `QA-INT-07` | **Aislamiento de Tienda Pública y Preview CMS (`Gate 12`)** | 1) En `/admin/settings` tab `preview`, alternar entre `1440px`, `768px`, `390px` y `320px`; 2) Comparar estilos computados (`backgroundColor`, `fontFamily`, colores de botones y hero) dentro del `iframe` `/?cms_preview_version=...` contra `/` abierto directamente en navegador público $\rightarrow$ **diferencia computada = `0`**. |
| `QA-INT-08` | **RBAC Zero-Trust en Interfaz y API** | Autenticar 3 perfiles distintos en QA: (a) `super_admin` (acceso total), (b) `catalog_editor` / operador restringido (ve Catálogo, no ve ni puede mutar Tesorería/Roles, `approve_payments=false` deshabilita selector financiero en `OrderPanel`), (c) cliente regular no-staff (redirigido inmediatamente fuera de `/admin`). |

---

## 4. SUITE E2E REAL CONTRA DJANGO + POSTGRESQL 16 QA (12 FLUJOS POR FAMILIA DE DOMINIO)

Todos los flujos se ejecutarán contra una base de datos QA limpia/transaccional en **PostgreSQL 16**, usando datos sintéticos rotulados `QA-G13V2-*` y **sin tocar servicios externos reales**:

| ID E2E | Familia de Dominio | Flujo Operativo End-to-End Verificado en PostgreSQL 16 |
|---|---|---|
| `E2E-PG-01` | **Auth & Business Core** | Login real en `/admin/login` $\rightarrow$ carga de `/admin` (Dashboard Tiendanube) con datos reales en `CLP` $\rightarrow$ cambio de moneda a `USD` $\rightarrow$ búsqueda `Cmd+K` y lectura de notificación `BF-32`. |
| `E2E-PG-02` | **Catálogo, PIM, Variantes & Bulk** | Crear producto maestro en `/admin/products` $\rightarrow$ abrir `/admin/products/:id` $\rightarrow$ crear variante con SKU propio y guardar especificación técnica `BF-44` $\rightarrow$ ejecutar preview y aplicación en `BulkEditModal` (`SideModal` claro). |
| `E2E-PG-03` | **Proveedores & Procurement** | Crear proveedor en `/admin/suppliers` $\rightarrow$ vincularlo al SKU $\rightarrow$ crear, aprobar y emitir Orden de Compra (`OC`) en USD en `/admin/procurement` $\rightarrow$ confirmar Recepción de Mercadería (`GR`) en `?tab=receipts`. |
| `E2E-PG-04` | **WMS, Kardex & Seriales** | En `/admin/inventory`: verificar asiento `GOODS_RECEIPT` en `Kardex` $\rightarrow$ ejecutar Ajuste Atómico con motivo obligatorio en `FormModal` $\rightarrow$ regularizar seriales en `BF-46` y consultarlos en tab `Seriales`. |
| `E2E-PG-05` | **Costing, Landed Cost & WAC** | En `/admin/costing`: crear y finalizar asignación `Landed Cost` sobre la `GR` confirmada $\rightarrow$ verificar nueva capa FIFO y recálculo `WAC` $\rightarrow$ correr simulación de precios y aprobar propuesta comercial. |
| `E2E-PG-06` | **OMS, Venta Manual, Pagos & RMA** | En `/admin/orders`: crear Venta Manual $\rightarrow$ convertir en orden $\rightarrow$ abrir `OrderPanel` (`SideModal`) $\rightarrow$ registrar intento de pago idempotente $\rightarrow$ transicionar estados 3D $\rightarrow$ crear y autorizar solicitud `RMA`. |
| `E2E-PG-07` | **CRM 360°, Cotizaciones B2B & Crédito** | En `/admin/users`: crear Organización B2B y Ficha Cliente $\rightarrow$ abrir `SideModal` 360° y registrar interacción $\rightarrow$ en `/admin/b2b`: emitir Cotización Pro y solicitar/aprobar línea de crédito B2B. |
| `E2E-PG-08` | **Finanzas, Tesorería, Cartola & Tributario** | En `/admin/finance`: crear cuenta bancaria QA $\rightarrow$ importar cartola CSV sintética (`SHA-256`) $\rightarrow$ conciliar transferencia pendiente contra línea de cartola $\rightarrow$ navegar desde tab `Tributario` a `/admin/billing` y registrar folio fiscal asistido. |
| `E2E-PG-09` | **Logística, Etiquetas QA & Taller** | En `/admin/logistics`: registrar bulto sobre envío $\rightarrow$ generar etiqueta PDF QA (verificando advertencia de prueba `LOG10-ACCEPT-01`) $\rightarrow$ crear Orden de Taller (`OT`), registrar diagnóstico y prueba QA. |
| `E2E-PG-10` | **Marketing, Consentimiento, Loyalty & Rewards** | En `/admin/marketing`: crear cupón sintético `QA10`, verificar preview de precio y registro de consentimiento $\rightarrow$ ajustar puntos en `/admin/loyalty` $\rightarrow$ crear campaña en `/admin/rewards/campaigns`. |
| `E2E-PG-11` | **Editorial CMS (`Gate 12`)** | En `/admin/settings`: crear borrador CMS $\rightarrow$ editar título Hero $\rightarrow$ verificar renderizado exacto en `iframe` de `Previsualización` $\rightarrow$ publicar versión $\rightarrow$ verificar en `/` $\rightarrow$ ejecutar `Rollback` a versión previa. |
| `E2E-PG-12` | **Academia, Servicios, RBAC & Auditoría** | Crear curso y módulo en `/admin/academy*` $\rightarrow$ actualizar solicitud en `/admin/services` $\rightarrow$ inspeccionar matriz en `/admin/roles` $\rightarrow$ abrir `/admin/audit`, filtrar los eventos generados por `E2E-PG-01..11` y abrir el `SideModal` forense con diff JSON. |

---

## 5. PRESUPUESTO DE PERFORMANCE, BUILD Y NO-REGRESIÓN TÉCNICA

Para habilitar el cierre técnico de Phase 2 antes de solicitar revisión final del propietario, deberán pasar con código de salida `0`:
1. `cd frontend && npm run lint` (`0` errores, `0` warnings con `--max-warnings=0`).
2. `cd frontend && npm run build` (compilación limpia Vite 8 sin imports rotos ni CSS inválido).
3. `cd frontend && npm run check:bundle` (cumplimiento estricto del presupuesto de tamaño de bundle configurado en el repositorio).
4. `cd frontend && npm run test:unit` (`100 %` de los tests unitarios históricos y nuevos en verde).
5. `cd backend && python manage.py test` (`0` regresiones en suites de dominio Gates 1–12; dado que Phase 2 es exclusivamente frontend, cualquier fallo indicaría desalineación de entorno y nunca se resolverá mutilando contratos backend).

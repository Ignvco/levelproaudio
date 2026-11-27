# LEVELPRO OS V4.0 — GATE 13 (PHASE 1.1 · PRE-IMPLEMENTATION APPROVAL)
## TABLERO DE APROBACIÓN VISUAL PREVIA DEL PROPIETARIO (`UX13-P1-03`)

> Archivo histórico de Phase 1.1. Para la publicación documental solo se normalizaron enlaces locales; los originales se preservan en el paquete de custodia. La aprobación final de Phase 1.2 prevalece sobre este tablero preliminar.

- **Repositorio:** `Ignvco/levelproaudio`
- **Rama local conservada:** `feature/v4-gate13-admin-experience`
- **HEAD de referencia intacto:** `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`
- **Manifiesto criptográfico SHA-256:** **manifest.json** (referencia histórica; manifiesto original no incluido en el handoff; ver `custody-manifest.json` para los 33 PNG preservados) (`33` imágenes PNG: `11` referencias verificadas + `11` propuestas LevelPro + `11` láminas comparativas lado a lado).
- **Garantía de aislamiento (`UX13-P1-04`):** Las propuestas LevelPro se generaron desde un prototipo estático aislado fuera del árbol `frontend/` y `backend/`. **Cero archivos funcionales (`.jsx`, `.js`, `.py`) y cero hojas CSS del aplicativo modificados.**

---

## 1. IDENTIDAD CORPORATIVA Y METODOLOGÍA DEL TABLERO VISUAL

### 1.1 Tokens Corporativos Aplicados Obligatoriamente
- **Deep Black:** `#0B0E14` (texto primario `19.1:1`, botones primarios, píldora del logotipo oficial [logo.png](../../../frontend/src/assets/logo.png)).
- **Level Green:** `#1AFF6E` (indicador lateral de ruta activa, acento sobre `#0B0E14` con contraste `13.8:1` AAA; **prohibido como texto sobre blanco**).
- **Pure White:** `#F5F5F5` (lienzo general `AppShell.Body`) + `#FFFFFF` (superficie elevada de `Sidebar`, `Header`, `Card`, `DataTable`, `Input`, `Modal` y `SideModal`).
- **Graphite:** `#242A34` (tinta secundaria estructural `14.2:1` AAA).
- **Tipografías oficiales (1:1 con `@nimbus-ds/tokens` v9.8):** `Geist` (interfaz) y `Geist Mono` (`tabular-nums` en SKUs, seriales, folios y montos).
- **Fidelidad dimensional del Sidebar (`UX13-P1-02`):** Expandido `240px` (`menuExpandedWidth=240px`) y **colapsado `48px` exactos** (`menuCollapsedWidth=48px`, alojando botones de `36×36px` con `6px` de margen simétrico).

### 1.2 Honestidad Documental sobre las Referencias
- Todas las imágenes de la columna izquierda (**REFERENCIA TIENDANUBE / NIMBUS**) son capturas directas verificadas (`HTTP 200`) del Storybook oficial publicado por Tiendanube (`tiendanube.github.io/nimbus-patterns` y `nimbus-design-system`) y de `tiendanube.dev`.
- **Ninguna imagen sintética se presenta como captura privada de Tiendanube.** Cuando una vista interna de cuenta privada de merchant (como el Dashboard comercial con datos reales o el Detalle privado de una orden pagada) no es pública sin credenciales privadas, se utiliza el patrón/template oficial de Nimbus correspondiente y se etiqueta expresamente como **`DOCUMENTADO EN NIMBUS — NO VERIFICADO RESPECTO AL ADMINISTRADOR PRIVADO`**.

---

## 2. LAS 11 SUPERFICIES COMPARATIVAS (`REFERENCIA TIENDANUBE/NIMBUS | PROPUESTA VISUAL LEVELPRO`)

### Superficie 01 — Sidebar Expandido (`240px`) y Colapsado (`48px` Rail)
- **Lámina Comparativa:** **01-comp-sidebar.png** (custodia: `visual-board/comparisons/01-comp-sidebar.png`) (`SHA-256: 8dd01c8b8c70...`)
- **Referencia Nimbus (`HTTP 200`):** **01-ref-sidebar.png** (custodia: `visual-board/references/01-ref-sidebar.png`) — `patterns-menu--menu-inside-fixed-bar` + `patterns-menu--menu-collapsed` (`DOCUMENTADO EN NIMBUS`).
- **Propuesta LevelPro:** **01-prop-sidebar.png** (custodia: `visual-board/proposals/01-prop-sidebar.png`)
- **Diferencias deliberadas de marca y dominio:** Sustituye el azul Tiendanube por selección activa `#E8FFF0` + borde interior `3px` `#1AFF6E` + texto `#0B0E14` (`17.8:1` AAA) e incorpora acordeones limpios para los módulos ERP de LevelPro (*Compras, WMS, Costos, Finanzas, CMS, Academia, RBAC*).

![01. Sidebar Expandido 240px y Colapsado 48px](./visual-board/comparisons/01-comp-sidebar.png)

---

### Superficie 02 — Header Superior (`56px`), Command Palette (`⌘K`) y Notificaciones (`BF-32`)
- **Lámina Comparativa:** **02-comp-header.png** (custodia: `visual-board/comparisons/02-comp-header.png`) (`SHA-256: affa5c1916ea...`)
- **Referencia Nimbus (`HTTP 200`):** **02-ref-header.png** (custodia: `visual-board/references/02-ref-header.png`) — `patterns-appshell--demo-app` (`DOCUMENTADO EN NIMBUS` + `OBSERVADO EN TIENDANUBE` para `⌘K`).
- **Propuesta LevelPro:** **02-prop-header.png** (custodia: `visual-board/proposals/02-prop-header.png`)
- **Diferencias deliberadas de marca y dominio:** Elimina la isla flotante negra `v3-floating-header`; integra sobre barra blanca de `56px` el disparador `⌘K`, el selector explícito de moneda contable (`CLP`/`USD`/`ARS`), el popover de notificaciones operativas `BF-32` y el menú de perfil RBAC.

![02. Header Superior, Command Palette y Notificaciones](./visual-board/comparisons/02-comp-header.png)

---

### Superficie 03 — Dashboard (`/admin`)
- **Lámina Comparativa:** **03-comp-dashboard.png** (custodia: `visual-board/comparisons/03-comp-dashboard.png`) (`SHA-256: ac0b631e5928...`)
- **Referencia Nimbus (`HTTP 200`):** **03-ref-dashboard.png** (custodia: `visual-board/references/03-ref-dashboard.png`) — `templates-landingscreen--base` + `patterns-summarystats` (`DOCUMENTADO EN NIMBUS — NO VERIFICADO ADMIN PRIVADO`).
- **Propuesta LevelPro:** **03-prop-dashboard.png** (custodia: `visual-board/proposals/03-prop-dashboard.png`)
- **Diferencias deliberadas de marca y dominio:** Reemplaza por completo la tarjeta obsidiana y el donut neón Lumin por `SummaryStats` de 4 columnas en `Geist Mono`, bloque accionable *"Por resolver hoy"* (conciliación, stock crítico WMS, solicitudes taller), curva limpia de ventas sobre tarjeta `#FFFFFF` (trazo `#0B0E14` + área sutil `#1AFF6E`) y tabla de últimas órdenes.

![03. Dashboard Inicio LevelPro](./visual-board/comparisons/03-comp-dashboard.png)

---

### Superficie 04 — Catálogo de Productos (`/admin/products`)
- **Lámina Comparativa:** **04-comp-product-list.png** (custodia: `visual-board/comparisons/04-comp-product-list.png`) (`SHA-256: e93ddc88553b...`)
- **Referencia Nimbus (`HTTP 200`):** **04-ref-product-list.png** (custodia: `visual-board/references/04-ref-product-list.png`) — `templates-productlist--basic` (`DOCUMENTADO EN NIMBUS`).
- **Propuesta LevelPro:** **04-prop-product-list.png** (custodia: `visual-board/proposals/04-prop-product-list.png`)
- **Diferencias deliberadas de marca y dominio:** Conserva la anatomía exacta de `ProductList` de Tiendanube (buscador, filtros con `Chip`s removibles, miniatura `40×40`, `BulkActions` sticky al seleccionar filas y menú `⋮`), añadiendo columnas `SKU Maestro` y precios multi-moneda explícitos (`CLP` / `USD` / `ARS`) y acceso a `Edición masiva (BF-15)`.

![04. Catálogo de Productos](./visual-board/comparisons/04-comp-product-list.png)

---

### Superficie 05 — Formulario de Producto y Variantes (`/admin/products/:id`)
- **Lámina Comparativa:** **05-comp-product-form.png** (custodia: `visual-board/comparisons/05-comp-product-form.png`) (`SHA-256: 209b70c2ddf0...`)
- **Referencia Nimbus (`HTTP 200`):** **05-ref-product-form.png** (custodia: `visual-board/references/05-ref-product-form.png`) — `templates-form--basic` (`DOCUMENTADO EN NIMBUS`).
- **Propuesta LevelPro:** **05-prop-product-form.png** (custodia: `visual-board/proposals/05-prop-product-form.png`)
- **Diferencias deliberadas de marca y dominio:** Elimina el 100 % de los inputs negros `bentoInput` (`#0B0E14`), organizando la ficha PIM en grilla asimétrica `2/3 + 1/3` con pestañas limpias (*General, Variantes, Especificaciones BF-44, Proveedores*), controles blancos `#FFFFFF` y barra inferior fija de cambios sin guardar (`UnsavedChangesBar`).

![05. Formulario de Producto y Variantes](./visual-board/comparisons/05-comp-product-form.png)

---

### Superficie 06 — Detalle de Pedido y `SideModal` (`OrderPanel`)
- **Lámina Comparativa:** **06-comp-order-sidemodal.png** (custodia: `visual-board/comparisons/06-comp-order-sidemodal.png`) (`SHA-256: 7f080bb568a5...`)
- **Referencia Nimbus (`HTTP 200`):** **06-ref-order-sidemodal.png** (custodia: `visual-board/references/06-ref-order-sidemodal.png`) — `patterns-sidemodal--with-footer` (`DOCUMENTADO EN NIMBUS — NO VERIFICADO ORDEN PRIVADA`).
- **Propuesta LevelPro:** **06-prop-order-sidemodal.png** (custodia: `visual-board/proposals/06-prop-order-sidemodal.png`)
- **Diferencias deliberadas de marca y dominio:** Migra `.lp-drawer` al patrón oficial `SideModal` (`580px`) sobre fondo claro, manteniendo visibles los 3 estados desacoplados `BF-13` (*Comercial, Financiero, Logístico*), desglose de cupón, pago idempotente y acción de creación de `RMA`.

![06. Detalle de Pedido en SideModal](./visual-board/comparisons/06-comp-order-sidemodal.png)

---

### Superficie 07 — Patrón Unificado `DataTable` (`64` Tablas Reconciliadas)
- **Lámina Comparativa:** **07-comp-datatable.png** (custodia: `visual-board/comparisons/07-comp-datatable.png`) (`SHA-256: 27096e21bd3e...`)
- **Referencia Nimbus (`HTTP 200`):** **07-ref-datatable.png** (custodia: `visual-board/references/07-ref-datatable.png`) — `patterns-datatable-datatable-bulkactions--basic` (`DOCUMENTADO EN NIMBUS`).
- **Propuesta LevelPro:** **07-prop-datatable.png** (custodia: `visual-board/proposals/07-prop-datatable.png`)
- **Diferencias deliberadas de marca y dominio:** Sustituye las cabeceras negras `.au-table thead th` y las tablas dispares `.lp-table` en las **64 tablas** del inventario por `thead` claro `#F9FAFB`, barra `BulkActions` contextual, `Tag`s de alto contraste, menú flotante `⋮` (`RowMenu`) y `Pagination`.

![07. DataTable Unificada](./visual-board/comparisons/07-comp-datatable.png)

---

### Superficie 08 — Sistema de Formularios `FormField` (`34` Formularios + `42` `FormModal`)
- **Lámina Comparativa:** **08-comp-forms.png** (custodia: `visual-board/comparisons/08-comp-forms.png`) (`SHA-256: ddc0ecfa5e6b...`)
- **Referencia Nimbus (`HTTP 200`):** **08-ref-forms.png** (custodia: `visual-board/references/08-ref-forms.png`) — `tiendanube.dev/es-AR/documentation/patterns/form-field` (`DOCUMENTADO EN NIMBUS`).
- **Propuesta LevelPro:** **08-prop-forms.png** (custodia: `visual-board/proposals/08-prop-forms.png`)
- **Diferencias deliberadas de marca y dominio:** Implementa las 4 apariencias oficiales de `FormField` (`none`, `success`, `warning`, `danger`), selectores de bodega WMS, área monoespaciada para escáner de números de serie (`BF-46`), `FileUploader` con validación `SHA-256` y `Toggle` con pulgar `#1AFF6E` sobre `#0B0E14`.

![08. Formularios y Estados FormField](./visual-board/comparisons/08-comp-forms.png)

---

### Superficie 09 — Modales y Confirmaciones Destructivas (`73` Overlays Reconciliados)
- **Lámina Comparativa:** **09-comp-modals.png** (custodia: `visual-board/comparisons/09-comp-modals.png`) (`SHA-256: 4764c545a1fc...`)
- **Referencia Nimbus (`HTTP 200`):** **09-ref-modals.png** (custodia: `visual-board/references/09-ref-modals.png`) — `templates-confirmationmodal--basic` abierto (`DOCUMENTADO EN NIMBUS`).
- **Propuesta LevelPro:** **09-prop-modals.png** (custodia: `visual-board/proposals/09-prop-modals.png`)
- **Diferencias deliberadas de marca y dominio:** Homologa los `6` modales manuales `position:"fixed"` (ej. *Ajuste Atómico Kardex*) en `FormModal` claro (`border-radius: 8px`) y reemplaza los `4` `window.confirm` nativos por `ConfirmationModal` accesible con botón `DangerButton` (`#C80003`).

![09. Modales y Confirmaciones](./visual-board/comparisons/09-comp-modals.png)

---

### Superficie 10 — Configuración y Editorial CMS (`/admin/settings` — Gate 12 Protegido)
- **Lámina Comparativa:** **10-comp-settings-cms.png** (custodia: `visual-board/comparisons/10-comp-settings-cms.png`) (`SHA-256: 923d1cc49ed3...`)
- **Referencia Nimbus (`HTTP 200`):** **10-ref-settings-cms.png** (custodia: `visual-board/references/10-ref-settings-cms.png`) — `templates-settingspage--basic` (`DOCUMENTADO EN NIMBUS` + `INFERIDO` split preview CMS).
- **Propuesta LevelPro:** **10-prop-settings-cms.png** (custodia: `visual-board/proposals/10-prop-settings-cms.png`)
- **Diferencias deliberadas de marca y dominio:** El panel administrativo opera 100 % en tema claro estilo Tiendanube, mientras el `<iframe src="/?cms_preview_version=..." />` conserva intacta la estética oscura editorial de la tienda pública de LevelPro Audio sin ninguna fuga de CSS.

![10. Configuración y Editorial CMS](./visual-board/comparisons/10-comp-settings-cms.png)

---

### Superficie 11 — Mobile Responsive (`390×844` Drawer + `320×720` Sin Overflow)
- **Lámina Comparativa:** **11-comp-mobile.png** (custodia: `visual-board/comparisons/11-comp-mobile.png`) (`SHA-256: e6db1dda0b6b...`)
- **Referencia Nimbus (`HTTP 200`):** **11-ref-mobile.png** (custodia: `visual-board/references/11-ref-mobile.png`) — `patterns-menu--menu-inside-sidebar` + `templates-productlist--basic` en `390×844` (`DOCUMENTADO EN NIMBUS`).
- **Propuesta LevelPro:** **11-prop-mobile.png** (custodia: `visual-board/proposals/11-prop-mobile.png`)
- **Diferencias deliberadas de marca y dominio:** En `< 1024px` el sidebar se transforma en drawer deslizable con ítems de `44px` de alto táctil y, en `320×720`, las tarjetas y tablas mantienen `0px` de desborde horizontal.

![11. Mobile 390px y 320px](./visual-board/comparisons/11-comp-mobile.png)

---

## 3. RESUMEN DE INVENTARIO RECONCILIADO Y CRITERIOS DE APROBACIÓN DEL PROPIETARIO

| Categoría Auditada (`admin-surface-inventory.md`) | IDs Únicos 1 a 1 | Total Exacto |
|---|---|---|
| Rutas, redirecciones y enlaces | `SURF-RT-001` .. `SURF-RT-041` | **41** (*39 rutas certificadas + 2 de control*) |
| Superficies de App Shell (`240px` / `48px`) | `SURF-SHL-001` .. `SURF-SHL-005` | **5** |
| Pestañas internas (`84`) y modos/viewports (`6`) | `SURF-TAB-001` .. `SURF-TAB-090` | **90** |
| Overlays (`Modal`, `SideModal`, `Confirm`, `Popover`) | `SURF-OVL-001` .. `SURF-OVL-073` | **73** |
| Tablas de datos (`DataTable` + `<table>`) | `SURF-TBL-001` .. `SURF-TBL-064` | **64** |
| Formularios y editores fuera de `FormModal` | `SURF-FRM-001` .. `SURF-FRM-034` | **34** |
| Estados transversales de interfaz | `SURF-ST-001` .. `SURF-ST-008` | **8** |
| **TOTAL GENERAL SIN AGRUPACIONES** | **100 % reconciliado** | **315** |

### Decisión Requerida del Propietario para Habilitar Phase 2 (Hydrogen)
1. Confirmación estética de las **11 láminas comparativas** (`#0B0E14`, `#1AFF6E`, `#F5F5F5`, `#242A34`, `Geist`, `Geist Mono`, sidebar `240px`/`48px`).
2. Autorización expresa para iniciar la secuencia de implementación controlada (`Bloques A–O`) sobre las `315` superficies inventariadas.

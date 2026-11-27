# LEVELPRO OS V4.0 — GATE 13 (PHASE 1.1 · VALIDATED & RECONCILED)
## BLUEPRINT EJECUTABLE DE REDISEÑO INTEGRAL ESTILO TIENDANUBE / NIMBUS

- **Repositorio:** `Ignvco/levelproaudio`
- **Rama local:** `feature/v4-gate13-admin-experience`
- **HEAD base verificado:** `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`
- **Base Gate 12:** `6fa8254a8de68667aa8f578e40a378b82ba64628`
- **Controles Phase 1.1 incorporados:** `UX13-P1-01` (`315` superficies reconciliadas 1 a 1), `UX13-P1-02` (`48px` rail colapsado oficial Nimbus), `UX13-P1-03` (tablero visual estático en `owner-visual-approval-board.md`), `UX13-P1-04` (reversión no destructiva por SHA de commit).
- **Estado de ejecución:** **PHASE 1.1 (PLANIFICACIÓN Y TABLERO VISUAL CERRADOS — PENDIENTE DE APROBACIÓN DEL PROPIETARIO).**

---

## 1. TESIS ARQUITECTÓNICA Y AISLAMIENTO ESTRICTO DEL STOREFRONT

### 1.1 Principio Rector
Adoptar con **fidelidad estructural, espacial e interactiva máxima** el modelo administrativo de **Tiendanube Admin** y su sistema oficial **Nimbus Design System (`@nimbus-ds/*`)**, vestido exclusivamente con la identidad corporativa **LevelPro Audio** (`#0B0E14`, `#1AFF6E`, `#F5F5F5`, `#242A34`, `Geist`, `Geist Mono`, logotipo oficial), manteniendo el **100 % de las capacidades ERP/OMS/WMS/B2B/Finanzas/Marketing/CMS/RBAC** de LevelPro OS V4.0.

### 1.2 Contrato de Aislamiento CSS (Protección Tienda Pública y Preview CMS Gate 12)
- El Storefront público (`/`, `/shop`, `/checkout`, `/academy`, `/services`, `/rewards`) conserva intacta su identidad editorial oscura en `frontend/src/index.css`.
- Todos los tokens y reglas del nuevo administrador vivirán **exclusivamente bajo el ámbito `.admin-root`** (montado en `AdminLayout.jsx` y `AdminLogin.jsx`) y `.admin-portal-root` (para modales/popovers si usan portal).
- `frontend/src/styles/v3-editorial-bento.css` será **retirado del árbol administrativo** durante el Bloque C/D y reemplazado por `frontend/src/styles/admin-nimbus-tokens.css` + la evolución limpia de `frontend/src/styles/admin-ui.css` acotada a `.admin-root`.
- **Protección expresa de Gate 12 (`AdminSettings.jsx`):** El previsualizador en vivo renderiza `<iframe src="/?cms_preview_version=..." />` en un documento independiente que carga `MainLayout` + `Home` (fuera de `.admin-root`), garantizando **contaminación CSS cero (`0`)** entre el panel claro estilo Tiendanube y la tienda pública.

---

## 2. ARQUITECTURA DE TOKENS LEVELPRO-ON-NIMBUS (`.admin-root`)

Basada directamente en `@nimbus-ds/tokens` v9.8 (`spacing`, `typography`, `shape`, `shadow`, `zIndex`, `breakpoint`) y la marca LevelPro Audio:

```css
.admin-root {
  /* ── Identidad Corporativa LevelPro Audio sobre Superficie Clara Nimbus ── */
  --lp-brand-black: #0B0E14;          /* Deep Black oficial */
  --lp-brand-green: #1AFF6E;          /* Level Green oficial */
  --lp-brand-white: #F5F5F5;          /* Pure White oficial (lienzo AppShell) */
  --lp-brand-graphite: #242A34;       /* Graphite oficial */

  /* ── Superficies (Nimbus Light Neutral Equivalences) ── */
  --admin-bg: #F5F5F5;                /* AppShell.Body canvas */
  --admin-surface: #FFFFFF;           /* Card, DataTable, Sidebar, Header, Input, Modal */
  --admin-surface-subtle: #F9FAFB;    /* DataTable.Header, zonas secundarias */
  --admin-surface-hover: #F3F4F6;     /* Row/Menu hover */
  --admin-surface-disabled: #E7E7E7;  /* Controles disabled (Nimbus neutral.95) */
  --admin-surface-active-nav: #E8FFF0;/* Selección activa en Sidebar con contraste AAA */

  /* ── Texto y Jerarquía (WCAG 2.1 AA / AAA verificados) ── */
  --admin-text: #0B0E14;              /* 19.1:1 sobre #FFF */
  --admin-text-secondary: #242A34;    /* 14.2:1 sobre #FFF */
  --admin-text-muted: #525B68;        /* 6.8:1 sobre #FFF */
  --admin-text-disabled: #6D6D6D;     /* Nimbus neutral.50 */
  --admin-link: #0A6E31;              /* Verde accesible para enlaces en texto (6.4:1) */

  /* ── Bordes, Radios y Sombras (Nimbus Shape & Shadow) ── */
  --admin-border: #E2E5EA;            /* Borde sutil de Card y DataTable */
  --admin-border-strong: #CBD2D9;     /* Borde de Input / Select / Button secondary */
  --admin-radius-sm: 6px;             /* Input, Button, Menu.Button, Chip */
  --admin-radius-md: 8px;             /* Card, DataTable, Modal, Alert */
  --admin-radius-pill: 9999px;        /* Tag, Badge, Toggle */
  --admin-shadow-card: 0 1px 2px rgba(11, 14, 20, 0.04);
  --admin-shadow-popover: 0 4px 12px rgba(11, 14, 20, 0.08), 0 0 1px rgba(11, 14, 20, 0.12);
  --admin-shadow-modal: 0 20px 32px rgba(11, 14, 20, 0.16), 0 0 1px rgba(11, 14, 20, 0.12);

  /* ── Tipografía Nativa Nimbus + LevelPro ── */
  --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, monospace;

  /* ── Dimensiones de AppShell (Nimbus v1.10.0 — UX13-P1-02 1:1) ── */
  --admin-sidebar-expanded: 240px;
  --admin-sidebar-collapsed: 48px;    /* Fidelidad exacta menuCollapsedWidth=48px (botones 36x36 + 6px pad) */
  --admin-header-height: 56px;

  /* ── Escala Z-Index Determinista (Nimbus v9.8) ── */
  --z-sticky: 200;
  --z-header: 400;
  --z-sidebar: 500;
  --z-backdrop: 600;
  --z-drawer: 700;
  --z-popover: 800;
  --z-modal-backdrop: 1000;
  --z-modal: 1100;
}
```

---

## 3. ARQUITECTURA DE NAVEGACIÓN DEL SIDEBAR (`Menu` v2.0.3)

Se reemplaza por completo la isla superior flotante por el **Sidebar Vertical Fijo/Colapsable de Tiendanube**, agrupando las **38 rutas autenticadas** en la misma lógica mental de un merchant de Tiendanube ampliada a ERP:

1. **Inicio** (`/admin` — acceso directo)
2. **Gestión Comercial** (`Menu.Section`)
   - **Ventas** (`Menu.ButtonAccordion`, badge pedidos pendientes):
     - *Lista de ventas* (`/admin/orders`)
     - *Cotizaciones B2B* (`/admin/b2b`)
     - *Bajo pedido* (`/admin/special-orders`)
     - *Transacciones de pago* (`/admin/payments`)
   - **Productos** (`Menu.ButtonAccordion`):
     - *Lista de productos* (`/admin/products`)
     - *Inventario y WMS* (`/admin/inventory`)
     - *Categorías* (`/admin/categories`)
     - *Marcas* (`/admin/brands`)
     - *Importar catálogo* (`/admin/products/import`)
   - **Clientes** (`/admin/users` — Directorio CRM 360° & Organizaciones B2B)
3. **Operaciones y Abastecimiento** (`Menu.Section`)
   - **Compras e Importaciones** (`Menu.ButtonAccordion`):
     - *Órdenes de compra* (`/admin/procurement`)
     - *Recepciones (GR)* (`/admin/procurement?tab=receipts`)
     - *Proveedores* (`/admin/suppliers`)
   - **Logística y Postventa** (`/admin/logistics` — Envíos, Etiquetas, Garantías, Taller)
   - **Costos y Precios** (`/admin/costing` — Landed Cost, WAC, Márgenes y Simulador)
4. **Finanzas y Contabilidad** (`Menu.Section`)
   - **Finanzas y Tesorería** (`/admin/finance` — Conciliación, Cartolas, AR/AP, Flujo 30/60/90)
   - **Documentos Tributarios** (`/admin/billing` — DTE Asistido)
5. **Marketing y Crecimiento** (`Menu.Section`)
   - **Cupones y Promociones** (`/admin/marketing` — incluye Carritos Abandonados y Consentimiento)
   - **Fidelización (Loyalty)** (`/admin/loyalty`)
   - **Rewards y Sorteos** (`Menu.ButtonAccordion`):
     - *Resumen Rewards* (`/admin/rewards`)
     - *Campañas* (`/admin/rewards/campaigns`)
     - *Participaciones* (`/admin/rewards/entries`)
     - *Ganadores* (`/admin/rewards/winners`)
6. **Canales y Ecosistema** (`Menu.Section`)
   - **Tienda Online (CMS)** (`/admin/settings` — Hero, Banners, Secciones, SEO y Live Preview)
   - **Academia LevelPro** (`Menu.ButtonAccordion`):
     - *Cursos* (`/admin/academy`)
     - *Módulos* (`/admin/academy/modules`)
     - *Lecciones* (`/admin/academy/lessons`)
     - *Inscripciones* (`/admin/academy/enrollments`)
     - *Certificaciones* (`/admin/academy/certifications`)
   - **Servicios Técnicos** (`/admin/services`)
7. **Footer Fijo del Sidebar (`Menu.Footer`)**
   - **Configuración y Seguridad** (`Menu.ButtonAccordion`):
     - *Medios de pago* (`/admin/payment-methods`)
     - *Roles y permisos RBAC* (`/admin/roles`)
     - *Auditoría forense* (`/admin/audit`)
   - **Ver mi tienda ↗** (`/` en nueva pestaña)

---

## 4. WIREFRAMES ESTRUCTURALES DE LAS 11 SUPERFICIES DE REVISIÓN DEL PROPIETARIO (SECCIÓN 16)

*(Nota: Wireframes textuales de planificación; cero código modificado en Phase 1.)*

### 4.1 Superficies 1, 2 y 3: Sidebar + Header + Dashboard (`/admin`)
```text
+------------------------+--------------------------------------------------------------------------------+
| [LP Logo] LevelPro  [<]|  [🔍 Buscar pedidos, SKUs o secciones... (⌘K)        ]   [CLP v] [🔔 3] [👤 Admin]|
|------------------------+--------------------------------------------------------------------------------|
| ● Inicio               |  Inicio                                        [Mes actual] [↻] [+ Nuevo prod.]|
|                        |  Resumen operativo de LevelPro Audio en CLP                                    |
| GESTIÓN COMERCIAL      |                                                                                |
| ▾ Ventas           (4) |  +------------------+------------------+------------------+------------------+ |
|   Lista de ventas      |  | Ventas del mes   | Total órdenes    | Ticket promedio  | Efectividad env. | |
|   Cotizaciones B2B     |  | $14.850.000      | 42               | $353.571         | 91% (38/42)      | |
|   Bajo pedido          |  | ▲ +12% vs prev   | Pagadas en CLP   | Órdenes pagadas  | Enviadas/Compl.  | |
|   Transacciones        |  +------------------+------------------+------------------+------------------+ |
| ▸ Productos            |                                                                                |
|   Clientes             |  +---------------------------------------------------------------------------+ |
|                        |  | Por resolver hoy                                              3 pendientes| |
| OPERACIONES & ERP      |  | [!] 4 órdenes con pago pendiente de conciliación      -> Ir a Ventas      | |
| ▸ Compras & Import.    |  | [!] 6 SKUs con stock crítico bajo el mínimo           -> Ir a Inventario  | |
|   Logística y Taller   |  | [!] 2 solicitudes de servicio técnico sin asignar     -> Ir a Servicios   | |
|   Costos y Precios     |  +---------------------------------------------------------------------------+ |
|                        |                                                                                |
| FINANZAS               |  +------------------------------------------------+ +------------------------+ |
|   Finanzas y Tesorería |  | Evolución de ventas          [7D | 30D | 1A]   | | Ventas por categoría   | |
|   Doc. Tributarios     |  | (Gráfico limpio sobre tarjeta #FFFFFF con      | | █████░░░ Monitores 48% | |
|                        |  |  línea #0B0E14 y relleno sutil #1AFF6E 12%)    | | ███░░░░░ Interfaces 31%| |
| MARKETING & CANALES    |  +------------------------------------------------+ +------------------------+ |
|   Cupones y Promos     |                                                                                |
|   Tienda Online (CMS)  |  +---------------------------------------------------------------------------+ |
| ▸ Academia             |  | Últimas ventas                                      Ver todas las ventas →| |
|------------------------|  | #ORD-8F21  | 25 nov | Estudio Sur SpA | [Pagado] [En prep.] |  $1.290.000 | |
| ▸ Configuración        |  +---------------------------------------------------------------------------+ |
|   Ver mi tienda ↗      |                                                                                |
+------------------------+--------------------------------------------------------------------------------+
```
- **Sidebar Colapsado (`48px` exactos — `UX13-P1-02`):** Respeta fielmente `menuCollapsedWidth = 48px` de Nimbus `AppShell` `v1.10.0`, alojando botones de ícono de `36×36px` centrados con `6px` de margen lateral (`spacing.1-5`), indicador lateral `#1AFF6E` en la ruta activa y `Popover`/`Tooltip` instantáneo con submenú al pasar el cursor o enfocar con teclado (mientras en `< 1024px` opera como drawer móvil con áreas táctiles $\ge 44\times44\text{px}$).

### 4.2 Superficies 4 y 7: Listado de Productos (`/admin/products`) y Anatomía `DataTable`
```text
Productos                                                    [↓ Exportar CSV] [↑ Importar] [+ Agregar producto]
Gestioná tu catálogo maestro, precios multi-moneda, existencias y visibilidad.

+-------------------------------------------------------------------------------------------------------------+
| [🔍 Buscar por nombre, SKU o marca...          ]  [Categoría v] [Marca v] [Estado v] [Tipo v]               |
| Filtros activos: [Categoría: Micrófonos ×] [Estado: Activos ×]   Limpiar filtros                            |
|-------------------------------------------------------------------------------------------------------------|
| [✓] 3 productos seleccionados    [Edición masiva (BF-15)]  [Exportar selección]          Deseleccionar todo | <- Sticky BulkBar
|-------------------------------------------------------------------------------------------------------------|
| [ ] | Producto                          | SKU          | Stock disp. | Precio CLP  | USD / ARS   | Estado |⋮|
|-----|-----------------------------------|--------------|-------------|-------------|-------------|--------|-|
| [✓] | [🖼] Shure SM7dB Vocal Dynamic    | SHU-SM7DB    | 14 unid.    | $589.990    | US$610 / —  | Activo |⋮|
| [✓] | [🖼] Beyerdynamic DT 770 Pro (3v) | BEY-DT770    | 22 unid.    | $219.990    | US$229 / —  | Activo |⋮|
|-------------------------------------------------------------------------------------------------------------|
| Mostrando 1–20 de 148 productos   [20 / pág. v]                                        [<] [1] [2] [3] … [>]|
+-------------------------------------------------------------------------------------------------------------+
```

### 4.3 Superficies 5 y 8: Formulario de Producto + Variantes (`/admin/products/:id`) y `FormField`
```text
← Volver a Productos
Beyerdynamic DT 770 Pro                                  [Tag: Activo] [Ver en tienda ↗] [Guardar cambios]
SKU Maestro: BEY-DT770 · 3 variantes comerciales

[General y Multimedia]  [Variantes (3)]  [Especificaciones Técnicas (12)]  [Proveedores y Costos]
----------------------------------------------------------------------------------------------------------
+--- Columna Principal (66%) ---------------------------+ +--- Columna Lateral (34%) --------------------+
| [Card: Nombre y descripción]                          | | [Card: Publicación]                          |
|  Nombre del producto *                                | |  [●] Visible en tienda online                |
|  [Beyerdynamic DT 770 Pro                           ] | |  [○] Destacado en portada                    |
|  Ayuda: Nombre visible en el catálogo público.        | +----------------------------------------------+
|  Descripción corta                                    | | [Card: Organización]                         |
|  [Audífonos cerrados de referencia para estudio...  ] | |  Categoría: [Audífonos de Estudio       v]   |
|-------------------------------------------------------| |  Marca:     [Beyerdynamic               v]   |
| [Card: Fotos y multimedia]                            | |  Tipo:      [Con variantes              v]   |
|  [Portada ★] [Foto 2] [Foto 3] [+ Subir imágenes]     | +----------------------------------------------+
|-------------------------------------------------------| | [Card: Inventario base y alertas]            |
| [Card: Precios (aislamiento estricto de moneda)]      | |  SKU Maestro:  [BEY-DT770       ] (Mono)     |
|  Precio CLP *      Precio promocional CLP             | |  Stock total:  22 unid. (sincronizado WMS)   |
|  [$ 219.990     ]  [$ 249.990            ]            | |  Alerta mín.:  [3               ]            |
|  Precio USD (opc.) Precio ARS (opc.)                  | +----------------------------------------------+
|  [US$ 229.00    ]  [$ —                  ]            |
+-------------------------------------------------------+
[Barra sticky si hay cambios sin guardar]: ● Tenés cambios sin guardar          [Descartar] [Guardar cambios]
```

### 4.4 Superficies 6 y 9: Detalle de Pedido (`OrderPanel` `SideModal`), Modales y Confirmaciones
```text
                              +--- SideModal (580px, fondo #FFFFFF, zIndex 700) -------------------------+
                              | ← Ventas / Orden #8F21A90C                           [Online]     [✕]    |
                              |--------------------------------------------------------------------------|
                              | [Tag: Com. Confirmada]  [Tag: Pago Aprobado]  [Tag: Log. En preparación] |
                              |                                                                          |
                              | [Card: Productos del pedido (2)]                                         |
                              |  [🖼] Shure SM7dB · SKU SHU-SM7DB            1 × $589.990 = $589.990     |
                              |  Subtotal: $589.990 · Descuento (PRO10): -$58.999 · Total: $530.991 CLP  |
                              |                                                                          |
                              | [Card: Gestión de Estados 3D (BF-13)]                                    |
                              |  Comercial [Confirmada v] Financiero [Pagada v] Logístico [En prep. v]   |
                              |  Courier [Chilexpress]  Tracking [_________]  Motivo * [_______________] |
                              |                                              [Actualizar estados 3D]     |
                              |                                                                          |
                              | [Card: Pagos e Intentos Idempotentes]  |  [Card: Devoluciones / RMA]     |
                              |--------------------------------------------------------------------------|
                              | Footer fijo: [Cerrar]                         [+ Crear solicitud RMA]    |
                              +--------------------------------------------------------------------------+
```

### 4.5 Superficies 10 y 11: Configuraciones / CMS (`/admin/settings`) y Mobile (`320px` / `390px`)
- **CMS & Configuración (`/admin/settings`):** Barra superior limpia con estado de versión activa (`Publicada v14` / `Borrador v15`), pestañas horizontales claras y vista dividida `Layout`: a la izquierda tarjetas `Card` + `FormField` claras de edición editorial (Hero, Banners, Anuncios, Secciones, SEO, Parámetros FX); a la derecha (o pestaña *Previsualización*), barra de viewports (`1440px`, `768px`, `390px`, `320px`) envolviendo el `<iframe src="/?cms_preview_version=..." />` 100 % aislado.
- **Mobile (`320×720` y `390×844`):**
  - Header compacto `52px` (`[☰] [Logo LP] ... [🔍] [🔔] [👤]`).
  - `Sidebar` izquierdo deslizable a ancho `288px` (`max-width: 88vw`) con ítems táctiles de `44px` de alto.
  - `Page.Header` apila título arriba y botones de acción en fila flexible sin desborde (`0px` horizontal overflow).
  - `DataTable` encapsula scroll horizontal interno (`overflow-x: auto` dentro de `.au-card`) manteniendo paginación y barra `BulkActions` visibles sin ensanchar el `<body>`.

---

## 5. BLINDAJE 2 — PUERTA OBJETIVA ANTI-SUPERFICIALIDAD POR MÓDULO

Queda **prohibido** declarar un módulo como `COMPLETO` por el mero cambio de sidebar, header, tipografía o variables globales. Un módulo solo alcanza `COMPLETO` cuando acredita simultáneamente las 6 condiciones internas de su dominio:

| Familia de Dominio | Condiciones Internas Obligatorias para Declarar `COMPLETO` |
|---|---|
| **1. Dashboard (`/admin`)** | (a) Eliminación total de `.v3-card-obsidian` y donut neón; (b) `SummaryStats` claras; (c) bloque accionable de tareas pendientes reales; (d) gráfico Recharts sobre tarjeta clara; (e) tabla compacta de últimas órdenes; (f) selector moneda funcional. |
| **2. Catálogo / PIM (`/admin/products*`, `brands`, `categories`)** | (a) `DataTable` clara con miniaturas y filtros con `Chip`s; (b) barra `BulkActions` sticky conectada a `SideModal` claro de `BulkEditModal` (sin `#0B0E14`); (c) modal/vista de alta y edición con `FormField` claros; (d) `AdminProductDetail` migrado a layout Nimbus sin `bentoInput` negro en sus 4 tabs (`variantes`, `specs`, `proveedores`, `general`); (e) importador CSV con `FileUploader`; (f) reemplazo de `window.confirm` por `ConfirmationModal`. |
| **3. OMS / Ventas / CRM (`/admin/orders`, `b2b`, `special-orders`, `payments`, `users`)** | (a) `DataTable` de órdenes con columnas claras y `Tag`s duales/3D; (b) `OrderPanel` migrado a `SideModal` claro con estados 3D, pagos y RMA; (c) vistas `Ventas Manuales`, `Fulfillment WMS`, `RMA` y `Kanban` en tarjetas claras; (d) generador Pro B2B, listas de precios y crédito B2B homologados; (e) `crm-360-drawer` en `/admin/users` migrado a `SideModal` claro. |
| **4. WMS / Compras / Logística (`/admin/inventory`, `suppliers*`, `procurement`, `logistics`)** | (a) Las 10 tabs de `AdminInventory` + `WmsInventoryTabs` con tablas claras; (b) los 6 modales `position:"fixed"` manuales (bodega, ajuste Kardex, nuevo proveedor, importar lista, nueva OC, nueva recepción GR) reemplazados por `FormModal`/`SideModal`; (c) ficha de proveedor en layout 2 columnas; (d) las 8 `.lp-table` y 8 modales de `AdminLogistics` unificados en `DataTable` + `FormModal`. |
| **5. Costing / Finanzas / Tributario (`/admin/costing`, `finance`, `billing`, `payment-methods`)** | (a) Las 10 tablas y 3 formularios de `AdminCostPricing` en `Card` + `FormField` + `DataTable` claros; (b) las 12 tabs de `AdminFinance` + `Gate9FinancePanels` unificadas (cero `.lp-table` dispares); (c) corrección del link `/admin/fiscal` $\rightarrow$ `/admin/billing`; (d) `AdminBilling` y `AdminPaymentMethods` en plantilla de configuración clara. |
| **6. Marketing / CMS (`/admin/marketing`, `loyalty`, `rewards*`, `settings`)** | (a) Las 12 tabs de `AdminMarketing` con constructor de cupón, simulador, carritos y consentimiento en tarjetas claras; (b) `AdminLoyalty` y las 5 rutas `AdminRewards*` homologadas; (c) las 13 tabs de `AdminSettings` con controles claros + `iframe` de preview CMS verificado sin fugas de CSS hacia `/`. |
| **7. Academia / Servicios / Seguridad (`/admin/academy*`, `services`, `roles`, `audit`, `login`)** | (a) Las 5 rutas de Academia y `AdminServices` homologadas; (b) eliminación de clases utilitarias sueltas en `AdminRoles` y `AdminAudit`; (c) detalle forense de auditoría en `SideModal` claro; (d) `AdminLogin` rediseñado bajo template claro Nimbus. |

---

## 6. PLAN DE MIGRACIÓN EN 15 BLOQUES DE BAJA REGRESIÓN (`BLOQUES A–O`, SECCIÓN 12 & `UX13-P1-04`)

> **Regla de Seguridad de Rollback (`UX13-P1-04`):** Queda **terminantemente prohibido** ejecutar comandos de descarte masivo del árbol de trabajo (`git checkout --`, `git restore`, `git reset --hard`, `git clean`). Cada bloque `A`–`N` se registrará en un **commit local atómico propio**; si un bloque requiere reversión, primero se verifica `git status --porcelain` (resguardando cualquier cambio ajeno con `git stash push -u -m "preserve-external-work"` si existiera) y se revierte **exclusivamente el commit del bloque** mediante `git revert --no-edit <sha-bloque>`.

| Bloque | Depend. | Archivos Afectados | Componentes Migrados | Rutas / Flujos Impactados | Riesgos Principales | Criterios de Aceptación | Pruebas Mínimas | Rollback Seguro No Destructivo (`UX13-P1-04`) |
|---|---|---|---|---|---|---|---|---|
| **A. Tokens y Fundamentos** | Ninguna | `styles/admin-nimbus-tokens.css` *(nuevo)*, `styles/admin-ui.css` | Variables `--admin-*` (`240px` / `48px`), tipografía `Geist`/`Geist Mono`, escala `zIndex`, aislamiento `.admin-root` | Base transversal (sin impacto en `/` tienda pública) | Fuga accidental de selectores fuera de `.admin-root` | `0` diferencias visuales en `/` y `/shop`; contraste AA verificado en variables | Build Vite + diff visual de `/` Home público | `git revert --no-edit <sha-bloque-A>` (preservando árbol ajeno) |
| **B. Componentes Base (`ui/`)** | Bloque A | `components/admin/ui/{Buttons,Badges,Inputs,Panels,StatCard,AdminPageHeader,AdminTabs,Skeletons,EmptyState,Pagination,index}.jsx` | `Page.Header` plano, `Button`, `Tag`/`Badge`, `Card`, `CalloutCard`, `SummaryStats`, `Tabs`, `Skeleton`, `EmptyMessage` | Las 38 rutas autenticadas que consumen `components/admin/ui` | Ruptura de props legacy (`eyebrow`, `variant`, `tone`) | Compatibilidad retroactiva 100 % de props existentes mientras renderizan anatomía Nimbus | `npm run lint` + `npm run test:unit` + build | `git revert --no-edit <sha-bloque-B>` |
| **C. App Shell, Sidebar y Header** | Bloques A, B | `layouts/AdminLayout.jsx`, `components/admin/AdminSearch.jsx`, retiro de `v3-editorial-bento.css` en layout | `AppShell` (`SURF-SHL-001..005`), `Menu` (expandido `240px`, colapsado `48px`, mobile `Sidebar`), `AppShell.Header`, `Cmd+K`, `BF-32` Popover | Las 38 rutas bajo `/admin/*` | Regresión en filtrado RBAC de menú o cierre de drawer en mobile | Navegación completa a las 38 rutas en desktop (`240px`), rail colapsado (`48px`) y `320px`/`390px` | Playwright: sidebar `240px`/`48px`, mobile drawer, `Cmd+K`, notificaciones | `git revert --no-edit <sha-bloque-C>` |
| **D. Tablas y Formularios** | Bloques A, B | `components/admin/ui/{DataTable,FormModal,Inputs}.jsx`, reglas `.au-table` y `.lp-table` en `admin-ui.css` | `DataTable` con `thead` claro, `BulkActions` sticky, `FilterChipBar`, `FormField` claro (`appearance`), `UnsavedChangesBar` | Las **64 tablas** (`SURF-TBL-001..064`) y **34 formularios** fuera de modal (`SURF-FRM-001..034`) | Desalineación de columnas anchas o pérdida de `data-testid` | `0` cabeceras negras `thead`; todos los `data-testid` intactos; foco visible en inputs | Tests Playwright de búsqueda, orden, selección y paginación | `git revert --no-edit <sha-bloque-D>` |
| **E. Overlays Unificados** | Bloques B, D | `components/admin/ui/{SideModal,FormModal,ConfirmationModal}.jsx` | Nuevo `SideModal` en `ui/`, homologación de `Modal` y `ConfirmationModal`, escala `zIndex` `600–1100` | Los **73 overlays** verificados (`SURF-OVL-001..073`: `42` FormModal, `13` ConfirmationModal, `1` BulkEdit, `2` Drawers, `6` fixed, `2` diálogos header, `4` `window.confirm`, `3` popovers) | Colisión de scroll lock o trap de foco anidado | Apertura/cierre con `Escape`, foco restaurado al trigger, scroll interno funcional en `320×720` | Test unitario/Playwright de foco, `Escape` y backdrop | `git revert --no-edit <sha-bloque-E>` |
| **F. Business Core (`/admin`, `/admin/login`)** | Bloques C, D, E | `pages/admin/AdminDashboard.jsx`, `pages/admin/AdminLogin.jsx` | Dashboard Tiendanube (`SummaryStats` + tareas pendientes + ventas + últimas órdenes) y `AdminLogin` claro | `/admin`, `/admin/login` | Pérdida de selectores esperados por `dashboard-v3-data.test.mjs` | Preservar `data-testid` críticos (`admin-dashboard`, `admin-sales-chart`, `dashboard-orders-table`, etc.) y pasar tests unitarios | `npm run test:unit` + E2E login y dashboard | `git revert --no-edit <sha-bloque-F>` |
| **G. Catálogo y PIM** | Bloques D, E | `pages/admin/{AdminProducts,AdminProductDetail,AdminProductImport,AdminBrands,AdminCategories}.jsx`, `components/admin/{BulkEditModal,BulkImportPanel,ProductSuppliersTab}.jsx` | `ProductList` Nimbus, `BulkEditModal` claro en `SideModal`, `AdminProductDetail` 2 cols sin `bentoInput` negro, reemplazo de `2` `window.confirm` (imagen y variante) por `ConfirmationModal` | `/admin/products`, `/admin/products/:id`, `/admin/products/import`, `/admin/brands`, `/admin/categories` | Regresión en guardado de variantes multi-moneda o preview bulk `BF-15` | `0` inputs `#0B0E14`; CRUD producto, variantes, specs `BF-44`, proveedores y bulk edit intactos | E2E PostgreSQL 16: crear producto + variante + spec + bulk preview | `git revert --no-edit <sha-bloque-G>` |
| **H. OMS, Ventas y CRM/B2B** | Bloques D, E | `pages/admin/{AdminOrders,AdminB2BQuotes,AdminSpecialOrders,AdminPayments}.jsx`, CRM tabs en `AdminUsers.jsx` | `OrderPanel` en `SideModal`, tabs OMS claras, vista Kanban clara, constructor B2B 2 cols, `crm-360-drawer` en `SideModal`, reemplazo de `window.confirm` en `AdminPayments` | `/admin/orders`, `/admin/b2b`, `/admin/special-orders`, `/admin/payments`, `/admin/users` | Alterar payload de transición 3D, intento de pago idempotente o RMA | Flujo 3D, venta manual WhatsApp, despacho WMS, RMA, cotización B2B y ficha 360° 100 % operativos | E2E PostgreSQL 16: orden manual $\rightarrow$ pago $\rightarrow$ despacho + cotización B2B | `git revert --no-edit <sha-bloque-H>` |
| **I. WMS, Procurement y Logística** | Bloques D, E | `pages/admin/{AdminInventory,AdminSuppliers,AdminSupplierDetail,AdminProcurement,AdminLogistics}.jsx`, `components/admin/WmsInventoryTabs.jsx` | Conversión de los `6` modales `position:"fixed"` y `1` `window.confirm` (`AdminSupplierDetail`) a `FormModal`/`ConfirmationModal`, unificación de las `8` tablas de `AdminLogistics` y `10` tabs de WMS | `/admin/inventory`, `/admin/suppliers*`, `/admin/procurement*`, `/admin/logistics` | Pérdida de validación de motivo Kardex o escáner de seriales `BF-46` | Ajuste Kardex, regularización de seriales, OC, recepción GR, etiqueta QA y OT taller intactos | E2E PostgreSQL 16: OC $\rightarrow$ GR $\rightarrow$ Kardex + envío logístico | `git revert --no-edit <sha-bloque-I>` |
| **J. Costing, Finanzas y Tributario** | Bloques D, E | `pages/admin/{AdminCostPricing,AdminFinance,AdminBilling,AdminPaymentMethods}.jsx`, `components/admin/Gate9FinancePanels.jsx`, `App.jsx` (redirect defensivo `fiscal` $\rightarrow$ `/admin/billing`) | Landed Cost y Simulador en `Card`s claras, `12` tabs de Finanzas unificadas (`3` `DataTable` + `5` `.lp-table`), fix del link `/admin/fiscal` $\rightarrow$ `/admin/billing` (`SURF-RT-041`) | `/admin/costing`, `/admin/finance`, `/admin/billing`, `/admin/payment-methods` | Mezcla accidental de divisas o alteración de `idempotency_key` en AR/AP/Conciliación | Aislamiento estricto `CLP`/`USD`/`ARS`; Landed Cost, WAC, cartola CSV y conciliación intactos | `v3-2-currency.test.mjs`, `v3-2-1-billing.test.mjs` + E2E conciliación y Landed Cost | `git revert --no-edit <sha-bloque-J>` |
| **K. Marketing y CMS (Gate 12 Protegido)** | Bloques D, E | `pages/admin/{AdminMarketing,AdminSettings}.jsx` | `12` tabs de Marketing en Nimbus claro; `13` tabs + `4` sub-viewports de `AdminSettings` claras con protección estricta del `iframe` live preview | `/admin/marketing`, `/admin/settings` y Storefront `/` | Contaminación de estilos en el preview CMS o ruptura de `publish`/`rollback` | Paridad visual 100 % entre `iframe` preview (`1440/768/390/320`) y `/` Home público | E2E cupón en checkout + borrador CMS $\rightarrow$ preview $\rightarrow$ publish $\rightarrow$ rollback | `git revert --no-edit <sha-bloque-K>` |
| **L. Academia, Servicios, Loyalty y Rewards** | Bloques D, E | `pages/admin/{AdminAcademy,AdminModules,AdminLessons,AdminEnrollments,AdminCertifications,AdminServices,AdminLoyalty,AdminRewards,AdminRewardsCampaigns,AdminRewardsCampaignDetail,AdminRewardsEntries,AdminRewardsWinners}.jsx` | Homologación completa de las 12 páginas de ecosistema a `Page` + `SummaryStats` + `DataTable` + `FormModal` | `/admin/academy/*`, `/admin/services`, `/admin/loyalty`, `/admin/rewards/*` | Regresión en selectores encadenados Curso $\rightarrow$ Módulo $\rightarrow$ Lección o sorteo Rewards | CRUD completo de Academia/Servicios, ajuste Loyalty y sorteo Rewards operativos | `v3-2-1-academy.browser.mjs` + E2E campaña Rewards | `git revert --no-edit <sha-bloque-L>` |
| **M. Seguridad, Roles y Auditoría** | Bloques D, E | `pages/admin/{AdminRoles,AdminAudit,AdminUsers}.jsx` | Matriz RBAC 360° clara con cabeceras legibles, `AdminAudit` sin clases Tailwind huérfanas y `SideModal` forense | `/admin/roles`, `/admin/audit`, `/admin/users` (tab RBAC) | Ocultar involuntariamente diferencias `before`/`after` en eventos forenses | Matriz de permisos legible en mobile/desktop, filtros de auditoría, diff JSON y export CSV intactos | E2E RBAC Zero-Trust + inspección de evento en `/admin/audit` | `git revert --no-edit <sha-bloque-M>` |
| **N. Pulido Responsive y Accesibilidad WCAG AA** | Bloques F–M | Ajustes finos en `styles/admin-ui.css` y componentes `ui/` | Refinamiento en `320×720`, `390×844`, `768×1024`, `1280×800`, `1440×900` y `3840×2160` + contraste y teclado sobre las `315` superficies | Las **39 rutas** completas (`90` tabs/modos, `73` overlays, `64` tablas) | Scroll horizontal residual en `320px` o foco oculto bajo barras sticky | `0px` de overflow de documento en las `234` combinaciones y `0` violaciones críticas WCAG AA | Barrido automatizado `39 × 6 = 234` + auditoría de contraste y teclado | `git revert --no-edit <sha-bloque-N>` |
| **O. QA Integral, Baseline Before/After y Certificación** | Bloques A–N | Suite QA Playwright/Node y artefactos nuevos en `gate13_v2_tiendanube_*` | Capturas verificables `BEFORE` (`fa53c7f9`) vs `AFTER`, manifiesto SHA-256, matriz `234` y suite E2E PostgreSQL 16 | Todo el sistema LevelPro OS V4.0 | Mezclar artefactos V1 con V2 (prevenido por namespace dedicado) | 100 % suites en verde, bundle `< 500 KB`, manifiesto SHA-256 íntegro y cero pérdidas funcionales | `lint` + `build` + `check:bundle` + `test:unit` + `manage.py test` + Playwright `234` + E2E real | Sin mutación de código aplicativo |

---

## 7. PROTOCOLO DE BASELINE REPRODUCIBLE Y PRESERVACIÓN HISTÓRICA (SECCIÓN 14)

1. **Inmutabilidad de Evidencias Previas:** Los directorios y archivos existentes en `<ArtifactDir>/gate13_before/`, `gate13_after/`, `gate13_responsive_matrix/`, `gate13_admin_before_after.zip` y `gate13_admin_screenshots.zip` pertenecen al historial auditable de Gate 13 V1 y **jamás serán sobrescritos, borrados ni mezclados**.
2. **Namespace Exclusivo para Phase 2 (V2 Tiendanube):**
   - `gate13_v2_tiendanube_before/` — capturado **antes de tocar una sola línea de código en Phase 2**, verificando `git rev-parse HEAD === "fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6"` y árbol limpio.
   - `gate13_v2_tiendanube_after/` — capturado al cerrar el Bloque N con los mismos viewports, rutas y datos semilla deterministas.
   - `gate13_v2_tiendanube_responsive_234/` — matriz íntegra `39 rutas × 6 viewports`.
   - `gate13_v2_tiendanube_manifest.json` — registro criptográfico con `sha256` individual de cada PNG `BEFORE` y `AFTER`, `git_sha_before`, `git_sha_after`, `timestamp`, `viewport` y `test_mode` (`synthetic_fixture` vs `real_postgres16_e2e`).
3. **Salvaguardas Técnicas Anti-Error:**
   - Todo script de captura tendrá guarda explícita `if (import.meta.url === \`file://\${process.argv[1]}\`)` para no ejecutarse nunca al ser importado.
   - El script `capture_before` abortará con `exit(1)` si el directorio `gate13_v2_tiendanube_before/` ya contiene archivos o si `HEAD` no coincide exactamente con `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`.

# LEVELPRO OS V4.0 — GATE 13 (V2.0 HARDENED · PHASE 1)
## MATRIZ DE ACEPTACIÓN VISUAL, CONTRASTE WCAG AA Y GOBERNANZA DE EVIDENCIA

- **Repositorio:** `Ignvco/levelproaudio`
- **Rama / HEAD:** `feature/v4-gate13-admin-experience` @ `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`
- **Propósito:** Establecer criterios visuales, estructurales y de accesibilidad **100 % medibles y verificables automáticamente y por revisión humana** antes de iniciar Phase 2.

---

## 1. REGLAS DE CLASIFICACIÓN DE ESTADO DE CERTIFICACIÓN (BLINDAJE 5)

Queda **prohibido inventar porcentajes subjetivos de similitud o cobertura**. Cada superficie del inventario (`admin-surface-inventory.md`) y cada bloque (`A–O`) se clasificará exclusivamente con uno de estos cuatro estados objetivos:

| Estado | Definición Estricta y Verificable |
|---|---|
| **`COMPLETO`** | Cumple el 100 % de los criterios aplicables (`STRUCTURE`, `SPACING`, `TYPOGRAPHY`, `HIERARCHY`, `INTERACTION`, `RESPONSIVE`, `ACCESSIBILITY`), elimina el 100 % de los patrones prohibidos en todas sus pestañas/modales internos (Blindaje 2), preserva sus contratos de API/RBAC (Blindaje 4) y cuenta con evidencia generada y verificada por SHA-256. |
| **`PARCIAL`** | El contenedor principal migró al nuevo sistema, pero al menos una pestaña interna, tabla secundaria, modal inline, viewport (`320px`–`3840px`) o estado (`Empty`/`Error`/`Skeleton`) conserva estilos antiguos o carece de prueba verificada. **Un módulo `PARCIAL` impide cerrar Gate 13.** |
| **`BLOQUEADO`** | Imposibilidad técnica externa o decisión pendiente del propietario debidamente documentada con causa raíz reproducible. Jamás se disfraza con mocks ni workarounds destructivos. |
| **`NO VERIFICABLE`** | Referencia externa privada de Tiendanube no accesible legalmente o condición que requiere infraestructura externa real prohibida (p. ej. cobro real en pasarela bancaria productiva o timbraje real SII/AFIP). |

---

## 2. CHECKLIST DE PROHIBICIONES VISUALES AUTOMATIZABLES (ANTI-REGRESIÓN BENTO V1)

Durante Phase 2, un test de inspección DOM/CSS computado en Playwright recorrerá las **39 rutas** y fallará si detecta cualquiera de estos anti-patrones rechazados por el propietario:

| Código Control | Anti-Patrón Prohibido (Sección 5) | Verificación Objetiva en DOM / `getComputedStyle` | Meta Obligatoria |
|---|---|---|---|
| `VIS-BAN-01` | **Navbar superior flotante oscura** (`.v3-floating-header`, `.v3-nav-island`) | `document.querySelectorAll('.v3-floating-header, .v3-nav-island').length === 0` | `0` instancias |
| `VIS-BAN-02` | **Hero headers negros masivos** (`.au-header` con fondo oscuro `#0B0E14` / gradiente) | En todo `Page.Header`, luminancia relativa de `backgroundColor` $> 0.85$ (transparente sobre `#F5F5F5` o `#FFFFFF`) | `0` cabeceras oscuras |
| `VIS-BAN-03` | **Cabeceras de tabla negras** (`.au-table thead th` en `#0B0E14`) | En todo `thead th`, luminancia relativa de `backgroundColor` $> 0.85$ (`#F9FAFB` / `#FFFFFF`) y texto oscuro accesible | `0` `thead` oscuros |
| `VIS-BAN-04` | **Tarjetas Fintech Bento / Obsidiana** (`.v3-card-obsidian`, anillos neón con `drop-shadow`) | `document.querySelectorAll('.v3-card-obsidian, .v3-donut-container').length === 0` | `0` instancias |
| `VIS-BAN-05` | **Inputs o sub-tarjetas negras sobre páginas claras** (`bentoInput` `#0B0E14` en `AdminProductDetail`, `BulkEditModal` oscuro) | En todo `input, select, textarea` visible dentro de `.admin-root`, luminancia de `backgroundColor` $> 0.80$ (`#FFFFFF` o `#E7E7E7` si `disabled`) | `0` controles oscuros |
| `VIS-BAN-06` | **Texto verde brillante `#1AFF6E` sobre fondo blanco/claro** | Ningún nodo de texto sobre superficie clara puede usar `#1AFF6E` como `color` (contraste `1.35:1` ilegal) | `0` violaciones AA |
| `VIS-BAN-07` | **Radios exagerados de estética Bento (`>= 20px`) en tarjetas o modales** | En `Card`, `DataTable` y `Modal`, `parseFloat(borderRadius) <= 12` (objetivo `8px`) | `100 %` $\le 12\text{px}$ |
| `VIS-BAN-08` | **Modales manuales ad-hoc o `window.confirm`** | `0` llamadas a `window.confirm` en `pages/admin/` y `components/admin/`; todos los diálogos usan `Modal`, `SideModal` o `ConfirmationModal` | `0` excepciones |

---

## 3. MATRIZ DE CONTRASTE CROMÁTICO WCAG 2.1 AA / AAA (IDENTIDAD LEVELPRO)

Todos los pares cromáticos autorizados para Phase 2 cumplen o superan el umbral WCAG 2.1 AA (`4.5:1` texto normal, `3.0:1` texto grande y bordes/iconos funcionales):

| Elemento de Interfaz | Color Primer Plano | Color Fondo | Ratio Calculado | Nivel WCAG | Veredicto |
|---|---|---|---|---|---|
| Título y texto primario sobre tarjeta | `#0B0E14` (*Deep Black*) | `#FFFFFF` | **19.1 : 1** | AAA | Aprobado |
| Título y texto primario sobre lienzo | `#0B0E14` (*Deep Black*) | `#F5F5F5` (*Pure White*) | **17.5 : 1** | AAA | Aprobado |
| Texto secundario estructural | `#242A34` (*Graphite*) | `#FFFFFF` | **14.2 : 1** | AAA | Aprobado |
| Texto de apoyo / labels secundarios / `thead` | `#525B68` | `#FFFFFF` / `#F9FAFB` | **6.8 : 1** / **6.5 : 1** | AA | Aprobado |
| Botón Primario estándar (texto) | `#FFFFFF` | `#0B0E14` | **19.1 : 1** | AAA | Aprobado |
| Botón Primario estándar (icono acento) | `#1AFF6E` (*Level Green*) | `#0B0E14` | **13.8 : 1** | AAA | Aprobado |
| Botón / Badge acento LevelPro (texto oscuro) | `#0B0E14` | `#1AFF6E` | **13.8 : 1** | AAA | Aprobado |
| Ítem activo del Sidebar (`Menu.Button active`) | `#0B0E14` | `#E8FFF0` | **17.8 : 1** | AAA | Aprobado |
| Enlaces en texto sobre fondo blanco | `#0A6E31` | `#FFFFFF` | **6.4 : 1** | AA | Aprobado |
| `Tag` Éxito (`Pagado` / `Activo` / `Conciliado`) | `#14532D` | `#DCFCE7` | **8.9 : 1** | AAA | Aprobado |
| `Tag` Advertencia (`Pendiente` / `En tránsito`) | `#78350F` | `#FEF3C7` | **7.6 : 1** | AAA | Aprobado |
| `Tag` Peligro (`Rechazado` / `Vencido` / `Crítico`) | `#7F1D1D` | `#FEE2E2` | **8.1 : 1** | AAA | Aprobado |
| **PROHIBIDO:** Texto Level Green sobre blanco | `#1AFF6E` | `#FFFFFF` | **1.35 : 1** | **FALLO** | **PROHIBIDO** |

---

## 4. CRITERIOS MEDIBLES POR DIMENSIÓN DE FIDELIDAD A TIENDANUBE / NIMBUS

| Dimensión | Reglas Medibles de Aceptación |
|---|---|
| **1. `STRUCTURE`** | • `AppShell` único con sidebar vertical izquierdo (`240px` expandido / **`48px` colapsado** conforme a `UX13-P1-02`) y `AppShell.Header` superior fijo (`56px`).<br>• Toda vista principal comienza con `Page.Header` plano (back/breadcrumb opcional + `<h1>` + descripción breve + acciones secundarias + máximo `1` botón primario).<br>• Vistas de edición/detalle complejas usan `Layout` de 2 columnas asimétricas (`~66% / ~34%` en `>= 1024px`).<br>• Detalles contextuales (`Orden`, `CRM 360°`, `Auditoría`, `Edición Masiva`) abren en `SideModal` derecho.<br>• Cobertura verificada sobre las **315 superficies individuales** del inventario (`41` rutas/enlaces, `5` shell, `90` pestañas/modos, `73` overlays, `64` tablas, `34` formularios, `8` estados). |
| **2. `SPACING`** | • Escala estricta múltiplo de `4px` (`4, 8, 12, 16, 20, 24, 32px`).<br>• Padding de `Card`: `16px–20px`; separación vertical entre secciones: `16px–20px`; padding de celda de tabla: `10px 14px` (alto de fila `48px–54px`).<br>• Radios sobrios estilo Nimbus: `6px` en botones/inputs/ítems de menú y `8px` en tarjetas/tablas/modales. |
| **3. `TYPOGRAPHY`** | • `Geist` para interfaz general (`12px` caption, `13px` labels, `14px` cuerpo/controles/celdas, `16px` título de `Card`, `20px–24px` `<h1>` de `Page.Header`; pesos `400`, `500` y `600`).<br>• `Geist Mono` con `font-variant-numeric: tabular-nums` en el 100 % de SKUs, números de serie, IDs de orden, folios, saldos de stock y montos monetarios. |
| **4. `HIERARCHY`** | • Superficie clara predominante (`> 92 %` del área visible en `#F5F5F5` / `#FFFFFF`).<br>• Un único CTA primario por cabecera de página.<br>• Diferenciación semántica estricta entre `Tag` (condición textual: *Pagado, En tránsito, Borrador*) y `Badge` (conteo numérico: notificaciones, ítems en tab). |
| **5. `INTERACTION`** | • `DataTable.BulkActions` aparece de forma sticky sobre la tabla al marcar $\ge 1$ fila.<br>• Filtros aplicados se reflejan en `Chip`s removibles individuales + acción `Limpiar filtros`.<br>• Atajo global `Cmd+K` / `Ctrl+K` operativo desde cualquier ruta; tecla `Escape` cierra cualquier `Modal`, `SideModal`, `Popover` o `Sidebar` móvil.<br>• Barra `UnsavedChangesBar` activa al modificar formularios maestros sin guardar. |
| **6. `RESPONSIVE`** | • Verificación íntegra en los 6 viewports (`320×720`, `390×844`, `768×1024`, `1280×800`, `1440×900`, `3840×2160`).<br>• `document.documentElement.scrollWidth <= window.innerWidth` (`0px` overflow de página) en las `234` combinaciones.<br>• En `< 1024px`, el sidebar pasa a drawer deslizante izquierdo sin solapar el header ni bloquear contenido. |
| **7. `ACCESSIBILITY`** | • Un único `<h1>` visible por ruta; jerarquía de encabezados sin saltos arbitrarios.<br>• `100 %` de controles de formulario asociados a `<label htmlFor>` o `aria-label`, con mensajes de error vinculados por `aria-describedby` y `aria-invalid="true"`.<br>• Áreas táctiles mínimas de `44×44px` en navegación móvil y controles primarios mobile.<br>• Trap de foco y restauración de foco al cerrar `Modal` / `SideModal`. |

---

## 5. MATRIZ DE REVISIÓN VISUAL POR FAMILIA DE PANTALLAS DEL PROPIETARIO (SECCIÓN 16)

| # | Superficie Clave para Revisión del Propietario | Referencia Nimbus / Tiendanube | Puntos Críticos de Inspección Visual |
|---|---|---|---|
| 01 | **Sidebar (Expandido y Colapsado)** | `AppShell` + `Menu` `v2.0.3` | Fondo `#FFFFFF`, ancho `240px` / **`48px` exactos** (`UX13-P1-02`), acordeones suaves, activo `#E8FFF0` + `#1AFF6E` + texto `#0B0E14`, footer fijo con Configuración y Ver tienda. |
| 02 | **Header Superior** | `AppShell.Header` | Alto `56px`, buscador `⌘K` integrado estilo Tiendanube, selector de moneda en vistas contables, campana `BF-32` con contador y menú de cuenta. |
| 03 | **Dashboard (`/admin`)** | Inicio Tiendanube + `SummaryStats` | Sin tarjeta obsidiana ni anillo neón; métricas claras en fila, lista accionable *"Por resolver hoy"*, gráfico limpio de ventas y tabla de últimas órdenes. |
| 04 | **Listado de Productos (`/admin/products`)** | `ProductList` + `DataTable` `v1.5.1` | Miniatura `40×40`, SKU en `Geist Mono`, precios claros sin mezcla de divisas, `Chip`s de filtro, `BulkActions` sticky y paginación limpia. |
| 05 | **Formulario de Producto y Variantes** | `Layout` 2 cols asimétricas + `FormField` | Distribución `2/3 + 1/3`, inputs blancos `#FFFFFF` (cero `bentoInput` negro), matriz clara de variantes, especificaciones técnicas y proveedores. |
| 06 | **Listado y Detalle de Pedido (`OrderPanel`)** | Ventas Tiendanube + `SideModal` `v1.8.1` | Tabla con badges separados de Pago y Envío; `SideModal` claro con ítems, estados 3D, pagos idempotentes y constructor RMA. |
| 07 | **Tablas Administrativas (`64` tablas)** | `DataTable` `v1.5.1` | Unificación total de las **64 tablas** (`10` `DataTable`, `36` `.au-table`, `13` `.lp-table`, `5` `<table>`) bajo cabecera clara `#F9FAFB`, bordes `#E2E5EA` y menú contextual `⋮`. |
| 08 | **Formularios y Simuladores (`34` + `42` modales)** | `FormField` `v1.8.1` + `Card` | Labels `13px` `weight: 500`, ayuda contextual y errores `danger` consistentes en los **34 formularios/editores** y **42 `FormModal`**. |
| 09 | **Modales, SideModals y Confirmaciones (`73` overlays)** | `Modal` + `SideModal` + `ConfirmationModal` | Homologación de los **73 overlays** (`SURF-OVL-001..073`), eliminando los `6` modales `position:"fixed"`, los `4` `window.confirm` y el fondo oscuro de `BulkEditModal`. |
| 10 | **Configuraciones y Editorial CMS** | `SettingsPage` + Editor Tienda Online | Controles claros en las 13 pestañas de `/admin/settings` preservando 100 % la fidelidad y aislamiento del `iframe` público. |
| 11 | **Experiencia Mobile (`320px` y `390px`)** | `Sidebar` drawer + `DataTable` responsive | Menú hamburguesa fluido, KPIs apilados legibles, tablas con scroll interno limpio y cero recorte de botones de guardado. |

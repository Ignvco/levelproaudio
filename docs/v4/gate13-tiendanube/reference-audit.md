# LEVELPRO OS V4.0 — GATE 13 (V2.0 HARDENED · PHASE 1)
## AUDITORÍA EXHAUSTIVA DE REFERENCIA TIENDANUBE & NIMBUS DESIGN SYSTEM

- **Repositorio:** `Ignvco/levelproaudio`
- **Rama local verificada:** `feature/v4-gate13-admin-experience`
- **HEAD local de referencia:** `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`
- **Base Gate 12 certificada:** `6fa8254a8de68667aa8f578e40a378b82ba64628` (`ANCESTOR_OK`)
- **Fecha de consulta y verificación:** `2026-11-25`
- **Alcance de fase:** Exclusivamente investigación, auditoría y arquitectura (cero cambios en código funcional, backend o CSS).

---

## 1. ORDEN DE PRIORIDAD DE FUENTES Y DECLARACIÓN DE HONESTIDAD DE EVIDENCIA

Conforme a la Sección 2 del Master Prompt V2.0, todas las decisiones arquitectónicas respetan la siguiente jerarquía estricta:

1. **Prioridad 1 — Documentación oficial vigente de Tiendanube / Nimbus Design System** (`tiendanube.dev`, paquetes oficiales `@nimbus-ds/*` v9.73 / `@nimbus-ds/tokens` v9.8 / `@nimbus-ds/patterns` en GitHub `TiendaNube/nimbus-design-system` y `TiendaNube/nimbus-patterns`, y Storybook oficial `tiendanube.github.io`).
2. **Prioridad 2 — Documentación operativa pública y capturas/flujos públicos verificables del administrador de Tiendanube** (`ayuda.tiendanube.com` y plantillas oficiales de homologación de Admin Panel en `tiendanube.dev/apps/admin/*`).
3. **Prioridad 3 — Código y contratos actuales de LevelPro OS V4.0** (Gates 1–12 en HEAD `fa53c7f9b07ec6b13c4886a3ce4f322a58fe4bf6`).
4. **Prioridad 4 — Identidad corporativa innegociable de LevelPro Audio** (`#0B0E14` Deep Black, `#1AFF6E` Level Green, `#F5F5F5` Pure White, `#242A34` Graphite, `Geist`, `Geist Mono`, logotipo oficial).
5. **Prioridad 5 — Accesibilidad WCAG 2.1 AA y diseño responsive multi-viewport** (`320×720` a `3840×2160`).

### Taxonomía de clasificación de evidencia (Sección 4)
Cada patrón o flujo en este documento se etiqueta explícitamente bajo una de cuatro categorías mutuamente excluyentes:
- **`DOCUMENTADO EN NIMBUS`**: Verificado directamente en la documentación oficial `tiendanube.dev/es-AR/documentation/*`, en las guías de homologación `tiendanube.dev/apps/admin/design-guidelines/*` o en las definiciones fuente TypeScript/JSON de `TiendaNube/nimbus-design-system` y `TiendaNube/nimbus-patterns`.
- **`OBSERVADO EN TIENDANUBE`**: Verificado en documentación pública oficial del panel comercial de Tiendanube (`ayuda.tiendanube.com`, ejemplos oficiales de vistas en `tiendanube.dev` y Storybook oficial de templates de Admin).
- **`INFERIDO`**: Adaptación estructural deducida rigurosamente a partir de primitivos y patrones oficiales de Nimbus para resolver capacidades empresariales de LevelPro OS (ERP/WMS/Landed Cost/Tesorería/RBAC/CMS) que exceden una tienda minorista estándar de Tiendanube.
- **`NO VERIFICADO`**: Aspecto interno de cuentas privadas de merchants de Tiendanube al que deliberadamente **no se accedió** por respeto absoluto a restricciones de autenticación, términos legales y prohibición de acceso no autorizado.

---

## 2. REGISTRO DE URLs CONSULTADAS Y ESTADO DE DISPONIBILIDAD (`2026-11-25`)

Todas las URLs fueron comprobadas mediante peticiones HTTP directas (`HEAD`/`GET`) antes de ser citadas:

| # | URL consultada | HTTP | URL efectiva resuelta | Estado / Observación verificable |
|---|---|---|---|---|
| 01 | `https://tiendanube.dev/es-AR/documentation` | `200` | `https://tiendanube.dev/es-AR/documentation` | Portal raíz oficial de documentación Tiendanube & Nimbus (ES). |
| 02 | `https://tiendanube.dev/es-AR/documentation/overview/getting-started` | `200` | `https://tiendanube.dev/es-AR/documentation/overview/getting-started` | Guía de arquitectura de paquetes `@nimbus-ds/styles` y componentes React. |
| 03 | `https://nimbus.tiendanube.com` | `200` (301) | `https://tiendanube.dev/documentation/overview/getting-started` | Redirige oficialmente al portal unificado `tiendanube.dev`. |
| 04 | `https://tiendanube.dev/es-AR/documentation/patterns/app-shell` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/app-shell` | Documentación oficial `App Shell` `v1.10.0`. |
| 05 | `https://tiendanube.dev/es-AR/documentation/patterns/menu` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/menu` | Documentación oficial `Menu` `v2.0.3` (navegación lateral Admin). |
| 06 | `https://tiendanube.dev/es-AR/documentation/patterns/page` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/page` | Documentación oficial `Page` `v1.3.7` (`Page.Header`, `Page.Body`). |
| 07 | `https://tiendanube.dev/es-AR/documentation/patterns/data-table` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/data-table` | Documentación oficial `Data Table` `v1.5.1` (`BulkActions`, `Footer`, menú fila). |
| 08 | `https://tiendanube.dev/es-AR/documentation/patterns/form-field` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/form-field` | Documentación oficial `Form Field` `v1.8.1` (`input`, `select`, `textarea`, `appearance`). |
| 09 | `https://tiendanube.dev/es-AR/documentation/patterns/layout` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/layout` | Documentación oficial `Layout` `v1.3.7` (1 col, 2 simétricas, 2 asimétricas, 3 cols). |
| 10 | `https://tiendanube.dev/es-AR/documentation/patterns/nav-tabs` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/nav-tabs` | Documentación oficial `Nav Tabs` `v1.4.0` (navegación mobile / vistas pares). |
| 11 | `https://tiendanube.dev/es-AR/documentation/patterns/side-modal` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/side-modal` | Documentación oficial `Side Modal` `v1.8.1` (panel lateral contextual). |
| 12 | `https://tiendanube.dev/es-AR/documentation/patterns/summary-stats` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/summary-stats` | Documentación oficial `Summary Stats` `v1.1.0` (KPIs horizontales/grid con tendencia). |
| 13 | `https://tiendanube.dev/es-AR/documentation/patterns/empty-message` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/empty-message` | Documentación oficial `Empty Message` `v1.2.6` (con ícono o ilustración + acción). |
| 14 | `https://tiendanube.dev/es-AR/documentation/patterns/product-data-list` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/product-data-list` | Documentación oficial `Product Data List` `v1.1.2` (listas compactas de productos/drag). |
| 15 | `https://tiendanube.dev/es-AR/documentation/patterns/callout-card` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/callout-card` | Documentación oficial `Callout Card` `v1.7.1` (recomendaciones y avisos accionables). |
| 16 | `https://tiendanube.dev/es-AR/documentation/patterns/interactive-list` | `200` | `https://tiendanube.dev/es-AR/documentation/patterns/interactive-list` | Documentación oficial `Interactive List` `v1.3.10` (listas con check/radio/toggle/acción). |
| 17 | `https://tiendanube.dev/es-AR/documentation/templates` | `200` | `https://tiendanube.dev/es-AR/documentation/templates` | Plantillas oficiales Nimbus (`ProductList`, `Form`, `SettingsPage`, `ConfirmationModal`, `Login`). |
| 18 | `https://tiendanube.dev/apps/admin/design-guidelines/overview` | `200` | `https://tiendanube.dev/apps/admin/design-guidelines/overview` | Directrices generales de diseño del Admin Panel de Tiendanube. |
| 19 | `https://tiendanube.dev/apps/admin/design-guidelines/concept-usage` | `200` | `https://tiendanube.dev/apps/admin/design-guidelines/concept-usage` | Reglas de priorización de acciones (1 primaria por vista), `Tag` vs `Badge`, `Alert` vs `Toast`, tarjetas. |
| 20 | `https://tiendanube.dev/apps/admin/design-guidelines/component-usage` | `200` | `https://tiendanube.dev/apps/admin/design-guidelines/component-usage` | Asignación obligatoria de componentes Atómicos (29) y Compuestos (15). |
| 21 | `https://tiendanube.dev/apps/admin/design-guidelines/template-usage` | `200` | `https://tiendanube.dev/apps/admin/design-guidelines/template-usage` | Homologación de vistas vacías, iniciales, formularios y configuraciones. |
| 22 | `https://tiendanube.github.io/nimbus-design-system/` | `200` | `https://tiendanube.github.io/nimbus-design-system/` | Storybook oficial de primitivos `@nimbus-ds/components`. |
| 23 | `https://tiendanube.github.io/nimbus-patterns/` | `200` | `https://tiendanube.github.io/nimbus-patterns/` | Storybook oficial de patrones y templates `@nimbus-ds/patterns`. |
| 24 | `https://github.com/TiendaNube/nimbus-design-system` | `200` | `https://github.com/TiendaNube/nimbus-design-system` | Monorepo oficial MIT: `packages/core/tokens` (`v9.8.0`), `packages/core/styles` (`v9.73.0`), `packages/react` (29 atómicos + 15 compuestos). |
| 25 | `https://github.com/TiendaNube/nimbus-patterns` | `200` | `https://github.com/TiendaNube/nimbus-patterns` | Monorepo oficial MIT de 26 patrones compuestos del Admin de Tiendanube. |
| 26 | `https://ayuda.tiendanube.com/es_AR` | `200` | `https://ayuda.tiendanube.com/es_AR` | Centro de ayuda oficial con documentación pública de flujos reales del Admin (Ventas, Productos, Variantes, Clientes, Descuentos, Configuración). |
| 27 | `https://github.com/TiendaNube/nimbus-tokens` | `404` | `https://github.com/TiendaNube/nimbus-tokens` | **No disponible como repo independiente** (`HTTP 404`); los tokens oficiales residen en `TiendaNube/nimbus-design-system/packages/core/tokens` (`HTTP 200`). |
| 28 | `https://tiendanube.dev/es-AR/documentation/components/*` | `404` | — | **Rutas `/components/*` no publicadas en `tiendanube.dev`**; los primitivos se documentan en `component-usage` (`200`), Storybook `tiendanube.github.io/nimbus-design-system/` (`200`) y código fuente TypeScript en GitHub (`200`). |

---

## 3. HALLAZGO FUNDACIONAL SOBRE TOKENS OFICIALES DE NIMBUS (`@nimbus-ds/tokens` v9.8.0)

La inspección directa de los archivos fuente JSON en `TiendaNube/nimbus-design-system/packages/core/tokens/src/` reveló tres hechos verificables decisivos para LevelPro Audio:

1. **Coincidencia Tipográfica Nativa 1:1 (`typography/sys.json`):**
   - `font.family.sans` en Nimbus es literalmente `"Geist, -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', arial, sans-serif"`.
   - `font.family.mono` en Nimbus es literalmente `"Geist Mono, 'Roboto Mono', monospace"`.
   - **Impacto:** La identidad tipográfica obligatoria de LevelPro Audio (`Geist` + `Geist Mono`) **es idéntica a la tipografía oficial actual de Nimbus**. No existe fricción tipográfica entre la marca LevelPro y la densidad visual de Tiendanube.
   - Pesos oficiales de Nimbus: `regular: 400`, `medium: 500`, `bold: 600` (semi-bold sobrio, evitando pesos `800–900` gritones que caracterizaban el diseño Bento rechazado).
   - Escala tipográfica oficial (`typography/ref.json` + `sys.json`):
     - `body.caption`: `0.75rem` (`12px`) / line-height `1rem` (`16px`) — etiquetas pequeñas, chips, metadatos secundarios.
     - `body.base`: `0.875rem` (`14px`) / line-height `1.25rem` (`20px`) — texto operativo estándar de tablas, inputs y tarjetas.
     - `body.highlight`: `1rem` (`16px`) / line-height `1.5rem` (`24px`) — texto enfatizado o subtítulos menores.
     - `title.h6`: `0.875rem` (`14px` / LH `20px`) · `title.h5`: `1rem` (`16px` / LH `24px`) · `title.h4`: `1.25rem` (`20px` / LH `24px`) · `title.h3`: `1.5rem` (`24px` / LH `28px`) · `title.h2`: `1.75rem` (`28px` / LH `32px`) · `title.h1`: `2rem` (`32px` / LH `40px`, máximo uno por vista).

2. **Superficies Claras Predominantes (`color/ref.json` + `color/sys.json`):**
   - `neutral.background` (`neutral.100`): `#FFFFFF` (superficie de `Card`, `DataTable`, `Input`, `Header`, `Sidebar`).
   - `neutral.surface` (`neutral.99`): `#F6F6F6` (lienzo general de aplicación — prácticamente indistinguible del blanco corporativo de LevelPro `#F5F5F5`, con diferencia cromática $\Delta E < 0.8$).
   - `neutral.surface-disabled` (`neutral.95`): `#E7E7E7` (fondos deshabilitados y divisores suaves).
   - `neutral.surface-highlight` (`neutral.90`): `#D1D1D1` (bordes de control en reposo y estados hover neutros).
   - `neutral.text-high` (`neutral.0`): `#0A0A0A` (mapea directamente al Deep Black `#0B0E14` de LevelPro Audio).
   - `neutral.text-low` (`neutral.40`): `#5D5D5D` (texto secundario con contraste WCAG AA `6.5:1` sobre `#FFFFFF` y `5.9:1` sobre `#F5F5F5`).
   - `neutral.text-disabled` (`neutral.50`): `#6D6D6D`.

3. **Escala Espacial, Radios, Sombras, Z-Index y Breakpoints (`spacing`, `shape`, `shadow`, `zIndex`, `breakpoint`):**
   - **Espaciado base 4px (`spacing/ref.json`):** `0-5` (`2px`), `1` (`4px`), `1-5` (`6px`), `2` (`8px`), `2-5` (`10px`), `3` (`12px`), `4` (`16px` — padding estándar de `Card`), `5` (`20px`), `6` (`24px` — separación entre bloques no relacionados), `8` (`32px` — margen de página).
   - **Radios contenidos (`shape/sys.json`):** `base` = `0.375rem` (`6px` en inputs/botones), `2` = `0.5rem` (`8px` en `Card`, `DataTable`, `Modal`, `Alert`), `full` = `9999px` (solo en `Tag`, `Badge`, `Chip`, `Toggle`). **Contraste directo con el diseño rechazado**, que abusaba de radios `18px–28px` y píldoras flotantes.
   - **Sombras mínimas (`shadow/ref.json`):** `level.0` (`none`), `level.1` (`0 0 1px`), `level.2` (`0 0 2px`), `level.3` (`0 3px 6px` popovers), `level.4` (`0 12px 16px` drawers/modales), `level.5` (`0 24px 32px` modales superiores). Las tarjetas usan borde fino `1px` y sombra `level.0` o `level.1`, nunca sombras difusas pesadas.
   - **Escala `zIndex` determinista (`zIndex/sys.json`):** `100–500` elementos locales/sticky, `600` backdrop de sidebar/overlay, `700` contenedor de `SideModal`/`Sidebar`, `800` `Toast`/`Popover`/`Tooltip`, `1000` backdrop de `Modal` crítico, `1100` contenedor de `Modal` crítico (elimina la colisión caótica actual de `zIndex: 95`, `300`, `1200`, `9999` en LevelPro).
   - **Breakpoints Nimbus (`breakpoint/sys.json`):** `xs: 0px`, `md: 672px`, `lg: 1024px` (umbral donde el `Menu` pasa de drawer mobile a sidebar fijo desktop), `xl: 1200px`, `xxl: 1920px`.

---

## 4. EXTRACCIÓN EXHAUSTIVA DE PATRONES VISUALES Y ESTRUCTURALES (SECCIÓN 4)

### 4.1 APP SHELL & NAVEGACIÓN GLOBAL

#### PAT-01 · `AppShell` (Estructura Raíz del Administrador)
- **URL oficial:** `https://tiendanube.dev/es-AR/documentation/patterns/app-shell` (`@nimbus-ds/app-shell` `v1.10.0`) y `packages/react/src/components/AppShell/src/appShell.types.ts`
- **Título del componente:** `App Shell` (`AppShell`, `AppShell.Header`, `AppShell.Body`)
- **Fecha de consulta:** `2026-11-25`
- **Evidencia visual:** Diagramas estructurales y ejemplos interactivos en `tiendanube.dev` + Storybook `patterns-appshell--docs`
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS`
- **Propósito:** Estructura raíz única del panel administrativo que coordina menú lateral izquierdo persistente, barra superior fija (`AppShell.Header`) y área de trabajo (`AppShell.Body` donde se monta `Page`). Prohibido anidar más de una instancia o usar barra superior flotante tipo isla.
- **Estructura:** Grid/Flex de dos columnas a nivel viewport (`[Menu Column] + [Main Column: Header sticky top + Scrollable Body]`).
- **Distribución:** Sidebar pegado al borde izquierdo a altura completa (`100dvh`); columna derecha con `AppShell.Header` fijo arriba (`leftSlot` + `rightSlot`) y lienzo claro debajo.
- **Dimensiones observables:**
  - `menuExpandedWidth`: `240px` por defecto (`DOCUMENTADO EN NIMBUS`).
  - `menuCollapsedWidth`: `48px` por defecto en modo rail de íconos (`DOCUMENTADO EN NIMBUS`).
  - Altura de `AppShell.Header`: `56px` (`3.5rem` — `OBSERVADO EN TIENDANUBE` / escala `spacing.14`).
- **Espaciado:** Cero márgenes externos flotantes alrededor del shell; transición limpia por borde `1px solid` entre sidebar, header y lienzo.
- **Tipografía:** `Geist` `14px` (`body.base`) en controles del header; `12px` (`body.caption`) en atajos y contadores.
- **Jerarquía:** El contenido operativo (`Page`) domina el `80%+` del viewport; el shell enmarca silenciosamente en tonos neutros claros (`#FFFFFF` / `#F5F5F5`) sin competir con los datos.
- **Comportamiento interactivo:**
  - `menuExpanded={true}` (default desktop `>= 1024px`): sidebar fijo de `240px` con ícono + etiqueta.
  - `menuExpanded={false}`: colapsa a rail de `48px`; soporta `menuBehavior="inline"` (reacomoda el ancho del contenido de forma persistente mediante botón toggle) o `menuBehavior="popover"` (`menuFlyout={{ trigger: "hover" | "manual" }}` en portal flotante cerrable con `Escape` o clic externo).
- **Estados:** Expandido fijo, colapsado inline, flyout temporal al hover/clic, modo mobile (`< 1024px`) con sidebar oculto y apertura en drawer.
- **Accesibilidad:** Landmarks `<aside aria-label="Navegación principal">`, `<header>`, `<main id="admin-main-content">`, skip-link al contenido principal, cierre de flyouts con `Escape`.
- **Responsive:** `>= 1024px` (`lg`): sidebar lateral visible (`240px` o `48px`). `< 1024px` (`xs`–`md`): sidebar oculto del flujo; botón hamburguesa en `AppShell.Header.leftSlot` abre `Sidebar` (`position="left"`) como drawer.

#### PAT-02 · `Menu` (Menú Lateral Jerárquico del Administrador)
- **URL oficial:** `https://tiendanube.dev/es-AR/documentation/patterns/menu` (`@nimbus-ds/menu` `v2.0.3`)
- **Título del componente:** `Menu` (`Menu.Header`, `Menu.Body`, `Menu.Section`, `Menu.Button`, `Menu.ButtonAccordion`, `Menu.Footer`)
- **Fecha de consulta:** `2026-11-25`
- **Evidencia visual:** Ejemplos interactivos `Expanded` / `Collapsed` en `tiendanube.dev` con las secciones reales de Tiendanube (*Inicio, Estadísticas, Gestión [Ventas, Productos, Pago Nube, Envío Nube, Clientes, Descuentos, Marketing], Canales de venta [Tienda online...], Configuración*).
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS` + `OBSERVADO EN TIENDANUBE`
- **Propósito:** Navegación persistente entre todos los módulos del administrador. Agrupa módulos por dominio de negocio con acordeones de primer/segundo nivel sin menús horizontales flotantes.
- **Estructura:**
  1. `Menu.Header`: Marca LevelPro Audio + nombre de tienda + botón de colapsar/expandir.
  2. `Menu.Body` scrollable verticalmente con `Menu.Section` (con título de grupo opcional, p. ej. *Gestión*, *Operaciones & ERP*, *Canales & Contenido*) y divisores finos.
  3. `Menu.Button`: Ítem hoja con ícono `16px–18px` a la izquierda, texto `14px` y `Badge`/`Tag` opcional a la derecha (ej. pedidos pendientes).
  4. `Menu.ButtonAccordion`: Grupo desplegable (ej. *Ventas* $\rightarrow$ *Órdenes, Ventas manuales, Cotizaciones B2B, Bajo pedido, Pagos, Tributario*; *Productos* $\rightarrow$ *Lista de productos, Inventario & WMS, Categorías, Marcas, Importación*).
  5. `Menu.Footer`: Acceso fijo inferior a *Configuración* (`/admin/settings` / parámetros) y enlace externo *"Ver mi tienda"* (`/`).
- **Distribución:** Columna vertical de `240px`, padding interno `8px–12px`, ítems a ancho completo con `border-radius: 6px`.
- **Dimensiones observables:** Altura por ítem `36px` (`32px–36px` desktop, `44px` táctil en drawer mobile); sangría de subítems en acordeón `28px–32px`.
- **Espaciado:** `gap: 2px–4px` entre ítems hermanos; `12px–16px` entre `Menu.Section`s.
- **Tipografía:** Ítems `Geist` `14px` `weight: 400` en reposo, `weight: 500/600` cuando `active`; encabezados de sección `12px` (`body.caption`) `weight: 500` en texto secundario (`#5D5D5D`), sin mayúsculas espaciadas agresivas.
- **Jerarquía:** Solo la ruta activa (y su acordeón padre) recibe énfasis visual primario; los demás ítems permanecen neutros (`#242A34` / `#0B0E14`).
- **Comportamiento interactivo:** Al navegar a una subruta, su `ButtonAccordion` padre permanece abierto automáticamente; en modo colapsado (`48px`), pasar el cursor sobre cada ícono muestra tooltip/popover con el nombre o submenú (`showPopoversWhenCollapsed`).
- **Estados:** Reposo, hover (`background: #F5F5F5`), focus-visible (`2px solid` accesible), `active` (fondo tintado suave de marca `rgba(26, 255, 110, 0.14)` + indicador lateral `#1AFF6E` / texto `#0B0E14` `weight: 600` con contraste `> 14:1`), deshabilitado/oculto por RBAC.
- **Accesibilidad:** Navegación por `Tab`, `Enter`/`Space`, `aria-expanded` en acordeones, `aria-current="page"` en ruta activa.
- **Responsive:** En `< 1024px` se monta exactamente el mismo árbol `Menu` dentro de `Sidebar` (`position="left"`, `maxWidth: 300px`, cierre automático al cambiar de ruta o presionar `Escape`).

#### PAT-03 · `AppShell.Header`, Búsqueda Global (`Cmd+K`) y Centro de Notificaciones
- **URL oficial:** `https://tiendanube.dev/es-AR/documentation/patterns/app-shell` + `https://ayuda.tiendanube.com/es_AR` (buscador rápido `Cmd+K` / `Ctrl+K`)
- **Título del componente:** `AppShell.Header` + Global Search + Notification Popover + Account Menu
- **Fecha de consulta:** `2026-11-25`
- **Evidencia visual:** Especificación de `leftSlot` / `rightSlot` en `AppShell` (`1.10.0`) y documentación de búsqueda global del Admin de Tiendanube.
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS` (`AppShell.Header`, `Popover`, `Badge`) + `OBSERVADO EN TIENDANUBE` (barra superior con buscador `Cmd+K`, ayuda/notificaciones y menú de cuenta).
- **Propósito:** Proveer utilidades transversales permanentes sin robar altura vertical ni duplicar la navegación del sidebar.
- **Estructura:**
  - `leftSlot`: Botón hamburguesa (solo `< 1024px`), botón colapsar sidebar (desktop) y contexto/breadcrumb compacto o selector rápido de tienda.
  - Centro / `rightSlot`: Disparador de Búsqueda Global / Command Palette (`Buscar en LevelPro… ⌘K`, `AdminSearch.jsx`), enlace rápido `Ver tienda ↗`, campana de Centro de Notificaciones (`BF-32` con `Badge` contador de no leídas) y menú de perfil de usuario (`Rol RBAC` + `Cerrar sesión`).
- **Dimensiones observables:** Alto fijo `56px`, fondo `#FFFFFF`, borde inferior `1px solid #E5E7EB`.

---

### 4.2 PÁGINAS, LAYOUTS Y CONTENEDORES

#### PAT-04 · `Page` (`Page.Header` + `Page.Body`)
- **URL oficial:** `https://tiendanube.dev/es-AR/documentation/patterns/page` (`@nimbus-ds/page` `v1.3.7`) y `https://tiendanube.dev/apps/admin/design-guidelines/concept-usage`
- **Título del componente:** `Page`
- **Fecha de consulta:** `2026-11-25`
- **Evidencia visual:** Código oficial y anatomía en `tiendanube.dev/es-AR/documentation/patterns/page`
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS`
- **Propósito:** Marco estructural único de toda vista de primer nivel (listados, formularios de alta/edición, detalle de entidad, configuraciones).
- **Estructura:**
  - `Page.Header`: Fondo claro transparente integrado al lienzo (`#F5F5F5`), **jamás una caja hero negra**. Incluye navegación de retorno (`IconButton` `ChevronLeft` / breadcrumbs cuando es subvista), `title` (`<h1>`), `subtitle` descriptivo opcional, `buttonStack` alineado a la derecha (acciones secundarias a la izquierda + **exactamente una acción primaria** `Button appearance="primary"` al extremo derecho), `Tag`s de estado global opcionales y `Alert` contextual opcional debajo del título.
  - `Page.Body`: Contenedor principal con ancho máximo controlado (`1200px–1360px` centrado para formularios/configuración; fluido controlado hasta `1600px` para tablas ERP densas) y separación vertical uniforme (`16px–24px`).
- **Reglas estrictas (`Do and Don'ts` documentados en Nimbus):**
  - ✅ Una sola acción `primary` por cabecera de página (`concept-usage`).
  - ✅ Título `<h1>` semántico siempre visible y específico (*"Productos"*, *"Órdenes"*, *"Agregar producto"*).
  - ❌ Prohibido anidar `Page` dentro de otro `Page`, modal o tab.

#### PAT-05 · `Layout` (Grillas de 1, 2 Simétricas, 2 Asimétricas y 3 Columnas)
- **URL oficial:** `https://tiendanube.dev/es-AR/documentation/patterns/layout` (`@nimbus-ds/layout` `v1.3.7`)
- **Título del componente:** `Layout` (`Layout.Section`)
- **Fecha de consulta:** `2026-11-25`
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS`
- **Propósito:** Organizar tarjetas (`Card`) en tipologías estandarizadas de Tiendanube:
  - `1 column`: Listados con `DataTable` o configuraciones lineales.
  - `2 asymmetric columns` (`~66%` principal + `~34%` lateral derecha, colapsando a `1 column` bajo `1024px`): **Patrón insignia de Tiendanube** para Alta/Edición de Producto, Detalle de Pedido, Detalle de Proveedor, Campañas y Cotizaciones B2B.
  - `2 symmetric columns` / `3 columns`: Comparativas y paneles operativos.
- **Espaciado:** `gap: 16px` (`spacing.4`) o `20px` (`spacing.5`) entre columnas y secciones apiladas.

#### PAT-06 · `Card` y `CalloutCard`
- **URL oficial:** `https://tiendanube.dev/apps/admin/design-guidelines/component-usage`, `https://tiendanube.dev/es-AR/documentation/patterns/callout-card` (`v1.7.1`) y `card.types.ts`
- **Título del componente:** `Card` (`Card.Header`, `Card.Body`, `Card.Footer`) & `CalloutCard`
- **Fecha de consulta:** `2026-11-25`
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS`
- **Propósito:** Agrupar atributos o controles relacionados sobre superficie blanca limpia (`#FFFFFF`), con borde `1px solid #E5E7EB`, radio `8px` (`shape.border.radius.2`), padding `16px–20px`, título de tarjeta en `Geist` `16px` `weight: 600` (`#0B0E14`) y acciones de contexto local en `Card.Header` o `Card.Footer`.

#### PAT-07 · `SummaryStats` (Métricas Ejecutivas Sobrias)
- **URL oficial:** `https://tiendanube.dev/es-AR/documentation/patterns/summary-stats` (`@nimbus-ds/summary-stats` `v1.1.0`)
- **Título del componente:** `Summary Stats` (`SummaryStats`, `SummaryStats.Item`)
- **Fecha de consulta:** `2026-11-25`
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS`
- **Propósito:** Sustituir las tarjetas Bento fintech oscuras/neón y medidores circulares decorativos por bandas limpias de métricas (`layout="horizontal"` o `"grid"`) dentro de superficie blanca con separadores verticales sutiles: `description` (`12px–13px` `#5D5D5D`), `value` (`20px–24px` `Geist` / `Geist Mono` `tabular-nums` `#0B0E14`), `trend` (`up`/`down`/`neutral`) con `Tag` semántico y `tooltip` explicativo opcional.

#### PAT-08 · `Tabs` & `NavTabs`
- **URL oficial:** `https://tiendanube.dev/es-AR/documentation/patterns/nav-tabs` (`v1.4.0`) y `packages/react/src/composite/Tabs/src/tabs.types.ts`
- **Título del componente:** `Tabs` (desktop/in-page) y `NavTabs` (mobile)
- **Fecha de consulta:** `2026-11-25`
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS`
- **Propósito:** Alternar sub-vistas de igual jerarquía dentro de una entidad o módulo con línea inferior limpia (`border-bottom: 1px solid #E5E7EB`), indicador inferior activo de `2px` (`#0B0E14` con acento `#1AFF6E`) y contador `Badge` opcional, eliminando los botones oscuros `#121722` y píldoras dispares que hoy coexisten en `AdminProductDetail`, `AdminOrders`, `AdminMarketing` y `AdminSettings`.

---

### 4.3 TABLAS DE DATOS, BÚSQUEDA, FILTROS Y ACCIONES MASIVAS

#### PAT-09 · `DataTable` (`Header`, `Row`, `Cell`, `Checkbox`, `BulkActions`, `Dropdown`, `Footer`)
- **URL oficial:** `https://tiendanube.dev/es-AR/documentation/patterns/data-table` (`@nimbus-ds/data-table` `v1.5.1`) y `dataTable.types.ts`
- **Título del componente:** `Data Table`
- **Fecha de consulta:** `2026-11-25`
- **Evidencia visual:** Ejemplos oficiales de tablas de *Pedidos* (`#1042`, Cliente, Total, Cant. de productos, Estado) y *Productos* (Producto, Categoría, Stock, Precio, Acciones) en `tiendanube.dev`.
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS` + `OBSERVADO EN TIENDANUBE`
- **Propósito:** Explorar, filtrar, comparar y operar individualmente o en lote sobre listados de entidades comparables ($\ge 3$ columnas).
- **Estructura y Anatomía:**
  1. **Toolbar superior de filtrado (integrada al contenedor blanco):** Buscador `Input` (`type="search"`, `36px` de alto) + botones de filtro / selectores compactos + fila de `Chip`s removibles para filtros activos (`Limpiar filtros`).
  2. **`DataTable.BulkActions` (barra sticky contextual):** Aparece **únicamente cuando hay $\ge 1$ fila seleccionada** sobre la cabecera de tabla, mostrando checkbox maestro, conteo (`"N seleccionados"`) y selector/botones de acciones masivas (p. ej. `Edición masiva BF-15`, `Exportar CSV`).
  3. **`DataTable.Header`:** Fila superior de **superficie clara neutra** (`#F9FAFB` / `#FFFFFF` con `border-bottom: 1px solid #E5E7EB`, **prohibido el encabezado negro `#0B0E14` actual**), texto `12px` `weight: 600` `#4B5563`, controles de ordenamiento con `IconButton` compacto.
  4. **`DataTable.Row` & `DataTable.Cell`:** Altura de fila `48px–56px`, fondo `#FFFFFF`, hover `#F8FAFC`, fila seleccionada con sutil tinte neutro/marca, `Checkbox` en primera columna (`40px`), miniatura `Thumbnail` `40×40px` en productos, códigos/SKUs/montos en `Geist Mono` `tabular-nums`, estados con `Tag` y última columna (`48px`) con `DataTable.Dropdown` (botón `IconButton` de 3 puntos verticales `MoreVertical`).
  5. **`DataTable.Footer`:** Franja inferior con conteo a la izquierda (`"Mostrando 1–20 de N registros"`) + selector de tamaño de página y `Pagination` a la derecha (se oculta si cabe en 1 página).
- **Responsive:** En `< 768px`, contenedor con scroll horizontal limpio sin desbordar el `Page` (`max-width: 100vw`) + fijación de columna primaria o vista resumida `DataList` / `InteractiveList` para lectura táctil en `320px` y `390px`.

---

### 4.4 FORMULARIOS, CONTROLES, CARGA DE ARCHIVOS Y BARRA DE GUARDADO

#### PAT-10 · `FormField` + Primitivos de Entrada (`Input`, `Select`, `Textarea`, `Checkbox`, `Radio`, `Toggle`, `FileUploader`)
- **URL oficial:** `https://tiendanube.dev/es-AR/documentation/patterns/form-field` (`@nimbus-ds/form-field` `v1.8.1`) y `https://tiendanube.dev/apps/admin/design-guidelines/component-usage`
- **Título del componente:** `Form Field`
- **Fecha de consulta:** `2026-11-25`
- **Estado de verificación:** `DOCUMENTADO EN NIMBUS`
- **Propósito:** Estandarizar el 100 % de la captura de datos en formularios, modales y simuladores.
- **Anatomía verificada:**
  1. `Label`: Asociado por `htmlFor`/`id`, `Geist` `13px` (`0.8125rem`) `weight: 500`, color `#0B0E14`, margen inferior `6px`.
  2. `Control`: Fondo `#FFFFFF` (**elimina definitivamente los inputs negros `bentoInput` `#0B0E14` incrustados sobre tarjetas claras**), borde `1px solid #D1D5DB`, radio `6px`, altura `36px` (`padding: 8px 12px`), texto `14px` `#0B0E14`, placeholder `#9CA3AF`, foco con anillo accesible `2px` y borde `#0B0E14`.
  3. `Icon` + `Help text` unificado bajo el campo (`12px`), cuya semántica cambia según `appearance`:
     - `none`: guía neutral (`#5D5D5D`, ej. *"Se muestra en el catálogo público"*).
     - `success`: confirmación válida (`#0A7A35`).
     - `warning`: advertencia no bloqueante (`#935B00`).
     - `danger`: error de validación bloqueante (`#C80003`, `aria-invalid="true"`, `role="alert"`).
- **Barra de Cambios sin Guardar (`UnsavedChangesBar`):**
  - **Estado de verificación:** `OBSERVADO EN TIENDANUBE` / `INFERIDO` sobre `Page` + `Button`.
  - **Comportamiento:** En formularios largos de edición (Producto, Proveedor, Configuración/CMS, Marketing), cuando el estado del formulario difiere del servidor (`isDirty`), se fija una barra contextual superior o inferior con estado *"Cambios sin guardar"*, botón secundario `Cancelar / Descartar` y botón primario `Guardar cambios`.

---

### 4.5 OVERLAYS (`Modal`, `SideModal`, `Sidebar`, `Popover`, `Dropdown`, `Tooltip`, Confirmación)

| ID | Patrón Nimbus | URL / Fuente Verificada | Estado Verif. | Dimensiones y Reglas de Uso en LevelPro |
|---|---|---|---|---|
| **PAT-11** | `Modal` | `composite/Modal/src/modal.types.ts` (`200`) | `DOCUMENTADO EN NIMBUS` | Diálogo centrado (`maxWidth: 480px–640px`), fondo `#FFFFFF`, radio `8px`, sombra `level.5`, `zIndex: 1000/1100`, trap de foco, `Escape` para cerrar. Uso exclusivo para creaciones focalizadas cortas o decisiones puntuales. |
| **PAT-12** | `SideModal` | `https://tiendanube.dev/es-AR/documentation/patterns/side-modal` (`v1.8.1`, `200`) | `DOCUMENTADO EN NIMBUS` | Panel lateral derecho (`maxWidth: { xs: "100%", md: "420px", lg: "560px"–"680px" }`), cabecera fija con título + `IconButton` cerrar, cuerpo con scroll propio y `footer` fijo con acciones primaria/secundaria. Uso obligatorio para **Detalle de Orden OMS**, **Ficha Cliente CRM 360°**, **Detalle de Evento de Auditoría** y **Edición Masiva con Preview**. |
| **PAT-13** | `ConfirmationModal` | `templates-confirmationmodal--basic` (`200`) | `DOCUMENTADO EN NIMBUS` | Diálogo compacto (`maxWidth: 420px`) para acciones destructivas o irreversibles (eliminar producto/categoría/marca, finalizar Landed Cost, publicar/rollback CMS, aprobar crédito). Botón de confirmación en variante `danger` (`#C80003` texto blanco) cuando destruye o revierte. |
| **PAT-14** | `Popover` / `Dropdown` | `atomic/Popover` + `DataTable.Dropdown` (`200`) | `DOCUMENTADO EN NIMBUS` | Menú contextual flotante (`zIndex: 800`, radio `8px`, borde `1px solid #E5E7EB`, sombra `level.3`) para acciones por fila, Centro de Notificaciones y menú de cuenta. |
| **PAT-15** | `Tooltip` | `atomic/Tooltip` (`200`) | `DOCUMENTADO EN NIMBUS` | Etiqueta flotante breve (`#0B0E14` fondo, `#F5F5F5` texto `12px`, radio `6px`) para íconos del sidebar colapsado y explicaciones de fórmulas contables/métricas. |

---

### 4.6 ESTADOS DE INTERFAZ Y RETROALIMENTACIÓN

| Estado | Patrón Nimbus | Clasificación | Regla Visual y de Comportamiento |
|---|---|---|---|
| **Loading / Spinner** | `Spinner` (`atomic/Spinner`) | `DOCUMENTADO EN NIMBUS` | Indicador inline en botones en curso (`loading={true}`, deshabilita doble submit) y recargas parciales. |
| **Skeleton** | `Skeleton` (`atomic/Skeleton`) | `DOCUMENTADO EN NIMBUS` | Bloques grises claros animados (`#EFEFEF` $\rightarrow$ `#E5E7EB`, radio `6px`) en carga inicial de `DataTable`, `SummaryStats` y `Card`s; nunca pantallas en blanco ni textos planos `"Cargando..."`. |
| **Empty (Búsqueda/Filtro)** | `EmptyMessage` (`v1.2.6` — *With icon*) | `DOCUMENTADO EN NIMBUS` | Ícono `32px` neutro, título claro (*"No encontramos resultados para tu búsqueda"*), texto guía y enlace/botón `Limpiar filtros`. |
| **Initial State (Sin datos)** | `InitialScreen` / `EmptyMessage` (*With illustration/icon*) | `DOCUMENTADO EN NIMBUS` | Guía de primer uso cuando un módulo aún no tiene registros (ej. sin cupones, sin cuentas de tesorería en ARS) con CTA primario directo (*"Crear primer cupón"*). |
| **Error** | `Alert appearance="danger"` | `DOCUMENTADO EN NIMBUS` | Banner de alerta persistente (`#FEDEDE` fondo suave, borde `#F77A7C`, texto `#530001`, ícono de alerta y botón `Reintentar` cuando falla una query). |
| **Success / Info Toast** | `Toast` (`atomic/Toast`, `4000ms`) | `DOCUMENTADO EN NIMBUS` | Notificación efímera no bloqueante en esquina superior/inferior derecha para confirmaciones de guardado, copia o exportación (`zIndex: 800`). |
| **Disabled** | Tokens `neutral.surface-disabled` / `text-disabled` | `DOCUMENTADO EN NIMBUS` | Fondo `#E7E7E7`, texto `#6D6D6D`, `cursor: not-allowed`, sin opacidad borrosa ilegible. |
| **Permission Denied (RBAC)** | `Alert` + `EmptyMessage` + ocultación preventiva | `INFERIDO` (sobre Nimbus) | Controles sin permiso se deshabilitan con tooltip explicativo o se ocultan según contrato Zero-Trust; rutas sin acceso muestran estado estructurado de permiso insuficiente con retorno seguro a `/admin`. |
| **Unsaved Changes** | `UnsavedChangesBar` + `ConfirmationModal` | `OBSERVADO EN TIENDANUBE` | Indicador explícito cuando `isDirty === true` en formularios maestros y confirmación antes de descartar cambios. |

---

## 5. ANÁLISIS DE FLUJOS ADMINISTRATIVOS REALES DE TIENDANUBE (SECCIÓN 3)

| Flujo / Módulo Tiendanube | Estado de Evidencia | Estructura Funcional y Visual de Referencia en Tiendanube | Equivalencia en LevelPro OS V4.0 |
|---|---|---|---|
| **1. Panel Inicial (`Inicio`)** | `OBSERVADO EN TIENDANUBE` + `DOCUMENTADO EN NIMBUS` (`SummaryStats`, `CalloutCard`, `Card`) | Saludo contextual sobrio + selector de período/moneda, banda superior de `SummaryStats` (ventas, pedidos, ticket promedio), lista accionable de tareas/alertas pendientes (*Pedidos por cobrar, Pedidos por empaquetar, Stock bajo*) con contadores y enlaces directos, gráfico limpio de evolución de ventas y tabla compacta de últimos pedidos. **Sin tarjetas negras gigantes con anillos de neón.** | `/admin` (`AdminDashboard.jsx`) |
| **2. Listado de Productos** | `OBSERVADO EN TIENDANUBE` + `DOCUMENTADO EN NIMBUS` (`Page`, `DataTable`) | `Page.Header` con botones secundarios (`Exportar`, `Importar`) y CTA primario (`+ Agregar producto`). Barra de búsqueda + filtros desplegables/chips (Categoría, Marca, Visibilidad, Stock). `DataTable` blanca con checkbox, miniatura `40×40`, Nombre + SKU, Stock editable/visible, Precio (y precio promocional), `Tag` de visibilidad y acciones rápidas (editar, ver en tienda, eliminar). `BulkActions` sticky al seleccionar filas. | `/admin/products` (`AdminProducts.jsx`) + `BulkEditModal.jsx` + `/admin/products/import` |
| **3. Alta y Edición de Producto + Variantes** | `OBSERVADO EN TIENDANUBE` + `DOCUMENTADO EN NIMBUS` (`Layout` 2 cols asimétricas, `Card`, `FormField`) | Vista dedicada (o drawer/página estructurada) en `Layout` asimétrico `2/3 + 1/3`: **Columna izquierda (`2/3`):** `Card` Nombre y Descripción, `Card` Fotos y Multimedia (grilla con portada destacada), `Card` Precios (Precio venta, Precio promocional y multi-moneda CLP/USD/ARS en LevelPro), `Card` Inventario y Códigos (SKU, Barcode, Stock, Stock mínimo), `Card` Variantes (atributos como Impedancia/Color/Conexión y tabla de combinaciones con SKU/Precio/Stock por variante), `Card` Especificaciones Técnicas y Proveedores (extensión LevelPro), `Card` SEO. **Columna derecha (`1/3`):** `Card` Estado/Publicación (`Toggle` Activo, Destacado), `Card` Organización (Categoría, Marca, Tipo de producto). | `/admin/products/:id` (`AdminProductDetail.jsx`) + creación/edición en `AdminProducts.jsx` |
| **4. Listado de Ventas / Pedidos** | `OBSERVADO EN TIENDANUBE` + `DOCUMENTADO EN NIMBUS` (`DataTable`, `Tag`) | KPIs compactos filtrables (`SummaryStats` clicables: Todas, Por cobrar, Por empaquetar, Enviadas), pestañas limpias de submódulo OMS, buscador + filtros por estado/origen/moneda, y `DataTable` cuyas columnas clave muestran **# Pedido**, **Fecha**, **Cliente**, **Total (moneda explícita)**, **Estado del Pago (`Tag`)**, **Estado del Envío/Logística (`Tag`)** y acción rápida. | `/admin/orders` (`AdminOrders.jsx`) |
| **5. Detalle de Pedido** | `OBSERVADO EN TIENDANUBE` + `DOCUMENTADO EN NIMBUS` (`SideModal` / `Layout` 2 cols) | Jerarquía clara de operación: encabezado con `#Orden`, fecha, origen (Web, Manual, WhatsApp, B2B) y badges de los 3 estados (Comercial, Pago, Envío); tarjeta de productos comprados con cantidades, SKU y subtotal; tarjeta de estado de pago e intentos conciliados; tarjeta de despacho WMS / courier / tracking; datos del cliente; e historial/RMA. | `OrderPanel` (`SideModal`) en `AdminOrders.jsx` |
| **6. Clientes (CRM & B2B)** | `OBSERVADO EN TIENDANUBE` + `INFERIDO` (extensiones B2B LevelPro) | Listado limpio en `DataTable` con nombre, email, organización, compras acumuladas / última compra y segmento; clic en fila abre ficha lateral `SideModal` 360° con datos de contacto, perfil técnico pro-audio, historial de interacciones, órdenes y crédito B2B. | `/admin/users` (`AdminUsers.jsx`) + `/admin/b2b` (`AdminB2BQuotes.jsx`) |
| **7. Marketing y Descuentos** | `OBSERVADO EN TIENDANUBE` + `INFERIDO` (motor Gate 11) | Navegación limpia por pestañas (`Tabs`: Cupones, Promociones programadas, Carritos abandonados, Consentimiento & Outbox, Simulador), `DataTable` de cupones con código en `Geist Mono`, vigencia, usos (`usados/límite`), estado `Tag` y formulario guiado en tarjetas claras (`FormField`). | `/admin/marketing` (`AdminMarketing.jsx`), `/admin/loyalty`, `/admin/rewards/*` |
| **8. Tienda Online / CMS y Configuración** | `OBSERVADO EN TIENDANUBE` + `INFERIDO` (Editorial CMS Gate 12) | En Tiendanube *Tienda online > Diseño* separa controles editoriales en panel estructurado claro junto al previsualizador responsive real (Desktop / Tablet / Mobile) sin contaminar el CSS de la tienda pública, mientras *Configuración* organiza medios de pago, envíos, impuestos/FX, usuarios y permisos en tarjetas claras con encabezados descriptivos. | `/admin/settings` (`AdminSettings.jsx`), `/admin/payment-methods`, `/admin/roles`, `/admin/audit` |

---

## 6. DIAGNÓSTICO DE BRECHA ARQUITECTÓNICA ACTUAL EN LEVELPRO OS (`fa53c7f9`)

La auditoría directa del código actual explica con total precisión por qué la implementación previa fue rechazada por el propietario:

1. **Navegación superior flotante oscura ajena a Tiendanube (`AdminLayout.jsx` + `v3-editorial-bento.css`):** Hoy existe una barra flotante horizontal negra (`v3-floating-header` / `v3-nav-island` en `#0B0E14`, `border-radius: 999px`) con menús desplegables por hover y cero sidebar izquierdo persistente.
2. **Hero Headers negros masivos (`admin-ui.css` `.au-header`):** Cada página abre con un bloque oscuro `#0B0E14` con gradiente radial verde, texto gigante `30px` peso `800` y `eyebrow` técnicos (`"GATE 6 · BF-09 & BF-18"`, `"LEVELPRO / GATE 7 OMS"`), opuesto al `Page.Header` plano y limpio de Nimbus.
3. **Cabeceras de tabla negras (`admin-ui.css` `.au-table thead th`):** Todas las tablas `.au-table` pintan `thead` en `#0B0E14` con texto blanco en mayúsculas, mientras otras páginas usan `.lp-table` o `<table style={{...}}>` inline, generando 3 estilos de tabla incompatibles.
4. **Dashboard Fintech Bento (`AdminDashboard.jsx`):** Basado explícitamente en *"Lumin - Referencia C"* con tarjeta obsidiana `#101214`, anillo SVG con `drop-shadow` neón `#1AFF6E` y barras segmentadas decorativas.
5. **Controles oscuros incrustados en vistas claras (`AdminProductDetail.jsx`, `BulkEditModal.jsx`):** `bentoInput` define `background: "#0B0E14"` y tarjetas de variantes/especificaciones en `#0B0E14` dentro de una página clara, rompiendo la legibilidad y la consistencia.
6. **Clases utilitarias huérfanas, `window.confirm` y modales inline duplicados:** Del total reconciliado de **315 superficies individuales** (`41` rutas/enlaces, `5` shell, `90` pestañas/modos, **`73` overlays**, **`64` tablas**, **`34` formularios** y `8` estados), existen hoy `6` modales manuales `position: "fixed"` (`WmsInventoryTabs` [2], `AdminSuppliers` [2], `AdminProcurement` [2]), `4` diálogos nativos bloqueantes `window.confirm` (`AdminPayments`, `AdminProducts`, `AdminProductDetail`, `AdminSupplierDetail`) y `54` tablas fuera del componente `DataTable`. Todos migrarán a primitivos homologados Nimbus sin pérdida funcional, manteniendo el ancho oficial colapsado de **`48px`** (`menuCollapsedWidth=48px`).

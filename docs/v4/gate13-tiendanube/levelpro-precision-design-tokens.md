# LEVELPRO PRECISION — DESIGN SYSTEM TOKENS (PHASE 1.2)

> **Sistema:** `LEVELPRO PRECISION` (Tiendanube/Nimbus Structural System × Lumin Art Direction)  
> **Estado:** Especificación normativa de tokens visuales previa a Phase 2  
> **Nota:** Documento de arquitectura visual. **No implementa CSS ni modifica código productivo en esta fase.**

---

## 1. Paleta corporativa obligatoria y roles cromáticos

Los 4 colores maestros de identidad establecidos para Phase 1.2 definen la columna vertebral cromática del panel administrativo:

| Token maestro | Hex exacto | Rol estructural |
| --- | --- | --- |
| `--lp-black-deep` | `#09090B` | Texto principal, botón primario CTA, tooltip oscuro editorial, logotipo positivo |
| `--lp-green-level` | `#1AFF6E` | Acento quirúrgico de marca: barra indicadora activa (`2.5 px`), punto focal de curva, switch activo, pulso de estado vivo |
| `--lp-white-pure` | `#F5F5F5` | Lienzo base de la aplicación (`bg-canvas`), equilibrio visual entre bloques |
| `--lp-graphite` | `#242A34` | Superficies oscuras elevadas de apoyo, subtítulos de preview oscuro, texto de contraste medio-alto |

### 1.1 Escala completa de tokens semánticos (16 roles)

| Token CSS propuesto | Valor Hex / RGBA | Uso autorizado | Contraste WCAG sobre fondo objetivo |
| --- | --- | --- | --- |
| `--lp-bg-canvas` | `#F5F5F5` | Fondo general de ventana y área de trabajo | Base de lienzo |
| `--lp-bg-surface` | `#FFFFFF` | Cards, `DataTable`, formularios, sidebar expandido/rail, modales | Base de superficie |
| `--lp-bg-surface-subtle` | `#FAFAFA` | Cabecera `<thead>` de tablas, secciones de preview en formulario, footer sticky sutil | Base secundaria |
| `--lp-bg-surface-hover` | `#F4F4F5` | Hover de filas de tabla, ítem activo de sidebar, controles segmented inactivos | Base interactiva |
| `--lp-bg-brand-dark` | `#09090B` | Botón primario, tooltip flotante, drawer hero preview | **19.9 : 1** con `#FFFFFF` (**AAA**) |
| `--lp-bg-brand-graphite` | `#242A34` | Botones/superficies secundarias dentro de preview oscuro Storefront | **14.3 : 1** con `#FFFFFF` (**AAA**) |
| `--lp-text-primary` | `#09090B` | Títulos H1/H2, valores KPI, celdas principales, etiquetas activas | **19.9 : 1** sobre `#FFFFFF` (**AAA**) |
| `--lp-text-secondary` | `#52525B` | Subtítulos, encabezados de columna, etiquetas de formulario, placeholders activos | **7.4 : 1** sobre `#FFFFFF` (**AAA**) |
| `--lp-text-muted` | `#71717A` | Breadcrumbs inactivos, timestamps, ayuda inline (`helperText`), metadata menor | **4.8 : 1** sobre `#FFFFFF` (**AA**) |
| `--lp-border-hairline` | `#E4E4E7` | Borde estructural por defecto (`1 px solid`) en cards, inputs, sidebar, header | Divisores precisos sin ruido |
| `--lp-border-strong` | `#D4D4D8` | Borde hover en inputs, botones secundarios Outline, divisores de grupo | Definición interactiva |
| `--lp-accent-brand` | `#1AFF6E` | Exclusivo para acento: indicador lateral sidebar, punto vivo en chart, slider/toggle | Decorativo / focal (`≥ 3:1` en gráficos sobre `#09090B`) |
| `--lp-accent-ink` | `#0F7A38` | Texto semántico positivo sobre fondo claro o pill suave (nunca usar `#1AFF6E` como texto sobre blanco) | **5.4 : 1** sobre `#FFFFFF` / **4.7 : 1** sobre `#DCFCE7` (**AA**) |
| `--lp-status-success-bg` | `#ECFDF3` | Fondo suave badge `Pagado`, `Publicado`, `En stock` (con dot `#16A34A` y texto `#0F7A38`) | **AA+** |
| `--lp-status-warning-ink` / `bg` | `#B45309` / `#FEF3C7` | Estado `Stock bajo`, `Pendiente`, `Borrador` | **5.0 : 1** (**AA**) |
| `--lp-status-danger-ink` / `bg` | `#DC2626` / `#FEF2F2` | Acción destructiva en `Modal`, errores de validación, `Sin stock` | **4.6 : 1** sobre `#FEF2F2` (**AA**) |

> **Regla crítica de contraste sobre `#1AFF6E`:** Jamás renderizar texto pequeño blanco sobre `#1AFF6E`, ni texto `#1AFF6E` sobre `#FFFFFF`. Todo elemento interactivo con texto sobre `#1AFF6E` (en caso excepcional de acento relleno) exige tinta `#09090B` (**14.2 : 1 AAA**). Por defecto en `LEVELPRO PRECISION`, el botón primario es `#09090B` con texto `#FFFFFF`.

---

## 2. Tipografía (`Geist` & `Geist Mono`) y ritmo numérico

| Nivel tipográfico | Familia | Tamaño / Line-height | Weight | Tracking | Uso obligatorio |
| --- | --- | --- | --- | --- | --- |
| `--lp-font-page-title` | `Geist` | `20 px` / `28 px` | `600` (SemiBold) | `-0.02em` | H1 único de cada página en `Page.Header` |
| `--lp-font-kpi-value` | `Geist` | `24 px` / `30 px` | `600` + `tabular-nums` | `-0.025em` | Valores numéricos principales en `KpiCard` |
| `--lp-font-section-title` | `Geist` | `15 px` / `20 px` | `600` | `-0.015em` | Títulos de cards `2/3 + 1/3`, modales, SideModal |
| `--lp-font-body-strong` | `Geist` | `13 px` / `18 px` | `500`–`600` | `-0.005em` | Etiquetas `FormField`, celdas primarias, ítems nav activos |
| `--lp-font-body` | `Geist` | `13 px` / `19 px` | `400` | `0` | Texto operativo, descripciones, navegación estándar |
| `--lp-font-caption` | `Geist` | `12 px` / `16 px` | `500` | `+0.01em` | Encabezados de tabla (uppercase `11 px` `+0.04em`), badges |
| `--lp-font-mono` | `Geist Mono` | `12 px` / `16 px` | `500` + `tabular-nums` | `0` | **Exclusivo** para `SKU`, pedidos (`#LPA-*`), N° de serie, folios DTE, slugs URL y atajos `⌘K` |

---

## 3. Dimensiones de layout, espaciado, radios y bordes

### 3.1 Geometría estructural invariable (Tiendanube/Nimbus)

| Token de layout | Valor desktop (`≥1024 px`) | Valor tablet (`768 px`) | Valor mobile (`390 px` / `320 px`) |
| --- | --- | --- | --- |
| `--lp-sidebar-width` | `240 px` (expandido) | Colapsado / Overlay `48 px` o drawer | Drawer `280 px` (max `85vw`) |
| `--lp-sidebar-rail` | `48 px` | `48 px` (rail persistente opcional) | N/A |
| `--lp-header-height` | `56 px` | `56 px` | `56 px` |
| `--lp-content-max` | `1280 px` (con gutter `24 px`) | Fluid `100 %` (gutter `20 px`) | Fluid `100 %` (gutter `16 px`) |
| `--lp-grid-form` | Asimétrico `2fr : 1fr` (`gap: 20 px`) | Apilado `1fr` (`gap: 16 px`) | Apilado `1fr` (`gap: 12 px`) |

### 3.2 Sistema de espaciado base (`4 px` grid)

`4 px` (`space-1`), `8 px` (`space-2`), `12 px` (`space-3`), `16 px` (`space-4`), `20 px` (`space-5`), `24 px` (`space-6`), `32 px` (`space-8`).
- Padding estándar de `Card`: `20 px` en desktop, `16 px` en mobile.
- Padding de celda en `DataTable`: `12 px 16 px` (densidad operativa cómoda).

### 3.3 Radios y hairline borders

| Elemento | Radio (`border-radius`) | Borde |
| --- | --- | --- |
| Controles (`Button`, `Input`, `Select`, Nav item) | `8 px` | `1 px solid #E4E4E7` (en outline/inputs) |
| Tarjetas (`Card`, `KpiCard`, `DataTable` shell) | `12 px` | `1 px solid #E4E4E7` |
| Modales (`Modal`, `CommandPalette`, `Popover`) | `14 px` | `1 px solid #E4E4E7` |
| SideModal / Drawer lateral | `0 px` borde exterior / `12 px` paneles internos | `1 px solid #E4E4E7` izquierdo |
| Badges y dot pills | `9999 px` (pill) o `6 px` (tag técnica SKU) | `1 px solid` semántico o transparente |

---

## 4. Elevación, estados interactivos, movimiento y gráficos

### 4.1 Sombras editoriales mínimas (estilo Lumin)

- `--lp-shadow-none`: `none` (cards estándar sobre `#F5F5F5` descansan en hairline border `#E4E4E7`).
- `--lp-shadow-card`: `0 1px 2px rgba(9, 9, 11, 0.03), 0 1px 1px rgba(9, 9, 11, 0.02)`.
- `--lp-shadow-popover`: `0 8px 24px -4px rgba(9, 9, 11, 0.08), 0 2px 6px rgba(9, 9, 11, 0.04)`.
- `--lp-shadow-modal`: `0 20px 48px -12px rgba(9, 9, 11, 0.18), 0 0 0 1px rgba(9, 9, 11, 0.06)`.

### 4.2 Estados interactivos (`hover`, `active`, `focus`, `disabled`)

- **Focus Ring accesible:** `0 0 0 2px #FFFFFF, 0 0 0 4px #09090B` (visible por teclado `:focus-visible`, alto contraste garantizado sin Halo neón intrusivo).
- **Hover en filas y nav:** transición a `#F4F4F5` en `120 ms cubic-bezier(0.2, 0, 0, 1)`.
- **Disabled:** opacidad `0.48`, cursor `not-allowed`, sin sombras ni efecto hover.

### 4.3 Iconografía, controles, densidad y charts

| Categoría | Regla normativa `LEVELPRO PRECISION` |
| --- | --- |
| **Iconografía** | Exclusivamente **`lucide-react`** (`16 px` en nav y botones, `14 px` en breadcrumbs/badges, `18–20 px` en placeholders audio). Stroke `1.5 px` uniforme. **Cero emojis Unicode.** |
| **Controles de acción** | Jerarquía de 3 niveles: Primario (`#09090B` sólido + `#FFFFFF`), Secundario (`#FFFFFF` + borde `#D4D4D8` + `#09090B`), Ghost (`transparent` + `#52525B`, hover `#F4F4F5`). Destructivo reservado a confirmación (`#DC2626`). |
| **Densidad de tablas** | 1 fila principal de altura mínima `48 px` + paginación compacta al pie + acciones `⋯` alineadas al extremo derecho sin colisiones. |
| **Visualización de datos** | Curva Bézier suave (`stroke: #09090B`, `2 px`), relleno gradiente vertical `#1AFF6E` al `14 % → 0 %`, rejilla horizontal punteada ultra-suave (`#F0F0F2`), eje Y derecho/izquierdo en `Geist 11 px tabular-nums`, tooltip flotante `#09090B` con punto `#1AFF6E` de `4 px`. |

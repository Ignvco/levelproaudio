# Mapa del Frontend de LevelPro

Este documento es el **plano** de tu frontend. Su objetivo es que, cuando quieras
modificar algo, sepas con exactitud **a qué llamar y dónde está**. No cambia código:
solo lo nombra y lo ubica.

Está organizado en cinco partes:

1. **Tokens globales** — colores, fuentes, radios, estilos (la base de todo el aspecto)
2. **Componentes globales reutilizables** — botones, cards, forms, badges
3. **Estructura del sitio público** — layout, secciones de cada página
4. **El panel de administración** — su layout y su biblioteca de componentes propia
5. **Cómo usar este mapa** — la guía práctica de "quiero cambiar X, toco Y"

Una idea clave que atraviesa todo: tu frontend tiene **dos mundos visuales
separados**:

- **El sitio público** → tema **oscuro** (fondo negro, verde neón). Tokens `--bg`, `--accent`, etc.
- **El panel admin** → tema **claro** (fondo gris claro, tarjetas blancas). Tokens `--admin-*`.

Los dos viven en el mismo archivo de estilos pero no se pisan.

---

## 1. Tokens globales — la base del aspecto

Todos los tokens viven en un solo archivo: **`src/index.css`**. Si querés cambiar
el aspecto general de todo el sitio (un color, una fuente), este es el lugar.

### 1.1 Colores del sitio público
Definidos en `src/index.css`, dentro de `:root` (a partir de la línea 9).

| Token | Valor | Qué es |
|-------|-------|--------|
| `--bg` | `#0a0a0a` | Fondo principal (casi negro) |
| `--bg-2` | `#0d0d0d` | Fondo secundario |
| `--surface` | `#101010` | Superficie de tarjetas |
| `--surface-2` | `#141414` | Superficie un nivel más clara |
| `--surface-3` | `#1a1a1a` | Superficie más clara aún |
| `--border` | `rgba(255,255,255,0.06)` | Bordes sutiles |
| `--border-hover` | `rgba(255,255,255,0.12)` | Borde al pasar el mouse |
| `--accent` | `#1aff6e` | **El verde neón de la marca** |
| `--accent-hover` | `#00e653` | Verde al pasar el mouse |
| `--accent-dim` | `rgba(26,255,110,0.1)` | Verde tenue (fondos) |
| `--accent-glow` | `rgba(26,255,110,0.22)` | Verde para resplandores |
| `--text` | `#fafafa` | Texto principal (casi blanco) |
| `--text-2` | `#a0a0a0` | Texto secundario (gris) |
| `--text-3` | `#8a8a8a` | Texto terciario (gris más apagado) |
| `--danger` | `#ff5757` | Rojo de error |
| `--warning` | `#ffb340` | Naranja de aviso |
| `--success` | `#1aff6e` | Verde de éxito |

> **Para cambiar el color de marca de todo el sitio:** cambiás `--accent` (y sus
> variantes) en `src/index.css` y se propaga a todos lados.

### 1.2 Fuentes (tipografía)
Definidas en `src/index.css`: el `@import` de Google Fonts está en la **línea 6**,
y las variables en `:root` (línea 36+).

| Token | Fuente | Uso |
|-------|--------|-----|
| `--font-sans` | `Geist` | Texto general del cuerpo |
| `--font-display` | `Geist` | Títulos y encabezados |
| `--font-hero` | `Poppins` | El hero de la portada |
| `--font-mono` | `Geist Mono` | Números, código, datos técnicos |
| `--font-serif` | `Geist` | (reservada, hoy = Geist) |

> **Para cambiar una fuente:** actualizás el `@import` de la línea 6 (para traer la
> nueva fuente de Google) y luego la variable correspondiente. Todo el sitio la toma.

### 1.3 Espaciado y contenedores
En `src/index.css`, `:root` (línea 44+).

| Token | Valor | Qué es |
|-------|-------|--------|
| `--container` | `1280px` | Ancho máximo del contenido |
| `--container-max` | `1440px` | Ancho máximo amplio |
| `--container-pad` | `clamp(18px, 4vw, 64px)` | Padding lateral responsive |
| `--section-space` | `clamp(64px, 8vw, 120px)` | Espacio vertical entre secciones |
| `--content-gap` | `clamp(32px, 4vw, 48px)` | Separación de bloques |
| `--card-gap` | `clamp(16px, 2vw, 24px)` | Separación entre tarjetas |

### 1.4 Radios de borde (esquinas redondeadas)
En `src/index.css`, `:root` (línea 53+).

| Token | Valor |
|-------|-------|
| `--r-sm` | `6px` |
| `--r-md` | `12px` |
| `--r-lg` | `18px` |
| `--r-xl` | `24px` |
| `--r-2xl` | `32px` |
| `--r-full` | `9999px` (círculos/píldoras) |

### 1.5 Animación (transiciones)
En `src/index.css`, `:root` (línea 61+).

| Token | Valor | Qué es |
|-------|-------|--------|
| `--dur` | `200ms` | Duración estándar |
| `--dur-slow` | `400ms` | Duración lenta |
| `--ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | Curva de suavizado principal |
| `--ease-out` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Curva de salida |

---

## 2. Componentes globales reutilizables

### 2.1 Clases utilitarias del sitio público
Definidas como clases CSS en **`src/index.css`**. Se usan poniendo `className="..."`
en cualquier elemento. Son la forma más rápida de mantener consistencia.

**Botones** (línea 185+):

| Clase | Qué es |
|-------|--------|
| `.btn` | Base de todos los botones (estructura) |
| `.btn-accent` | Botón verde con efecto de brillo (el principal) |
| `.btn-accent-solid` | Botón verde sólido |
| `.btn-ghost` | Botón transparente con borde |
| `.btn-dark` | Botón oscuro |

**Contenedores y layout** (línea 128+):

| Clase | Qué es |
|-------|--------|
| `.container` / `.lp-container` | Contenedor centrado con ancho máximo |
| `.lp-sections` | Espaciado vertical entre secciones |
| `.section-header` | Encabezado de una sección |
| `.section-header__desc` | Descripción bajo el título de sección |

**Inputs** (línea 164+):

| Clase | Qué es |
|-------|--------|
| `.input` | Campo de formulario estándar |
| `.input.error` | Campo con estado de error (borde rojo) |

**Tarjetas y superficies** (línea 332+):

| Clase | Qué es |
|-------|--------|
| `.card` | Tarjeta estándar |
| `.card-glow` | Tarjeta con resplandor al pasar el mouse |
| `.glass` | Efecto vidrio esmerilado |
| `.glass-strong` | Vidrio esmerilado más marcado |

**Fondos con gradiente** (línea 365+):

| Clase | Qué es |
|-------|--------|
| `.hero-gradient` | Gradiente del hero |
| `.section-gradient-green` | Gradiente verde de sección |
| `.section-gradient-dark` | Gradiente oscuro de sección |

**Animaciones** (línea 319+): `.animate-fade-up`, `.animate-fade-in`,
`.animate-scale-in`, `.animate-float`. Con modificadores de retraso `.delay-100`
hasta `.delay-600`.

**Skeleton de carga** (línea 263): `.skeleton` — el efecto de carga gris pulsante.

### 2.2 Componentes React reutilizables (sitio público)
Viven en `src/components/`.

**De producto** (`src/components/product/`):

| Componente | Archivo | Qué es |
|-----------|---------|--------|
| `ProductCard` | `ProductCard.jsx` | Tarjeta de producto (vista grilla) |
| `ProductRow` | `ProductRow.jsx` | Fila de producto (vista lista) |
| `FavoriteButton` | `FavoriteButton.jsx` | Botón de corazón/favorito |
| `ShopFilters` | `ShopFilters.jsx` | **El sidebar de filtros** de la tienda (y drawer en mobile) |

**De academia** (`src/components/academy/`):

| Componente | Archivo | Qué es |
|-----------|---------|--------|
| `CourseCard` | `CourseCard.jsx` | Tarjeta de curso |

**De servicios** (`src/components/services/`):

| Componente | Archivo | Qué es |
|-----------|---------|--------|
| `ServiceCard` | `ServiceCard.jsx` | Tarjeta de servicio |
| `ServiceProcess` | `ServiceProcess.jsx` | El bloque de "cómo funciona" (los pasos del proceso) |

**De autenticación** (`src/components/auth/`):

| Componente | Archivo | Qué es |
|-----------|---------|--------|
| `AuthShell` | `AuthShell.jsx` | La plantilla visual de login/registro |
| `GoogleSignInButton` | `GoogleSignInButton.jsx` | Botón de "iniciar con Google" |

**Legales** (`src/components/legal/`):

| Componente | Archivo | Qué es |
|-----------|---------|--------|
| `LegalShell` | `LegalShell.jsx` | La plantilla de las páginas legales |
| `AcceptCheckbox` | `AcceptCheckbox.jsx` | Checkbox de "acepto términos" |

**Decorativos de audio** (`src/components/ui/StudioUI.jsx`) — un archivo con varios
componentes con estética de equipo de audio:

| Componente | Qué es |
|-----------|--------|
| `LED` | Lucecita LED (verde/roja) con etiqueta |
| `VUMeter` | Medidor de volumen tipo consola |
| `DigitalReadout` | Display digital de números |
| `Knob` | Perilla giratoria |
| `Fader` | Deslizador vertical tipo mezcladora |
| `AnimatedWaveform` | Forma de onda animada |

**Otros de UI** (`src/components/ui/`):

| Componente | Archivo | Qué es |
|-----------|---------|--------|
| `ToastNotification` | `ToastNotification.jsx` | Notificaciones emergentes (`showToast`) |
| `CustomCursor` | `CustomCursor.jsx` | El cursor personalizado |
| `PageTransition` | `PageTransition.jsx` | La transición entre páginas |
| `RichText` | `RichText.jsx` | Renderiza texto con formato |

**Globales sueltos** (`src/components/`):

| Componente | Archivo | Qué es |
|-----------|---------|--------|
| `CurrencySelector` | `CurrencySelector.jsx` | Selector de moneda (en el footer) |
| `Seo` / `SeoGlobal` | `Seo.jsx` / `SeoGlobal.jsx` | Metadatos SEO por página / globales |
| `JsonLd` | `JsonLd.jsx` | Datos estructurados para buscadores |
| `Analytics` | `Analytics.jsx` | Seguimiento de analítica |
| `ErrorBoundary` | `ErrorBoundary.jsx` | Captura errores para que no se caiga la app |

---

## 3. Estructura del sitio público

### 3.1 El layout principal
**`src/layouts/MainLayout.jsx`** (796 líneas) — envuelve todas las páginas públicas.
Contiene tres sub-componentes internos (están en el mismo archivo):

| Sub-componente | Qué es | Dónde |
|----------------|--------|-------|
| `Navbar` | La barra superior flotante (el "pill" oscuro) — solo desktop | dentro de `MainLayout.jsx` |
| `MobileDock` | La navegación inferior en celular | dentro de `MainLayout.jsx` (línea ~496) |
| `Footer` | El pie de página (links, selector de moneda, copyright) | dentro de `MainLayout.jsx` (línea ~615) |

> **Para editar la navegación:** el menú de escritorio está en `Navbar`, el de
> celular en `MobileDock`. Son dos lugares distintos dentro del mismo archivo.

También existe **`src/layouts/DashboardLayout.jsx`** (164 líneas) — el layout de la
cuenta del cliente (las páginas "Mi..."), con su propia navegación lateral.

### 3.2 Las páginas y su estructura
Viven en `src/pages/`. Las principales:

**`Home.jsx`** (1253 líneas — la más grande). Sus secciones, en orden:
- **Hero** — carrusel de imágenes de fondo con texto encima (línea ~131). Las
  imágenes salen de la configuración del sitio (`hero_image_url`, etc.)
- **Sección de confianza** — garantía, envíos, pagos, soporte (línea ~638)
- **"Conoce LevelPro"** — bloque de marca (línea ~760)
- **Testimonios** — reseñas de clientes

**`Shop.jsx`** (421 líneas) — la tienda:
- Barra de búsqueda + botones de vista (grilla/lista)
- **Sidebar de filtros** → es el componente `ShopFilters` (categorías, precio).
  En desktop es una columna lateral; en mobile es un drawer que se despliega
- Grilla o lista de productos (usa `ProductCard` o `ProductRow`)
- Estado "sin resultados" (con el CTA de bajo pedido)

**`Services.jsx`** (167 líneas) — servicios:
- Grid de servicios (usa `ServiceCard`), con el componente `ServiceProcess`
  para explicar el proceso. **No tiene sidebar** — es un grid simple.

**`Academy.jsx`** (213 líneas) — la academia:
- Grid de cursos (usa `CourseCard`). **No tiene sidebar** — grid de tarjetas
  `repeat(auto-fill, minmax(320px, 1fr))`.

**`ProductDetail.jsx`** — la ficha de producto: galería de imágenes, precio (con
moneda activa + ARS referencial), botón de compra o "bajo pedido" si está agotado,
productos relacionados.

**`Cart.jsx`** / **`Checkout.jsx`** — carrito y checkout.

**`SpecialOrder.jsx`** — el formulario de "solicitar equipo bajo pedido".

**`Rewards.jsx`** — sorteos y campañas.

**Otras**: `CourseDetail`, `ServiceDetail`, `OrderConfirmation`, `NotFound`, y las de
auth (`Login`, `Register`, `ForgotPassword`, `ResetPassword`).

**Sub-carpetas de páginas:**
- `pages/dashboard/` — la cuenta del cliente: `MyBookings`, `MyCourses`, `MyEntries`,
  `MyFavorites`, `MyLoyalty`, `MyServices`, `OrderDetail`, `Orders`, `Profile`
- `pages/legal/` — `Terminos`, `Privacidad`, `PoliticaGarantia`, `PoliticaEnvios`, `BasesSorteo`
- `pages/payment/` — `PaymentSuccess`, `PaymentFailure`, `TransferInstructions`

---

## 4. El panel de administración

El admin es un **mundo visual separado** con tema claro y su propia biblioteca de
componentes. **No comparte estilos con el sitio público** (salvo las fuentes).

### 4.1 Tokens del admin
Definidos en **`src/index.css`** a partir de la **línea 782** (separados de los
públicos). Todos empiezan con `--admin-`:

| Token | Valor | Qué es |
|-------|-------|--------|
| `--admin-primary` | `#1AFF6E` | Verde de acción del admin |
| `--admin-primary-hover` | `#00E653` | Verde al pasar el mouse |
| `--admin-primary-text` | `#0F9940` | Verde para texto (más oscuro, legible) |
| `--admin-background` | `#F4F5F7` | Fondo gris claro del panel |
| `--admin-surface` | `#FFFFFF` | Tarjetas blancas |
| `--admin-surface-secondary` | `#F7F8FA` | Superficie secundaria |
| `--admin-border` | `#ECEEF2` | Bordes claros |
| `--admin-text` | `#14161A` | Texto principal (casi negro) |
| `--admin-text-muted` | `#6B7280` | Texto secundario (gris) |
| `--admin-success` | `#0F9940` | Verde de éxito |
| `--admin-warning` | `#D97706` | Naranja de aviso |
| `--admin-danger` | `#EF4444` | Rojo de error |
| `--admin-radius-sm/md/lg` | `12/16/20px` | Radios de esquina |
| `--admin-shadow-sm/md` | sombras | Sombras suaves |

### 4.2 El layout del admin
**`src/layouts/AdminLayout.jsx`** (426 líneas) — el menú lateral + la barra superior.
Acá se define **el menú de navegación del panel** (las secciones: Inicio, Ventas,
Catálogo, Academia, etc.) y los títulos de cada página.

### 4.3 La biblioteca de componentes del admin
Dos partes: clases CSS y componentes React.

**Clases CSS** en **`src/styles/admin-ui.css`** — todas empiezan con `.au-` y están
"scopeadas" a `.admin-root` (solo aplican dentro del panel):

| Clase | Qué es |
|-------|--------|
| `.au-page` | Contenedor de página admin |
| `.au-card` | Tarjeta blanca del admin |
| `.au-card--interactive` | Tarjeta que reacciona al mouse |
| `.au-header` | Encabezado de página |
| `.au-eyebrow` | El texto chico en mayúsculas sobre el título |
| `.au-title` | Título de página |
| `.au-desc` | Descripción bajo el título |
| `.au-btn` | Botón base |
| `.au-btn--primary` | Botón verde principal |
| `.au-btn--secondary` | Botón blanco secundario |
| `.au-btn--danger` | Botón de acción peligrosa (rojo) |
| `.au-btn--sm` | Botón chico |
| `.au-iconbtn` | Botón de solo ícono |

**Componentes React** en `src/components/admin/ui/`. Se importan todos desde un
único punto: `src/components/admin/ui/index.js`. Esto significa que en cualquier
página admin escribís `import { DataTable, StatusBadge, ... } from "components/admin/ui"`.

| Componente | Archivo | Qué es |
|-----------|---------|--------|
| `AdminPageHeader` | `AdminPageHeader.jsx` | Encabezado de página (título + acciones) |
| `StatCard` / `MetricBadge` | `StatCard.jsx` | Tarjeta de métrica / insignia de dato |
| `StatusBadge` | `Badges.jsx` | Etiqueta de estado (Activo/Pendiente/etc.) |
| `ChartCard` / `SectionCard` / `ChartLegend` | `Panels.jsx` | Contenedores de gráficos y secciones |
| `RadialStatCard` / `BRAND_CHART_COLORS` | `RadialStatCard.jsx` | Tarjeta con gráfico radial / paleta de colores de gráficos |
| `DataTable` | `DataTable.jsx` | **Tabla de datos** (la que usan casi todas las páginas admin) |
| `EmptyState` / `ErrorState` | `EmptyState.jsx` | Estados vacío y de error |
| `SkeletonCard` / `SkeletonTable` | `Skeletons.jsx` | Placeholders de carga |
| `SearchInput` / `FilterSelect` | `Inputs.jsx` | Búsqueda y filtros |
| `AdminTabs` | `AdminTabs.jsx` | Pestañas |
| `Pagination` | `Pagination.jsx` | Paginación |
| `ConfirmationModal` | `ConfirmationModal.jsx` | Modal de "¿estás seguro?" |
| `FormModal` / `FormField` / `formInputStyle` | `FormModal.jsx` | Modal de formulario + campos |
| `PrimaryButton` / `SecondaryButton` / `DangerButton` / `IconButton` | `Buttons.jsx` | Botones del admin |

**Otros del admin** (`src/components/admin/`):
- `AdminSearch.jsx` — el buscador global del panel
- `BulkImportPanel.jsx` — el panel de importación masiva

### 4.4 Las páginas del admin
En `src/pages/admin/` — hay 27. Las principales por dominio:
- **Ventas**: `AdminOrders`, `AdminSpecialOrders`, `AdminPayments`, `AdminPaymentMethods`, `AdminBilling`
- **Catálogo**: `AdminProducts`, `AdminCategories`, `AdminBrands`, `AdminInventory`, `AdminProductImport`
- **Academia**: `AdminAcademy`, `AdminModules`, `AdminLessons`, `AdminEnrollments`, `AdminCertifications`
- **Servicios**: `AdminServices`
- **Fidelización**: `AdminLoyalty`, `AdminRewards` (+ `AdminRewardsCampaigns`, `AdminRewardsCampaignDetail`, `AdminRewardsEntries`, `AdminRewardsWinners`)
- **Negocio**: `AdminFinance`, `AdminUsers`, `AdminSettings` (Personalización), `AdminDashboard`
- **Acceso**: `AdminLogin`

---

## 5. Cómo usar este mapa

La lógica general: **cambio global → tocás un token o clase en `index.css`. Cambio
puntual → tocás el componente o página específica.**

Ejemplos concretos de "quiero cambiar X → toco Y":

| Quiero cambiar... | Toco... |
|-------------------|---------|
| El verde de la marca en todo el sitio | `--accent` (y variantes) en `src/index.css` |
| La fuente de los títulos | `--font-display` + el `@import` (línea 6) en `src/index.css` |
| Cómo se ven **todos** los botones verdes públicos | La clase `.btn-accent` en `src/index.css` |
| El aspecto de la tarjeta de producto | `src/components/product/ProductCard.jsx` |
| Los filtros de la tienda | `src/components/product/ShopFilters.jsx` |
| El hero de la portada | La sección hero en `src/pages/Home.jsx` (línea ~131) |
| El menú de navegación (desktop) | `Navbar` dentro de `src/layouts/MainLayout.jsx` |
| El menú de navegación (mobile) | `MobileDock` dentro de `src/layouts/MainLayout.jsx` |
| El footer | `Footer` dentro de `src/layouts/MainLayout.jsx` |
| Los colores del **panel admin** | Los tokens `--admin-*` en `src/index.css` (línea 782+) |
| Cómo se ven **todos** los botones del admin | `.au-btn` en `src/styles/admin-ui.css`, o `Buttons.jsx` |
| Las tablas del admin | `src/components/admin/ui/DataTable.jsx` |
| El menú lateral del admin | `src/layouts/AdminLayout.jsx` |

### Nota importante sobre inconsistencia (para tener en cuenta al refactorizar)

Hay una diferencia de enfoque entre las dos partes:

- **El sitio público** mezcla dos formas de dar estilo: clases CSS (`.btn`, `.card`)
  **y** estilos inline (`style={{...}}` dentro de cada componente). Por ejemplo,
  `ProductCard.jsx` usa mayormente estilos inline. Esto significa que para cambiar
  una tarjeta de producto tenés que editar el componente, no una clase central.
- **El panel admin** es más consistente: casi todo pasa por la biblioteca `au-*`
  y los componentes de `admin/ui/`.

Esta es justamente la clase de cosa que un refactor podría ordenar: **extraer los
estilos inline del sitio público a componentes reutilizables** (un `<Button>`, un
`<Card>`, un `<Input>` públicos), como ya existe en el admin. Cuando decidamos
refactorizar, este es el mayor candidato.

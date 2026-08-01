# LevelPro Audio — PRD

## Problem statement
SaaS Chile/Argentina: e-commerce (Tienda), Academia y Servicios de audio. UI dark premium, acento verde neón (#1aff6e), fuente Geist. React 19 + Vite / Django 5 + DRF. Auth cookies HTTPOnly (JWT). Pagos MercadoPago (CL) + PayPal. Deploy GCP Cloud Build → Cloud Run + Secret Manager. Idioma: Español.

## Settings / infra
- Local: `DJANGO_SETTINGS_MODULE=config.settings.local` (SQLite). Backend `uvicorn server:app`.
- **El .env que la app REALMENTE lee es `/app/.env` (raíz del repo)**, NO `/app/backend/.env` (base.py: `read_env(BASE_DIR.parent/'.env')`). Editar `/app/.env`.
- Preview SIN credenciales de pago → pagos solo validables en producción.

## Implementado (2026-07-31)
- Navbar/Home mobile; Servicios (fixes + pago precio fijo + rediseño premium detalle).
- Rewards STICKERS (sticker_price, StickerPurchase, buy endpoint, entries al pagar, my-entries codes+image, modal compra, MyEntries tickets). `prize_product` FK catálogo + selector admin + sección "El premio" con ProductCard (migr 0003).
- Seguridad: quitado /payments/diagnostics/ + DIAGNOSTICS_KEY.
- PAGOS: PayPal ahora se captura en PaymentSuccess.jsx (antes no). Validar en prod.
- Login/Register premium (AuthShell split-screen).
- Admin premium: AdminLayout (nav activo verde) + cabeceras bold Geist (reemplazo font-serif→font-display, weight 300→800 en pages/admin/*).
- SEO: components/Seo.jsx (React 19), agregado a Home/Shop/Services/Rewards/Academy/Product/ServiceDetail. index.html lang=es + favicon + OG. robots.txt + sitemap.xml (public/). OG banner generado.
- **Emails (Resend)**: `apps/emails.py` (plantilla marca) — confirmación de compra (webhook MP + captura PayPal), tickets del sorteo (al generar entries), password reset (fn lista, wiring en paso e). Settings RESEND_API_KEY/RESEND_FROM_EMAIL. Fallback a consola si no hay key. cloudbuild.yaml: binding secret RESEND_API_KEY + env RESEND_FROM_EMAIL.

## EN CURSO / bloqueos
- (ninguno)

## Recuperar contraseña (2026-07-31) ✅
- Backend `apps/users/`: `POST /auth/password/reset/` (respuesta genérica anti-enumeración, genera uid b64 + token nativo Django, envía email Resend) y `POST /auth/password/reset/confirm/` (uid+token+password/password2, valida con validators). `PASSWORD_RESET_TIMEOUT=3600` (1h). Token de un solo uso (se invalida al cambiar la pass).
- Frontend: `/forgot-password` (ForgotPassword.jsx) y `/reset-password?uid=..&token=..` (ResetPassword.jsx), diseño AuthShell premium. Ruteo en App.jsx.
- Verificado por curl end-to-end (todos los casos) + screenshots de ambas pantallas.

## Backlog (orden: a✔ admin → b✔ legales → c✔ SEO → d✔ Resend → e✔ recuperar pass)
- (backlog legal/auth completo)

## Rediseño Admin — estilo "DealDeck" (2026-08-01) ✅
Basado en mockup del usuario (admin.png): sidebar oscuro flotante + área clara + cards blancas redondeadas + acento verde LevelPro.
- **Tema claro scopeado** en `.admin-root` (index.css): sobreescribe variables globales (--bg/--surface/--text/--border...) a valores claros SOLO dentro del admin. El sitio público sigue OSCURO (scoping no filtra).
- **Overrides de componentes** (`.admin-root .card/.input/.btn-accent/table/...`): todas las páginas heredadas adoptan cards blancas redondeadas (radio 20px, sombra suave `0 10px 30px rgba(20,30,24,.07)`), inputs claros con foco verde, botones primarios pill verde, tablas con separadores suaves — sin editar página por página.
- **`AdminLayout.jsx` reescrito**: sidebar oscuro flotante COLAPSABLE (a íconos) + drawer móvil, nav con TODAS las rutas + grupos desplegables (Productos/Academia/Rewards), topbar (título por ruta + fecha + search/bell/user chip), footer con user + Ver sitio + Cerrar sesión.
- **`AdminDashboard.jsx` reescrito**: card destacada verde (Ingresos), KPIs (Pedidos/Usuarios/Productos con badges REALES, sin % inventados), gráfico de barras de ventas reales, card Resumen, cards de acción (pendientes/stock/servicios). Datos reales de getAdminDashboard.
- Verificado: login, dashboard con datos reales, colapsar sidebar, navegación completa (testing_agent iteration_6, 7 rutas OK antes de rate-limit de Vite) + screenshots de Dashboard/Órdenes/Productos/Personalización/Finanzas. Funcionalidad/datos/rutas intactos.
- Nota: el rediseño se logra por scoping (no se reescribió cada página); las páginas con estilos inline usan variables CSS y quedaron claras automáticamente.

## Admin — Recharts + Buscador global + Modales (2026-08-01) ✅
- **Recharts**: `AdminDashboard.jsx` usa BarChart interactivo (recharts, ya instalado) con ejes, barras verdes redondeadas y tooltip oscuro redondeado (`ChartTooltip`). Datos reales de sales_chart.
- **Buscador global**: `components/admin/AdminSearch.jsx` (command palette) — busca productos/pedidos/usuarios vía getAdminProducts/Orders/Users({search}). Abre desde botón search del topbar o Cmd/Ctrl+K. Navega al resultado. Verificado con datos reales.
- **Modales**: heredan el tema claro (usan var(--surface)/.input/.btn-accent dentro de .admin-root). Modal de producto verificado (panel blanco redondeado, tabs verde, inputs claros, botón "Crear producto" pill verde). Curso/campaña usan mismo patrón.

## Admin — Consistencia de pestañas (2026-08-01) ✅
- **Fix duplicación de títulos**: el topbar de `AdminLayout` ya NO muestra título/subtítulo (solo botón colapsar + acciones search/bell/user). Cada página usa su propio H1 (como el mockup). `AdminDashboard` recibió su header propio (Dashboard + fecha).
- Todas las pestañas (Vista Ejecutiva, Analytics, Órdenes, Pagos, Servicios, Usuarios, Finanzas, etc.) quedan coherentes con el tema claro + verde vía scoping. Verificado Dashboard + Órdenes.
- Pendiente menor: el gráfico "Ventas por mes" de Analytics muestra un bloque verde grande cuando hay 1 solo mes de datos (artefacto del componente viejo); se puede migrar a Recharts en una próxima iteración.

## Admin — Unificación de cards/KPIs en páginas internas (2026-08-01) ✅
- **CSS global** (`index.css`, bloque final `.admin-root`): un selector por atributo (`[style*="var(--surface)"][style*="var(--border)"][style*="var(--r-xl)"]` y `--r-2xl`) aplica a TODAS las páginas internas —de una sola vez— bordes redondeados 20px, sombra suave `var(--card-shadow)` y realce de sombra en hover. Resuelve la queja de "cards/botones no se ven como el Dashboard" sin editar página por página.
- **KPIs con ícono en tile verde** (`.a-kpi-tile` + `.a-kpi-hover`), reemplazando emojis por íconos lucide, en: ExecutiveDashboard, AdminAnalytics, AdminFinance, AdminInventory, AdminRewards, AdminLoyalty. Los emojis decorativos legítimos (medallas de nivel 🥉🥈🥇💎, íconos de categoría configurables) se conservan.
- **Bug corregido**: texto blanco invisible (`color:"#fff"` heredado del tema oscuro) en AdminRewards y AdminRewardsCampaignDetail → `var(--text)`.
- Verificado por screenshots (elección del usuario): Executive, Analytics, Payments, Users, Orders, Services, Finance, Inventory, Rewards, Loyalty — todos consistentes.

## Admin — Afinado cromático y tipográfico (2026-08-01) ✅
1. **Verde de texto accesible**: nueva var `--accent-text: #0F9940` en `.admin-root`. Todo el TEXTO verde (`color:"var(--accent)"` inline → `--accent-text` vía sed en todo `pages/admin`) pasó al verde oscuro accesible; el neón `#1AFF6E` queda SOLO para fondos (botones, tiles KPI, barras, nav activo).
2. **Paleta de estados unificada**: `--success:#0F9940`, `--warning:#D97706`, `--danger:#EF4444` en `.admin-root`. Reemplazo global de los hexes dispersos (`#4ade80→#0F9940`, `#facc15→#D97706`, `#f87171→#EF4444`).
3. **Paleta de gráficos de marca** (AdminAnalytics `COLORS`): greens/teals + neutros cálidos `["#1AFF6E","#0F9940","#14B8A6","#5EEAD4","#A7F3D0","#CA8A04","#78716C","#D6D3D1"]` (se fueron los azul/violeta/naranja "de librería").
4. **Tipografía**: eliminado el eyebrow duplicado "VISTA EJECUTIVA" (el H1 ya lo dice); micro-labels uppercase se mantienen solo en KPIs/headers de tabla.
5. **Emojis → lucide**: medallas de nivel en AdminLoyalty (🥉🥈🥇💎 → Medal/Award/Gem monocromos con color de nivel de mejor contraste). Íconos de categoría configurables por el usuario se conservan (son data).
- Verificado por screenshots: Executive, Analytics, Finance, Loyalty. Sin regresiones.

## Admin — Biblioteca de componentes `au-*` + Dashboard piloto (2026-08-01) ✅
Rediseño SaaS premium basado en referencia "Job Portal Admin Dashboard" adaptada a la identidad LevelPro (negro + verde neón estratégico).
- **Tokens** `--admin-*` en `.admin-root` (index.css): primary/soft/text, background/surface/border, text/muted, success/warning/danger, radius sm/md/lg, shadow sm/md.
- **Hoja de estilos** `frontend/src/styles/admin-ui.css` (clases `.au-*`, importada en main.jsx). Sin estilos hardcodeados repetidos por página.
- **Biblioteca** `frontend/src/components/admin/ui/` (barrel `index.js`):
  - `AdminPageHeader` (eyebrow/title/description/actions/breadcrumbs)
  - `StatCard` (variantes default/primary/dark/compact/outlined + Icon/label/value/sub/delta/badge/action/to/loading) + `MetricBadge`
  - `ChartCard` (title/desc/legend/period/action + loading/empty) + `SectionCard` + `ChartLegend`
  - `RadialStatCard` (donut recharts + leyenda por categoría, paleta de marca `BRAND_CHART_COLORS`)
  - `DataTable` (búsqueda, filtros, selector estado, page-size, paginación, orden por columnas, checkbox, menú 3-puntos por fila, badges, responsive scroll, skeleton/empty/error)
  - `StatusBadge`, `EmptyState`/`ErrorState`, `SkeletonCard`/`SkeletonTable`, `SearchInput`, `FilterSelect`, `AdminTabs`, `Pagination`, `ConfirmationModal`, `PrimaryButton`/`SecondaryButton`/`DangerButton`/`IconButton`.
- **AdminDashboard.jsx reescrito** como piloto (4 filas: KPIs → gráfico+radial → tabla órdenes+resumen → acciones). Datos reales de `getAdminDashboard`, rutas/acciones intactas.
- Verificado por screenshots (desktop). Sin errores de compilación. **Pendiente de aprobación del usuario** antes de migrar las demás pantallas.

## Admin — Corrección del lenguaje de cards al estilo del front (2026-08-01) ✅
El usuario aclaró que la referencia NO era el "Job Portal", sino sus propias cards del front (ProductCard/CourseCard/ServiceCard) SIN imagen de fondo.
- `StatCard` reescrito con el lenguaje LevelPro: card oscura #121212, radio 24px, pill de etiqueta, ícono en círculo, valor Geist bold blanco, sub en pill gris translúcido, delta en pill; variante `primary` con glow verde en esquina (como CourseCard de Academia); variantes `light` y `compact` disponibles. Estilos en `admin-ui.css` (`.au-lp*`).
- Dashboard: fila de KPIs migrada al nuevo StatCard. Paneles de gráfico/tabla se mantienen claros para densidad/legibilidad de datos (mismo contraste dark-card/light-bg que la tienda).
- Verificado por screenshot. Pendiente confirmar dirección antes de migrar el resto.

## Admin — Migración batch 1 (páginas KPI) al StatCard del front (2026-08-01) ✅
Patrón DRY: cada componente KPI local delega en el `StatCard` de la biblioteca (mismo dato/lógica, look nuevo) + headers a `AdminPageHeader`.
- Migradas y verificadas por screenshot: **Vista Ejecutiva, Analytics, Finanzas, Inventario, Rewards, Fidelización**. Todas con las cards oscuras estilo front (pill de etiqueta, ícono en círculo, valor bold, sub en pill, verde estratégico) + headers `AdminPageHeader` (eyebrow/title/description/actions).
- Paneles de gráfico/tabla se mantienen claros (decisión del usuario: mejor para leer datos).
- Sin errores JS reales (los 429/blancos en screenshots fueron rate-limit de Cloudflare al navegador headless).
- **Pendiente batch 2 (páginas con tablas)**: Productos, Categorías, Marcas, Facturación, Órdenes, Pagos, Servicios, Usuarios → convertir tablas al `DataTable` + headers `AdminPageHeader`. Requiere cablear columnas/acciones a los handlers CRUD existentes con cuidado (sin romper funcionalidad).

## Admin — Cards estilo front en secciones específicas (2026-08-01) ✅
Nuevas clases en `admin-ui.css`: `.au-pcard` (estilo ProductCard) y `.au-acard` (estilo CourseCard/Academia con franja verde), ambas oscuras, redondeadas, con pills y sin imagen.
- **Pagos**: KPIs de estado → `StatCard variant="compact"` con indicador "activo" al filtrar.
- **Marcas**: grilla de cards estilo producto (logo/Tag, título, website, pills Editar/Eliminar).
- **Servicios** (tab Servicios) y **Cursos** (Academia): cards estilo academia (franja verde, tag de categoría/nivel, estado, precio en pill, acciones). Se quitó la imagen del curso.
- **Finanzas → Configuración**: categorías como cards estilo academia (franja tintada con el color de la categoría, tag config, color pill, acciones).
- **Densidad compacta** aplicada en Inventario (6 KPIs) y Pagos.
- Verificado por screenshots. Sin errores de compilación.
- **Sigue pendiente batch 2**: Órdenes y Pagos (y demás) → tablas al `DataTable`.



Decisiones del usuario: prerendering en build (Fase 2, pendiente), mantener URLs actuales (/shop/:slug, ?category=), dominio dual (canónico primario: https://levelproaudio.com), arrancar por Fase 1.

**Backend:**
- `apps/seo/views.py` + `urls.py`: sitemap.xml dinámico desde BD (estáticas + categorías activas + productos activos + servicios activos + cursos publicados, con lastmod real). Montado en `/api/v1/seo/sitemap.xml`.
- `config/settings/base.py`: `SITE_URL` (env, default https://levelproaudio.com).

**Frontend (sin cambios visuales):**
- `nginx.conf`: `location = /sitemap.xml` → proxy al backend.
- `public/robots.txt`: reescrito (disallow admin/dashboard/checkout/login/register/etc + Sitemap directive).
- `components/Seo.jsx`: reescrito → canonical absoluto, robots meta (index/noindex), og:url absoluto, twitter card. Prop `noindex`.
- `components/JsonLd.jsx`, `components/SeoGlobal.jsx` (Organization + WebSite + verificación GSC), `components/Analytics.jsx` (GA4 vía env), `utils/seo.js`, `utils/analytics.js` (helper track()).
- `App.jsx`: monta `<SeoGlobal/>` + `<Analytics/>`.
- `ProductDetail.jsx`: JSON-LD Product + BreadcrumbList.
- `Home.jsx`: title/description objetivo Chile. Login/Register: noindex.

**Env vars nuevas:** frontend `.env` → VITE_SITE_URL, VITE_GA4_ID, VITE_GOOGLE_SITE_VERIFICATION. Backend `/app/.env` + cloudbuild → SITE_URL.

Verificado (curl + playwright): sitemap XML válido con 28+ URLs, canonical/robots/og/JSON-LD (Organization,WebSite,Product,BreadcrumbList) OK, login noindex, diseño intacto.

**PENDIENTE SEO (fases siguientes):** Fase 2 prerendering en build (crítico para preview social), Fase 5 blog + Article schema, Fase 6 eventos GA4 (helper track() ya listo) + SEO editable en admin. Punto 31 (contadores home incoherentes) y mejoras 404 (búsqueda/destacados): pendientes.

## SEO — FASE 3 y 4: Datos estructurados (2026-07-31) ✅
- `ProductDetail.jsx`: JSON-LD Product + BreadcrumbList.
- `ServiceDetail.jsx`: JSON-LD Service + BreadcrumbList.
- `CourseDetail.jsx`: agregado `<Seo>` (no tenía) + JSON-LD Course + BreadcrumbList.
- `Shop.jsx`: metadata dinámica por categoría (title "{Cat} en Chile", canonical /shop?category=slug indexable); búsqueda interna (?search=) → noindex; filtros (brand/price) → canonical consolidado a /shop.
- `NotFound.jsx`: `<Seo noindex>`. Login/Register: noindex.
- Verificado (playwright DOM): todas las páginas con title/canonical/robots/JSON-LD correctos, sin cambios visuales.



- `components/legal/AcceptCheckbox.jsx`: checkbox reutilizable (no togglea al clickear enlaces internos).
- Registro (`Register.jsx`): checkbox obligatorio Términos + Privacidad (bloquea submit, muestra error). Enlaces a /terminos y /privacidad (target=_blank).
- Compra de stickers (`Rewards.jsx` StickerModal): checkbox obligatorio Bases del Sorteo (botones de pago disabled hasta aceptar). Enlace a /bases-sorteo.
- Testeado con testing_agent: 5/5 flujos OK (iteration_5).

## Deploy GCP — fix Resend secret (2026-07-31)
- Error de deploy: secreto `RESEND_API_KEY` no existía en Secret Manager de GCP. Solución (usuario debe correr en su GCP): `gcloud secrets create RESEND_API_KEY` + `add-iam-policy-binding` al SA `levelproaudio-run@`. Usuario ya lanzó re-deploy.
- `cloudbuild.yaml`: RESEND_FROM_EMAIL cambiado de onboarding@resend.dev → `LevelPro Audio <no-responder@levelproaudio.com>` (dominio verificado).

## Páginas legales (2026-07-31) ✅
- `components/legal/LegalShell.jsx`: layout editorial reutilizable (hero + índice sticky con scroll-spy + secciones numeradas).
- Páginas: `/terminos` (Terminos.jsx), `/privacidad` (Privacidad.jsx), `/bases-sorteo` (BasesSorteo.jsx). Contenido en español para CL/AR (compras, pagos, envíos, datos, sorteo Rewards). Cada una con `<Seo>`.
- Rutas en App.jsx dentro de MainLayout. Footer: reemplazados los `<span>` sin link por Links reales + agregado "Bases del Sorteo".
- P1: Validar PayPal + emails reales en prod. Editar prize_product en detalle admin.
- P2: Automatizar USD_CLP_RATE. Reseñas. Cupones.

## Credenciales de prueba
Ver `/app/memory/test_credentials.md`.

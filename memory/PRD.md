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

## SEO — FASE 1: Indexación (2026-07-31) ✅
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

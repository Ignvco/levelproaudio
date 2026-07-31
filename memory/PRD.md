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

## Backlog (orden: a✔ admin → b legales → c✔ SEO → d✔ Resend → e✔ recuperar pass)
- b) Páginas legales: Términos, Privacidad, Bases del Sorteo (footer hoy <span> sin link).
- P1: Validar PayPal + emails reales en prod. Editar prize_product en detalle admin.
- P2: Automatizar USD_CLP_RATE. Reseñas. Cupones.

## Credenciales de prueba
Ver `/app/memory/test_credentials.md`.

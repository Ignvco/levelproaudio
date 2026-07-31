# LevelPro Audio — PRD

## Problem statement
SaaS Chile/Argentina: e-commerce (Tienda), Academia y Servicios de audio. UI dark premium, acento verde neón (#1aff6e), fuente Geist. React 19 + Vite / Django 5 + DRF. Auth cookies HTTPOnly (JWT). Pagos MercadoPago (CL) + PayPal. Deploy GCP Cloud Build → Cloud Run + Secret Manager. Idioma: Español.

## Settings
- Local: `DJANGO_SETTINGS_MODULE=config.settings.local` (SQLite). Backend `uvicorn server:app`.
- Preview SIN credenciales de pago → pagos solo validables en producción.

## Implementado reciente (2026-07-31)
- Navbar mobile dock; Home mobile editorial; logo mobile agrandado.
- Servicios: fixes envío + presupuesto + pago online precio fijo; rediseño premium del detalle (hero, card promo oscura, formulario redondeado, título estilo sección).
- Rewards STICKERS: `Campaign.sticker_price`, `StickerPurchase`, buy endpoint, entries al pagar, my-entries con códigos+imagen; modal compra; MyEntries con tickets; admin precio sticker.
- Rewards `prize_product` (FK catálogo) — selector visual en admin + sección "El premio" con ProductCard (migración 0003).
- Seguridad: eliminado `/payments/diagnostics/` + DIAGNOSTICS_KEY.
- PAGOS fix: PayPal ahora se captura en `PaymentSuccess.jsx` (antes no → órdenes quedaban pending). Validar en prod.
- **Login/Register premium**: `components/auth/AuthShell.jsx` (split-screen) + AuthField/AuthSubmit. Login/Register reescritos. Link "olvidé contraseña" → /forgot-password (pendiente paso e).
- **Admin premium**: `AdminLayout.jsx` reescrito (nav activo verde con barra+glow, avatar, hovers via `.admin-nav-link`). Cabeceras: reemplazo masivo en `pages/admin/*` de `var(--font-serif)`→`var(--font-display)` y `fontWeight:300`→`800` (títulos bold Geist).
- **SEO**: `components/Seo.jsx` (React 19 hoista <title>/<meta>/OG). Agregado a Home, Shop, Services, Rewards, Academy, ProductDetail, ServiceDetail (dinámico). index.html: lang="es", favicon /favicon.svg, title/description/OG default. OG banner generado. `public/robots.txt` + `public/sitemap.xml`.

## EN CURSO
- **Resend (emails reales)**: playbook obtenido. FALTA: RESEND_API_KEY del usuario + remitente/dominio verificado. Implementar: confirmación de compra, tickets de sorteo, y (paso e) recuperar contraseña. Hoy EMAIL_BACKEND=console.

## Backlog (orden acordado: a✔ admin → b legales → c SEO✔ → d Resend → e recuperar pass)
- b) Páginas legales: Términos, Privacidad, Bases del Sorteo (footer hoy son <span> sin link).
- d) Resend (en curso).
- e) Recuperar contraseña (depende de Resend).
- P1: Validar PayPal en prod. Editar prize_product en detalle admin.
- P2: Automatizar USD_CLP_RATE. Reseñas de productos. Cupones.
- P4: Limpieza legacy Rewards.

## Credenciales de prueba
Ver `/app/memory/test_credentials.md`.

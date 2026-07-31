# LevelPro Audio — PRD

## Problem statement
SaaS para Chile/Argentina que combina e-commerce (Tienda), Academia y Servicios profesionales de audio. UI moderna, responsive, dark mode con acento verde neón. Stack: React 19 + Vite (frontend), Django 5 + DRF (backend), SQLite local / PostgreSQL prod. Auth por cookies HTTPOnly (JWT). Pagos: MercadoPago (CL) + PayPal (live) vía órdenes. Deploy: Google Cloud Build → Cloud Run (cloudbuild.yaml + Secret Manager).

Idioma del usuario: **Español** (responder siempre en español).

## Settings importantes
- Local: `DJANGO_SETTINGS_MODULE=config.settings.local` (SQLite). Backend corre con `uvicorn server:app` (server.py fija `config.settings.local`).
- Migraciones locales: `DJANGO_SETTINGS_MODULE=config.settings.local python manage.py migrate`.

## Implementado (histórico reciente)
- Navbar mobile (dock inferior tipo pill): iconos blancos; el icono de la página activa se pone negro sobre círculo verde neón. Iconos: Home, Tienda (bolsa), Academia (birrete), Servicios (ecualizador), Rewards (regalo), Carrito, Cuenta. `MainLayout.jsx`.
- Home mobile rediseñado a layout editorial alineado a la izquierda (logo arriba-izq, título grande, tags, CTAs). Se quitó logo duplicado del top en Home. `Home.jsx` + `MainLayout.jsx`.

### 2026-07-31
- **Servicios (bug fix)**: el presupuesto ahora se sanitiza a número antes de enviar (acepta "$500.000") y se muestra el error real del backend. `ServiceDetail.jsx`. Verificado con testing agent (iteration_4, 100%).
- **Rewards rediseñado a sistema de STICKERS** (reemplaza "comprar producto = participar"):
  - `Campaign.sticker_price` (precio por sticker, CLP). Nuevo modelo `StickerPurchase(order, campaign, quantity)`. Migración `rewards/0002`.
  - Endpoint `POST /api/v1/rewards/campaigns/{slug}/buy/` {quantity} → crea Order pending + OrderItem + StickerPurchase; devuelve order_id/total. Frontend llama luego a `/payments/create/` (MP/PayPal).
  - `generate_entries_for_order` reescrito: al pagar la orden genera N Entries (1 por sticker), idempotente. `rewards/services.py` + `rewards/signals.py`.
  - `/rewards/my-entries/` ahora devuelve `codes` (códigos de tickets) + `image` de la campaña.
  - Frontend: `Rewards.jsx` con modal de compra (stepper + total en vivo + botones MP/PayPal), sección "Cómo funciona"; se quitó "Productos participantes". `MyEntries.jsx` muestra cada ticket con código único + imagen de audio. Admin: precio por sticker en crear (`AdminRewardsCampaigns.jsx`) y editar (`AdminRewardsCampaignDetail.jsx`).
  - Verificado por main agent con curl (buy 201, validación 400, entries al pagar, my-entries con codes) + capturas (Rewards, modal, perfil). NO se usó testing agent por preferencia del usuario.

## Backlog / próximos
- P1: Email real de tickets (integrar proveedor, ej. Resend) — hoy diferido; tickets solo en perfil. (EMAIL_BACKEND actual = console, no envía correos reales).
- P1: Seguridad: quitar/rotar `DIAGNOSTICS_KEY` o el endpoint `/api/v1/payments/diagnostics/`.
- P2: Automatizar `USD_CLP_RATE` con API de tipo de cambio en vivo (hoy fijo 950).
- P2 (pregunta abierta al usuario): ¿Servicios con precio fijo deben redirigir al checkout de pago? Hoy solo formulario de solicitud.
- P3: Compartir en redes (imagen para IG Stories con tickets); sistema de referidos.
- P4: Limpieza de código legacy de Rewards (RewardProduct, /rewards/preview/, /rewards/product/{slug}/ ya no se usan).

## Credenciales de prueba
Ver `/app/memory/test_credentials.md`.

# LevelPro Audio — PRD

## Problem statement
SaaS para Chile/Argentina que combina e-commerce (Tienda), Academia y Servicios profesionales de audio. UI moderna, responsive, dark mode con acento verde neón. Stack: React 19 + Vite (frontend), Django 5 + DRF (backend), SQLite local / PostgreSQL prod. Auth por cookies HTTPOnly (JWT). Pagos: MercadoPago (CL) + PayPal (live) vía órdenes. Deploy: Google Cloud Build → Cloud Run (cloudbuild.yaml + Secret Manager).

Idioma del usuario: **Español** (responder siempre en español).

## Settings importantes
- Local: `DJANGO_SETTINGS_MODULE=config.settings.local` (SQLite). Backend corre con `uvicorn server:app` (server.py fija `config.settings.local`).
- Migraciones locales: `DJANGO_SETTINGS_MODULE=config.settings.local python manage.py migrate`.

## Implementado (histórico reciente)
- Navbar mobile (dock inferior pill): iconos blancos; icono de página activa negro sobre círculo verde neón. `MainLayout.jsx`.
- Home mobile editorial alineado a la izquierda; sin logo duplicado en Home. `Home.jsx` + `MainLayout.jsx`.

### 2026-07-31
- **Servicios**:
  - Bug fix presupuesto: se sanitiza a número (acepta "$500.000") y muestra error real. Verificado testing agent (iteration_4).
  - Bug fix envío: el botón quedaba deshabilitado para invitados (nombre/email vacíos) → al no poder click, "solo WhatsApp". Ahora `disabled` solo exige nombre/email/mensaje cuando `isAuthenticated`; invitado puede click → redirige a /login. `ServiceDetail.jsx`.
  - **Pago online de servicios con precio fijo**: nuevo endpoint `POST /api/v1/services/{slug}/checkout/` (crea Order pending + OrderItem, devuelve order_id; 400 si no es precio fijo). Frontend: si `price_type==="fixed"` con precio, `ServiceDetail.jsx` muestra tarjeta "Contratar" con botones MercadoPago/PayPal que llaman checkout → `/payments/create/` → redirige al checkout. Servicios "quote"/"hourly" mantienen el formulario de solicitud. Verificado con curl (201/400/401) + captura.
- **Rewards → sistema de STICKERS** (reemplaza "comprar producto = participar"):
  - `Campaign.sticker_price` (CLP). Modelo `StickerPurchase(order, campaign, quantity)`. Migración `rewards/0002`.
  - `POST /api/v1/rewards/campaigns/{slug}/buy/` {quantity} → Order pending + OrderItem + StickerPurchase; devuelve order_id/total. Frontend luego llama `/payments/create/`.
  - `generate_entries_for_order` reescrito: al pagar genera N Entries (1/sticker), idempotente.
  - `/rewards/my-entries/` devuelve `codes` + `image`.
  - Frontend: `Rewards.jsx` modal de compra (stepper + total + MP/PayPal) + "Cómo funciona"; sin "Productos participantes". `MyEntries.jsx` muestra tickets con código único + imagen de audio. Admin: precio por sticker en crear/editar campaña.
  - Verificado con curl + capturas (NO testing agent, por preferencia del usuario).

## Backlog / próximos
- P1: Email real de tickets/confirmaciones (integrar proveedor, ej. Resend) — hoy EMAIL_BACKEND=console (no envía). Diferido.
- P1: Seguridad: quitar/rotar `DIAGNOSTICS_KEY` o el endpoint `/api/v1/payments/diagnostics/`.
- P2: Automatizar `USD_CLP_RATE` con API de tipo de cambio en vivo (hoy fijo 950).
- P3: Compartir tickets en IG Stories; sistema de referidos.
- P4: Limpieza de legacy Rewards (RewardProduct, /rewards/preview/, /rewards/product/{slug}/).

## Credenciales de prueba
Ver `/app/memory/test_credentials.md`.

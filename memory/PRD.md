# LevelPro Audio — PRD

## Problem statement
SaaS para Chile/Argentina que combina e-commerce (Tienda), Academia y Servicios profesionales de audio. UI moderna, responsive, dark mode con acento verde neón (#1aff6e). Stack: React 19 + Vite (frontend), Django 5 + DRF (backend), SQLite local / PostgreSQL prod. Auth por cookies HTTPOnly (JWT). Pagos: MercadoPago (CL) + PayPal (live) vía órdenes. Deploy: Google Cloud Build → Cloud Run (cloudbuild.yaml + Secret Manager).

Idioma del usuario: **Español** (responder siempre en español). Fuentes: Geist (display/sans).

## Settings importantes
- Local: `DJANGO_SETTINGS_MODULE=config.settings.local` (SQLite). Backend corre con `uvicorn server:app`.
- Migraciones locales: `DJANGO_SETTINGS_MODULE=config.settings.local python manage.py migrate`.
- **Preview NO tiene credenciales de pago** (MP_CL_ACCESS_TOKEN / PAYPAL vacíos). Los pagos solo se completan en producción (Secret Manager). Cualquier flujo de pago debe validarse en prod.

## Implementado (histórico reciente)
- Navbar mobile dock pill; Home mobile editorial; logo mobile agrandado (hero 42px, top 34px).

### 2026-07-31
- **Servicios**: fix presupuesto (sanitiza a número), fix envío (invitado→login con `?next=`, precarga datos del user, solo exige mensaje logueado), **pago online para precio fijo** (`POST /api/v1/services/{slug}/checkout/` → order pending; frontend paga vía `/payments/create/`). Rediseño premium del detalle siguiendo mockup del usuario: hero editorial, grid 2 cols, card promocional oscura "Hablemos de tu proyecto", formulario con inputs redondeados rellenos (r16) + título estilo sección (blanco display-bold) + botones WhatsApp(verde)/Enviar(blanco) en fila. `design_guidelines.json` generado.
- **Rewards → sistema de STICKERS**: `Campaign.sticker_price`, modelo `StickerPurchase`, endpoint `/rewards/campaigns/{slug}/buy/`, entries idempotentes al pagar, `/rewards/my-entries/` con `codes`+`image`. Modal de compra (stepper+MP/PayPal), "Cómo funciona", `MyEntries.jsx` con tickets (código único + imagen de audio). Admin: precio por sticker en crear/editar.
- **Rewards → producto a sortear** (`rewards/0003`): `Campaign.prize_product` FK a `products.Product`. Serializer público usa `ProductListSerializer` (ProductCard). Admin: selector visual de producto del catálogo en el modal de creación (`prize-product-search`, `pick-product-<slug>`, `selected-prize-product`). Público: sección "El premio" con `ProductCard` + CTA participar.
- **Seguridad**: eliminado endpoint `/api/v1/payments/diagnostics/` + `DIAGNOSTICS_KEY`.
- **PAGOS — fix crítico**: PayPal nunca se capturaba (`capturePayPal` no se llamaba). Ahora `PaymentSuccess.jsx` ejecuta la captura al volver con `paymentId`+`PayerID` e invalida la query de la orden. Afecta tienda/cursos/stickers/servicios. **Solo validable en producción** (preview sin creds).

## Estado de PAGOS (diagnóstico 2026-07-31)
- ✅ MercadoPago CL/AR: preferencia + webhook → order paid → entries/enrollment.
- ✅ PayPal: create order + CLP→USD + **captura ahora conectada** (antes faltaba).
- ✅ Stickers y servicios usan el mismo flujo de órdenes/pago.
- ⚠️ Emails: EMAIL_BACKEND=console (no envía). Diferido.
- ⚠️ USD_CLP_RATE fijo (950). Automatizar con API de cambio.
- ⚠️ Global66: transferencia manual (por diseño).

## Backlog / próximos
- P1: Validar en producción la captura de PayPal (compra chica real).
- P1: Email real (Resend) para confirmaciones de compra + tickets de sorteo.
- P2: Automatizar USD_CLP_RATE con API en vivo.
- P2: Permitir editar `prize_product` en el detalle admin de campaña (hoy solo en crear).
- P3: Compartir tickets en IG Stories; sistema de referidos.
- P4: Limpieza legacy Rewards (RewardProduct, /rewards/preview/, /rewards/product/{slug}/).

## Credenciales de prueba
Ver `/app/memory/test_credentials.md`.

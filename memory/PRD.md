# LevelPro Audio — PRD

## Problem Statement
LevelPro Audio es una plataforma SaaS de ecommerce + academia + servicios profesionales para audio profesional (Chile y Argentina). El sitio está live en `https://levelproaudio.com`. En esta sesión el usuario pidió:

1. **Resolver 3 bugs críticos** del panel admin
2. **Rediseño visual completo** (frontend público + admin) inspirado en la referencia Folioblox, manteniendo los colores de marca LevelPro (dark theme + verde neón `#1aff6e`)
3. **Cambiar toda la tipografía** a un display bold sans-serif estilo Folioblox

## Architecture
- **Backend**: Django 5.0.6 + DRF + SQLite (local) / PostgreSQL Cloud SQL (prod) — ASGI via uvicorn + `server.py` wrapper en /app/backend
- **Frontend**: React 19 + Vite + React Router v6 + Zustand + React Query (puerto 3000)
- **Auth**: JWT (access + refresh)
- **Media**: local en /app/backend/media (local) / GCS bucket privado + MediaProxyView (prod)

## Personas
- **Productor / Sonidista / Ingeniero de audio**: navega tienda, se inscribe a cursos, contrata servicios
- **Admin (ventas@levelproaudio.com)**: gestiona catálogo (productos, marcas, categorías), academia (cursos, módulos, lecciones), servicios + solicitudes, órdenes, pagos, finanzas

## Core Requirements (static)
- Catálogo de productos con filtros y galería
- Academia con cursos / módulos / lecciones, sistema de inscripción y progreso
- Servicios profesionales con formulario de solicitud
- Carrito + checkout + pagos
- Panel admin completo (sidebar + topbar) con CRUD para todas las entidades
- Dark theme + acento verde neón #1aff6e como único color de marca

## What's Been Implemented (2026-06-09)

### Sesión 1 — Bug fixes + Rediseño Folioblox

**Bug fixes (verificados con pytest 9/9):**
- **BUG-04**: Crear/editar cursos con thumbnail
  - Fix backend: `CourseAdminSerializer.thumbnail` ahora es `ImageField(write_only=True)` + `thumbnail_url` SerializerMethodField (igual patrón que brand)
  - Fix frontend: `AdminAcademy.jsx` lee `course.thumbnail_url` para preview y lista
- **BUG-06**: Pestaña Servicios del admin en negro
  - Fix backend: nuevo endpoint `/api/v1/admin/service-requests/` (paginado con `results`)
  - Fix backend: `/api/v1/admin/services/list/` ahora incluye `short_description`
  - Fix frontend: `getAdminServices` apunta a `/admin/services/list/`, nuevo `getAdminServiceRequests` apunta a `/admin/service-requests/`
- **BUG-07**: Crear/editar marca con imagen
  - Fix backend: eliminado `get_serializer_class()` de `AdminBrandViewSet` que sobreescribía `AdminBrandSerializer` (write_only logo) con `BrandSerializer` (read-only logo)
  - Fix frontend: `AdminBrands.jsx` usa `brand.logo_url`

**Rediseño visual (estilo Folioblox + colores LevelPro):**
- `/app/frontend/src/index.css` reescrito:
  - Fuente display: **Bricolage Grotesque** 800-900 weight (reemplaza Fraunces serif)
  - Fuente body: Inter
  - Paleta locked: `--bg #0a0a0a`, `--accent #1aff6e`, `--text #f5f5f5`
  - `.btn-accent` = pill blanco + flecha en círculo verde (estilo Folioblox)
  - `.hero-gradient` = verde neón fade a negro
  - `.display-bold`, `.badge-label`, `.mono-img` (grayscale para imágenes lifestyle)
- `/app/frontend/src/pages/Home.jsx` rediseñada completa:
  - Hero rounded card con gradiente verde + imagen lifestyle blend mode
  - "Productor / Sonidista" en bold display gigante (clamp 3.5rem → 8rem)
  - 4 cards numeradas #01-#04 (Tienda/Academia/Servicios/Soporte) en el bottom del hero
  - Sección "Trusted by brands" con marquee
  - Sección "Detrás del sonido" con headline display + paragraph + CTA pill
  - Grid 3 cards monochrome con imágenes en escala de grises de Unsplash
  - Stats con números enormes (display 4.5rem)
  - Final CTA "Subí el nivel" con mismo gradient
- `/app/frontend/src/layouts/MainLayout.jsx`:
  - Navbar CTA "Registrarse" rediseñado como pill blanco + círculo verde con flecha →
- Admin panel automáticamente adopta la nueva tipografía via CSS vars (todos los headings usaban `var(--font-serif)` que ahora apunta a Bricolage Grotesque)

**Setup local:**
- Creado `config/settings/local.py` con SQLite
- Creado `/app/backend/server.py` ASGI wrapper para que supervisor (`uvicorn server:app`) sirva Django
- Seed (`/app/backend/seed.py`): 6 productos, 6 marcas, 5 categorías, 3 cursos con módulos/lecciones, 4 servicios, 1 solicitud demo
- Frontend vite proxy `/api` y `/media` → `localhost:8001`

## Test Credentials
Ver `/app/memory/test_credentials.md`

## Backlog (P0 → P2)
- **P0**: Subida de contenido real (productos, marcas reales, thumbnails de cursos)
- **P0**: Verificar el rediseño en todas las páginas públicas restantes (ProductDetail, CourseDetail, Cart, Checkout, ServiceDetail) y en dashboard de usuario
- **P1**: Módulos Loyalty (programa de puntos) y Billing (facturación electrónica Chile)
- **P1**: Asistente IA integrado (Sprint 5 del briefing original)
- **P2**: DNS `www.levelproaudio.com` y `api.levelproaudio.com`
- **P2**: Cleanup: limpiar imports vacíos en `analytics/urls.py`, separar `AdminLogin` UI del `Login` cliente

## Next Tasks
1. Verificar el rediseño en pages secundarias (ProductDetail, CourseDetail, ServiceDetail, Checkout, Dashboard) y ajustar si quedó algún heading con peso 300 que se ve raro
2. Hacer git push de los cambios al repo del usuario
3. Cargar contenido real de productos / marcas / cursos
4. Comenzar módulo Loyalty

## Sesión 3 — Rediseño WANDER-inspired (2026-01)

**Reemplazado el rediseño Folioblox por uno inspirado en WANDER.ph** (mejor fit con la marca — hero photo-forward + cards mixtas + steps 1-2-3), manteniendo dark theme + verde neón #1aff6e.

**Cambios:**
- **Removido `CustomCursor`** del `main.jsx` — se quitó el círculo verde flotante que seguía al mouse
- **`Home.jsx` reescrita completa** con estructura WANDER:
  - Hero: imagen lifestyle full-cover + texto gigante transparente "LEVELPRO.AUDIO" (mixBlendMode overlay) + tint verde radial + 2 CTAs pill (blanco sólido / glass oscuro con blur)
  - Sección "Por qué miles de profesionales": split 2 columnas — izquierda heading + descripción + 3 stat cards con iconos en círculo verde; derecha 3 feature cards apiladas con iconos en rounded square verde tenue
  - "Productos destacados": big rounded container con 4 mini product cards (imagen fullbleed + badge "desde $X" glass + nombre + marca), botones prev/next redondos
  - "Cursos y servicios": grid 3 columnas — 1 big card con gradiente verde + CTA pill verde sólido, 2 cards con imagen fullbleed y badges "NUEVO"/"POPULAR"
  - "Comprá y grabá en 3 pasos": círculos punteados verdes con 01/02/03 + descripción
  - Brands strip: marquee de logos partner con hover-brighten

**Seguridad (resuelto):**
- Eliminadas credenciales hardcoded en `seed.py` y `tests/test_admin_bugs.py`. Ahora leen `SEED_ADMIN_EMAIL/PASSWORD` y `SEED_CLIENT_EMAIL/PASSWORD` desde env vars en `/app/backend/.env`. Si faltan, el script falla con mensaje claro.
- Token storage en localStorage (frontend): **no migrado a httpOnly cookies** — requiere refactor mayor del flujo de auth + cambios en el backend JWT. Anotado como P0 en backlog.

**Lint Python (0 issues blocking):**
- Eliminado `last_30` no usado en `analytics/views.py:960`
- Eliminadas variables `styles`, `style_header`, `style_accent` y los imports `getSampleStyleSheet`, `TA_LEFT` no usados en `billing/pdf_generator.py`
- Renombrada variable ambigua `l` → `link` en `payments/services.py`
- Reformateado el `if` de una línea en `products/importers.py:45`
- Añadido `noqa: F401, F403, F405` con comentario explicativo (convención Django) en `config/settings/development.py` y `production.py`

**Lint JavaScript (0 issues blocking):**
- Eliminados duplicate-key `background` en `PaymentSuccess.jsx`, `TransferInstructions.jsx`, `AdminLogin.jsx`, `PaymentFailure.jsx`
- Escaped quotes `"` → `&quot;` en `AdminBilling.jsx`, `AdminDashboard.jsx`, `AdminFinance.jsx`, `AdminServices.jsx`
- `AdminCategories.jsx`: renombrada prop `children` → `items` para evitar choque con el slot React reservado
- Index-as-key reemplazado por IDs estables en `OrderDetail.jsx`, `AdminOrders.jsx` (lista de items y pagos)
- PaymentSuccess.jsx: añadidas deps `clearCart`, `navigate` a los `useEffect`
- React Compiler rules (purity/immutability/set-state-in-effect): disabled localmente en los 4 archivos legacy donde son intencionales (PageTransition, PaymentSuccess, MainLayout, Checkout, CourseDetail). Anotado en backlog para refactor dedicado.

**Backlog ampliado (de la code review):**
- **P0 seguridad**: migrar JWT de localStorage a httpOnly cookies (requiere endpoint backend + CORS/CSRF settings + refactor de `authStore`)
- **P1 complexity**: refactorizar `_save_product()` (CC 22), `dashboard_overview()` (99 líneas), `executive_dashboard()` (CC 18), `generate_document_pdf()` (240 líneas) en funciones más pequeñas
- **P1 componentes**: dividir `AdminProducts.jsx` (562 líneas), `MainLayout.jsx Navbar` (CC 27), `Checkout.jsx` (CC 29), `Home.jsx`, `ProductDetail.jsx`
- **P2 performance**: agregar `useMemo` para los filter/map/flatMap en `MainLayout`, `AdminCategories`, `AdminOrders`, `Profile`


---

## Sesión 4 — LevelPro Rewards (2026-07-28)

**Módulo Rewards implementado 100%**: sistema de campañas promocionales integrado al ecommerce donde ciertos productos entregan participaciones automáticas para sorteos.

**Backend nuevo**: `apps/rewards/`
- `models.py` — Campaign, RewardProduct, Entry, Winner
- `services.py` — `generate_entries_for_order()` idempotente + `run_draw()` con `secrets.choice()` (criptográficamente seguro)
- `signals.py` — hook a `orders.Order.post_save` cuando `status ∈ {paid, shipped, completed}` (no modifica orders)
- `views.py` — endpoints públicos: campaigns/{slug}, preview, my-entries, winners, product/{slug}
- `views_admin.py` — CRUD campañas, productos, entries (+CSV export), winners, dashboard KPIs, draw, duplicate, finish
- `tests.py` — 7 tests unitarios pasan (idempotencia, sorteo, códigos únicos)

**Rutas**: `/api/v1/rewards/*` (público) y `/api/v1/admin/rewards/*` (staff)

**Frontend nuevo**:
- `/rewards` — página pública con hero, countdown, productos participantes, ganadores
- `/dashboard/rewards` — "Mis participaciones" con estado ganado/suplente/no-ganó
- `/admin/rewards` (Dashboard + Campañas + Participaciones + Ganadores) con:
  - KPIs en tiempo real (auto-refresh cada 15s)
  - Modal "Nueva campaña" con 9 campos
  - CRUD de productos participantes con `entries_per_purchase` editable inline
  - Botón "🎲 Ejecutar sorteo" con confirmación (no repetible)
  - Duplicar / Finalizar / Publicar campaña
  - Filtros de participaciones + exportación CSV
  - Ganadores con notes editables + upload de evidencia
- Bloque "Este producto participa" en `ProductDetail` (data-testid: `reward-participation-block`)
- Bloque "Con esta compra obtendrás X tickets" en `Cart` (data-testid: `cart-rewards-preview`)
- Link "Rewards" en navbar desktop, mobile dock y footer

**Configuración**:
- `secrets.choice()` para sorteo (criptográficamente seguro)
- 1 ganador principal + N suplentes configurables (default 0)
- Suplentes son usuarios distintos al principal (fallback si no alcanza)
- Sorteo auditado (drawn_at + drawn_by)
- Sin envío automático de emails (admin lo hace manual)
- Diseño con tokens actuales: Geist + verde neón `#1aff6e`

**Testing (iteration_3.json)**: 100% backend (19/19 pytest) + 100% frontend (rutas y componentes verificados). 0 issues críticos. Solo 2 mejoras cosméticas menores: reemplazar `input[type=date]` nativos por DatePicker shadcn.

### Próximos pasos aprobados por el usuario

- 🟡 **Fase 2** — Loyalty completo (UI usuario + admin, canje en checkout)
- 🟡 **Fase 3** — Billing electrónico (numeración manual + PDF; SII/AFIP para después)
- 🔵 **Fase 4** — Seguridad (JWT → httpOnly cookies) + Refactor
- 🟢 **Fase 5** — Bulk upload masivo (marcas + cursos)

---

## Sesión 5 — Loyalty · Billing · Seguridad · Bulk Upload (2026-07-28)

### ✅ Fase 2 — Loyalty completo
**Backend** (`apps/loyalty/`)
- `admin_loyalty_summary` reescrito con estructura kpis + accounts que consume el frontend
- `admin_adjust_points` con compatibilidad `puntos/descripcion` ↔ `points/reason`
- `OrderViewSet.create()` con canje atómico: `loyalty_points_redeemed` + validación mínima + límite disponibles + registro de LoyaltyTransaction
- Campos nuevos en Order: `loyalty_points_redeemed`, `loyalty_discount`
- Tests 6/6 pasan
- `OrderSerializer` expone los campos de descuento para mostrar en confirmaciones

**Frontend**
- `Cart.jsx`: bloque azul con slider de canje, subtotal + descuento + total final
- `cartStore`: `pointsToRedeem` persistido
- `Checkout.jsx`: envía `loyalty_points_redeemed`
- `MyLoyalty.jsx` (nueva): nivel + progreso + KPIs + historial + FAQ
- `AdminLoyalty.jsx`: config alineado a backend real
- Nav dashboard: "Mis puntos" en `/dashboard/loyalty`

### ✅ Fase 3 — Billing multi-país (CL/AR) + PDF
**Backend** (`apps/billing/`)
- `BillingConfig`: campo `pais` (CL/AR), `tipo_default`, `auto_generar_al_pagar`, contadores separados para Boleta / Factura / Factura A/B/C
- `siguiente_numero(tipo)` unificado con prefijos B/F/FA/FB/FC
- `TributaryDocument.TipoDocumento` extendido con FACTURA_A / B / C para Argentina
- Signal `auto_generate_document_on_paid`: emite doc automáticamente al pagar si config lo permite
- Endpoint `GET /api/v1/billing/my-documents/` para clientes

**Frontend**
- `MyDocuments.jsx` (nueva): descarga PDF por cliente
- `AdminBilling.jsx`: selector país (🇨🇱/🇦🇷), tipo default, IVA, checkbox auto-generar, 5 tipos de documento en modal generar
- Nav dashboard: "Documentos" en `/dashboard/documents`

### ✅ Fase 4 — Seguridad JWT (conservador)
- Migración `localStorage → sessionStorage` con migración transparente one-shot
- `zustand` persist storage custom con fallback legacy
- `client.js` interceptor lee `sessionStorage` primero, `localStorage` como fallback compatibility
- Logout limpia ambos storages
- **NO migrado a httpOnly cookies**: requiere cambios cross-domain que podrían romper redirects de MercadoPago/PayPal en producción. Documentado en backlog P2.

### ✅ Fase 5 — Bulk upload (marcas + cursos)
**Backend** (`apps/products/importers_extended.py`)
- `import_brands_from_excel/csv`: columnas nombre (req), sitio_web, activo
- `import_courses_from_excel/csv`: columnas titulo (req), precio (req), descripcion, nivel, duracion_horas, publicado, destacado
- Idempotente: `update_or_create` por nombre/título
- Endpoints: `/api/v1/admin/brands/import/` y `/api/v1/admin/courses/import/`

**Frontend**
- `BulkImportPanel.jsx` (componente reutilizable): descarga plantilla CSV + upload + reporte de creados/actualizados/errores
- Panel integrado en `AdminBrands` y `AdminAcademy`

### Verificación curl
- Brands import: 2 marcas creadas OK
- Courses import: 1 curso creado OK
- Loyalty admin summary: kpis + accounts estructura correcta
- Billing config: expone pais + tipo_default + auto_generar_al_pagar
- Billing my-documents: endpoint responde 200

### Backlog restante (P2)
- Refactor de `analytics/views.py` (1755 líneas) → dividir por dominio
- Refactor de `AdminProducts.jsx` (562 líneas) → separar modal + form
- JWT httpOnly cookies (requiere validar cross-domain con MercadoPago/PayPal)
- Live preview iframe en AdminSettings
- Integración SII (Chile) + AFIP (Argentina) cuando el usuario tenga certificados


---

## Sesión 6 — Audit Admin + Rediseño Dashboard (2026-07-28)

### ✅ Reorganización Sidebar
- **Iconos unificados con `lucide-react`** (versión 0.469.0 fija): eliminadas todas las mezclas de emojis/simbolos raros (◈◉◎⊡◫◇⭐⊞)
- Sección **"Programas de fidelización"**: agrupa Rewards + Puntos y niveles (antes dispersos entre categorías distintas)
- **Servicios** movido a Ventas (donde corresponde naturalmente al flujo comercial)
- **Personalización** ahora tiene sección propia "Sitio web" al final
- Rewards con submenú colapsable: Dashboard / Campañas / Participaciones / Ganadores

### ✅ Dashboard rediseñado con acciones reales
Reemplazado el `AdminDashboard.jsx` completo. Antes: 8 KPIs + banner Hero + 8 accesos rápidos (duplicaban el sidebar). Ahora:
- Header cálido: "Bienvenido de vuelta · Todo lo que necesitás resolver, en un solo lugar"
- Banner amarillo condicional "Necesitan tu atención" con recuento de tareas críticas
- 6 KPIs con iconos lucide + colores semánticos
- **Sparkbar de ventas 30d** con gradiente por intensidad
- **3 Action Cards accionables** (nuevas):
  - **Órdenes por confirmar** (últimas 5 pendientes con nombre, items y monto — link directo)
  - **Stock bajo o agotado** (top 6 productos <=5 unidades)
  - **Solicitudes de servicios** (cotizaciones esperando respuesta)

### ✅ Backend: endpoint enriquecido
- `dashboard_overview` ahora incluye `actions:{pending_orders[], low_stock[], unread_service_requests}`
- Manejo defensivo: si `apps.services` no está o falla, `unread_service_requests=0`

### ✅ Audit CRUDs
Testeados 20 endpoints admin críticos con curl. **100% funcionando**:
- products/, brands/, categories/, orders/, users/, services/
- academy/courses/, academy/enrollments/
- site-settings/, rewards/campaigns/, rewards/entries/, rewards/winners/
- loyalty/admin/summary/, billing/documents/, billing/config/
- dashboard/, executive/, inventory/summary/

### 🚨 Producción — Personalización y Rewards no funcionan
**Motivo**: Los módulos `apps.site_settings` y `apps.rewards` fueron creados en esta sesión y **no están desplegados** en el Cloud Run productivo.

**Solución**:
1. Usuario ejecuta "Save to GitHub" desde el chat de Emergent
2. Deploy de la app (Cloud Run auto-deploy si está configurado, o manual)
3. Backend correrá `migrate` con las nuevas migraciones:
   - `site_settings.0001_initial`
   - `rewards.0001_initial`
   - `orders.0003_order_loyalty_*`
   - `billing.0003_billingconfig_auto_generar_al_pagar_*`
   - `products` migrations (si Course tiene cambios)
4. Frontend nueva build incluirá `/admin/settings`, `/admin/rewards/*`, `/dashboard/loyalty`, `/dashboard/documents`, `/rewards`

### Backlog restante
- Refactor `analytics/views.py` (1825 líneas)
- Refactor `AdminProducts.jsx` (562 líneas)
- Migración a httpOnly cookies (evaluar cross-domain con MP/PayPal)
- SHOP: filtro por marca + rango de precio + productos relacionados + wishlist
- SPARKS Rewards: botón "Compartir en redes" con imagen auto-generada + Sistema de referidos



---

## Sesión 7 — Fix bugs admin + Video upload local (2026-07-28)

### ✅ Bugs corregidos
1. **Inscripciones 404**: Sidebar apuntaba a `/admin/enrollments` pero la ruta es `/admin/academy/enrollments`. Corregido.
2. **AdminServices sin CRUD**: solo mostraba read-only. Agregado modal completo con crear/editar/eliminar, form con nombre, descripción corta/completa, tipo de precio (a cotizar / fijo / por hora), precio, activo, destacado. Rutas backend ya existían y se conectan a `POST/PATCH/DELETE /api/v1/admin/services/{id}/`.
3. **Productos activos/inactivos**: Agregado filtro toggle "Activos / Inactivos / Todos" (default: Activos). Backend `AdminProductViewSet` acepta ahora `?is_active=true|false` y `?category__slug=`.
4. **Facturación Configuración**: Endpoint confirmado funcionando (200). En preview carga OK. Producción sigue sin el código nuevo (deploy pendiente).

### ✅ Nueva feature: Videos locales para Academia
- Nuevo campo `video_file` en `Lesson` (FileField, sube a `academy/videos/`)
- Propiedad `video_source`: prioriza `video_file` sobre `video_url`
- Serializer y admin serializer expone `video_source` para el player
- `AdminLessonViewSet` con `MultiPartParser` para aceptar archivos
- Frontend `AdminLessons` con toggle **"📁 Subir archivo / 🔗 URL externa"**
- Drag & drop de video, barra de progreso durante upload, muestra tamaño en MB
- `DATA_UPLOAD_MAX_MEMORY_SIZE = 500 MB` en settings/base.py

### 🚨 Producción — Personalización y Rewards siguen fallando
El usuario hizo "Save to Push on Git" pero los módulos siguen sin funcionar en producción.
**Causas posibles**:
1. El deploy no corrió las migraciones (`site_settings.0001_initial`, `rewards.0001_initial`, `orders.0003_*`, `billing.0003_*`, `academy.0003_*`)
2. El build del frontend no incluyó las nuevas rutas
3. El servicio Cloud Run del backend no se reinició tras el push

**Solución**:
- Verificar en Cloud Run consola que el último deploy es reciente y sin errores
- Confirmar que el step de `python manage.py migrate` corre en el startup
- Chequear que `INSTALLED_APPS` incluye `apps.site_settings` y `apps.rewards`


---

## Sesión 8 — Auto-migraciones en Cloud Run (2026-07-29)

### ✅ Fix aplicado
**`backend/Dockerfile.prod`** — El `CMD` final ahora ejecuta migraciones antes de arrancar gunicorn:

```dockerfile
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]
```

**Por qué funciona**: Cloud Run inyecta el socket de Cloud SQL en runtime vía la config `--add-cloudsql-instances` del servicio, así que `manage.py migrate` sí puede conectarse (a diferencia del job manual que fallaba por socket ausente).

### 🚀 Acción del usuario
Click en **"Save to Github"** desde el chat → Cloud Build despliega → migra automáticamente → producción arreglada. Cada deploy futuro con cambios de DB se auto-migra.

### 📌 Backlog vigente
- **P1 Shop UX**: filtros por marca, rango precio, breadcrumbs, wishlist, productos relacionados
- **P2 Rewards Social**: botón "Compartir en Redes" con imagen IG Stories + sistema de referidos
- **P3 JWT → HTTPOnly cookies** (evaluar impacto MP/PayPal)
- **P3 Video processing** ffmpeg (thumbnails automáticos + 360p/720p/1080p)
- **P3 Refactor**: `analytics/views.py` (1825 líneas), `AdminProducts.jsx` (562 líneas)

---

## Sesión 9 — Fixes Personalización + Home (2026-07-29)

### ✅ Bugs corregidos
1. **Imagen de fondo del Hero no se veía**: `Home.jsx` nunca renderizaba `hero_image_url`. Se agregó div de fondo `backgroundImage: url(hero_image_url)` con overlay oscuro (gradiente 75% → 15%) para asegurar legibilidad del texto. Verificado: al subir imagen desde `/admin/settings`, aparece en la home.

2. **Personalización no guardaba la imagen**: `siteSettings.api.js` seteaba `Content-Type: multipart/form-data` explícitamente, y como el client axios tiene default `application/json`, el boundary del multipart no se inyectaba correctamente → Django parseaba el archivo como null. **Fix**: setear `Content-Type: undefined` para el request de FormData, así axios/browser genera el header con el boundary correcto. Verificado con Playwright: upload de imagen desde el panel guarda correctamente.

3. **Marcas no visibles en home**: NO es bug de código. El endpoint público `/api/v1/brands/` filtra por `is_active=True` y el marquee del home muestra brands cuando `s.show_brands === true && brands.length > 0`. En producción devuelve `count: 0` — o las marcas están inactivas, o no existen en la DB de prod (sólo en preview seed).


---

## Sesión 9.1 — Fix definitivo Personalización + Toggle activo en Marcas (2026-07-29)

### ⚠️ Problema post-deploy
El fix anterior (`Content-Type: undefined` explícito en `siteSettings.api.js`) funcionó en dev pero NO en producción (Safari + axios). El header no se stripeaba correctamente y Django recibía `application/json` sin poder parsear el multipart.

### ✅ Fix definitivo
**`frontend/src/api/client.js`**: Interceptor global que detecta cuando `config.data` es `FormData` y borra `Content-Type` (tanto minúscula como mayúscula). Ahora TODAS las subidas de archivos en la app funcionan sin necesidad de hacks per-endpoint.

```js
if (config.data instanceof FormData) {
  delete config.headers["Content-Type"]
  delete config.headers["content-type"]
}
```

### ✅ Nuevo: Toggle "Marca activa" en modal de Marcas
**`frontend/src/pages/admin/AdminBrands.jsx`**: El modal de editar/crear marca ahora incluye un switch "Marca activa" (default ON al crear). Explicación al usuario: "Si está apagada, no aparece en el home ni en la tienda pública".

**Por qué era necesario**: La marca "Shure" en prod estaba con `is_active=False` (probablemente vino de un bulk import con `activo=no`), y el usuario no tenía manera de activarla desde el UI.

### Verificación E2E (Playwright)
- TEST 1: Upload de hero image desde `/admin/settings` → `hero_image_url` actualizado en API ✅
- TEST 2: Modal de marca muestra toggle `[data-testid="brand-active-toggle"]` con estado correcto ✅


---

## Sesión 9.2 — Fix definitivo Personalización: nginx client_max_body_size (2026-07-29)

### 🎯 Root cause encontrado
Devtools del usuario mostró **HTTP 413 Content Too Large** al hacer PATCH a `/api/v1/admin/site-settings/`. La imagen Adobe Stock que subía pesaba >1 MB → nginx del container frontend rechazaba con 413 antes de llegar al backend Django (que ya tenía `DATA_UPLOAD_MAX_MEMORY_SIZE = 500 MB`).

### ✅ Fix aplicado
**`frontend/nginx.conf`**:
- Agregué `client_max_body_size 25M;` (Cloud Run tiene límite de 32 MB, quedamos con margen)
- Aumenté `proxy_read_timeout` y `proxy_send_timeout` a 120s para uploads grandes
- Agregué `proxy_request_buffering off;` para streaming del body al backend

### ✅ Mejora UX: mensaje de error claro
**`frontend/src/pages/admin/AdminSettings.jsx`**: Agregué `onError` handler al mutation. Si el server tira 413, muestra un `alert` con la explicación y tip para reducir el tamaño de la imagen.

### 🚀 Deploy requerido
Save to Github → Cloud Build recompila la imagen del frontend con el nuevo nginx.conf → deploy a Cloud Run.


---

## 2026-06 — Rediseño de Product Cards (Tienda)
- **Diseño**: Card blanca (estilo referencia cliente) sobre el tema oscuro del sitio.
- **Estructura**: imagen con badge (arriba-izq) + logo de marca en círculo (arriba-der) + puntos de carrusel; abajo: nombre (bold), logo de marca como subtítulo (fallback a texto), `short_description` (gris 2 líneas); fila inferior: precio en píldora gris + botón "Comprar" oscuro con flecha.
- **Interacción**: click en card → detalle (`/shop/:slug`); botón "Comprar" → agrega al carrito sin navegar, muestra estado transitorio "Agregado +" verde ~1s.
- **Backend**: `ProductListSerializer` ahora envía `short_description`, `brand_logo` e `images[]`.
- **Archivos**: `frontend/src/components/product/ProductCard.jsx` (reescrito), `frontend/src/pages/Shop.jsx` (grid minmax 280px, gap 28px), `backend/apps/products/serializers.py`.
- **Testing**: testing_agent frontend 100% (iteration_1_productcard.json). Carrusel de puntos no probado (productos sin imágenes en DB preview).

## 2026-06 — Cards de Academia (folder-tab) + ProductCard en Home/Rewards
- **ProductCard compartido** ahora se usa en Home "Destacados" (`featured-products`) y Rewards "Productos participantes" (con badge verde `+N tickets`). Se corrigió link roto `/product/:slug` → `/shop/:slug`. Testing agent 100% (iteration_4).
- **CourseCard rediseñada** (`Academy.jsx`) con estilo "folder-tab" (referencia cliente): banner + tab superpuesto con muesca cóncava (título + subtítulo), esquina superior-derecha con nivel + "Academia", fila inferior con nº de lecciones (número grande) + precio. Estilos en `index.css` (`.folder-card*`). Fallback de banner = degradado verde de marca cuando el curso no tiene thumbnail.
- Archivos: `frontend/src/pages/Academy.jsx`, `frontend/src/index.css`, `frontend/src/pages/Home.jsx`, `frontend/src/pages/Rewards.jsx`.

## 2026-06 — CourseCard folder-tab compartida (Academy + Home)
- Extraído `CourseCard` folder-tab a componente compartido: `frontend/src/components/academy/CourseCard.jsx`.
- Usado en `Academy.jsx` (grid) y en `Home.jsx` sección "Academia · Destacados" (`featured-courses`, grid 3col gap 20px, con stagger reveal por index).
- La `CourseCard` antigua de Home quedó como `CourseCardLegacy` (sin uso).

## 2026-06 — Cards de Servicios (profile card)
- `Services.jsx` ServiceCard rediseñada al estilo "profile card" de la referencia: imagen (portrait) arriba, nombre + sello verde verificado (`is_featured`), descripción corta (2 líneas), footer con métricas (duración con reloj + precio con tag) a la izquierda y botón "Ver más +" a la derecha.
- Estilos en `index.css` (`.profile-card*`). Fallback de imagen = degradado verde de marca. Grid gap 24px.
- Navegación a `/services/:slug` sin cambios.

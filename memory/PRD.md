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

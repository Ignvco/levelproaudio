# LEVELPRO OS V4.0 — GATE 0
## 00. Diagnóstico y Estado Actual de la Plataforma

**Documento:** `docs/v4/gate0/00-estado-actual.md`  
**Versión:** 4.0.0-gate0  
**Fecha de Certificación:** Noviembre 2026  
**Auditor / Arquitecto:** Senior Software Architect & Lead Systems Auditor  
**Entorno Auditado:** Producción (`https://levelproaudio.com`) y Repositorio `Ignvco/levelproaudio`  
**Commit Certificado:** `e33f699` (Branch `main` / `feature/v4-gate0-audit`)  
**Despliegue GCP Cloud Build:** ID `adea45b9-6a52-4f42-b28f-57f5adece3d0` (Status: SUCCESS)

---

### 1. Resumen Ejecutivo del Estado del Sistema

LevelPro Audio opera actualmente bajo una arquitectura web moderna, desacoplada y nativa en la nube (Google Cloud Platform). Tras la certificación y despliegue del parche correctivo V3.5 (commit `e33f699`), la plataforma presenta una estabilidad sobresaliente, cero errores de compilación, 518 pruebas automatizadas aprobadas (419 backend y 99 frontend) y paridad idéntica al 100% entre el código fuente de la rama `main` y las imágenes de contenedor activas en Cloud Run.

El ecosistema actual cubre el ciclo de comercio electrónico B2C de audio profesional, venta bajo pedido (Special Orders), cotizaciones B2B mayoristas, academia virtual con cursos técnicos, servicios de consultoría acústica/estudio, sistema de fidelización por puntos (Loyalty), sorteos y rifas comerciales (Rewards) e integraciones con pasarelas de pago multi-moneda (CLP, USD, ARS).

No obstante, desde la perspectiva de gestión empresarial (ERP / Business Management System), la suite administrativa actual (`/admin`) opera como un panel de control fragmentado de Django/React, con dispersión de vistas operativas, ausencia de gestión de compras/proveedores (PO), inventario simplificado a un único entero sin trazabilidad de números de serie ni ubicaciones, y conciliación financiera parcialmente manual. La iniciativa **LEVELPRO OS V4.0** tiene como objetivo unificar, potenciar y profesionalizar este sistema sobre la base arquitectónica sólida ya construida.

---

### 2. Topología de Infraestructura y Despliegue

La plataforma se encuentra desplegada en **Google Cloud Platform (GCP)** dentro de la región `us-central1`, orquestada mediante contenedores Docker sin estado y servicios gestionados:

```
                                  [ INTERNET ]
                                        │
                                        ▼
                           [ Cloudflare DNS & SSL ]
                         (levelproaudio.com / WAF)
                                        │
                                        ▼
                          [ GCP Cloud Run Ingress ]
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              ▼                                                   ▼
  [ Frontend Service ]                                [ Backend API Service ]
  - React 18 + Vite                                   - Python 3.11 + Django 5.2.16
  - Nginx Reverse Proxy                               - Gunicorn + Uvicorn Worker
  - Editorial Bento UI                                - Django REST Framework
  - TailwindCSS + Geist Fonts                         - drf-spectacular (OpenAPI 3)
              │                                                   │
              └─────────────────────────┬─────────────────────────┘
                                        │
                ┌───────────────────────┼───────────────────────┐
                ▼                       ▼                       ▼
      [ Cloud SQL PostgreSQL 16 ]  [ Cloud Storage (GCS) ]  [ Secret Manager ]
      - Instance: levelproaudio-db - Bucket: media assets    - API Keys / Tokens
      - Multi-currency isolation   - MediaProxyView SA auth  - DB Credentials
      - ACID Compliant             - Product/Course assets   - Gateway Webhooks
```

#### Componentes Principales:
1. **Frontend Cloud Run Service (`levelproaudio-frontend`):**
   - Single Page Application (SPA) desarrollada en React 18 con Vite.
   - Servida mediante servidor web Nginx con compresión gzip/brotli, headers de seguridad HTTP (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) y enrutamiento SPA (`try_files $uri $uri/ /index.html`).
   - Reverse proxy interno para endpoints de API (`/api/v1/`) y proxy de media (`/media/`).

2. **Backend Cloud Run Service (`levelproaudio-backend`):**
   - API RESTful construida en Django 5.2.16 y Django REST Framework (DRF) 3.15.
   - Ejecución mediante Gunicorn con workers asíncronos en contenedor Python 3.11.
   - Autenticación híbrida: JWT (JSON Web Tokens) con rotación de tokens (`rest_framework_simplejwt`) y sesiones administrativas estándar.

3. **Capa de Persistencia (Cloud SQL PostgreSQL 16):**
   - Instancia gestionada `levelproaudio:us-central1:levelproaudio-db`.
   - Motor PostgreSQL 16 con soporte de transacciones ACID estrictas, índices B-Tree, GIN para búsquedas textuales y llaves foráneas con integridad referencial protegida.

4. **Almacenamiento de Medios (Google Cloud Storage):**
   - Bucket `levelproaudio-media` para imágenes de productos, portadas de cursos, comprobantes de transferencia y fichas técnicas.
   - Servido a través de `MediaProxyView` en el backend para evitar la exposición pública indiscriminada de buckets y garantizar control de acceso.

5. **Gestión de Secretos (Google Secret Manager):**
   - Inyección en tiempo de ejecución de variables sensibles: `DATABASE_URL`, `SECRET_KEY`, credenciales de Webpay Plus, Mercado Pago (Chile y Argentina), Ualá Bis, PayPal, Stripe y claves de webhook de SoundMap.

---

### 3. Mapa de Arquitectura del Software

```
 backend/
 ├── config/                     # Configuración central Django
 │   ├── settings/               # Modular: base.py, production.py, local_qa.py
 │   ├── urls.py                 # Enrutador principal de API v1
 │   └── wsgi.py / asgi.py
 ├── core/                       # Utilidades transversales
 │   ├── admin_permissions.py    # RBAC: IsAdminOrStaff, IsSuperUser
 │   ├── pagination.py           # StandardResultsSetPagination
 │   └── views.py                # MediaProxyView, HealthCheck
 └── apps/
     ├── users/                  # CustomUser, Perfil, Direcciones, SSO SoundMap
     ├── products/               # Producto, Categoría, Marca, Kit/Bundle, Comparador
     ├── orders/                 # Order, OrderItem, Carrito, Pedidos Especiales
     ├── payments/               # Pasarelas, Webhooks, BankAccount, Idempotencia
     ├── billing/                # TributaryDocument (SII), Cotizaciones B2B, Couriers
     ├── analytics/              # IncomeRecord, Distribución de costos, Margen
     ├── loyalty/                # Puntos, Tiers (Bronce/Plata/Oro/Platino), Historial
     ├── rewards/                # Sorteos comerciales, Tickets, Sorteo verificable
     ├── academy/                # Cursos, Módulos, Lecciones, Inscripciones
     ├── services/               # Consultoría pro audio, Agendamiento, Briefing
     ├── site_settings/          # Banners, Hero, Anuncios, Personalización UI
     └── seo/                    # Generación dinámica de sitemap.xml y metadatos
```

---

### 4. Inventario de Modelos de Base de Datos y Relaciones

El esquema relacional cuenta con 38 tablas principales interconectadas:

| App Django | Modelo Principal | Relaciones Clave | Propósito Operativo |
| :--- | :--- | :--- | :--- |
| **users** | `CustomUser` | 1:1 `LoyaltyProfile`, 1:N `Order`, 1:N `Address` | Identidad, autenticación, RBAC (`is_staff`, `role`). |
| **products** | `Product` | 1:N `ProductImage`, N:M `BundleItem`, 1:1 opt `Course` | Catálogo maestro de hardware, software y kits. |
| **products** | `Category`, `Brand` | 1:N con `Product` | Taxonomía de marcas pro audio y jerarquía de catálogo. |
| **orders** | `Order` | 1:N `OrderItem`, 1:N `Payment`, 1:1 opt `TributaryDocument` | Máquina de estados del pedido (Pending → Paid → Shipped). |
| **orders** | `SpecialOrder` | N:M `Product`, 1:1 `CustomUser` | Solicitudes de equipamiento bajo pedido e importación. |
| **payments** | `Payment` | N:1 `Order`, 1:1 opt `BankAccount` | Transacción de cobro, gateway tracking, idempotencia. |
| **payments** | `BankAccount` | 1:N `Payment` (Transferencia) | Cuentas bancarias oficiales (CLP: Banco de Chile, ARS: Santander Río). |
| **billing** | `TributaryDocument` | 1:1 `Order` | Registro de documento tributario chileno (Boleta/Factura SII). |
| **billing** | `B2BQuote` | 1:N `B2BQuoteItem`, 1:1 opt `Order` | Cotizador mayorista B2B y conversión a orden de compra. |
| **analytics** | `IncomeRecord` | 1:1 `Order`, 1:N `IncomeDistribution` | Asignación financiera de ingresos, costos directos y márgenes. |
| **analytics** | `DistributionCategory` | 1:N `IncomeDistribution` | Categorías de distribución (Cost of Goods, Logística, Marketing). |
| **loyalty** | `LoyaltyProfile` | 1:1 `CustomUser`, 1:N `LoyaltyTransaction` | Saldo de puntos LP, nivel de membresía y multiplicadores. |
| **rewards** | `RewardsCampaign` | 1:N `RewardsEntry`, 1:N `RewardsWinner` | Campañas comerciales de sorteos y asignación de números. |
| **academy** | `Course` | 1:N `CourseModule`, 1:N `Enrollment` | Cursos profesionales de sonido, mezcla y producción. |
| **services** | `ProfessionalService` | 1:N `ServiceBooking` | Servicios técnicos (Acondicionamiento, calibración, mezcla). |
| **site_settings**| `SiteSettings` | Singleton | Personalización de banners, alertas y switches de pasarelas. |

---

### 5. Estado de Pasarelas de Pago y Aislamiento Multi-Moneda

La plataforma procesa cobros en tres monedas independientes sin mezclar saldos contables ni realizar conversiones automáticas impredecibles:

1. **CLP (Peso Chileno):**
   - **Webpay Plus (Transbank):** Tokenización y redirección oficial certificada.
   - **Mercado Pago Chile:** Checkout API con Webhook HMAC SHA-256 verificado.
   - **Transferencia Bancaria Directa:** Cuenta Corriente Banco de Chile validada en `/api/v1/payments/methods/`.
2. **USD (Dólar Estadounidense):**
   - **PayPal SDK / Orders API v2:** Integración internacional para clientes fuera del Cono Sur.
   - **Stripe Elements:** Procesamiento seguro de tarjetas de crédito internacionales.
3. **ARS (Peso Argentino):**
   - **Mercado Pago Argentina:** Soporte nativo de checkout regional.
   - **Ualá Bis:** Integración con checkout link y validación de orden en ARS.
   - **Transferencia Bancaria (CBU / Alias):** Cuenta Banco Santander Río Argentina registrada y certificada.

---

### 6. Paridad y Validación con Producción

La sincronización entre el repositorio local, la rama remota `main` y la versión en producción (`levelproaudio.com`) fue verificada empíricamente en el Gate 0:

- **Commit en Producción:** `e33f699` (*"fix(v3.5): complete post-deployment audit remediation"*)
- **Endpoints Validados en Vivo:**
  - `GET https://levelproaudio.com/api/v1/courses/` → Retorna HTTP 200 con 3 cursos profesionales activos.
  - `GET https://levelproaudio.com/api/v1/payments/methods/` → Retorna HTTP 200 con cuentas bancarias CLP y ARS activas.
  - `GET https://levelproaudio.com/api/v1/products/compare/?ids=invalid-id` → Retorna HTTP 400 Bad Request validado.
  - Redirección con parámetro `?next=` en autenticación → Verificado en bundles minificados del frontend.
- **Diferencial entre `main` y Producción:** **0 commits de desfase.** El entorno está completamente estabilizado y listo para la formulación arquitectónica de V4.0.

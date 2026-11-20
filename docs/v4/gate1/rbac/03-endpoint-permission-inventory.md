# LEVELPRO OS V4.0 — GATE 1.1: ENDPOINT PERMISSION INVENTORY
## Documento 03: Inventario Exhaustivo de Endpoints, Verbos HTTP y Controles de Acceso

**Estado:** Certificado  
**Versión:** 1.0  
**Fecha:** 20 de Noviembre, 2026  
**Ambiente:** LEVELPRO OS V4.0 Production Baseline  

---

### 1. Endpoints de Autenticación y Autorización (`/api/v1/auth/`)

| Endpoint | Método | Permiso Requerido | Módulo RBAC | Capacidad Sensible | Descripción / Serializer |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `/api/v1/auth/csrf/` | `GET` | AllowAny | — | — | Obtención de cookie `csrftoken` HTTPOnly |
| `/api/v1/auth/register/` | `POST` | AllowAny | — | — | Registro de nuevos clientes |
| `/api/v1/auth/login/` | `POST` | AllowAny | — | — | Autenticación y seteo de cookies JWT |
| `/api/v1/auth/logout/` | `POST` | AllowAny | — | — | Invalidación y revocación de cookies |
| `/api/v1/auth/profile/` | `GET`, `PATCH` | IsAuthenticated | — | — | Perfil del usuario autenticado |
| `/api/v1/auth/me/permissions/` | `GET` | IsAuthenticated | — | — | Permisos efectivos, roles y módulos del usuario |

---

### 2. Endpoints Administrativos y RBAC (`/api/v1/admin/`)

| Endpoint | Método | Permiso Base | Módulo RBAC | Capacidad Sensible | Protección de Datos / Serializer |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `/api/v1/admin/dashboard/` | `GET` | IsAdminOrStaff | `dashboard` | — | Dashboard overview con KPIs reales |
| `/api/v1/admin/analytics/` | `GET` | IsAdminOrStaff | `dashboard` | — | Métricas de ventas y carritos |
| `/api/v1/admin/roles/` | `GET` | IsAdminOrStaff | `roles` | `manage_roles` | Resumen de los 10 roles empresariales |
| `/api/v1/admin/roles/<role_name>/` | `GET` | IsAdminOrStaff | `roles` | `manage_roles` | Detalle, capacidades y usuarios de un rol |
| `/api/v1/admin/users/<uuid>/roles/` | `GET`, `POST` | IsAdminOrStaff | `roles` | `manage_roles` | Asignación y revocación segura de roles |
| `/api/v1/admin/permissions/catalog/` | `GET` | IsAdminOrStaff | `roles` | `manage_roles` | Catálogo de módulos y capacidades |
| `/api/v1/admin/users/` | `GET` | IsAdminOrStaff | `dashboard` | — | Listado de clientes y staff con roles |
| `/api/v1/admin/users/<uuid>/` | `PATCH`, `DELETE` | IsAdminOrStaff | `roles` | `manage_roles` | Modificación de cuentas (solo superuser para staff) |
| `/api/v1/admin/products/` | `GET`, `POST` | IsAdminOrStaff | `catalog` | `edit_costs` (W) | `AdminProductDetailSerializer` (enmascara `cost_price`) |
| `/api/v1/admin/products/<uuid>/` | `GET`, `PATCH`, `DELETE` | IsAdminOrStaff | `catalog` | `edit_costs` (W) | Enmascara costos; rechaza escritura no autorizada |
| `/api/v1/admin/categories/` | `GET`, `POST` | IsAdminOrStaff | `catalog` | — | Categorías de catálogo |
| `/api/v1/admin/brands/` | `GET`, `POST` | IsAdminOrStaff | `catalog` | — | Marcas de equipamiento pro audio |
| `/api/v1/admin/inventory/summary/` | `GET` | IsAdminOrStaff | `inventory` | — | Valorización de existencias |
| `/api/v1/admin/orders/` | `GET` | IsAdminOrStaff | `orders` | — | Listado de órdenes transaccionales |
| `/api/v1/admin/orders/<uuid>/` | `GET`, `PATCH` | IsAdminOrStaff | `orders` | — | Detalle y despacho de pedidos |
| `/api/v1/admin/finance/summary/` | `GET` | IsAdminOrStaff | `finances` | `view_finances` | Resumen financiero multi-moneda |
| `/api/v1/admin/finance/categories/` | `GET`, `POST` | IsAdminOrStaff | `finances` | `view_finances` | Categorías de distribución de ingresos |
| `/api/v1/admin/finance/withdrawals/` | `GET`, `POST` | IsAdminOrStaff | `finances` | `view_finances` | Retiros y egresos de tesorería |
| `/api/v1/admin/finance/by-product/` | `GET` | IsAdminOrStaff | `finances` | `view_finances` | Rentabilidad y costos por producto |
| `/api/v1/admin/academy/courses/` | `GET`, `POST` | IsAdminOrStaff | `academy` | — | Cursos de academia |
| `/api/v1/admin/academy/modules/` | `GET`, `POST` | IsAdminOrStaff | `academy` | — | Módulos curriculares |
| `/api/v1/admin/academy/lessons/` | `GET`, `POST` | IsAdminOrStaff | `academy` | — | Lecciones y videos |
| `/api/v1/admin/academy/enrollments/` | `GET`, `POST` | IsAdminOrStaff | `academy` | — | Inscripciones académicas |
| `/api/v1/admin/services/` | `GET`, `POST` | IsAdminOrStaff | `services` | — | Servicios profesionales y agendamiento |
| `/api/v1/admin/rewards/` | `GET` | IsAdminOrStaff | `marketing` | — | Campañas y sorteos Rewards |

---

### 3. Mecanismos de Transición para Endpoints No Etiquetados

Para endpoints administrativos preexistentes que aún no hayan sido etiquetados explícitamente con un módulo RBAC:
- **Super Admin:** Mantiene acceso irrestricto e ininterrumpido.
- **Staff con rol empresarial:** Mantiene acceso si pertenece a un rol operativo válido.
- **Staff legacy sin rol asignado:** Mantiene acceso operativo de transición a módulos comunes, pero tiene **bloqueado por defecto el acceso a finanzas y roles de seguridad**, garantizando que ninguna cuenta legacy no auditada pueda acceder a datos bancarios o escalar privilegios.

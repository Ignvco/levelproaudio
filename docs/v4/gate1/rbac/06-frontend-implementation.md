# LEVELPRO OS V4.0 — GATE 1.1: FRONTEND IMPLEMENTATION
## Documento 06: Implementación de la Interfaz de Seguridad Administrativa (Bento UI)

**Estado:** Certificado  
**Versión:** 1.0  
**Fecha:** 20 de Noviembre, 2026  
**Ambiente:** React 19.3.1 / Vite 8.3.5 / Editorial Bento / Geist & Geist Mono  

---

### 1. Resumen de Componentes y Vistas Desarrolladas

Para dar soporte visual y operativo al modelo RBAC en el panel de LEVELPRO OS V4.0, se crearon y actualizaron los siguientes artefactos frontend:

1. **Cliente API RBAC (`frontend/src/api/rbac.api.js`):**
   - `getMyPermissions()`: Consulta los permisos y roles efectivos del operador actual (`GET /api/v1/auth/me/permissions/`).
   - `getAdminRoles()`: Obtiene el consolidado de roles empresariales (`GET /api/v1/admin/roles/`).
   - `getAdminRoleDetail(roleName)`: Obtiene la especificación completa y usuarios de un rol (`GET /api/v1/admin/roles/{role}/`).
   - `manageUserRole(userId, role, action)`: Asignación o revocación de roles (`POST /api/v1/admin/users/{id}/roles/`).
   - `getPermissionsCatalog()`: Catálogo maestro de 12 módulos y 11 capacidades (`GET /api/v1/admin/permissions/catalog/`).

2. **Página de Roles y Permisos (`frontend/src/pages/admin/AdminRoles.jsx`):**
   - KPI Strip con 4 métricas maestras: Roles Oficiales (10), Capacidades Sensibles (11), Módulos (12), Usuarios Staff Asignados.
   - Pestaña 1: **Roles Empresariales (Bento Grid):** Tarjetas con estética Bento, tono visual por criticidad, badges de módulos y capacidades, conteo de usuarios y botón de inspección detallada.
   - Pestaña 2: **Matriz de Permisos 360°:** Tabla interactiva de alta densidad con cruce de 10 roles vs. capacidades sensibles protegidas y checkmarks verde oficial `#1AFF6E`.
   - Modal de Detalle de Rol: Muestra descripción ejecutiva, módulos habilitados, capacidades sensibles autorizadas y el listado de usuarios activos pertenecientes al rol.

3. **Evolución de la Gestión de Usuarios (`frontend/src/pages/admin/AdminUsers.jsx`):**
   - Nueva columna de **Roles y Acceso** que renderiza los roles asignados mediante `StatusBadge` con código cromático corporativo.
   - Botón de acción **Roles** en cada fila para abrir el modal de asignación y revocación segura.
   - Filtro reactivo en la tabla que permite filtrar tanto por roles base (Clientes, Staff) como por cada rol específico de la organización.
   - Retroalimentación visual inmediata ante intentos de escalada no autorizados (mensajes de error de API capturados y renderizados sin recarga).

4. **Navegación Dinámica Filtrada (`frontend/src/layouts/AdminLayout.jsx`):**
   - Cada grupo de navegación (`navGroups`) y cada enlace hijo fueron etiquetados con su correspondiente identificador de módulo (`module`).
   - Hook de consulta `useQuery(["my-permissions"])` calcula la lista de módulos permitidos para el operador autenticado.
   - Si el operador carece de permiso para un módulo, el enlace es removido automáticamente del menú desktop (pills) y del cajón móvil (drawer), garantizando que no se visualicen secciones inaccesibles.

---

### 2. Cumplimiento de Lineamientos de Diseño

- **Tipografías:** `var(--font-sans)` (Geist) para jerarquía de títulos y etiquetas; `var(--font-mono)` (Geist Mono) para codenames de permisos, correos electrónicos y cifras numéricas.
- **Colorimetría Oficial:**
  - Verde Corporativo: `#1AFF6E` (Checkmarks de matriz, badges de capacidades autorizadas).
  - Escala Bento Oscura: Fondos `var(--admin-surface)`, bordes `var(--admin-border)`.
  - Tonalidades de Alerta: `#FF4444` (Super Admin / Alertas de seguridad), `#FFB800` (Finanzas y Gerencia).
- **Responsividad Certificada:**
  - Móvil (320px - 390px): Las tarjetas de roles se apilan fluidamente en una columna; modales con `maxWidth: 100%` y scroll interno.
  - Tablet (768px): Grilla Bento de 2 columnas.
  - Desktop (1280px+): Grilla Bento de 3 columnas; tabla de matriz de permisos completa visible sin recorte horizontal.
- **Preservación del Bundle:**
  - Tamaño inicial comprimido: `143.89 KB gzip` (muy por debajo del límite estricto de 200 KB).

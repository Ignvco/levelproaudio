# 04 — ROLE LIFECYCLE SECURITY & SUPER ADMIN PROTECTION
## LEVELPRO OS V4.0 — PATCH 1.1.1 (RBAC HARDENING & FINAL ACCEPTANCE)

---

## 1. POLÍTICA ÚNICA DE AUTORIDAD: `is_superuser`, `is_staff`, `Super Admin` Y ROLES DE NEGOCIO

Para eliminar toda ambigüedad entre los flags nativos de Django y el modelo RBAC de LEVELPRO OS V4.0, PATCH 1.1.1 establece una **política única e invariante** implementada en `backend/core/rbac/permissions.py` y `backend/core/rbac/services.py`:

| Condición del Usuario en Base de Datos | `is_effective_super_admin` | Roles Efectivos (`get_user_roles`) | Módulos y Capacidades Efectivas | Acceso a `/api/v1/admin/*` |
|---|---|---|---|---|
| `is_active=False` (incluso con `is_superuser=True`) | `False` | `[]` | `0` módulos, `0` capacidades | **DENEGADO (`403 Forbidden`)** |
| `is_active=True`, `is_superuser=True` | `True` | `["Super Admin", ...]` | `12` módulos, `12` capacidades, `7` acciones | **AUTORIZADO (Control Total)** |
| `is_active=True`, `is_staff=True`, con 1+ roles en `ALL_ROLES` | `False` (salvo rol `Super Admin` que sincroniza `is_superuser=True`) | Lista de roles asignados | Unión estricta de `modules`, `capabilities` y `module_actions` de sus roles | **AUTORIZADO SOLO EN SUS MÓDULOS Y ACCIONES** |
| `is_active=True`, `is_staff=True`, **sin roles en `ALL_ROLES`** (staff legacy) | `False` | `[]` | `0` módulos, `0` capacidades, `0` acciones | **DENEGADO POR DEFECTO (`403 Forbidden`)** |
| `is_active=True`, `is_staff=False`, `is_superuser=False` (cliente) | `False` | `[]` | `0` módulos, `0` capacidades, `0` acciones | **DENEGADO (`403 Forbidden`)** |

### Sincronización Atómica de Flags en Asignación y Revocación
- **Al asignar cualquier rol oficial (`assign_role_to_user`):**
  - Se activa `is_staff = True` automáticamente.
  - Si el rol asignado es `Super Admin`, se sincroniza `is_superuser = True` (operación permitida únicamente a un `Super Admin` activo).
- **Al revocar un rol (`remove_role_from_user`):**
  - Si el rol revocado es `Super Admin`, se sincroniza `is_superuser = False`.
  - Si tras la revocación el usuario queda con `remaining_roles == []` y no es superusuario, se sincroniza **`is_staff = False`** atómicamente y se invalidan sus tokens JWT activos (`OutstandingToken` -> `BlacklistedToken`).
  - Esto garantiza que un usuario cuyo rol fue revocado **jamás pueda caer en un estado de "staff sin rol"** ni recuperar acceso por ninguna ruta legacy.

---

## 2. VERIFICACIÓN EN VIVO DE SESIONES ABIERTAS (`_resolve_live_user`)

Para impedir que un usuario desactivado o cuyo rol fue revocado continúe operando con un token JWT previamente emitido o una instancia de usuario cacheada en memoria:
1. Cada evaluación de `IsAdminOrStaff`, `RBACPermission`, `get_user_effective_permissions`, `user_has_module_access`, `user_has_module_action` y `user_has_capability` invoca `_resolve_live_user(user)`.
2. `_resolve_live_user` ejecuta una lectura ligera por clave primaria (`User.objects.filter(pk=user.pk).only("id", "is_active", "is_staff", "is_superuser").first()`) contra PostgreSQL.
3. Si el usuario fue desactivado (`is_active=False`) o su último rol fue revocado (`is_staff=False`), la petición en curso se rechaza inmediatamente con `403 Forbidden` en el mismo milisegundo, sin esperar a la expiración del JWT.

---

## 3. SEGREGACIÓN DE FUNCIONES (SoD — SEGREGATION OF DUTIES)

En `backend/core/rbac/constants.py` se define la matriz de incompatibilidad de roles (`INCOMPATIBLE_ROLE_PAIRS`) para evitar que un mismo operador controle simultáneamente el origen comercial/físico de una operación y su conciliación o aprobación financiera:

- `(Ventas, Finanzas / Contabilidad)` — Un vendedor no puede aprobar sus propios pagos ni conciliar sus ingresos.
- `(Compras, Finanzas / Contabilidad)` — Un comprador no puede aprobar ni liberar retiros financieros.
- `(Bodega, Finanzas / Contabilidad)` — Un operador de inventario físico no puede conciliar saldos ni retiros financieros.

`assign_role_to_user` bloquea la fila del usuario con `select_for_update()` y verifica `INCOMPATIBLE_ROLE_PAIRS`, rechazando cualquier combinación incompatible con `ValidationError` (HTTP `400 Bad Request`).

---

## 4. PROTECCIÓN CONCURRENTE DEL ÚLTIMO SUPER ADMIN ACTIVO

El último `Super Admin` activo está protegido contra eliminación, desactivación o degradación en **todos los puntos de mutación posibles**:

1. **API de Revocación de Roles (`POST /api/v1/admin/users/<id>/roles/` -> `remove_role_from_user`):**
   - Abre `@transaction.atomic`, obtiene los PKs de todos los Super Admins activos y adquiere un bloqueo pesimista determinista `User.objects.select_for_update().filter(pk__in=super_pks, is_active=True).order_by("id")`.
   - Si `len(active_supers) <= 1` y el usuario objetivo es ese único Super Admin activo, aborta con `ValidationError("No se puede revocar el rol al único Super Admin activo del sistema.")` (HTTP `400`).
2. **API de Detalle de Usuario (`PATCH / DELETE /api/v1/admin/users/<id>/` -> `admin_user_detail`):**
   - Bloquea la auto-modificación/auto-eliminación (`user.id == request.user.id` -> HTTP `403`).
   - Bloquea con `select_for_update()` la desactivación (`is_active=False`) si `remaining_supers == 0` (HTTP `400`).
   - Bloquea siempre el `DELETE` de cualquier cuenta `Super Admin` por API (HTTP `403`).
3. **Panel Nativo Django Admin (`backend/apps/users/admin.py` -> `UserAdmin`):**
   - `get_readonly_fields`: Oculta la edición de `is_superuser`, `is_staff`, `groups` y `user_permissions` a cualquier usuario que no sea `is_superuser=True` activo.
   - `has_change_permission` / `has_delete_permission`: Impide a no-superusuarios editar o borrar cuentas de superusuarios, e impide borrar al último superusuario activo.
   - `save_model`: Impide guardar `is_active=False` o `is_superuser=False` sobre el último superusuario activo.

---

## 5. IDEMPOTENCIA NO DESTRUCTIVA DE `setup_rbac`

El comando `backend/apps/users/management/commands/setup_rbac.py` fue rediseñado para ser **100% seguro e idempotente en cualquier entorno**:
- **Por defecto (`python manage.py setup_rbac`):**
  - Crea o actualiza los 12 permisos sensibles en `ContentType(User)`.
  - Crea los 10 grupos oficiales si no existen y **agrega** (`group.permissions.add(*perms_to_add)`) los permisos de la matriz base **sin borrar permisos personalizados adicionales** que pudieran haberse asignado a un grupo.
  - **No modifica ninguna cuenta de usuario real** (`0` usuarios alterados).
- **Flags explícitos opcionales:**
  - `--reset-defaults`: Reemplaza exactamente los permisos de cada grupo por los de `DEFAULT_ROLE_MATRIX` (`group.permissions.set(perms_to_add)`).
  - `--sync-superusers`: Vincula a las cuentas con `is_superuser=True, is_active=True` al grupo `Super Admin`.

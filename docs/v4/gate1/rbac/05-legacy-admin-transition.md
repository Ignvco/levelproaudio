# LEVELPRO OS V4.0 — GATE 1.1 (PATCH 1.1.1): LEGACY ADMIN TRANSITION
## Documento 05: Política de Transición con Denegación por Defecto (Zero Trust)

**Estado:** Certificado (Rectificado en PATCH 1.1.1)  
**Versión:** 1.1.1  
**Fecha:** 20 de Noviembre, 2026  

---

### 1. Eliminación de Rutas Permisivas Legacy

En PATCH 1.1.1 se eliminaron definitivamente las rutas permisivas de coexistencia en `IsAdminOrStaff` (`backend/core/admin_permissions.py`) y `RBACPermission` (`backend/core/rbac/permissions.py`):

1. **Denegación por Defecto en Recursos No Clasificados:** Si una vista administrativa que utiliza `IsAdminOrStaff` o `RBACPermission` no declara clasificación RBAC explícita (`rbac_module`, `rbac_allowed_modules`, `rbac_capability`, `rbac_capability_by_method`, `rbac_allowed_roles`, `rbac_allowed_roles_by_method`), `evaluate_admin_rbac_permission(request, view)` retorna **`False`** para todo usuario no-superusuario.
2. **`is_staff=True` NUNCA es un Bypass de Seguridad:** Un usuario con `is_staff=True` que no posea al menos un rol oficial de `ALL_ROLES` recibe `0` módulos, `0` capacidades y `403 Forbidden` en el 100% de los endpoints administrativos.
3. **Pertenecer a un Grupo NO es Autorización Universal:** Poseer un rol solo autoriza los módulos, acciones granulares (`read`, `create`, `update`, `delete`, `export`, `import`, `approve`) y capacidades explícitamente asignadas a ese rol en `DEFAULT_ROLE_MATRIX`.
4. **Revocación sin Fallback Legacy:** Al revocar el último rol de un usuario en `remove_role_from_user`, el sistema sincroniza atómicamente `is_staff = False` e invalida sus tokens JWT activos (`OutstandingToken`), impidiendo cualquier recuperación de acceso.

Ver especificación completa en:
- `docs/v4/gate1/rbac/hardening/00-findings-and-remediation.md`
- `docs/v4/gate1/rbac/hardening/02-effective-permissions-matrix.md`
- `docs/v4/gate1/rbac/hardening/04-role-lifecycle-security.md`

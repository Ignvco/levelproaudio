# LEVELPRO OS V4.0 — GATE 1.1: LEGACY ADMIN TRANSITION
## Documento 05: Estrategia de Convivencia y Transición del Administrador Legacy

**Estado:** Certificado  
**Versión:** 1.0  
**Fecha:** 20 de Noviembre, 2026  
**Ambiente:** LEVELPRO OS V4.0 Production Baseline  

---

### 1. Desafío de Transición y Coexistencia

Previo a LEVELPRO OS V4.0, la autorización administrativa descansaba en los flags booleanos de Django `is_staff` e `is_superuser`:
- Si un usuario tenía `is_staff=True`, la clase `IsAdminOrStaff` le otorgaba acceso a casi cualquier vista administrativa en `/api/v1/admin/`.
- No existía diferenciación entre un operador de bodega y un gestor comercial o financiero.

La misión de Gate 1.1 exigía introducir **RBAC granular sin romper los flujos existentes** de los administradores actuales ni bloquear las operaciones de producción.

---

### 2. Mecanismo de Coexistencia Implementado

La clase `IsAdminOrStaff` (`backend/core/admin_permissions.py`) fue refactorizada para implementar una lógica de transición por capas:

```python
class IsAdminOrStaff(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False

        # 1. Super Admin activo tiene bypass irrestricto
        if user.is_superuser:
            return True

        # 2. Clientes estándar son denegados de inmediato
        if not user.is_staff:
            return False

        # 3. Si la vista especifica un módulo RBAC, validar pertenencia
        required_module = getattr(view, "rbac_module", None)
        if required_module:
            if not user_has_module_access(user, required_module):
                return False

        # 4. Si la vista especifica una capacidad sensible, validar explícitamente
        required_capability = getattr(view, "rbac_capability", None)
        if required_capability:
            if not user_has_capability(user, required_capability):
                return False

        # 5. Usuario con roles asignados: acceso concedido
        roles = get_user_roles(user)
        if roles:
            return True

        # 6. Usuario staff legacy sin rol asignado:
        # Acceso restringido por defecto a finanzas y roles
        from core.rbac.constants import MODULE_FINANCES, MODULE_ROLES
        if required_module in (MODULE_FINANCES, MODULE_ROLES):
            return False

        return True
```

---

### 3. Garantías de Seguridad de la Transición

1. **Protección de Datos Financieros:** Cualquier cuenta de staff que no haya sido migrada o aprovisionada formalmente con un rol de finanzas o superusuario queda automáticamente bloqueada de `/api/v1/admin/finance/*`.
2. **Protección Contra Elevación de Privilegios:** Ningún staff legacy puede crear otros usuarios staff, modificar contraseñas de superusuarios o acceder a los endpoints de gestión de roles.
3. **Idempotencia en el Aprovisionamiento (`setup_rbac`):**
   - El comando `python manage.py setup_rbac` puede ejecutarse de forma segura en cualquier momento.
   - Detecta superusuarios existentes y les asigna automáticamente el rol `Super Admin`.
   - Crea los 10 grupos y las 11 capacidades sin alterar relaciones previas de usuarios.

---

### 4. Hoja de Ruta para Desactivación de Flags Legacy

- **Fase I (Gate 1.1 — Actual):** Coexistencia híbrida con denegación de módulos críticos para staff no asignado.
- **Fase II (Gates 2 al 6):** Asignación progresiva de los 10 roles empresariales a la totalidad del personal operativo.
- **Fase III (Gate 13 — Admin Experience Unification):** Deprecación final de validaciones directas sobre `is_staff` a nivel de negocio, dejando `is_staff` únicamente como requisito de entrada al backend y delegando la totalidad de la lógica en los roles RBAC.

# LEVELPRO OS V4.0 — GATE 1.2 FINAL ACCEPTANCE
## 04. Verificación de Endpoints API, Segregación RBAC y Exportaciones Seguras

**Documento Rector:** `docs/v4/gate1/audit-trail/final-acceptance/04-rbac-api-and-exports-verification.md`  
**Rama Local:** `feature/v4-gate1-business-core`  
**Estado:** Certificado y Homologado

---

### 1. Los 5 Endpoints del Centro de Auditoría

Todos los endpoints se encuentran protegidos mediante `@rbac_endpoint` y autenticación estricta `IsAdminOrStaff`:

```
┌────────────────────────────────────────────────────────────────────────┐
│               ARQUITECTURA DE ENDPOINTS DE AUDITORÍA (REST)            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. GET /api/v1/admin/audit/events/                                    │
│     → Listado paginado con 12 filtros dinámicos. Segregación RBAC.    │
│                                                                        │
│  2. GET /api/v1/admin/audit/events/{id}/                               │
│     → Detalle forense y diff estructurado. 403 si falta capability.   │
│                                                                        │
│  3. GET /api/v1/admin/audit/summary/                                   │
│     → KPIs Bento y desglose por severidad/módulo sin eventos ocultos. │
│                                                                        │
│  4. GET /api/v1/admin/audit/catalog/                                   │
│     → Catálogo de taxonomía con etiquetas legibles en español.        │
│                                                                        │
│  5. GET /api/v1/admin/audit/events/export/                             │
│     → Descarga CSV blindada contra CWE-1236 y con auditoría activa.   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Matriz de Control de Acceso y Segregación por Rol

| Endpoint | Rol Super Admin | Rol Management | Rol Finance | Otros Roles (Sales, Warehouse) |
|---|---|---|---|---|
| **Listado (`/events/`)** | Acceso total a todos los eventos | Acceso a auditoría operativa (seguridad excluida) | Acceso a auditoría financiera/operativa (seguridad excluida) | 403 Denegado por defecto |
| **Detalle (`/events/{id}/`)** | Acceso total y diff sin enmascarar | Enmascaramiento según permisos; 403 en eventos de seguridad | Enmascaramiento según permisos; 403 en eventos de seguridad | 403 Denegado por defecto |
| **Resumen (`/summary/`)** | KPIs calculados sobre el 100% de la BD | KPIs excluyen eventos de seguridad automáticamente | KPIs excluyen eventos de seguridad automáticamente | 403 Denegado por defecto |
| **Catálogo (`/catalog/`)** | Lectura autorizada | Lectura autorizada | Lectura autorizada | 403 Denegado por defecto |
| **Export CSV (`/export/`)** | Descarga autorizada (audita export) | Descarga autorizada (audita export) | Descarga autorizada (audita export) | 403 Denegado por defecto |

---

### 3. Enmascaramiento Dinámico de Datos Financieros

En el serializador `_serialize_audit_event()`, los campos de costos (`cost_price`), márgenes y montos de retiro se filtran en tiempo de ejecución:

```python
def _serialize_audit_event(event: AuditEvent, user):
    can_finances = _can_view_financials(user)
    can_costs = is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_COSTS) or can_finances
    can_margins = is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_MARGINS) or can_finances

    masked_prev = mask_payload_financial_data(
        event.previous_values or {},
        can_view_costs=can_costs,
        can_view_margins=can_margins,
        can_view_finances=can_finances,
    )
    # ...
```

Si el usuario carece de `view_costs` o `view_finances`, cualquier valor en `previous_values` o `new_values` correspondiente a costos se sustituye por `"[RESTRINGIDO]"`, preservando la visibilidad del resto de campos (por ejemplo, `stock` permanece visible). Certificado con `test_audit_api_rbac_dynamic_financial_field_masking`.

---

### 4. Mitigación de Inyección de Fórmulas CSV (CWE-1236)

Para proteger a los administradores de ataques vía archivos CSV abiertos en hojas de cálculo, se implementó `sanitize_csv_cell()` en `core/audit/sanitizer.py`:

```python
def sanitize_csv_cell(value) -> str:
    """
    Previene inyección de fórmulas CSV (CWE-1236 / Formula Injection).
    Si el valor comienza con '=', '+', '-', '@', tab o retorno de carro,
    antepone una comilla simple (') para forzar interpretación como texto plano.
    """
    if value is None:
        return ""
    val_str = str(value)
    if val_str and val_str[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{val_str}"
    return val_str
```

#### Evidencia de Prueba Automatizada (`test_csv_formula_injection_prevention`)
- **Entrada Maliciosa:** `resource_id="=cmd|'/C calc'!A0"`, `resource_repr="@SUM(1+1)"`, `actor_email="+admin@malicious.com"`, `actor_username="=1+1"`.
- **Salida en CSV Exportado:**
  ```csv
  ID,Fecha UTC,Actor Email,Actor Username,Roles al Momento,Módulo,Acción,Categoría,Recurso Tipo,Recurso ID,Recurso Representación...
  ...,'+admin@malicious.com','=1+1,,catalog,PRICE_CHANGED,Cambio de Precio,Product,'=cmd|'/C calc'!A0,'@SUM(1+1)...
  ```
- **Resultado:** Las fórmulas son tratadas como texto inofensivo por Excel y LibreOffice. Prueba superada exitosamente.

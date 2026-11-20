# LEVELPRO OS V4.0 — GATE 1.2: AUDIT TRAIL & ACTIVITY LOG
## DOCUMENTO TÉCNICO 06: ESPECIFICACIÓN FORMAL DE LA API REST DE AUDITORÍA

---

### 1. RESUMEN DE ENDPOINTS

El módulo de auditoría expone cinco endpoints bajo el prefijo `/api/v1/admin/audit/`:

| Endpoint | Método | Capacidad RBAC Requerida | Roles Autorizados | Descripción |
|---|---|---|---|---|
| `/api/v1/admin/audit/events/` | `GET` | `view_audit` | Super Admin, Gerencia, Finanzas | Listado paginado y filtrado de eventos. |
| `/api/v1/admin/audit/events/{id}/` | `GET` | `view_audit` | Super Admin, Gerencia, Finanzas | Detalle forense y diff de estado. |
| `/api/v1/admin/audit/summary/` | `GET` | `view_audit` | Super Admin, Gerencia, Finanzas | KPIs consolidados para el Activity Center. |
| `/api/v1/admin/audit/catalog/` | `GET` | `view_audit` | Super Admin, Gerencia, Finanzas | Catálogo de taxonomía y etiquetas legibles. |
| `/api/v1/admin/audit/events/export/` | `GET` | `export_audit` | Super Admin, Gerencia, Finanzas | Exportación a archivo CSV en tiempo real. |

---

### 2. DETALLE DE ENDPOINTS

#### 2.1. Listado de Eventos: `GET /api/v1/admin/audit/events/`

##### Parámetros de Consulta (Query Params):
- `page` *(int, default=1)*: Número de página.
- `page_size` *(int, default=25, min=5, max=100)*: Tamaño de página.
- `search` *(str)*: Búsqueda libre en `actor_email`, `actor_username`, `resource_repr`, `resource_id` y `action`.
- `module` *(str)*: Filtrar por código de módulo (ej. `catalog`, `orders`, `finances`).
- `event_category` o `category` *(str)*: Filtrar por categoría taxonómica.
- `severity` *(str)*: `info`, `warning`, `critical`.
- `result` *(str)*: `success`, `denied`, `error`.
- `actor` *(str)*: Email o username del actor.
- `role` *(str)*: Rol activo del actor.
- `correlation_id` *(str)*: UUID de correlación de la solicitud.
- `date_from` / `date_to` *(ISO 8601)*: Rango temporal.

##### Respuesta Exitosa (200 OK):
```json
{
  "count": 142,
  "total_pages": 6,
  "current_page": 1,
  "page_size": 25,
  "results": [
    {
      "id": "e1f0718f-a034-404a-81d1-750b9f5d9aa4",
      "created_at": "2026-11-20T19:45:00.123456Z",
      "actor": {
        "id": "u-1",
        "email": "gerencia@levelpro.cl",
        "username": "gerencia",
        "type": "staff",
        "roles": ["Gerencia / Administración"]
      },
      "module": "catalog",
      "action": "PRICE_CHANGED",
      "event_category": "price_change",
      "category_label": "Cambio de Precio de Venta",
      "resource_type": "Product",
      "resource_id": "421",
      "resource_repr": "Shure SM7B Vocal Dynamic Microphone",
      "result": "success",
      "result_label": "Exitoso",
      "severity": "info",
      "severity_label": "Información",
      "previous_values": { "price": "429990.00" },
      "new_values": { "price": "459990.00" },
      "changed_fields": ["price"],
      "correlation_id": "a6b107ec-d278-43bb-a801-b54133497d51",
      "source": "api",
      "ip_address": "192.168.1.105",
      "user_agent": "Mozilla/5.0 ...",
      "metadata": {},
      "schema_version": 1,
      "financial_masked": false
    }
  ]
}
```

---

#### 2.2. Detalle Forense: `GET /api/v1/admin/audit/events/{id}/`
Retorna el objeto completo del evento aplicando segregación especial:
- Si el evento pertenece a las categorías de seguridad (`role_permission`, `security_denied`, `privilege_escalation`) y el consultante NO posee `view_security_audit` (ni es Super Admin), retorna `HTTP 403 Forbidden`:
  ```json
  { "error": "No posee autorización (view_security_audit) para consultar este evento de seguridad." }
  ```
- Si el consultante carece de `view_costs` o `view_finances`, los campos protegidos en `previous_values` y `new_values` se retornan como `"[RESTRINGIDO]"` y `"financial_masked": true`.

---

#### 2.3. Métricas y KPIs: `GET /api/v1/admin/audit/summary/`
Retorna agregaciones calculadas en tiempo real respetando la visibilidad del usuario:
```json
{
  "total_events": 142,
  "last_24h_count": 38,
  "warning_count": 12,
  "critical_count": 2,
  "modules_active_count": 8,
  "events_by_severity": { "info": 128, "warning": 12, "critical": 2 },
  "events_by_result": { "success": 136, "denied": 4, "error": 2 }
}
```

---

#### 2.4. Catálogo de Taxonomía: `GET /api/v1/admin/audit/catalog/`
Proporciona la lista de categorías, severidades, resultados y módulos con etiquetas localizadas en español para alimentar selectores y filtros del frontend.

---

#### 2.5. Exportación a CSV: `GET /api/v1/admin/audit/events/export/`
- **Cabeceras de Respuesta**:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="audit_log_20261120_194500.csv"`
- **Columnas Exportadas**: `ID`, `Fecha/Hora`, `Actor Email`, `Actor Roles`, `Módulo`, `Acción`, `Categoría`, `Recurso Tipo`, `Recurso ID`, `Recurso`, `Resultado`, `Severidad`, `Campos Modificados`, `Valores Previos`, `Valores Nuevos`, `Correlation ID`, `IP`, `User Agent`.
- **Efecto Colateral Obligatorio**: Cada exportación genera inmediatamente un evento de auditoría de categoría `export` (`AUDIT_LOG_EXPORTED`), garantizando trazabilidad de quién descargó la información forense.

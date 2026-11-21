# LEVELPRO OS V4.0 — GATE 1.1: SENSITIVE DATA PROTECTION
## Documento 04: Protección de Datos Sensibles, Enmascaramiento y Serializadores

**Estado:** Certificado  
**Versión:** 1.0  
**Fecha:** 20 de Noviembre, 2026  
**Ambiente:** LEVELPRO OS V4.0 Production Baseline  

---

### 1. Principio Rector: Seguridad a Nivel de Serializador

En la arquitectura de LEVELPRO OS V4.0, la protección de campos sensibles no depende únicamente de vistas o plantillas de interfaz de usuario. Se implementa en la **capa de serialización del backend** mediante el mixin `SensitiveDataSerializerMixin` (`backend/core/rbac/mixins.py`).

Este mixin actúa bidireccionalmente:
1. **En Lectura (`to_representation`):** Si el usuario solicitante carece de la capacidad requerida (`view_costs`, `view_margins`, `view_finances`), los campos protegidos son eliminados del diccionario de salida antes de emitir la respuesta JSON.
2. **En Escritura (`to_internal_value`):** Si un cliente envía campos sensibles (`cost_price`, `price`, etc.) y el usuario carece de la capacidad de edición (`edit_costs`, `edit_prices`), la petición es rechazada de inmediato con `HTTP 400 Bad Request` o `HTTP 403 Forbidden`, impidiendo que los valores lleguen al modelo o a la base de datos.

---

### 2. Clasificación de Campos Sensibles Protegidos

#### Grupo A: Costos de Adquisición (`COST_FIELDS`)
- **Campos:** `cost_price`, `cost`, `supplier_cost`, `purchase_price`, `landed_cost`, `unit_cost`, `precio_costo`.
- **Capacidad de Lectura requerida:** `view_costs`
- **Capacidad de Escritura requerida:** `edit_costs`
- **Roles con Acceso de Lectura:** `Super Admin`, `Gerencia / Administración`, `Compras`, `Finanzas / Contabilidad`.
- **Roles con Acceso de Escritura:** `Super Admin`, `Compras`.
- **Comportamiento en Rol Ventas:** Enmascarado en lecturas (`cost_price` ausente). Rechazado con excepción en escrituras.

#### Grupo B: Márgenes y Utilidades (`MARGIN_FIELDS`)
- **Campos:** `margin`, `margin_percentage`, `gross_margin`, `net_margin`, `profit`, `markup`, `utilidad`.
- **Capacidad requerida:** `view_margins`
- **Roles con Acceso:** `Super Admin`, `Gerencia / Administración`, `Finanzas / Contabilidad`.

#### Grupo C: Datos Financieros y Agregados (`FINANCIAL_FIELDS`)
- **Campos:** `daily_revenue`, `withdrawals`, `balance`, `bank_account`, `bank_accounts`, `revenue`, `gross_sales`, `net_sales`, `monto_total_ventas`, `margen_total`.
- **Capacidad requerida:** `view_finances`
- **Roles con Acceso:** `Super Admin`, `Gerencia / Administración`, `Finanzas / Contabilidad`.

#### Grupo D: Precios de Venta (`PRICE_WRITE_FIELDS`)
- **Campos:** `price`, `compare_price`, `price_ars`, `price_usd`.
- **Capacidad de Escritura requerida:** `edit_prices`
- **Roles con Autorización de Edición:** `Super Admin`, `Gerencia / Administración`.

---

### 3. Implementación en `AdminProductViewSet`

En `backend/apps/analytics/views.py`:
- `AdminProductDetailSerializer` hereda de `SensitiveDataSerializerMixin` y `ProductDetailSerializer`.
- En el método `_save_product` de `AdminProductViewSet`, se añade una salvaguarda de defensa en profundidad:
```python
# ── Protección de costo sensible (RBAC) ──────────────────
if "cost_price" in data and not request.user.is_superuser:
    if not user_has_capability(request.user, PERM_EDIT_COSTS):
        raise AdminInputError("No posee autorización para modificar costos de adquisición (cost_price).")
```
Esto garantiza que incluso si los datos se procesan fuera del flujo estándar de serializers DRF, ninguna mutación no autorizada sobre `cost_price` puede consumarse.

---

### 4. Evidencia de Comportamiento en Pruebas Automatizadas

La suite `backend/apps/users/tests_rbac.py` certifica los siguientes comportamientos:
1. `test_sales_can_read_catalog_but_cost_price_is_masked`: El endpoint `GET /api/v1/admin/products/{id}/` responde `200 OK` pero omite `cost_price`.
2. `test_sales_cannot_write_cost_price`: El endpoint `PATCH /api/v1/admin/products/{id}/` con payload `{"cost_price": 150000}` responde `400 Bad Request` y el valor en PostgreSQL permanece intacto en `220000.0`.
3. `test_finance_can_access_finance_and_see_costs`: El usuario de Finanzas recibe `cost_price: 220000.0` en su respuesta JSON.
4. `test_super_admin_has_full_bypass_and_write_costs`: El Super Admin puede leer y actualizar `cost_price` satisfactoriamente.

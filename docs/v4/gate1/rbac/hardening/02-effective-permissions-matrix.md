# 02 — EFFECTIVE PERMISSIONS MATRIX (RECONCILED SINGLE SOURCE OF TRUTH)
## LEVELPRO OS V4.0 — PATCH 1.1.1 (RBAC HARDENING & FINAL ACCEPTANCE)

- **Fuente única de verdad:** Generado programáticamente desde `backend/core/rbac/constants.py` (`DEFAULT_ROLE_MATRIX`, `ALL_MODULES`, `ALL_SENSITIVE_PERMISSIONS`, `ALL_ACTIONS`, `MODULE_IMPLEMENTATION_STATUS`, `INCOMPATIBLE_ROLE_PAIRS`).
- **Reconciliación completa (Bloque 6):** Cero contradicciones entre `constants.py`, `evaluate_admin_rbac_permission`, `SensitiveDataSerializerMixin`, vistas administrativas y documentación.

---

## 1. ESTADO DE IMPLEMENTACIÓN DE LOS 12 MÓDULOS OPERATIVOS

| # | Código de Módulo | Estado en Gate 1.1 | Gate / Alcance | Descripción Funcional Real |
|---|---|---|---|---|
| 1 | `dashboard` | **`implemented`** | Gate 0 / Gate 1.1 | Dashboard operativo, analítica y dashboard ejecutivo. |
| 2 | `catalog` | **`implemented`** | Gate 0 / Gate 2 (PIM) | Productos, categorías, marcas, imágenes e importadores. |
| 3 | `orders` | **`implemented`** | Gate 0 / Gate 7 (OMS) / Gate 8 (B2B) | Órdenes de venta, cotizaciones B2B y solicitudes bajo pedido. |
| 4 | `inventory` | **`implemented`** | Gate 0 / Gate 4 (WMS) | Resumen de inventario, alertas de stock, rotación y valorización. |
| 5 | `purchases` | **`partial_reserved`** | Gate 3 (Suppliers) & Gate 5 (Procurement) | Cubre solicitudes bajo pedido y gestión de costos de catálogo; proveedores y OC reservados para Gates 3 y 5. |
| 6 | `logistics` | **`partial_reserved`** | Gate 10 (Logistics & After-Sales) | Cubre actualización de despacho en órdenes; transportistas y guías dedicadas reservados para Gate 10. |
| 7 | `finances` | **`implemented`** | Gate 0 / Gate 9 (Financial Management) | Resumen financiero, categorías de distribución, retiros, rentabilidad por SKU, métodos de pago, cuentas bancarias y doc. tributaria SII. |
| 8 | `marketing` | **`implemented`** | Gate 0 / Gate 14 (Loyalty & Rewards) | Campañas Rewards, sorteos, participaciones, ganadores y programa de fidelización Loyalty. |
| 9 | `academy` | **`implemented`** | Gate 0 / Gate 14 (Academy) | Cursos, rutas de certificación, módulos, lecciones, subida firmada de videos e inscripciones. |
| 10 | `services` | **`implemented`** | Gate 0 / Gate 14 (Professional Services) | Catálogo de servicios profesionales, solicitudes de cotización y reservas. |
| 11 | `roles` | **`implemented`** | Gate 1.1 (Security Core & RBAC) | Gestión de roles empresariales, asignación de permisos y administración de cuentas de usuario. |
| 12 | `settings` | **`implemented`** | Gate 0 / Gate 11 & 12 | Configuración global y personalización editorial del sitio web. |

---

## 2. CATÁLOGO DE LAS 12 CAPACIDADES SENSIBLES (`ALL_SENSITIVE_PERMISSIONS`)

| # | Codename (`users.<codename>`) | Propósito y Separación de Responsabilidades | Roles Autorizados |
|---|---|---|---|
| 1 | `view_costs` | Visualizar `cost_price`, `total_cost`, `valor_inventario` y `cost_missing_count`. | `Super Admin`, `Gerencia / Administración`, `Compras`, `Finanzas / Contabilidad` |
| 2 | `edit_costs` | Modificar `cost_price` en productos e importación masiva de catálogo. | `Super Admin`, `Gerencia / Administración`, `Compras` |
| 3 | `view_margins` | Visualizar `margin`, `profit`, `ganancia_potencial` y `utilidad_mes`. | `Super Admin`, `Gerencia / Administración`, `Finanzas / Contabilidad` |
| 4 | `view_finances` | Consultar flujos financieros (`admin_finance_summary`, `admin_finance_by_product`, cuentas bancarias). | `Super Admin`, `Gerencia / Administración`, `Finanzas / Contabilidad` |
| 5 | `manage_finances` | Modificar configuración financiera, registrar/eliminar retiros (`Withdrawal`) y emitir registros tributarios (`TributaryDocument`). | `Super Admin`, `Gerencia / Administración`, `Finanzas / Contabilidad` |
| 6 | `approve_payments` | Aprobar/rechazar pagos manuales (`admin_update_payment_status`) y marcar órdenes como `paid`. | `Super Admin`, `Gerencia / Administración`, `Finanzas / Contabilidad` |
| 7 | `edit_prices` | Modificar precios de venta (`price`, `price_usd`, `price_ars`, `compare_price`), crear/editar productos y servicios, y aprobar descuentos B2B > 15%. | `Super Admin`, `Gerencia / Administración` |
| 8 | `apply_discounts` | Aplicar descuentos comerciales en cotizaciones B2B hasta el límite de política (`15.00%`). | `Super Admin`, `Gerencia / Administración` |
| 9 | `adjust_inventory` | Ajustar existencias físicas (`stock`, `stock_min`) en catálogo y bodega. | `Super Admin`, `Gerencia / Administración`, `Bodega` |
| 10 | `export_data` | Exportar reportes y listados CSV/Excel sensibles (ej. `AdminEntryViewSet.export_csv`). | `Super Admin`, `Gerencia / Administración`, `Compras`, `Finanzas / Contabilidad` |
| 11 | `manage_roles` | Consultar catálogo RBAC, asignar/revocar roles y administrar cuentas de usuario (`MODULE_ROLES`). | `Super Admin` |
| 12 | `manage_settings` | Acceder y modificar configuración global del sistema (`/api/v1/admin/site-settings/`), tasas de cambio (`usd_to_clp`, `usd_to_ars`), cuentas bancarias y parámetros de Loyalty. | `Super Admin`, `Gerencia / Administración` |

---

## 3. MATRIZ CRUZADA: 10 ROLES × 12 CAPACIDADES SENSIBLES

| Rol Empresarial | `view_costs` | `edit_costs` | `view_margins` | `view_finances` | `manage_finances` | `approve_payments` | `edit_prices` | `apply_discounts` | `adjust_inventory` | `export_data` | `manage_roles` | `manage_settings` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Super Admin** | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI |
| **Gerencia / Administración** | SI | SI | SI | SI | SI | SI | SI | SI | SI | SI | — | SI |
| **Ventas** | — | — | — | — | — | — | — | — | — | — | — | — |
| **Compras** | SI | SI | — | — | — | — | — | — | — | SI | — | — |
| **Bodega** | — | — | — | — | — | — | — | — | SI | — | — | — |
| **Logística** | — | — | — | — | — | — | — | — | — | — | — | — |
| **Finanzas / Contabilidad** | SI | — | SI | SI | SI | SI | — | — | — | SI | — | — |
| **Marketing** | — | — | — | — | — | — | — | — | — | — | — | — |
| **Academia** | — | — | — | — | — | — | — | — | — | — | — | — |
| **Soporte Técnico** | — | — | — | — | — | — | — | — | — | — | — | — |

---

## 4. MATRIZ GRANULAR DE ACCIONES POR MÓDULO Y ROL (`read`, `create`, `update`, `delete`, `export`, `import`, `approve`)

| Rol Empresarial | `dashboard` | `catalog` | `orders` | `inventory` | `purchases` | `logistics` | `finances` | `marketing` | `academy` | `services` | `roles` | `settings` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Super Admin** | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` |
| **Gerencia / Administración** | `read`, `export` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | `read`, `create`, `update`, `delete`, `export`, `import`, `approve` | — | `read`, `update` |
| **Ventas** | `read` | `read` | `read`, `update` | — | — | — | — | `read` | — | — | — | — |
| **Compras** | `read` | `read`, `update` | — | `read`, `export` | `read`, `create`, `update`, `export` | — | — | — | — | — | — | — |
| **Bodega** | — | — | — | `read`, `update` | — | `read`, `update` | — | — | — | — | — | — |
| **Logística** | — | — | `read`, `update` | — | — | `read`, `update` | — | — | — | — | — | — |
| **Finanzas / Contabilidad** | `read`, `export` | `read` | `read`, `approve`, `export` | `read`, `export` | `read` | — | `read`, `create`, `update`, `delete`, `approve`, `export` | — | — | — | — | — |
| **Marketing** | `read` | `read`, `update` | — | — | — | — | — | `read`, `create`, `update` | — | — | — | — |
| **Academia** | `read` | — | — | — | — | — | — | — | `read`, `create`, `update`, `import` | — | — | — |
| **Soporte Técnico** | — | — | `read` | — | — | `read` | — | — | — | `read`, `update` | — | — |

---

## 5. REGLAS DE RECONCILIACIÓN Y SEGREGACIÓN DE FUNCIONES (SoD)

1. **Gerencia / Administración (`edit_costs` reconciliado):** Posee `edit_costs` tanto en `DEFAULT_ROLE_MATRIX` como en la base de datos (`auth_group_permissions`), permitiéndole supervisar y corregir costos de catálogo sin depender de Super Admin.
2. **Marketing (`manage_settings` removido):** No posee `manage_settings` ni acceso al módulo `settings` (`/api/v1/admin/site-settings/`), cuentas bancarias (`/api/v1/payments/admin/bank-accounts/`), tasas de cambio (`usd_to_clp`, `usd_to_ars`), ajustes manuales de puntos (`/api/v1/loyalty/admin/adjust/`) ni exportación CSV de participantes (`/api/v1/admin/rewards/entries/export/`).
3. **Usuarios legacy (`is_staff=True` sin rol):** Acceso efectivo = **`0 módulos, 0 capacidades, 0 acciones`**. Denegados por defecto (`403 Forbidden`) en el 100% de los endpoints administrativos.
4. **Acceso a información de clientes (`/api/v1/admin/users/`):** Autorizado exclusivamente para `Super Admin`, `Gerencia / Administración`, `Ventas` y `Soporte Técnico`. Para `Soporte Técnico`, los campos financieros `total_spent` y `spend_by_currency` se enmascaran a `null`.
5. **Aprobación manual de pagos (`approve_payments`):** Exclusiva de `Super Admin`, `Gerencia / Administración` y `Finanzas / Contabilidad`. `Ventas` y `Logística` tienen prohibido aprobar pagos o transicionar órdenes al estado `paid`.
6. **Edición y eliminación de productos:**
   - `Ventas`: Solo lectura (`read`) en catálogo, con `cost_price` enmascarado.
   - `Bodega`: Ajuste exclusivo de `stock` y `stock_min` (`adjust_inventory`), sin lectura ni edición de costos o precios, y sin permiso de creación o eliminación.
   - `Compras`: Actualización exclusiva de `cost_price` (`edit_costs`), sin edición de precios de venta ni eliminación.
   - `Marketing`: Actualización exclusiva de campos editoriales/SEO e imágenes, sin edición de precios, costos o stock, y sin eliminación.
   - `DELETE` de productos, cursos, rutas de certificación, categorías, marcas, imágenes y solicitudes bajo pedido: Restringido exclusivamente a `Super Admin` y `Gerencia / Administración`.
7. **Límite de política comercial en descuentos B2B:** `MAX_UNAPPROVED_DISCOUNT_PERCENT = 0.00%`. `Ventas` puede aplicar descuentos hasta 15.00%; cualquier porcentaje superior requiere `edit_prices` (`Gerencia / Administración` o `Super Admin`).
8. **Pares de roles incompatibles por Segregación de Funciones (SoD):**
   - `Ventas` ↔ `Finanzas / Contabilidad` (rechazado atómicamente en `assign_role_to_user` con HTTP 400).
   - `Compras` ↔ `Finanzas / Contabilidad` (rechazado atómicamente en `assign_role_to_user` con HTTP 400).
   - `Bodega` ↔ `Finanzas / Contabilidad` (rechazado atómicamente en `assign_role_to_user` con HTTP 400).
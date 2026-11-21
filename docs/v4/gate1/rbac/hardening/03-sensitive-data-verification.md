# 03 — SENSITIVE DATA VERIFICATION
## LEVELPRO OS V4.0 — PATCH 1.1.1 (RBAC HARDENING & FINAL ACCEPTANCE)

---

## 1. ARQUITECTURA DE PROTECCIÓN DE DATOS SENSIBLES EN DOS CAPAS

En PATCH 1.1.1 la protección de datos sensibles opera en **dos capas complementarias**:

1. **Capa 1 — Serializadores DRF (`SensitiveDataSerializerMixin` en `backend/core/rbac/mixins.py`):**
   - **Podado recursivo en lectura (`to_representation` + `_recursively_strip_fields`):** Recorre diccionarios y listas anidadas a cualquier profundidad y elimina:
     - `COST_FIELDS = {"cost_price", "total_cost", "valor_inventario", "cost_missing_count"}` si el usuario no posee `view_costs`.
     - `MARGIN_FIELDS = {"margin", "profit", "ganancia_potencial", "utilidad_mes"}` si el usuario no posee `view_margins`.
     - `FINANCIAL_FIELDS = {"total_income", "total_withdrawn", "net_balance", "net_balance_identified_only", "distributions"}` si el usuario no posee `view_finances`.
     - `GATEWAY_PRIVATE_FIELDS = {"raw_response"}` si el usuario no posee `view_finances`.
   - **Bloqueo atómico en escritura (`validate` + `AdminProductViewSet._validate_product_field_permissions`):**
     - Verifica permisos de campo **antes** de ejecutar cualquier `serializer.save()`.
     - Si un payload incluye `stock` + `price` o `stock` + `cost_price` enviado por `Bodega`, la petición completa se rechaza con HTTP `400/403` sin modificar ni un solo campo en PostgreSQL.

2. **Capa 2 — Endpoints de Agregación y Respuestas Manuales (`Response({...})` en `views.py`):**
   - Todos los endpoints que construyen diccionarios JSON manualmente aplican verificación explícita de capacidades (`user_has_capability`) antes de exponer métricas de costos, márgenes, ingresos o gasto por cliente.

---

## 2. MATRIZ DE VERIFICACIÓN DE ENDPOINTS CON DATOS SENSIBLES

| Endpoint | Campos Sensibles Protegidos | Regla RBAC Aplicada | Resultado para Rol No Autorizado | Resultado para Rol Autorizado | Test Automatizado |
|---|---|---|---|---|---|
| `GET /api/v1/admin/products/` y `/<id>/` | `cost_price` | Requiere `view_costs` (`Super Admin`, `Gerencia`, `Compras`, `Finanzas`) | Clave `cost_price` **eliminada** del JSON para `Ventas` y `Marketing` | `cost_price` visible (`220000.0`) | `test_sales_cannot_edit_prices_stock_costs_or_delete_products` |
| `PATCH /api/v1/admin/products/<id>/` | `cost_price`, `price`, `price_usd`, `price_ars`, `compare_price`, `stock`, `stock_min` | `cost_price` -> `edit_costs`; precios -> `edit_prices`; stock -> `adjust_inventory` | `403 Forbidden` atómico sin efecto parcial en DB | `200 OK` solo para los campos autorizados al rol | `test_warehouse_can_adjust_stock_only_and_atomic_rejection_on_price_or_cost` |
| `GET /api/v1/admin/inventory/summary/` | `valor_inventario`, `ganancia_potencial`, `valor_venta`, `cost_missing_count`, `profit_calculable` | `valor_inventario` / `cost_missing_count` -> `view_costs`; `ganancia_potencial` -> `view_costs` + `view_margins` | Campos devuelven `null` (`profit_calculable: false`) para `Bodega`; conteos físicos (`total_productos`, `sin_stock`, `stock_critico`, `stock_ok`) visibles | Valorización completa visible para `Finanzas`, `Compras`, `Gerencia`, `Super Admin` | `test_inventory_endpoints_mask_cost_and_margin_for_warehouse` |
| `GET /api/v1/admin/inventory/alerts/` | `cost_price` en cada ítem con alerta de stock | Requiere `view_costs` | Clave `cost_price` **omitida** en cada alerta para `Bodega` | `cost_price` incluido en cada alerta | `test_inventory_endpoints_mask_cost_and_margin_for_warehouse` |
| `GET /api/v1/admin/inventory/by-category/` | `valor_inventario` por categoría | Requiere `view_costs` | `valor_inventario: null` (ordenado por `unidades`) para `Bodega` | `valor_inventario` calculado y ordenado por valor | `test_inventory_endpoints_mask_cost_and_margin_for_warehouse` |
| `GET /api/v1/admin/inventory/rotation/` | `ingresos` por SKU en los últimos 30 días | Requiere `view_finances` o `view_costs` | `ingresos: null` para `Bodega` (conserva `unidades_vendidas` y `stock_actual`) | `ingresos` visible en la moneda consultada | `inventory_rotation` |
| `GET /api/v1/admin/executive/` | `utilidad_mes`, `utilidad_estado`, `ventas`, `ventas_7dias`, `ordenes_hoy`, `top_productos[*].ingresos` | `utilidad_mes` -> `view_finances` + `view_margins`; `ventas` -> `view_finances` o `MODULE_ORDERS` | Para `Ventas`: `utilidad_mes: null`, `utilidad_estado: "restringido_rbac"`. Para `Soporte`: `403 Forbidden` | Para `Finanzas` / `Gerencia` / `Super Admin`: `utilidad_mes` visible en CLP | `test_executive_dashboard_and_support_users_mask_profit_and_spend` |
| `GET /api/v1/admin/dashboard/` y `/api/v1/admin/analytics/` | `revenue`, `revenue_by_currency`, `sales_chart[*].total`, `top_products[*].revenue`, `kpis.total_revenue` | Requiere `view_finances` o acceso a `MODULE_ORDERS` | Para `Academia` o `Compras`: métricas de ingresos financieros enmascaradas a `null` | Ingresos visibles para `Super Admin`, `Gerencia`, `Finanzas`, `Ventas` | `dashboard_overview`, `analytics_full` |
| `GET /api/v1/admin/users/` | `total_spent`, `total_spent_currency`, `spend_by_currency` | Requiere `view_finances` o rol comercial (`Super Admin`, `Gerencia`, `Ventas`) | Para `Soporte Técnico`: `total_spent: null`, `spend_by_currency: null` (solo ve nombre, email y `orders_count`) | Visible para `Super Admin`, `Gerencia`, `Ventas` | `test_executive_dashboard_and_support_users_mask_profit_and_spend` |
| `GET /api/v1/admin/rewards/dashboard/` | `related_revenue` | Requiere `view_finances` | `related_revenue: null` para `Marketing` y `Ventas` | Visible para `Super Admin` y `Gerencia` | `rewards_dashboard` |
| `GET /api/v1/payments/admin/bank-accounts/` | Cuentas bancarias administrativas (CRUD) | `MODULE_FINANCES` + `view_finances` (lectura) / `manage_settings` (escritura) | `403 Forbidden` para `Ventas`, `Marketing`, `Bodega`, `Soporte`, `Logística` | `200 OK` para `Super Admin`, `Gerencia`, `Finanzas` | `test_marketing_cannot_manage_settings_exchange_rates_or_manual_points` |
| `GET /media/billing/*`, `/media/receipts/*`, `/media/private/*` | PDFs de documentos tributarios SII y comprobantes privados | Requiere sesión autenticada + (`MODULE_FINANCES` / `MODULE_ORDERS` / cliente titular del pedido) + `Cache-Control: private, no-store` | `401/403` para usuarios anónimos, clientes ajenos o `Soporte Técnico` | Descarga autorizada con `Cache-Control: private, no-store` | `test_private_media_proxy_requires_authentication_and_rbac` |

---

## 3. PRESERVACIÓN DE INSTRUCCIONES LEGÍTIMAS DE PAGO PARA CLIENTES

Se verificó explícitamente que el endurecimiento de `AdminBankAccountViewSet` (`/api/v1/payments/admin/bank-accounts/`) **no afecta** los endpoints públicos y de checkout para clientes:
- `GET /api/v1/payments/methods/?currency=CLP|USD|ARS` (`PaymentMethodsPublicView`, `AllowAny`): Continúa entregando las cuentas bancarias activas de la moneda seleccionada para transferencia, Payoneer y Global66.
- `GET /api/v1/payments/transfer/<order_id>/` (`TransferInstructionsView`, `AllowAny` con validación de UUID de orden): Continúa entregando las instrucciones de transferencia al comprador.
- Certificado por la suite `backend/apps/payments/tests_transfer_instructions.py` (100% aprobada).

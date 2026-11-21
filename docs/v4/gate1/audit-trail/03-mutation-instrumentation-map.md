# LEVELPRO OS V4.0 — GATE 1.2: AUDIT TRAIL & ACTIVITY LOG
## DOCUMENTO TÉCNICO 03: MAPA EXHAUSTIVO DE INSTRUMENTACIÓN DE MUTACIONES

---

### 1. ALCANCE DE LA INSTRUMENTACIÓN

Para garantizar el cumplimiento de **GATE 1.2**, cada punto de mutación en la lógica del backend fue instrumentado de forma síncrona mediante la función canónica `record_audit_event()`.

Ninguna entidad comercial, financiera, de inventario o de seguridad puede sufrir mutaciones de estado (`CREATE`, `UPDATE`, `DELETE`, `TRANSITION`) sin emitir un evento formal e inmutable.

---

### 2. MATRIZ MAESTRA DE INSTRUMENTACIÓN POR MÓDULO

| Módulo | Archivo de Origen | Función / Método / Vista | Acción Emitida | Categoría |
|---|---|---|---|---|
| **Catálogo** | `apps/analytics/views.py` | `AdminProductViewSet.perform_create` | `PRODUCT_CREATED` | `creation` |
| **Catálogo** | `apps/analytics/views.py` | `AdminProductViewSet.perform_update` | `PRICE_CHANGED` (si cambia precio) | `price_change` |
| **Catálogo** | `apps/analytics/views.py` | `AdminProductViewSet.perform_update` | `COST_CHANGED` (si cambia costo) | `cost_change` |
| **Catálogo** | `apps/analytics/views.py` | `AdminProductViewSet.perform_update` | `STOCK_ADJUSTED` (si cambia stock) | `stock_adjustment` |
| **Catálogo** | `apps/analytics/views.py` | `AdminProductViewSet.perform_update` | `PRODUCT_MODIFIED` (atributos grales) | `modification` |
| **Catálogo** | `apps/analytics/views.py` | `AdminProductViewSet.perform_destroy` | `PRODUCT_DELETED` | `deletion` |
| **Catálogo** | `apps/analytics/views.py` | `AdminCategoryViewSet` | `CATEGORY_CREATED` / `UPDATED` / `DELETED` | `creation` / `modification` |
| **Catálogo** | `apps/analytics/views.py` | `AdminBrandViewSet` | `BRAND_CREATED` / `UPDATED` / `DELETED` | `creation` / `modification` |
| **Catálogo** | `apps/analytics/views.py` | `product_image_upload` | `PRODUCT_IMAGE_UPLOADED` | `modification` |
| **Catálogo** | `apps/analytics/views.py` | `product_image_delete` | `PRODUCT_IMAGE_DELETED` | `deletion` |
| **Catálogo** | `apps/analytics/views.py` | `product_image_set_primary` | `PRODUCT_IMAGE_SET_PRIMARY` | `modification` |
| **Operaciones Masivas** | `apps/analytics/views.py` | `import_products` | `BULK_PRODUCTS_IMPORTED` | `bulk_operation` |
| **Operaciones Masivas** | `apps/analytics/views.py` | `import_brands` | `BULK_BRANDS_IMPORTED` | `bulk_operation` |
| **Operaciones Masivas** | `apps/analytics/views.py` | `import_courses` | `BULK_COURSES_IMPORTED` | `bulk_operation` |
| **Órdenes y Ventas** | `apps/analytics/views.py` | `AdminOrderViewSet.update_status` | `ORDER_STATUS_CHANGED` | `order_status` |
| **Cotizaciones B2B** | `apps/orders/views_b2b.py` | `admin_b2b_quote_convert` | `B2B_QUOTE_CONVERTED_TO_ORDER` | `order_status` |
| **Cotizaciones B2B** | `apps/orders/views_b2b.py` | `admin_b2b_quote_detail` | `B2B_QUOTE_STATUS_UPDATED` | `modification` |
| **Pagos** | `apps/analytics/views.py` | `admin_update_payment_status` | `PAYMENT_APPROVED` / `PAYMENT_REJECTED` | `payment_operation` |
| **Pagos (Webhooks)** | `apps/payments/signals.py` | `update_order_status` (post_save) | `PAYMENT_AUTO_SYNC_STATUS` | `payment_operation` |
| **Finanzas** | `apps/analytics/views.py` | `admin_finance_categories` | `FINANCE_CATEGORY_CREATED` | `financial_operation` |
| **Finanzas** | `apps/analytics/views.py` | `admin_finance_category_detail` | `FINANCE_CATEGORY_UPDATED` / `DELETED` | `financial_operation` |
| **Finanzas** | `apps/analytics/views.py` | `admin_finance_withdrawals` | `FINANCIAL_WITHDRAWAL_EXECUTED` | `financial_operation` |
| **Finanzas** | `apps/analytics/views.py` | `admin_finance_withdrawal_delete`| `FINANCIAL_WITHDRAWAL_DELETED` | `financial_operation` |
| **Facturación SII** | `apps/billing/views.py` | `upsert_document` | `TRIBUTARY_DOCUMENT_UPSERTED` | `financial_operation` |
| **Facturación SII** | `apps/billing/views.py` | `upload_document_pdf` | `TRIBUTARY_DOCUMENT_PDF_UPLOADED` | `financial_operation` |
| **Seguridad y RBAC** | `core/rbac/services.py` | `assign_role_to_user` | `RBAC_ROLE_ASSIGNED` | `role_permission` |
| **Seguridad y RBAC** | `core/rbac/services.py` | `remove_role_from_user` | `RBAC_ROLE_REVOKED` | `role_permission` |
| **Seguridad y RBAC** | `core/rbac/events.py` | `log_security_event` | `PRIVILEGE_ESCALATION_ATTEMPT` / `INCOMPATIBLE_ROLE_ASSIGNMENT` | `privilege_escalation` |
| **Seguridad (HTTP)** | `core/audit/middleware.py` | `AuditCorrelationMiddleware` | `SECURITY_DENIED_ACCESS` (HTTP 403) | `security_denied` |
| **Academia** | `apps/analytics/views.py` | `AdminCourseViewSet` | `COURSE_CREATED` / `UPDATED` / `DELETED` | `creation` / `modification` |
| **Academia** | `apps/analytics/views.py` | `AdminCertificationPathViewSet` | `CERTIFICATION_PATH_CREATED` / `UPDATED` | `creation` / `modification` |
| **Academia** | `apps/analytics/views.py` | `AdminModuleViewSet` | `ACADEMY_MODULE_CREATED` / `UPDATED` | `creation` / `modification` |
| **Academia** | `apps/analytics/views.py` | `AdminLessonViewSet` | `ACADEMY_LESSON_CREATED` / `UPDATED` | `creation` / `modification` |
| **Academia** | `apps/analytics/views.py` | `admin_create_enrollment` | `ENROLLMENT_CREATED` | `creation` |
| **Academia** | `apps/analytics/views.py` | `admin_delete_enrollment` | `ENROLLMENT_DELETED` | `deletion` |
| **Servicios Técnicos**| `apps/analytics/views.py` | `admin_services_crud` | `SERVICE_CREATED` | `creation` |
| **Servicios Técnicos**| `apps/analytics/views.py` | `admin_service_detail` | `SERVICE_UPDATED` / `DELETED` | `modification` / `deletion` |
| **Servicios Técnicos**| `apps/analytics/views.py` | `update_booking_status` | `BOOKING_STATUS_CHANGED` | `modification` |
| **Servicios Técnicos**| `apps/analytics/views.py` | `update_request_status` | `SERVICE_REQUEST_STATUS_CHANGED` | `modification` |
| **Fidelización** | `apps/loyalty/views.py` | `admin_loyalty_config` | `LOYALTY_CONFIG_UPDATED` | `config_change` |
| **Fidelización** | `apps/loyalty/views.py` | `admin_adjust_points` | `LOYALTY_POINTS_ADJUSTED` | `modification` |
| **Rewards** | `apps/rewards/views_admin.py` | `AdminCampaignViewSet` | `REWARDS_CAMPAIGN_CREATED` / `UPDATED` | `creation` / `modification` |
| **Rewards** | `apps/rewards/views_admin.py` | `AdminCampaignViewSet.draw` | `REWARDS_CAMPAIGN_DRAW_EXECUTED` | `modification` |
| **Rewards** | `apps/rewards/views_admin.py` | `AdminCampaignViewSet.finish` | `REWARDS_CAMPAIGN_FINISHED` | `modification` |
| **Configuración** | `apps/site_settings/views.py` | `AdminSiteSettingsView.patch` | `SITE_SETTINGS_UPDATED` | `config_change` |
| **Auditoría** | `apps/analytics/views_audit.py`| `audit_export_view` | `AUDIT_LOG_EXPORTED` | `export` |

---

### 3. PATRÓN DE INSTRUMENTACIÓN CANÓNICO

En cada mutación, se extrae el estado previo (`previous_values`), se persiste la operación y se registra el nuevo estado (`new_values`) capturando la diferencia mediante `compute_state_diff()`:

```python
# Ejemplo canónico implementado en AdminProductViewSet
old_price = str(instance.price)
instance = serializer.save()
new_price = str(instance.price)

if old_price != new_price:
    record_audit_event(
        module=MODULE_CATALOG,
        action="PRICE_CHANGED",
        event_category=CATEGORY_PRICE_CHANGE,
        resource_type="Product",
        resource_id=str(instance.id),
        resource_repr=instance.name,
        actor=self.request.user,
        previous_values={"price": old_price},
        new_values={"price": new_price},
        changed_fields=["price"],
        severity=SEVERITY_INFO,
        mandatory=True,
    )
```

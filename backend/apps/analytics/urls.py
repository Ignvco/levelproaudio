# apps/analytics/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    dashboard_overview,
    AdminOrderViewSet,
    AdminProductViewSet,
    AdminCategoryViewSet,
    AdminBrandViewSet,
    AdminProductImageViewSet,
    AdminCourseViewSet,
    AdminCertificationPathViewSet,
    AdminModuleViewSet,
    AdminLessonViewSet,
    admin_lesson_video_upload_url,
    admin_users,
    admin_payments,
    admin_update_payment_status,
    admin_academy,
    admin_services,
    admin_services_crud,
    admin_service_detail,
    admin_service_requests,
    admin_create_enrollment,
    admin_enrollments,
    admin_user_detail, 
    admin_delete_enrollment,
    admin_finance_categories,
    admin_finance_category_detail,
    admin_finance_summary,
    admin_finance_withdrawals,
    admin_finance_withdrawal_delete,
    admin_finance_by_product,
    update_booking_status,
    admin_bookings_list,
    update_request_status,
    import_products,
    import_brands,
    import_courses,
    download_template,
    analytics_full,
    product_images,
    product_image_upload,
    product_image_delete,
    product_image_set_primary,
    inventory_summary,
    inventory_alerts,
    inventory_rotation,
    inventory_value_by_category,
    executive_dashboard,
)
from apps.users.views_rbac import (
    roles_list_view,
    role_detail_view,
    user_roles_management_view,
    permissions_catalog_view,
)
from .views_audit import (
    audit_events_list_view,
    audit_event_detail_view,
    audit_summary_view,
    audit_catalog_view,
    audit_export_view,
)
from apps.products.admin_pim_views import (
    admin_product_variants,
    admin_product_variant_detail,
    admin_technical_attributes_catalog,
    admin_product_technical_specs,
    admin_products_bulk_preview,
    admin_products_bulk_apply,
    admin_products_export,
)
from apps.orders.oms_views import (
    admin_manual_orders_view,
    admin_manual_order_detail_view,
    admin_manual_order_convert_view,
    admin_manual_order_cancel_view,
    admin_manual_order_whatsapp_link_view,
    admin_order_states_view,
    admin_fulfillment_queue_view,
    admin_order_dispatch_view,
    admin_order_payment_attempt_view,
    admin_order_rma_view,
    admin_rma_list_view,
    admin_rma_authorize_view,
    admin_rma_inspect_view,
    admin_rma_refund_view,
)

router = DefaultRouter()
router.register("orders",          AdminOrderViewSet,   basename="admin-orders")
router.register("products",        AdminProductViewSet, basename="admin-products")
router.register("categories",      AdminCategoryViewSet, basename="admin-categories")
router.register("brands",          AdminBrandViewSet,   basename="admin-brands")
router.register("academy/courses", AdminCourseViewSet,  basename="admin-courses")
router.register("academy/certifications", AdminCertificationPathViewSet, basename="admin-certifications")
router.register("academy/modules", AdminModuleViewSet,  basename="admin-modules")
router.register("academy/lessons", AdminLessonViewSet,  basename="admin-lessons")

urlpatterns = [
    # Dashboard y analytics
    path("dashboard/",         dashboard_overview, name="admin-dashboard"),
    path("analytics/",         analytics_full,     name="admin-analytics"),

    # Usuarios
    path("users/",             admin_users,        name="admin-users"),
    path("users/<uuid:user_id>/roles/", user_roles_management_view, name="admin-user-roles"),

    # Roles y Permisos (LEVELPRO OS V4.0 RBAC)
    path("roles/",             roles_list_view,    name="admin-roles-list"),
    path("roles/<str:role_name>/", role_detail_view, name="admin-role-detail"),
    path("permissions/catalog/", permissions_catalog_view, name="admin-permissions-catalog"),

    # LEVELPRO OS V4.0 — AUDIT TRAIL & ACTIVITY LOG (Gate 1.2)
    path("audit/events/", audit_events_list_view, name="admin-audit-events"),
    path("audit/events/<uuid:event_id>/", audit_event_detail_view, name="admin-audit-event-detail"),
    path("audit/events/export/", audit_export_view, name="admin-audit-export"),
    path("audit/summary/", audit_summary_view, name="admin-audit-summary"),
    path("audit/catalog/", audit_catalog_view, name="admin-audit-catalog"),
     
    path("executive/", executive_dashboard, name="executive-dashboard"),
     
    # Pagos
    path("payments/",          admin_payments,     name="admin-payments"),
    path("payments/<uuid:payment_id>/status/", admin_update_payment_status, name="admin-payment-status"),
    path("finance/by-product/", admin_finance_by_product, name="finance-by-product"),
    path("finance/summary/",                            admin_finance_summary,              name="finance-summary"),
    path("finance/categories/",                         admin_finance_categories,           name="finance-categories"),
    path("finance/categories/<uuid:cat_id>/",           admin_finance_category_detail,      name="finance-category-detail"),
    path("finance/withdrawals/",                        admin_finance_withdrawals,          name="finance-withdrawals"),
    path("finance/withdrawals/<uuid:withdrawal_id>/",   admin_finance_withdrawal_delete,    name="finance-withdrawal-delete"),

    # Academia
    path("academy/",           admin_academy,      name="admin-academy"),
    path("academy/enrollments/",        admin_enrollments,       name="admin-enrollments"),
    path("academy/enrollments/create/", admin_create_enrollment, name="admin-enrollment-create"),
    path("users/<uuid:user_id>/",                        admin_user_detail,         name="admin-user-detail"),
    path("academy/enrollments/<uuid:enrollment_id>/",    admin_delete_enrollment,   name="admin-enrollment-delete"),

    # Servicios
    path("services/",          admin_services,     name="admin-services"),
    path("services/list/",            admin_services_crud,   name="admin-services-list"),
    path("services/<uuid:service_id>/", admin_service_detail, name="admin-service-detail"),
    path("service-requests/",  admin_service_requests, name="admin-service-requests"),
    path("bookings/",                   admin_bookings_list,     name="admin-bookings-list"),
    path("bookings/<uuid:pk>/status/",  update_booking_status,   name="admin-booking-status"),
    path("requests/<uuid:pk>/status/",  update_request_status,   name="admin-request-status"),

    # Productos — importación, exportación, edición masiva, variantes y specs (GATE 2 PIM)
    path("products/import/",   import_products,    name="admin-products-import"),
    path("products/export/",   admin_products_export, name="admin-products-export"),
    path("products/bulk-preview/", admin_products_bulk_preview, name="admin-products-bulk-preview"),
    path("products/bulk-apply/",   admin_products_bulk_apply,   name="admin-products-bulk-apply"),
    path("products/technical-attributes/", admin_technical_attributes_catalog, name="admin-technical-attributes"),
    path("products/<uuid:product_id>/variants/", admin_product_variants, name="admin-product-variants"),
    path("products/<uuid:product_id>/variants/<uuid:variant_id>/", admin_product_variant_detail, name="admin-product-variant-detail"),
    path("products/<uuid:product_id>/technical-specs/", admin_product_technical_specs, name="admin-product-technical-specs"),
    path("brands/import/",     import_brands,      name="admin-brands-import"),
    path("courses/import/",    import_courses,     name="admin-courses-import"),
    path("products/template/", download_template,  name="admin-products-template"),
    
    path("inventory/summary/",    inventory_summary,             name="inventory-summary"),
    path("inventory/alerts/",     inventory_alerts,              name="inventory-alerts"),
    path("inventory/rotation/",   inventory_rotation,            name="inventory-rotation"),
    path("inventory/by-category/",inventory_value_by_category,  name="inventory-by-category"),

    # Imágenes de productos — solo las funciones directas (sin duplicados)
    path("products/<uuid:product_id>/images/",
         product_images,           name="product-images"),
    path("products/<uuid:product_id>/images/upload/",
         product_image_upload,     name="product-image-upload"),
    path("images/<uuid:image_id>/delete/",
         product_image_delete,     name="product-image-delete"),
    path("images/<uuid:image_id>/primary/",
         product_image_set_primary, name="product-image-primary"),

    # Subida directa de video de lección a GCS (evita el límite de 32MB de Cloud Run)
    path("academy/lessons/upload-url/",
         admin_lesson_video_upload_url, name="admin-lesson-video-upload-url"),

    # WMS — Bodegas, Stock Dimensional, Kardex, Reservas, Transferencias y Seriales (GATE 4)
    path("", include("apps.inventory.urls")),

    # OMS — Ventas Manuales, WhatsApp Checkout, Estados 3D, Preparación/Despacho y RMA (GATE 7)
    path("orders/manual/", admin_manual_orders_view, name="admin-orders-manual"),
    path("orders/manual/<uuid:draft_id>/", admin_manual_order_detail_view, name="admin-orders-manual-detail"),
    path("orders/manual/<uuid:draft_id>/convert/", admin_manual_order_convert_view, name="admin-orders-manual-convert"),
    path("orders/manual/<uuid:draft_id>/cancel/", admin_manual_order_cancel_view, name="admin-orders-manual-cancel"),
    path("orders/manual/<uuid:draft_id>/whatsapp-link/", admin_manual_order_whatsapp_link_view, name="admin-orders-manual-whatsapp"),
    path("orders/fulfillment-queue/", admin_fulfillment_queue_view, name="admin-orders-fulfillment-queue"),
    path("orders/rmas/", admin_rma_list_view, name="admin-orders-rmas-list"),
    path("orders/rmas/<uuid:rma_id>/authorize/", admin_rma_authorize_view, name="admin-orders-rma-authorize"),
    path("orders/rmas/<uuid:rma_id>/inspect/", admin_rma_inspect_view, name="admin-orders-rma-inspect"),
    path("orders/rmas/<uuid:rma_id>/refund/", admin_rma_refund_view, name="admin-orders-rma-refund"),
    path("orders/<uuid:order_id>/states/", admin_order_states_view, name="admin-orders-states"),
    path("orders/<uuid:order_id>/dispatch/", admin_order_dispatch_view, name="admin-orders-dispatch"),
    path("orders/<uuid:order_id>/payment-attempt/", admin_order_payment_attempt_view, name="admin-orders-payment-attempt"),
    path("orders/<uuid:order_id>/rma/", admin_order_rma_view, name="admin-orders-rma"),

    # Router al final
    path("", include(router.urls)),
]
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

    # Productos — importación
    path("products/import/",   import_products,    name="admin-products-import"),
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

    # Router al final
    path("", include(router.urls)),
]
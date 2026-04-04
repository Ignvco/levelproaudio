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
    AdminModuleViewSet,
    AdminLessonViewSet,
    admin_users,
    admin_payments,
    admin_update_payment_status,
    admin_academy,
    admin_services,
    admin_services_crud,
    admin_service_detail,
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
    update_request_status,
    import_products,
    download_template,
    analytics_full,
    product_images,
    product_image_upload,
    product_image_delete,
    product_image_set_primary,
)

router = DefaultRouter()
router.register("orders",          AdminOrderViewSet,   basename="admin-orders")
router.register("products",        AdminProductViewSet, basename="admin-products")
router.register("categories",      AdminCategoryViewSet, basename="admin-categories")
router.register("brands",          AdminBrandViewSet,   basename="admin-brands")
router.register("academy/courses", AdminCourseViewSet,  basename="admin-courses")
router.register("academy/modules", AdminModuleViewSet,  basename="admin-modules")
router.register("academy/lessons", AdminLessonViewSet,  basename="admin-lessons")

urlpatterns = [
    # Dashboard y analytics
    path("dashboard/",         dashboard_overview, name="admin-dashboard"),
    path("analytics/",         analytics_full,     name="admin-analytics"),

    # Usuarios
    path("users/",             admin_users,        name="admin-users"),

    # Pagos
    path("payments/",          admin_payments,     name="admin-payments"),
    path("payments/<uuid:payment_id>/status/", admin_update_payment_status, name="admin-payment-status"),
    path("finance/by-product/", admin_finance_by_product, name="finance-by-product"),
    path("finance/summary/",                            admin_finance_summary,              name="finance-summary"),
    path("finance/categories/",                         admin_finance_categories,           name="finance-categories"),
    path("finance/categories/<uuid:cat_id>/",           admin_finance_category_detail,      name="finance-category-detail"),
    path("finance/withdrawals/",                        admin_finance_withdrawals,          name="finance-withdrawals"),
    path("finance/withdrawals/<uuid:withdrawal_id>/",   admin_finance_withdrawal_delete,    name="finance-withdrawal-delete"),
    path("finance/by-product/",                         admin_finance_by_product,           name="finance-by-product"),

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
    path("bookings/<uuid:pk>/status/",  update_booking_status,   name="admin-booking-status"),
    path("requests/<uuid:pk>/status/",  update_request_status,   name="admin-request-status"),

    # Productos — importación
    path("products/import/",   import_products,    name="admin-products-import"),
    path("products/template/", download_template,  name="admin-products-template"),

    # Imágenes de productos — solo las funciones directas (sin duplicados)
    path("products/<uuid:product_id>/images/",
         product_images,           name="product-images"),
    path("products/<uuid:product_id>/images/upload/",
         product_image_upload,     name="product-image-upload"),
    path("images/<uuid:image_id>/delete/",
         product_image_delete,     name="product-image-delete"),
    path("images/<uuid:image_id>/primary/",
         product_image_set_primary, name="product-image-primary"),

    # Router al final
    path("", include(router.urls)),
]
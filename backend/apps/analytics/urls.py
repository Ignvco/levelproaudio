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
    admin_users,
    admin_payments,
    admin_academy,
    admin_services,
    update_booking_status,
    update_request_status,
    import_products,
    download_template,
    analytics_full,
)

router = DefaultRouter()
router.register("orders",     AdminOrderViewSet,    basename="admin-orders")
router.register("products",   AdminProductViewSet,  basename="admin-products")
router.register("categories", AdminCategoryViewSet, basename="admin-categories")
router.register("brands",     AdminBrandViewSet,    basename="admin-brands")

urlpatterns = [
    path("dashboard/",         dashboard_overview,  name="admin-dashboard"),
    path("analytics/",         analytics_full,      name="admin-analytics"),
    path("users/",             admin_users,         name="admin-users"),
    path("payments/",          admin_payments,      name="admin-payments"),
    path("academy/",           admin_academy,       name="admin-academy"),
    path("services/",          admin_services,      name="admin-services"),
    path("products/import/",   import_products,     name="admin-products-import"),
    path("products/template/", download_template,   name="admin-products-template"),
    path("products/<uuid:product_pk>/images/",
         AdminProductImageViewSet.as_view({"get": "list", "post": "create"}),
         name="admin-product-images"),
    path("products/<uuid:product_pk>/images/<uuid:pk>/",
         AdminProductImageViewSet.as_view({"delete": "destroy", "patch": "partial_update"}),
         name="admin-product-image-detail"),
    path("bookings/<uuid:pk>/status/", update_booking_status, name="admin-booking-status"),
    path("requests/<uuid:pk>/status/", update_request_status, name="admin-request-status"),
    path("", include(router.urls)),
]

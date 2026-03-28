# apps/analytics/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    dashboard_overview,
    AdminOrderViewSet,
    AdminProductViewSet,
    admin_users,
    admin_payments,
    admin_academy,
    admin_services,
    update_booking_status,
    update_request_status,
)
from .views import analytics_full
from .views import AdminCourseViewSet
from .views import admin_user_detail
from .views import AdminProductImageViewSet
from .views import AdminModuleViewSet, AdminLessonViewSet, AdminEnrollmentViewSet



router = DefaultRouter()
router.register("orders",   AdminOrderViewSet,   basename="admin-orders")
router.register("products", AdminProductViewSet, basename="admin-products")
router.register("courses", AdminCourseViewSet, basename="admin-courses")
router.register("product-images", AdminProductImageViewSet, basename="admin-product-images")
router.register("modules",     AdminModuleViewSet,     basename="admin-modules")
router.register("lessons",     AdminLessonViewSet,     basename="admin-lessons")
router.register("enrollments", AdminEnrollmentViewSet, basename="admin-enrollments")

urlpatterns = [
    path("dashboard/",  dashboard_overview,    name="admin-dashboard"),
    path("analytics/", analytics_full, name="admin-analytics"),
    path("users/",      admin_users,           name="admin-users"),
    path("users/<uuid:pk>/", admin_user_detail, name="admin-user-detail"),
    path("payments/",   admin_payments,        name="admin-payments"),
    path("academy/",    admin_academy,         name="admin-academy"),
    path("services/",   admin_services,        name="admin-services"),
    path("bookings/<uuid:pk>/status/",  update_booking_status,  name="admin-booking-status"),
    path("requests/<uuid:pk>/status/",  update_request_status,  name="admin-request-status"),
    path("", include(router.urls)),
]
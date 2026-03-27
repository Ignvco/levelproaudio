# apps/services/urls.py

from rest_framework.routers import DefaultRouter
from .views import (
    ServiceCategoryViewSet,
    ServiceViewSet,
    BookingViewSet,
    ServiceRequestViewSet,
)

router = DefaultRouter()
router.register("service-categories", ServiceCategoryViewSet, basename="service-category")
router.register("services",           ServiceViewSet,         basename="service")
router.register("bookings",           BookingViewSet,         basename="booking")
router.register("service-requests",   ServiceRequestViewSet,  basename="service-request")

urlpatterns = router.urls
"""
apps/rewards/urls_admin.py — rutas admin (montadas en /api/v1/admin/rewards/).
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views_admin import (
    AdminCampaignViewSet,
    AdminRewardProductViewSet,
    AdminEntryViewSet,
    AdminWinnerViewSet,
    rewards_dashboard,
)


router = DefaultRouter()
router.register(r"campaigns", AdminCampaignViewSet,      basename="admin-rewards-campaigns")
router.register(r"products",  AdminRewardProductViewSet, basename="admin-rewards-products")
router.register(r"entries",   AdminEntryViewSet,         basename="admin-rewards-entries")
router.register(r"winners",   AdminWinnerViewSet,        basename="admin-rewards-winners")

urlpatterns = [
    path("dashboard/", rewards_dashboard, name="admin-rewards-dashboard"),
    path("", include(router.urls)),
]

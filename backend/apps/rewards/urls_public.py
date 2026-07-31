"""
apps/rewards/urls_public.py — rutas públicas (montadas en /api/v1/rewards/).
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CampaignPublicViewSet,
    CartPreviewView,
    MyEntriesView,
    BuyStickersView,
    WinnersPublicView,
    ProductParticipationView,
)


router = DefaultRouter()
router.register(r"campaigns", CampaignPublicViewSet, basename="rewards-public-campaigns")

urlpatterns = [
    path("preview/",           CartPreviewView.as_view(),        name="rewards-preview"),
    path("my-entries/",        MyEntriesView.as_view(),          name="rewards-my-entries"),
    path("campaigns/<slug:slug>/buy/", BuyStickersView.as_view(), name="rewards-buy-stickers"),
    path("winners/",           WinnersPublicView.as_view(),      name="rewards-winners"),
    path("product/<slug:slug>/", ProductParticipationView.as_view(), name="rewards-product"),
    path("", include(router.urls)),
]

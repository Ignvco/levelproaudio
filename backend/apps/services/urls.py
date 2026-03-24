# apps/services/urls.py
# Endpoints de servicios profesionales

from rest_framework.routers import DefaultRouter
from .views import ServiceViewSet


router = DefaultRouter()

router.register(r'services', ServiceViewSet, basename='services')


urlpatterns = router.urls
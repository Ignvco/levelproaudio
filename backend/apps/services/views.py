# apps/services/views.py
# API de servicios profesionales

from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import Service
from .serializers import ServiceSerializer


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Servicios ofrecidos por LevelPro.

    GET /api/v1/services/
    GET /api/v1/services/{slug}/
    """

    queryset = Service.objects.filter(is_active=True)

    serializer_class = ServiceSerializer

    permission_classes = [AllowAny]

    lookup_field = "slug"

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]

    search_fields = ["name", "description"]
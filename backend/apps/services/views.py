# apps/services/views.py

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import ServiceCategory, Service, Booking, ServiceRequest
from .serializers import (
    ServiceCategorySerializer,
    ServiceListSerializer,
    ServiceDetailSerializer,
    BookingSerializer,
    ServiceRequestSerializer,
)


class ServiceCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/v1/service-categories/
    GET /api/v1/service-categories/{slug}/
    """
    queryset         = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [AllowAny]
    lookup_field     = "slug"


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/v1/services/              → catálogo
    GET /api/v1/services/{slug}/       → detalle
    GET /api/v1/services/?is_featured=true → destacados
    GET /api/v1/services/?category__slug=produccion → filtro
    """
    queryset = Service.objects.filter(
        is_active=True
    ).select_related("category")
    lookup_field   = "slug"
    permission_classes = [AllowAny]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = {
        "category__slug": ["exact"],
        "price_type":     ["exact"],
        "is_featured":    ["exact"],
    }
    search_fields  = ["name", "description", "short_description"]
    ordering_fields = ["price", "order", "name"]
    ordering       = ["order", "name"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ServiceDetailSerializer
        return ServiceListSerializer


class BookingViewSet(viewsets.ModelViewSet):
    """
    GET    /api/v1/bookings/        → mis reservas
    POST   /api/v1/bookings/        → crear reserva
    GET    /api/v1/bookings/{id}/   → detalle
    DELETE /api/v1/bookings/{id}/   → cancelar
    """
    serializer_class   = BookingSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return Booking.objects.filter(
            user=self.request.user
        ).select_related("service").order_by("-created_at")

    def destroy(self, request, *args, **kwargs):
        booking = self.get_object()
        if booking.status in ["completed"]:
            return Response(
                {"detail": "No puedes cancelar una reserva completada."},
                status=status.HTTP_400_BAD_REQUEST
            )
        booking.status = Booking.Status.CANCELLED
        booking.save(update_fields=["status"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ServiceRequestViewSet(viewsets.ModelViewSet):
    serializer_class   = ServiceRequestSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return ServiceRequest.objects.filter(
            user=self.request.user
        ).select_related("service").order_by("-created_at")

    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)
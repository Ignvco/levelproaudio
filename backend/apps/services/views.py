# apps/services/views.py

from rest_framework import viewsets, filters, status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import ServiceCategory, Service, Booking, ServiceRequest
from .serializers import (
    ServiceCategorySerializer,
    ServiceListSerializer,
    ServiceDetailSerializer,
    BookingSerializer,
    ServiceRequestSerializer,
)


class ServiceCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = ServiceCategory.objects.all()
    serializer_class   = ServiceCategorySerializer
    permission_classes = [AllowAny]
    lookup_field       = "slug"


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Service.objects.filter(
        is_active=True
    ).select_related("category")
    lookup_field       = "slug"
    permission_classes = [AllowAny]
    filter_backends    = [
        DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter
    ]
    filterset_fields = {
        "category__slug": ["exact"],
        "price_type":     ["exact"],
        "is_featured":    ["exact"],
    }
    search_fields   = ["name", "description", "short_description"]
    ordering_fields = ["price", "order", "name"]
    ordering        = ["order", "name"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ServiceDetailSerializer
        return ServiceListSerializer


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class   = BookingSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Booking.objects.none()
        return Booking.objects.filter(
            user=self.request.user
        ).select_related("service").order_by("-created_at")

    def destroy(self, request, *args, **kwargs):
        booking = self.get_object()
        if booking.status == "completed":
            return Response(
                {"detail": "No puedes cancelar una reserva completada."},
                status=status.HTTP_400_BAD_REQUEST
            )
        booking.status       = Booking.Status.CANCELLED
        booking.cancelled_at = timezone.now()  # ← registra fecha de cancelación
        booking.save(update_fields=["status", "cancelled_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ServiceRequestViewSet(viewsets.ModelViewSet):
    serializer_class   = ServiceRequestSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ServiceRequest.objects.none()
        return ServiceRequest.objects.filter(
            user=self.request.user
        ).select_related("service").order_by("-created_at")


class ServiceCheckoutView(APIView):
    """
    POST /api/v1/services/{slug}/checkout/
    Crea una orden pendiente para pagar un servicio de PRECIO FIJO.
    Admite moneda CLP, USD o ARS (respetando aislamiento multi-moneda).
    El frontend luego llama a /payments/create/ con el order_id.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        from apps.orders.models import Order, OrderItem
        from apps.site_settings.models import SiteSettings

        try:
            service = Service.objects.get(slug=slug, is_active=True)
        except Service.DoesNotExist:
            return Response({"error": "Servicio no encontrado."},
                            status=status.HTTP_404_NOT_FOUND)

        if service.price_type != Service.PriceType.FIXED or not service.price:
            return Response(
                {"error": "Este servicio no tiene precio fijo. Enviá una solicitud para cotizar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        currency = (request.data.get("currency") or "CLP").strip().upper()
        if currency not in ("CLP", "USD", "ARS"):
            return Response(
                {"error": "Moneda no soportada. Usa CLP, USD o ARS."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        site = SiteSettings.objects.first()
        prices = service.prices_by_currency(
            site.usd_to_clp if site else None,
            site.usd_to_ars if site else None,
        )
        unit_price = prices.get(currency)
        if unit_price is None or unit_price <= 0:
            return Response(
                {"error": f"No hay un precio válido configurado para {currency}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = Order.objects.create(
            stock_deductions={},  # Compra digital/servicio: no reserva inventario físico.
            user             = request.user,
            status           = "pending",
            total            = unit_price,
            currency         = currency,
            email            = request.user.email,
            shipping_address = "Servicio profesional — LevelPro Audio",
            notes            = f"Servicio contratado: {service.name}",
        )
        OrderItem.objects.create(
            order        = order,
            product      = None,
            product_name = f"Servicio · {service.name}",
            price        = unit_price,
            quantity     = 1,
        )

        return Response(
            {"order_id": str(order.id), "total": float(unit_price), "currency": currency},
            status=status.HTTP_201_CREATED,
        )
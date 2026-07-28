"""
apps/rewards/views.py — endpoints PÚBLICOS (usuario / sitio web).

- GET  /api/v1/rewards/              → lista campañas activas
- GET  /api/v1/rewards/{slug}/       → detalle de campaña
- POST /api/v1/rewards/preview/      → cotiza participaciones para un carrito
- GET  /api/v1/rewards/my-entries/   → participaciones del usuario logueado
- GET  /api/v1/rewards/winners/      → historial de ganadores públicos
"""
from rest_framework import viewsets, views, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.orders.models import Cart
from .models      import Campaign, Winner, CampaignStatus
from .selectors   import (
    get_active_campaigns,
    get_entries_preview_for_cart,
    get_user_entries_grouped,
)
from .serializers import (
    CampaignPublicSerializer,
    WinnerPublicSerializer,
    UserEntriesGroupedSerializer,
)


class CampaignPublicViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/v1/rewards/          → campañas activas (destacadas primero)
    GET /api/v1/rewards/{slug}/   → detalle de una campaña por slug
    GET /api/v1/rewards/all/      → todas las campañas (activas y finalizadas)
    """
    serializer_class   = CampaignPublicSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field       = "slug"

    def get_queryset(self):
        # Por defecto sólo activas
        return get_active_campaigns()

    @action(detail=False, methods=["get"], url_path="all")
    def all_campaigns(self, request):
        qs = Campaign.objects.exclude(status=CampaignStatus.DRAFT).order_by("-draw_date")
        return Response(self.get_serializer(qs, many=True).data)


class CartPreviewView(views.APIView):
    """
    POST /api/v1/rewards/preview/
    body: { "items": [{"product_id": "uuid", "quantity": 1}, ...] }
      o vacío → usa el carrito activo del usuario logueado.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        items = request.data.get("items")

        if not items and request.user.is_authenticated:
            cart = Cart.objects.filter(user=request.user, is_active=True).first()
            if cart:
                items = [
                    {"product_id": str(ci.product_id), "quantity": ci.quantity}
                    for ci in cart.items.all()
                ]
            else:
                items = []

        if not items:
            return Response({"campaigns": [], "total_entries": 0})

        preview = get_entries_preview_for_cart(items)
        return Response({
            "campaigns": [
                {
                    "campaign_id":   str(p["campaign"].id),
                    "campaign_name": p["campaign"].name,
                    "campaign_slug": p["campaign"].slug,
                    "draw_date":     p["campaign"].draw_date.isoformat(),
                    "entries":       p["entries_count"],
                }
                for p in preview
            ],
            "total_entries": sum(p["entries_count"] for p in preview),
        })


class MyEntriesView(views.APIView):
    """
    GET /api/v1/rewards/my-entries/
    Devuelve las campañas donde el usuario tiene participaciones agrupadas
    con conteo + estado de si ganó.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = get_user_entries_grouped(request.user)
        ser = UserEntriesGroupedSerializer(qs, many=True, context={"request": request})
        return Response({"results": ser.data})


class WinnersPublicView(views.APIView):
    """
    GET /api/v1/rewards/winners/  → todos los ganadores (histórico público)
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Winner.objects.select_related("campaign").order_by("-created_at")
        return Response({
            "results": WinnerPublicSerializer(qs, many=True).data,
        })


class ProductParticipationView(views.APIView):
    """
    GET /api/v1/rewards/product/{slug}/
    Retorna las campañas activas en las que participa un producto.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        from apps.products.models import Product
        from .selectors import get_product_participation

        try:
            product = Product.objects.get(slug=slug)
        except Product.DoesNotExist:
            return Response({"campaigns": []}, status=status.HTTP_200_OK)

        rps = get_product_participation(product)
        return Response({
            "campaigns": [{
                "campaign_id":   str(rp.campaign.id),
                "campaign_name": rp.campaign.name,
                "campaign_slug": rp.campaign.slug,
                "main_prize":    rp.campaign.main_prize,
                "draw_date":     rp.campaign.draw_date.isoformat(),
                "entries_per_purchase": rp.entries_per_purchase,
            } for rp in rps],
        })

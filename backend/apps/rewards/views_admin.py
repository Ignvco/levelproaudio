"""
apps/rewards/views_admin.py — endpoints ADMIN (staff only).

Rutas bajo /api/v1/admin/rewards/
- campaigns/       CRUD Campaign
- campaigns/{id}/draw/     POST → ejecuta sorteo
- campaigns/{id}/duplicate/ POST → duplica campaña
- products/        CRUD RewardProduct
- entries/         Read-only + filtros + export CSV
- winners/         Read + update (notas, evidencia)
- dashboard/       KPIs generales
"""
import csv
from django.http import HttpResponse
from django.db.models import Sum, Count, Q
from django.utils import timezone

from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.admin_permissions import IsAdminOrStaff
from apps.orders.models import Order, OrderItem

from .models      import Campaign, RewardProduct, Entry, Winner, CampaignStatus
from .services    import run_draw, DrawError
from .serializers import (
    AdminCampaignSerializer,
    AdminRewardProductSerializer,
    AdminEntrySerializer,
    AdminWinnerSerializer,
)


# ═══════════════════════════════════════════════════════════════
# CAMPAIGNS
# ═══════════════════════════════════════════════════════════════

class AdminCampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = AdminCampaignSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["name", "main_prize"]
    ordering_fields    = ["created_at", "draw_date", "status"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        return Campaign.objects.all().order_by("-created_at")

    @action(detail=True, methods=["post"])
    def draw(self, request, pk=None):
        """POST /admin/rewards/campaigns/{id}/draw/ → sortea la campaña."""
        campaign = self.get_object()
        try:
            winners = run_draw(campaign, request.user)
        except DrawError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "detail": f"Sorteo ejecutado. {len(winners)} ganador(es).",
                "winners": AdminWinnerSerializer(winners, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        """POST /admin/rewards/campaigns/{id}/duplicate/ → clona la campaña."""
        original = self.get_object()
        rps      = list(original.reward_products.all())

        original.pk       = None
        original.id       = None
        original.name     = f"{original.name} (copia)"
        original.slug     = ""
        original.status   = CampaignStatus.DRAFT
        original.drawn_at = None
        original.drawn_by = None
        original.save()

        for rp in rps:
            RewardProduct.objects.create(
                campaign             = original,
                product              = rp.product,
                entries_per_purchase = rp.entries_per_purchase,
                is_active            = rp.is_active,
            )

        return Response(AdminCampaignSerializer(original).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def finish(self, request, pk=None):
        """POST /admin/rewards/campaigns/{id}/finish/ → fuerza a Finalizada."""
        campaign = self.get_object()
        campaign.status = CampaignStatus.FINISHED
        campaign.save(update_fields=["status"])
        return Response({"status": campaign.status})


# ═══════════════════════════════════════════════════════════════
# REWARD PRODUCTS
# ═══════════════════════════════════════════════════════════════

class AdminRewardProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = AdminRewardProductSerializer
    parser_classes     = [JSONParser]

    def get_queryset(self):
        qs = RewardProduct.objects.select_related("campaign", "product").all()
        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return qs


# ═══════════════════════════════════════════════════════════════
# ENTRIES
# ═══════════════════════════════════════════════════════════════

class AdminEntryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = AdminEntrySerializer
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["unique_code", "user__email"]
    ordering_fields    = ["created_at"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = Entry.objects.select_related(
            "user", "campaign", "order", "product"
        ).all()

        for field in ("campaign", "user", "order", "product"):
            val = self.request.query_params.get(field)
            if val:
                qs = qs.filter(**{f"{field}_id": val})

        date_from = self.request.query_params.get("date_from")
        date_to   = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        """GET /admin/rewards/entries/export/?campaign=<id> → CSV"""
        qs = self.get_queryset()
        resp = HttpResponse(content_type="text/csv")
        resp["Content-Disposition"] = 'attachment; filename="participaciones.csv"'
        writer = csv.writer(resp)
        writer.writerow(["Código", "Campaña", "Usuario", "Email",
                         "Orden", "Producto", "Fecha"])
        for e in qs.iterator(chunk_size=500):
            writer.writerow([
                e.unique_code,
                e.campaign.name,
                f"{e.user.first_name} {e.user.last_name}".strip(),
                e.user.email,
                str(e.order.id)[:8].upper(),
                e.product.name if e.product else "—",
                e.created_at.strftime("%Y-%m-%d %H:%M"),
            ])
        return resp


# ═══════════════════════════════════════════════════════════════
# WINNERS
# ═══════════════════════════════════════════════════════════════

class AdminWinnerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = AdminWinnerSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    http_method_names  = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = Winner.objects.select_related("campaign", "entry", "user").all()
        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return qs.order_by("campaign", "backup_position")


# ═══════════════════════════════════════════════════════════════
# DASHBOARD (KPIs Admin)
# ═══════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def rewards_dashboard(request):
    """
    GET /api/v1/admin/rewards/dashboard/
    KPIs generales del módulo Rewards.
    """
    now = timezone.now()
    active = Campaign.objects.filter(status=CampaignStatus.ACTIVE)
    current = active.filter(end_date__gte=now).order_by("draw_date").first()

    total_campaigns   = Campaign.objects.count()
    total_entries     = Entry.objects.count()
    total_participants = Entry.objects.values("user").distinct().count()

    # Ventas relacionadas: órdenes que generaron entries
    related_orders = (
        Entry.objects.values("order").distinct()
    )
    related_revenue = (
        Order.objects
        .filter(id__in=related_orders.values("order"),
                status__in=["paid", "shipped", "completed"])
        .aggregate(t=Sum("total"))["t"] or 0
    )

    current_data = None
    if current:
        current_data = {
            "id":                 str(current.id),
            "name":               current.name,
            "slug":               current.slug,
            "main_prize":         current.main_prize,
            "draw_date":          current.draw_date.isoformat(),
            "end_date":           current.end_date.isoformat(),
            "total_entries":      current.entries.count(),
            "total_participants": current.entries.values("user").distinct().count(),
            "products_count":     current.reward_products.filter(is_active=True).count(),
        }
        # Conversión: participantes / clientes únicos que compraron en el periodo
        buyers_in_window = (
            Order.objects
            .filter(status__in=["paid", "shipped", "completed"],
                    created_at__gte=current.start_date,
                    created_at__lte=current.end_date)
            .values("user").distinct().count()
        )
        current_data["conversion_rate"] = round(
            (current_data["total_participants"] / buyers_in_window) * 100, 1
        ) if buyers_in_window else 0

        # Tiempo restante en segundos
        remaining = current.draw_date - now
        current_data["seconds_remaining"] = max(0, int(remaining.total_seconds()))

    return Response({
        "totals": {
            "campaigns":        total_campaigns,
            "entries":          total_entries,
            "participants":     total_participants,
            "related_revenue":  float(related_revenue),
        },
        "current_campaign": current_data,
        "recent_campaigns": [
            {
                "id":     str(c.id),
                "name":   c.name,
                "status": c.status,
                "entries": c.entries.count(),
                "draw_date": c.draw_date.isoformat(),
            }
            for c in Campaign.objects.order_by("-created_at")[:5]
        ],
    })

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
from django.db.models import Count, Q
from apps.analytics.currency import requested_currency, currency_error, summarize_by_currency
from django.utils import timezone

from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    MODULE_MARKETING,
    MODULE_ORDERS,
    PERM_EXPORT_DATA,
    PERM_VIEW_FINANCES,
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
    ROLE_MARKETING,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability, user_has_module_access
from apps.orders.models import Order, OrderItem

from .models      import Campaign, RewardProduct, Entry, Winner, CampaignStatus
from .services    import run_draw, DrawError
from .serializers import (
    AdminCampaignSerializer,
    AdminRewardProductSerializer,
    AdminEntrySerializer,
    AdminWinnerSerializer,
)
from core.audit.services import record_audit_event
from core.audit.sanitizer import sanitize_csv_cell
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_MODIFICATION,
    CATEGORY_DELETION,
    CATEGORY_EXPORT,
    SEVERITY_INFO,
    SEVERITY_WARNING,
    RESULT_SUCCESS,
)


# ═══════════════════════════════════════════════════════════════
# CAMPAIGNS
# ═══════════════════════════════════════════════════════════════

class AdminCampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    rbac_module        = MODULE_MARKETING
    rbac_allowed_roles_by_method = {
        "create": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "update": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "partial_update": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "duplicate": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "finish": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "draw": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT],
        "destroy": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT],
    }
    serializer_class   = AdminCampaignSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["name", "main_prize"]
    ordering_fields    = ["created_at", "draw_date", "status"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        return Campaign.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        instance = serializer.save()
        record_audit_event(
            module="marketing",
            action="REWARDS_CAMPAIGN_CREATED",
            event_category=CATEGORY_CREATION,
            resource_type="Campaign",
            resource_id=str(instance.id),
            resource_repr=f"Campaña {instance.name}",
            actor=self.request.user,
            new_values={"name": instance.name, "status": instance.status},
            mandatory=True,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        record_audit_event(
            module="marketing",
            action="REWARDS_CAMPAIGN_UPDATED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="Campaign",
            resource_id=str(instance.id),
            resource_repr=f"Campaña {instance.name}",
            actor=self.request.user,
            new_values={"name": instance.name, "status": instance.status},
            mandatory=True,
        )

    def perform_destroy(self, instance):
        cid = str(instance.id)
        name = instance.name
        instance.delete()
        record_audit_event(
            module="marketing",
            action="REWARDS_CAMPAIGN_DELETED",
            event_category=CATEGORY_DELETION,
            resource_type="Campaign",
            resource_id=cid,
            resource_repr=f"Campaña {name}",
            actor=self.request.user,
            severity=SEVERITY_WARNING,
            mandatory=True,
        )

    @action(detail=True, methods=["post"])
    def draw(self, request, pk=None):
        """POST /admin/rewards/campaigns/{id}/draw/ → sortea la campaña."""
        campaign = self.get_object()
        try:
            winners = run_draw(campaign, request.user)
        except DrawError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        record_audit_event(
            module="marketing",
            action="REWARDS_CAMPAIGN_DRAWN",
            event_category=CATEGORY_MODIFICATION,
            resource_type="Campaign",
            resource_id=str(campaign.id),
            resource_repr=f"Sorteo ejecutado en Campaña {campaign.name}",
            actor=request.user,
            severity=SEVERITY_WARNING,
            metadata={"winners_count": len(winners)},
            mandatory=True,
        )

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

        record_audit_event(
            module="marketing",
            action="REWARDS_CAMPAIGN_DUPLICATED",
            event_category=CATEGORY_CREATION,
            resource_type="Campaign",
            resource_id=str(original.id),
            resource_repr=f"Campaña clonada: {original.name}",
            actor=request.user,
            mandatory=True,
        )

        return Response(AdminCampaignSerializer(original).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def finish(self, request, pk=None):
        """POST /admin/rewards/campaigns/{id}/finish/ → fuerza a Finalizada."""
        campaign = self.get_object()
        campaign.status = CampaignStatus.FINISHED
        campaign.save(update_fields=["status"])

        record_audit_event(
            module="marketing",
            action="REWARDS_CAMPAIGN_FINISHED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="Campaign",
            resource_id=str(campaign.id),
            resource_repr=f"Campaña finalizada: {campaign.name}",
            actor=request.user,
            severity=SEVERITY_WARNING,
            mandatory=True,
        )

        return Response({"status": campaign.status})


# ═══════════════════════════════════════════════════════════════
# REWARD PRODUCTS
# ═══════════════════════════════════════════════════════════════

class AdminRewardProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    rbac_module        = MODULE_MARKETING
    rbac_allowed_roles_by_method = {
        "create": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "update": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "partial_update": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "destroy": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
    }
    serializer_class   = AdminRewardProductSerializer
    parser_classes     = [JSONParser]

    def get_queryset(self):
        qs = RewardProduct.objects.select_related("campaign", "product").all()
        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        record_audit_event(
            module="marketing",
            action="REWARDS_PRODUCT_CREATED",
            event_category=CATEGORY_CREATION,
            resource_type="RewardProduct",
            resource_id=str(instance.id),
            resource_repr=f"Producto Reward #{instance.id} (Campaña {instance.campaign.name})",
            actor=self.request.user,
            mandatory=True,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        record_audit_event(
            module="marketing",
            action="REWARDS_PRODUCT_UPDATED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="RewardProduct",
            resource_id=str(instance.id),
            resource_repr=f"Producto Reward #{instance.id} (Campaña {instance.campaign.name})",
            actor=self.request.user,
            mandatory=True,
        )

    def perform_destroy(self, instance):
        rpid = str(instance.id)
        cname = instance.campaign.name
        instance.delete()
        record_audit_event(
            module="marketing",
            action="REWARDS_PRODUCT_DELETED",
            event_category=CATEGORY_DELETION,
            resource_type="RewardProduct",
            resource_id=rpid,
            resource_repr=f"Producto Reward #{rpid} eliminado de {cname}",
            actor=self.request.user,
            severity=SEVERITY_WARNING,
            mandatory=True,
        )


# ═══════════════════════════════════════════════════════════════
# ENTRIES
# ═══════════════════════════════════════════════════════════════

class AdminEntryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminOrStaff]
    rbac_module        = MODULE_MARKETING
    rbac_capability_by_method = {
        "export_csv": PERM_EXPORT_DATA,
    }
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
        qs = self.filter_queryset(self.get_queryset())
        resp = HttpResponse(content_type="text/csv")
        resp["Content-Disposition"] = 'attachment; filename="participaciones.csv"'
        writer = csv.writer(resp)
        writer.writerow(["Código", "Campaña", "Usuario", "Email",
                         "Orden", "Producto", "Fecha"])
        for e in qs.iterator(chunk_size=500):
            writer.writerow([
                sanitize_csv_cell(e.unique_code),
                sanitize_csv_cell(e.campaign.name),
                sanitize_csv_cell(f"{e.user.first_name} {e.user.last_name}".strip()),
                sanitize_csv_cell(e.user.email),
                sanitize_csv_cell(str(e.order.id)[:8].upper()),
                sanitize_csv_cell(e.product.name if e.product else "—"),
                sanitize_csv_cell(e.created_at.strftime("%Y-%m-%d %H:%M")),
            ])

        record_audit_event(
            module="marketing",
            action="SENSITIVE_DATA_EXPORTED",
            event_category=CATEGORY_EXPORT,
            resource_type="RewardEntries",
            resource_id="participaciones.csv",
            resource_repr="Exportación CSV de participaciones Rewards",
            actor=request.user,
            severity=SEVERITY_WARNING,
            mandatory=True,
        )

        return resp


# ═══════════════════════════════════════════════════════════════
# WINNERS
# ═══════════════════════════════════════════════════════════════

class AdminWinnerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    rbac_module        = MODULE_MARKETING
    rbac_allowed_roles_by_method = {
        "create": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "partial_update": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING],
        "destroy": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT],
    }
    serializer_class   = AdminWinnerSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    http_method_names  = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = Winner.objects.select_related("campaign", "entry", "user").all()
        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return qs.order_by("campaign", "backup_position")

    def perform_update(self, serializer):
        instance = serializer.save()
        record_audit_event(
            module="marketing",
            action="REWARDS_WINNER_UPDATED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="Winner",
            resource_id=str(instance.id),
            resource_repr=f"Ganador #{instance.id} (Campaña {instance.campaign.name})",
            actor=self.request.user,
            mandatory=True,
        )


# ═══════════════════════════════════════════════════════════════
# DASHBOARD (KPIs Admin)
# ═══════════════════════════════════════════════════════════════

@rbac_endpoint(module=MODULE_MARKETING)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def rewards_dashboard(request):
    """
    GET /api/v1/admin/rewards/dashboard/
    KPIs generales del módulo Rewards.
    """
    currency = requested_currency(request)
    if currency is None:
        return currency_error()

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
    qualifying_orders = Order.objects.filter(
        id__in=related_orders.values("order"),
        status__in=["paid", "shipped", "completed"],
    )
    related_revenue_by_currency = summarize_by_currency(qualifying_orders)
    related_revenue = related_revenue_by_currency[currency]

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

    can_see_finances = is_effective_super_admin(request.user) or user_has_capability(request.user, PERM_VIEW_FINANCES)

    return Response({
        "currency": currency,
        "related_revenue_by_currency": related_revenue_by_currency if can_see_finances else None,
        "totals": {
            "campaigns":        total_campaigns,
            "entries":          total_entries,
            "participants":     total_participants,
            "related_revenue":  float(related_revenue) if can_see_finances else None,
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

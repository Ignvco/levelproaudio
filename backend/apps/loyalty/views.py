from core.api_errors import api_error_response
from django.db import transaction
from core.audit.services import record_audit_event
from core.audit.constants import (
    CATEGORY_CONFIG_CHANGE,
    CATEGORY_FINANCIAL_OPERATION,
    SEVERITY_INFO,
    SEVERITY_WARNING,
    RESULT_SUCCESS,
)
# apps/loyalty/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.generics import ListAPIView
from rest_framework import serializers as drf_serializers
from .models import LoyaltyAccount, LoyaltyTransaction, LoyaltyConfig


class LoyaltyTransactionSerializer(drf_serializers.ModelSerializer):
    fecha = drf_serializers.DateTimeField(source="created_at", format="%d/%m/%Y")

    class Meta:
        model  = LoyaltyTransaction
        fields = ["tipo", "puntos", "descripcion", "fecha"]


class LoyaltyTransactionsView(ListAPIView):
    """
    GET /api/v1/loyalty/transactions/ — historial completo paginado
    (20 por página). my_loyalty() solo trae los últimos 10 para el resumen;
    esta vista es para "ver todo el historial" en Mis puntos.
    """
    serializer_class   = LoyaltyTransactionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class    = PageNumberPagination

    def get_queryset(self):
        account, _ = LoyaltyAccount.objects.get_or_create(user=self.request.user)
        return account.transactions.all()


# ── Vista del cliente ─────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_loyalty(request):
    """GET /api/v1/loyalty/me/ — cuenta del usuario autenticado"""
    account, _ = LoyaltyAccount.objects.get_or_create(user=request.user)
    config     = LoyaltyConfig.get()

    siguiente_nivel, puntos_para_siguiente = account.nivel_siguiente
    progreso = 0
    if puntos_para_siguiente:
        umbrales = {"bronze": 0, "silver": 1000, "gold": 5000, "platinum": 15000}
        actual_min = umbrales.get(account.nivel, 0)
        progreso = min(
            int((account.puntos_totales - actual_min) /
                (puntos_para_siguiente - actual_min) * 100),
            100
        )

    transactions = account.transactions.all()[:10]
    proxima_exp  = account.proxima_expiracion()

    return Response({
        "nivel":              account.nivel,
        "puntos_disponibles": account.puntos_disponibles,
        "puntos_totales":     account.puntos_totales,
        "puntos_canjeados":   account.puntos_canjeados,
        "valor_disponible":   int(account.puntos_disponibles * float(config.peso_por_punto)),
        "minimo_canje":       config.minimo_canje,
        "siguiente_nivel":    siguiente_nivel,
        "puntos_para_siguiente": puntos_para_siguiente,
        "progreso_nivel":     progreso,
        "proxima_expiracion": {
            "puntos": proxima_exp["puntos"],
            "fecha":  proxima_exp["fecha"].strftime("%d/%m/%Y"),
        } if proxima_exp else None,
        "transactions": [{
            "tipo":       t.tipo,
            "puntos":     t.puntos,
            "descripcion":t.descripcion,
            "fecha":      t.created_at.strftime("%d/%m/%Y"),
        } for t in transactions],
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def redeem_points(request):
    """POST /api/v1/loyalty/redeem/ — canjear puntos"""
    puntos = int(request.data.get("puntos", 0))
    try:
        account, _ = LoyaltyAccount.objects.get_or_create(user=request.user)
        descuento  = account.canjear_puntos(
            puntos,
            descripcion="Canje de puntos en checkout"
        )
        return Response({
            "descuento":          descuento,
            "puntos_canjeados":   puntos,
            "puntos_disponibles": account.puntos_disponibles,
        })
    except ValueError as e:
        return Response({"error": str(e)}, status=400)


# ── Vista admin ───────────────────────────────────────────────
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    MODULE_MARKETING,
    PERM_MANAGE_SETTINGS,
    PERM_APPLY_DISCOUNTS,
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
)


@rbac_endpoint(module=MODULE_MARKETING)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_loyalty_summary(request):
    """
    GET /api/v1/loyalty/admin/summary/
    Devuelve KPIs + lista completa de cuentas con métricas agregadas.
    """
    from django.db.models import Sum, Count, Q

    config = LoyaltyConfig.get()

    accounts_qs = (
        LoyaltyAccount.objects
        .select_related("user")
        .annotate(
            total_ganados=Sum(
                "transactions__puntos",
                filter=Q(transactions__tipo="earn"),
            ),
            total_canjeados=Sum(
                "transactions__puntos",
                filter=Q(transactions__tipo="redeem"),
            ),
        )
        .order_by("-puntos_totales")
    )

    accounts = [{
        "id":                 a.id,
        "user_id":            str(a.user.id),
        "user_email":         a.user.email,
        "user_name":          f"{a.user.first_name} {a.user.last_name}".strip() or a.user.email,
        "nivel":              a.nivel,
        "puntos_disponibles": a.puntos_disponibles,
        "puntos_totales":     a.puntos_totales,
        "puntos_canjeados":   a.puntos_canjeados,
        "total_ganados":      a.total_ganados or 0,
        "total_canjeados":    abs(a.total_canjeados or 0),
        "valor_disponible":   int(a.puntos_disponibles * float(config.peso_por_punto)),
    } for a in accounts_qs]

    total_issued = LoyaltyTransaction.objects.filter(
        tipo="earn"
    ).aggregate(t=Sum("puntos"))["t"] or 0
    total_redeemed = abs(LoyaltyTransaction.objects.filter(
        tipo="redeem"
    ).aggregate(t=Sum("puntos"))["t"] or 0)
    total_available = sum(a["puntos_disponibles"] for a in accounts)

    by_nivel = {
        "bronze":   accounts_qs.filter(nivel="bronze").count(),
        "silver":   accounts_qs.filter(nivel="silver").count(),
        "gold":     accounts_qs.filter(nivel="gold").count(),
        "platinum": accounts_qs.filter(nivel="platinum").count(),
    }

    return Response({
        "kpis": {
            "total_accounts":         len(accounts),
            "total_points_issued":    total_issued,
            "total_points_available": total_available,
            "total_points_redeemed":  total_redeemed,
            "by_nivel":               by_nivel,
        },
        "accounts": accounts,
    })


@rbac_endpoint(
    module=MODULE_MARKETING,
    capability_by_method={"PATCH": PERM_MANAGE_SETTINGS},
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAdminOrStaff])
def admin_loyalty_config(request):
    """GET/PATCH /api/v1/loyalty/admin/config/"""
    config = LoyaltyConfig.get()

    if request.method == "PATCH":
        fields = ["puntos_por_peso", "peso_por_punto", "minimo_canje",
                  "expiracion_dias", "is_active"]
        for f in fields:
            if f in request.data:
                setattr(config, f, request.data[f])
        config.save()

        record_audit_event(
            module="marketing",
            action="LOYALTY_CONFIG_UPDATED",
            event_category=CATEGORY_CONFIG_CHANGE,
            resource_type="LoyaltyConfig",
            resource_id=str(config.id),
            resource_repr="Configuración de Loyalty",
            actor=request.user,
            new_values={f: request.data[f] for f in fields if f in request.data},
            mandatory=True,
        )

    return Response({
        "puntos_por_peso":  float(config.puntos_por_peso),
        "peso_por_punto":   float(config.peso_por_punto),
        "minimo_canje":     config.minimo_canje,
        "expiracion_dias":  config.expiracion_dias,
        "is_active":        config.is_active,
    })


@rbac_endpoint(
    module=MODULE_MARKETING,
    capability=PERM_APPLY_DISCOUNTS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_adjust_points(request):
    """
    POST /api/v1/loyalty/admin/adjust/ — ajuste manual de puntos.
    Acepta `puntos`+`descripcion` o `points`+`reason` (compatibilidad frontend).
    """
    from rest_framework import serializers
    class AdjustmentRequest(serializers.Serializer):
        user_id = serializers.UUIDField()
        points = serializers.IntegerField(min_value=-2147483647, max_value=2147483647)
    payload = AdjustmentRequest(data={
        "user_id": request.data.get("user_id"),
        "points": request.data.get("puntos") or request.data.get("points") or 0,
    })
    if not payload.is_valid():
        return Response({"error": "Usuario o cantidad de puntos inválidos."}, status=400)
    user_id = payload.validated_data["user_id"]
    puntos = payload.validated_data["points"]
    descripcion = (
        request.data.get("descripcion")
        or request.data.get("reason")
        or "Ajuste manual"
    )

    if puntos == 0:
        return Response({"error": "Puntos no pueden ser 0"}, status=400)

    try:
        from apps.users.models import User
        user       = User.objects.get(id=user_id)
        account, _ = LoyaltyAccount.objects.get_or_create(user=user)
        if puntos > 0:
            account.agregar_puntos(puntos, descripcion)
        else:
            locked = LoyaltyAccount.objects.select_for_update().get(pk=account.pk)
            locked.puntos_canjeados += abs(puntos)
            locked.save(update_fields=["puntos_canjeados"])
            LoyaltyTransaction.objects.create(
                account     = locked,
                tipo        = "adjust",
                puntos      = puntos,
                descripcion = descripcion,
            )
            account.refresh_from_db()

        record_audit_event(
            module="marketing",
            action="LOYALTY_POINTS_ADJUSTED",
            event_category=CATEGORY_FINANCIAL_OPERATION,
            resource_type="LoyaltyPoints",
            resource_id=str(user_id),
            resource_repr=f"Ajuste de {puntos} puntos para usuario {user.email}",
            actor=request.user,
            new_values={"points": puntos, "reason": descripcion, "new_balance": account.puntos_disponibles},
            mandatory=True,
        )

        return Response({"puntos_disponibles": account.puntos_disponibles})
    except User.DoesNotExist:
        return Response({"error": "Usuario no encontrado"}, status=404)
    except Exception:
        transaction.set_rollback(True)
        return api_error_response(
            "No se pudo guardar el ajuste de puntos. Revisa el saldo antes de repetirlo.",
            operation="admin_adjust_points",
        )
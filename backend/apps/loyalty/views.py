# apps/loyalty/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import LoyaltyAccount, LoyaltyTransaction, LoyaltyConfig


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

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_loyalty_summary(request):
    """GET /api/v1/admin/loyalty/summary/"""
    from django.db.models import Sum, Count, Avg

    if not request.user.is_staff:
        return Response(status=403)

    accounts = LoyaltyAccount.objects.all()

    niveles = {
        "bronze":   accounts.filter(nivel="bronze").count(),
        "silver":   accounts.filter(nivel="silver").count(),
        "gold":     accounts.filter(nivel="gold").count(),
        "platinum": accounts.filter(nivel="platinum").count(),
    }

    total_puntos = accounts.aggregate(
        t=Sum("puntos_totales")
    )["t"] or 0

    top_clientes = LoyaltyAccount.objects.select_related("user").order_by(
        "-puntos_totales"
    )[:10]

    return Response({
        "total_cuentas":   accounts.count(),
        "total_puntos":    total_puntos,
        "niveles":         niveles,
        "top_clientes": [{
            "email":     a.user.email,
            "nivel":     a.nivel,
            "puntos":    a.puntos_disponibles,
            "total":     a.puntos_totales,
        } for a in top_clientes],
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def admin_loyalty_config(request):
    """GET/PATCH /api/v1/admin/loyalty/config/"""
    if not request.user.is_staff:
        return Response(status=403)

    config = LoyaltyConfig.get()

    if request.method == "PATCH":
        fields = ["puntos_por_peso", "peso_por_punto", "minimo_canje",
                  "expiracion_dias", "is_active"]
        for f in fields:
            if f in request.data:
                setattr(config, f, request.data[f])
        config.save()

    return Response({
        "puntos_por_peso":  float(config.puntos_por_peso),
        "peso_por_punto":   float(config.peso_por_punto),
        "minimo_canje":     config.minimo_canje,
        "expiracion_dias":  config.expiracion_dias,
        "is_active":        config.is_active,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_adjust_points(request):
    """POST /api/v1/admin/loyalty/adjust/ — ajuste manual de puntos"""
    if not request.user.is_staff:
        return Response(status=403)

    user_id     = request.data.get("user_id")
    puntos      = int(request.data.get("puntos", 0))
    descripcion = request.data.get("descripcion", "Ajuste manual")

    try:
        from apps.users.models import User
        user    = User.objects.get(id=user_id)
        account, _ = LoyaltyAccount.objects.get_or_create(user=user)
        if puntos > 0:
            account.agregar_puntos(puntos, descripcion)
        else:
            account.puntos_canjeados += abs(puntos)
            account.save(update_fields=["puntos_canjeados"])
            LoyaltyTransaction.objects.create(
                account     = account,
                tipo        = "adjust",
                puntos      = puntos,
                descripcion = descripcion,
            )
        return Response({"puntos_disponibles": account.puntos_disponibles})
    except Exception as e:
        return Response({"error": str(e)}, status=400)
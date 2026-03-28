# apps/analytics/views.py
# Endpoints del panel admin — métricas, gestión completa

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from django.db.models import Sum, Count, Avg, Q
from django.db.models.functions import TruncDay, TruncMonth
from django.utils import timezone
from datetime import timedelta
from core.admin_permissions import IsAdminOrStaff

from apps.orders.models import Order, OrderItem, OrderStatus
from apps.orders.serializers import OrderSerializer
from apps.products.models import Product, Category, Brand
from apps.products.serializers import ProductDetailSerializer, ProductListSerializer
from apps.users.models import User
from apps.payments.models import Payment, PaymentStatus
from apps.academy.models import Course, Enrollment
from apps.services.models import Service, Booking, ServiceRequest



# ── Dashboard overview ───────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def dashboard_overview(request):
    """
    GET /api/v1/admin/dashboard/
    Métricas principales del negocio.
    """
    now   = timezone.now()
    today = now.date()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_30     = now - timedelta(days=30)
    last_7      = now - timedelta(days=7)

    # ── Ventas ──────────────────────────────────────────────
    paid_orders = Order.objects.filter(status__in=["paid", "shipped", "completed"])

    total_revenue     = paid_orders.aggregate(t=Sum("total"))["t"] or 0
    revenue_this_month = paid_orders.filter(
        created_at__gte=month_start
    ).aggregate(t=Sum("total"))["t"] or 0
    revenue_last_30   = paid_orders.filter(
        created_at__gte=last_30
    ).aggregate(t=Sum("total"))["t"] or 0

    # ── Pedidos ──────────────────────────────────────────────
    total_orders    = Order.objects.count()
    pending_orders  = Order.objects.filter(status="pending").count()
    orders_today    = Order.objects.filter(created_at__date=today).count()
    orders_this_month = Order.objects.filter(created_at__gte=month_start).count()

    # ── Usuarios ─────────────────────────────────────────────
    total_users      = User.objects.count()
    new_users_month  = User.objects.filter(date_joined__gte=month_start).count()
    new_users_week   = User.objects.filter(date_joined__gte=last_7).count()

    # ── Productos ────────────────────────────────────────────
    total_products   = Product.objects.filter(is_active=True).count()
    low_stock        = Product.objects.filter(is_active=True, stock__lte=5).count()
    out_of_stock     = Product.objects.filter(is_active=True, stock=0).count()

    # ── Academia ─────────────────────────────────────────────
    total_enrollments = Enrollment.objects.count()
    enrollments_month = Enrollment.objects.filter(created_at__gte=month_start).count()

    # ── Gráfico ventas últimos 30 días ───────────────────────
    sales_chart = (
        paid_orders
        .filter(created_at__gte=last_30)
        .annotate(day=TruncDay("created_at"))
        .values("day")
        .annotate(total=Sum("total"), count=Count("id"))
        .order_by("day")
    )

    # ── Top productos ────────────────────────────────────────
    top_products = (
        OrderItem.objects
        .filter(order__status__in=["paid", "shipped", "completed"])
        .values("product_name")
        .annotate(total_sold=Sum("quantity"), revenue=Sum("price"))
        .order_by("-total_sold")[:5]
    )

    # ── Últimas órdenes ──────────────────────────────────────
    recent_orders = Order.objects.select_related("user").order_by("-created_at")[:8]

    return Response({
        "revenue": {
            "total":       float(total_revenue),
            "this_month":  float(revenue_this_month),
            "last_30_days": float(revenue_last_30),
        },
        "orders": {
            "total":      total_orders,
            "pending":    pending_orders,
            "today":      orders_today,
            "this_month": orders_this_month,
        },
        "users": {
            "total":      total_users,
            "new_month":  new_users_month,
            "new_week":   new_users_week,
        },
        "products": {
            "total":     total_products,
            "low_stock": low_stock,
            "out_of_stock": out_of_stock,
        },
        "academy": {
            "total_enrollments": total_enrollments,
            "enrollments_month": enrollments_month,
        },
        "sales_chart": [
            {
                "date":  item["day"].strftime("%Y-%m-%d"),
                "total": float(item["total"]),
                "count": item["count"],
            }
            for item in sales_chart
        ],
        "top_products": list(top_products),
        "recent_orders": [
            {
                "id":      str(o.id),
                "email":   o.email,
                "total":   float(o.total),
                "status":  o.status,
                "created": o.created_at.strftime("%Y-%m-%d %H:%M"),
            }
            for o in recent_orders
        ],
    })


# ── Admin Orders ─────────────────────────────────────────────

class AdminOrderViewSet(viewsets.ModelViewSet):
    """
    GET    /api/v1/admin/orders/
    GET    /api/v1/admin/orders/{id}/
    PATCH  /api/v1/admin/orders/{id}/
    POST   /api/v1/admin/orders/{id}/update_status/
    """
    permission_classes = [IsAdminOrStaff]
    serializer_class   = OrderSerializer
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["email", "id"]
    ordering_fields    = ["created_at", "total", "status"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = Order.objects.select_related("user").prefetch_related("items").all()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        order      = self.get_object()
        new_status = request.data.get("status")
        valid      = [s[0] for s in OrderStatus.choices]

        if new_status not in valid:
            return Response({"error": f"Estado inválido. Opciones: {valid}"},
                status=status.HTTP_400_BAD_REQUEST)

        order.status = new_status
        order.save(update_fields=["status"])
        return Response({"status": new_status, "detail": "Estado actualizado."})


# ── Admin Products ───────────────────────────────────────────

class AdminProductViewSet(viewsets.ModelViewSet):
    """CRUD completo de productos para el admin."""
    permission_classes = [IsAdminOrStaff]
    serializer_class   = ProductDetailSerializer
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["name", "sku"]
    ordering_fields    = ["name", "price", "stock", "created_at"]
    ordering           = ["-created_at"]
    lookup_field       = "id"

    def get_queryset(self):
        return Product.objects.select_related(
            "category", "brand"
        ).prefetch_related("images").all()


# ── Admin Users ──────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_users(request):
    """GET /api/v1/admin/users/ — listado de usuarios con stats."""
    search = request.query_params.get("search", "")
    users  = User.objects.all().order_by("-date_joined")

    if search:
        users = users.filter(
            Q(email__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search)
        )

    data = []
    for u in users[:100]:
        orders_count = Order.objects.filter(user=u).count()
        total_spent  = Order.objects.filter(
            user=u, status__in=["paid", "shipped", "completed"]
        ).aggregate(t=Sum("total"))["t"] or 0

        data.append({
            "id":           str(u.id),
            "email":        u.email,
            "first_name":   u.first_name,
            "last_name":    u.last_name,
            "date_joined":  u.date_joined.strftime("%Y-%m-%d"),
            "is_active":    u.is_active,
            "orders_count": orders_count,
            "total_spent":  float(total_spent),
        })

    return Response({"results": data, "count": users.count()})


# ── Admin Payments ───────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_payments(request):
    """GET /api/v1/admin/payments/ — transacciones con filtros."""
    status_filter = request.query_params.get("status")
    payments = Payment.objects.select_related("order").order_by("-created_at")

    if status_filter:
        payments = payments.filter(status=status_filter)

    data = [{
        "id":          str(p.id),
        "order_id":    str(p.order.id),
        "order_email": p.order.email,
        "provider":    p.provider,
        "status":      p.status,
        "amount":      float(p.amount),
        "currency":    p.currency,
        "paid_at":     p.paid_at.strftime("%Y-%m-%d %H:%M") if p.paid_at else None,
        "created_at":  p.created_at.strftime("%Y-%m-%d %H:%M"),
    } for p in payments[:200]]

    total_approved = payments.filter(
        status="approved"
    ).aggregate(t=Sum("amount"))["t"] or 0

    return Response({
        "results": data,
        "total_approved": float(total_approved),
    })


# ── Admin Academy ────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_academy(request):
    """GET /api/v1/admin/academy/ — cursos con inscripciones."""
    courses = Course.objects.annotate(
        enrollment_count=Count("enrollments")
    ).order_by("-created_at")

    return Response({
        "results": [{
            "id":               str(c.id),
            "title":            c.title,
            "slug":             c.slug,
            "price":            float(c.price),
            "is_published":     c.is_published,
            "is_free":          c.is_free,
            "level":            c.level,
            "enrollment_count": c.enrollment_count,
            "total_lessons":    c.total_lessons,
        } for c in courses]
    })


# ── Admin Services ───────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_services(request):
    """GET /api/v1/admin/services/ — servicios + reservas + solicitudes."""
    bookings = Booking.objects.select_related(
        "user", "service"
    ).order_by("-created_at")[:50]

    requests_qs = ServiceRequest.objects.select_related(
        "user", "service"
    ).order_by("-created_at")[:50]

    return Response({
        "bookings": [{
            "id":             str(b.id),
            "user_email":     b.user.email,
            "service_name":   b.service.name,
            "scheduled_date": b.scheduled_date.strftime("%Y-%m-%d %H:%M"),
            "status":         b.status,
            "notes":          b.notes,
        } for b in bookings],

        "requests": [{
            "id":           str(r.id),
            "name":         r.name,
            "email":        r.email,
            "service_name": r.service.name if r.service else "General",
            "message":      r.message,
            "budget":       float(r.budget) if r.budget else None,
            "status":       r.status,
            "created_at":   r.created_at.strftime("%Y-%m-%d %H:%M"),
        } for r in requests_qs],
    })


# ── Admin update booking/request status ─────────────────────

@api_view(["PATCH"])
@permission_classes([IsAdminOrStaff])
def update_booking_status(request, pk):
    try:
        booking = Booking.objects.get(id=pk)
    except Booking.DoesNotExist:
        return Response({"error": "No encontrado."}, status=404)
    booking.status = request.data.get("status", booking.status)
    booking.save(update_fields=["status"])
    return Response({"status": booking.status})


@api_view(["PATCH"])
@permission_classes([IsAdminOrStaff])
def update_request_status(request, pk):
    try:
        sr = ServiceRequest.objects.get(id=pk)
    except ServiceRequest.DoesNotExist:
        return Response({"error": "No encontrado."}, status=404)
    sr.status       = request.data.get("status", sr.status)
    sr.admin_notes  = request.data.get("admin_notes", sr.admin_notes)
    sr.save(update_fields=["status", "admin_notes"])
    return Response({"status": sr.status})

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def analytics_full(request):
    """
    GET /api/v1/admin/analytics/
    Datos completos para la página de analytics.
    """
    now         = timezone.now()
    last_6m     = now - timedelta(days=180)
    last_12m    = now - timedelta(days=365)

    paid_orders = Order.objects.filter(
        status__in=["paid", "shipped", "completed"]
    )

    # ── Ventas por mes (12 meses) ────────────────────────────
    sales_by_month = (
        paid_orders
        .filter(created_at__gte=last_12m)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(total=Sum("total"), count=Count("id"))
        .order_by("month")
    )

    # ── Órdenes por estado ───────────────────────────────────
    orders_by_status = (
        Order.objects
        .values("status")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    # ── Nuevos usuarios por mes ──────────────────────────────
    users_by_month = (
        User.objects
        .filter(date_joined__gte=last_12m)
        .annotate(month=TruncMonth("date_joined"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    # ── Ingresos por método de pago ──────────────────────────
    revenue_by_provider = (
        Payment.objects
        .filter(status="approved")
        .values("provider")
        .annotate(total=Sum("amount"), count=Count("id"))
        .order_by("-total")
    )

    # ── Productos con bajo stock ─────────────────────────────
    low_stock_products = (
        Product.objects
        .filter(is_active=True, stock__lte=10)
        .order_by("stock")
        .values("name", "stock", "sku")[:15]
    )

    # ── Ingresos por categoría ───────────────────────────────
    revenue_by_category = (
        OrderItem.objects
        .filter(order__status__in=["paid", "shipped", "completed"])
        .filter(product__isnull=False)
        .values("product__category__name")
        .annotate(
            total=Sum("price"),
            count=Sum("quantity")
        )
        .order_by("-total")[:8]
    )

    # ── Inscripciones por mes ────────────────────────────────
    enrollments_by_month = (
        Enrollment.objects
        .filter(created_at__gte=last_12m)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    # ── KPIs resumen ─────────────────────────────────────────
    total_revenue     = paid_orders.aggregate(t=Sum("total"))["t"] or 0
    avg_order_value   = paid_orders.aggregate(a=Avg("total"))["a"] or 0
    total_customers   = Order.objects.values("user").distinct().count()
    repeat_customers  = (
        Order.objects
        .values("user")
        .annotate(c=Count("id"))
        .filter(c__gt=1)
        .count()
    )

    return Response({
        "kpis": {
            "total_revenue":    float(total_revenue),
            "avg_order_value":  float(avg_order_value),
            "total_customers":  total_customers,
            "repeat_customers": repeat_customers,
            "repeat_rate": round(
                (repeat_customers / total_customers * 100) if total_customers else 0, 1
            ),
        },
        "sales_by_month": [
            {
                "month": item["month"].strftime("%b %Y"),
                "total": float(item["total"]),
                "count": item["count"],
            }
            for item in sales_by_month
        ],
        "orders_by_status": [
            {
                "status": item["status"],
                "count":  item["count"],
            }
            for item in orders_by_status
        ],
        "users_by_month": [
            {
                "month": item["month"].strftime("%b %Y"),
                "count": item["count"],
            }
            for item in users_by_month
        ],
        "revenue_by_provider": [
            {
                "provider": item["provider"],
                "total":    float(item["total"]),
                "count":    item["count"],
            }
            for item in revenue_by_provider
        ],
        "low_stock_products": list(low_stock_products),
        "revenue_by_category": [
            {
                "category": item["product__category__name"] or "Sin categoría",
                "total":    float(item["total"]),
                "count":    item["count"],
            }
            for item in revenue_by_category
        ],
        "enrollments_by_month": [
            {
                "month": item["month"].strftime("%b %Y"),
                "count": item["count"],
            }
            for item in enrollments_by_month
        ],
    })
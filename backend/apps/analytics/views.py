# apps/analytics/views.py — VERSION LIMPIA SIN DUPLICADOS

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework import serializers as drf_serializers
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Sum, Count, Avg, Q
from django.db.models.functions import TruncDay, TruncMonth
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from datetime import timedelta
from core.admin_permissions import IsAdminOrStaff

from apps.orders.models import Order, OrderItem, OrderStatus
from apps.orders.serializers import OrderSerializer
from apps.products.models import Product, Category, Brand, ProductImage
from apps.products.serializers import (
    ProductDetailSerializer, ProductListSerializer, ProductImageSerializer, CategorySerializer, BrandSerializer
)
from apps.users.models import User
from apps.payments.models import Payment
from apps.academy.models import Course, Module, Lesson, Enrollment
from apps.services.models import Service, Booking, ServiceRequest
from apps.products.importers import import_from_excel, import_from_csv


# ═══════════════════════════════════════════════════════════
# SERIALIZERS
# ═══════════════════════════════════════════════════════════

class AdminCategorySerializer(drf_serializers.ModelSerializer):
    class Meta:
        model  = Category
        fields = ["id", "name", "slug", "description",
                  "parent", "is_active", "order", "image"]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
        }


class AdminBrandSerializer(drf_serializers.ModelSerializer):
    class Meta:
        model  = Brand
        fields = ["id", "name", "slug", "website", "is_active", "logo"]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
        }


class AdminModuleSerializer(drf_serializers.ModelSerializer):
    class Meta:
        model  = Module
        fields = ["id", "title", "order", "course"]


class AdminLessonSerializer(drf_serializers.ModelSerializer):
    class Meta:
        model  = Lesson
        fields = ["id", "title", "video_url", "description",
                  "order", "is_free", "duration_minutes", "module"]


class CourseAdminSerializer(drf_serializers.ModelSerializer):
    enrollment_count = drf_serializers.SerializerMethodField()
    total_lessons    = drf_serializers.SerializerMethodField()
    thumbnail_url    = drf_serializers.SerializerMethodField()

    class Meta:
        model  = Course
        fields = [
            "id", "title", "slug", "short_description", "description",
            "thumbnail", "thumbnail_url", "preview_url",
            "price", "level", "is_free", "is_published", "order",
            "enrollment_count", "total_lessons",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
        }

    def get_thumbnail_url(self, obj):
        # Path relativo — proxy Vite lo resuelve en dev
        if obj.thumbnail:
            return obj.thumbnail.url
        return None

    def get_enrollment_count(self, obj):
        return getattr(obj, "enrollment_count", obj.enrollments.count())

    def get_total_lessons(self, obj):
        return obj.total_lessons


class AdminProductWriteSerializer(drf_serializers.ModelSerializer):
    """Serializer para crear/editar productos — acepta IDs de categoría y marca."""
    class Meta:
        model  = Product
        fields = [
            "id", "name", "slug", "sku",
            "category", "brand",
            "short_description", "description",
            "price", "compare_price", "stock",
            "product_type", "is_active", "is_featured",
            "weight", "seo_title", "seo_description",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
        }


# ═══════════════════════════════════════════════════════════
# VIEWSETS
# ═══════════════════════════════════════════════════════════

class AdminOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = OrderSerializer
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["email", "id"]
    ordering_fields    = ["created_at", "total", "status"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = Order.objects.select_related("user").prefetch_related(
            "items", "payments"
        ).all()
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
            return Response(
                {"error": f"Estado inválido. Opciones: {valid}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        order.status = new_status
        order.save(update_fields=["status"])
        return Response({"status": new_status, "detail": "Estado actualizado."})


class AdminProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["name", "sku"]
    ordering_fields    = ["name", "price", "stock", "created_at"]
    ordering           = ["-created_at"]
    lookup_field       = "id"

    def get_queryset(self):
        return Product.objects.select_related(
            "category", "brand"
        ).prefetch_related("images").all()

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return ProductDetailSerializer
        return AdminProductWriteSerializer


class AdminCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = AdminCategorySerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    queryset           = Category.objects.all().order_by("order", "name")
    filter_backends    = [filters.SearchFilter]
    search_fields      = ["name"]
    
    def get_serializer_class(self):
        return CategorySerializer

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()



class AdminBrandViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = AdminBrandSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    queryset           = Brand.objects.all().order_by("name")
    filter_backends    = [filters.SearchFilter]
    search_fields      = ["name"]
    
    def get_serializer_class(self):
        return BrandSerializer

    def perform_create(self, serializer):
        serializer.save()


class AdminProductImageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    parser_classes     = [MultiPartParser, FormParser]
    serializer_class   = ProductImageSerializer

    def get_queryset(self):
        product_pk = self.kwargs.get("product_pk")
        if product_pk:
            return ProductImage.objects.filter(
                product_id=product_pk
            ).order_by("order")
        return ProductImage.objects.all().order_by("order")

    def get_serializer_class(self):
        return ProductImageSerializer

    def create(self, request, *args, **kwargs):
        product_pk = self.kwargs.get("product_pk")
        if not product_pk:
            return Response(
                {"error": "product_pk requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )

        image_file = request.FILES.get("image")
        if not image_file:
            return Response(
                {"error": "No se recibió ningún archivo. Envía 'image' como campo."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            product = Product.objects.get(id=product_pk)
        except Product.DoesNotExist:
            return Response({"error": "Producto no encontrado."}, status=404)

        is_first = not ProductImage.objects.filter(product=product).exists()

        img = ProductImage.objects.create(
            product    = product,
            image      = image_file,
            alt_text   = request.data.get("alt_text", product.name),
            order      = int(request.data.get("order", 0)),
            is_primary = (
                request.data.get("is_primary", "false").lower() == "true"
                or is_first
            ),
        )

        serializer = ProductImageSerializer(img, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def perform_create(self, serializer):
        from apps.products.models import Product
        product = Product.objects.get(id=self.kwargs["product_pk"])
        serializer.save(product=product)


class AdminCourseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = CourseAdminSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    lookup_field       = "id"

    def get_queryset(self):
        return Course.objects.annotate(
            enrollment_count=Count("enrollments")
        ).order_by("-created_at")


class AdminModuleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = AdminModuleSerializer
    parser_classes     = [JSONParser]

    def get_queryset(self):
        qs = Module.objects.all().order_by("order")
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs


class AdminLessonViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrStaff]
    serializer_class   = AdminLessonSerializer
    parser_classes     = [JSONParser]

    def get_queryset(self):
        qs = Lesson.objects.all().order_by("order")
        module_id = self.request.query_params.get("module")
        if module_id:
            qs = qs.filter(module_id=module_id)
        return qs


# ═══════════════════════════════════════════════════════════
# API VIEWS (funciones)
# ═══════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def dashboard_overview(request):
    now         = timezone.now()
    today       = now.date()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_30     = now - timedelta(days=30)
    last_7      = now - timedelta(days=7)

    paid_orders = Order.objects.filter(status__in=["paid", "shipped", "completed"])

    total_revenue      = paid_orders.aggregate(t=Sum("total"))["t"] or 0
    revenue_this_month = paid_orders.filter(
        created_at__gte=month_start
    ).aggregate(t=Sum("total"))["t"] or 0
    revenue_last_30    = paid_orders.filter(
        created_at__gte=last_30
    ).aggregate(t=Sum("total"))["t"] or 0

    total_orders      = Order.objects.count()
    pending_orders    = Order.objects.filter(status="pending").count()
    orders_today      = Order.objects.filter(created_at__date=today).count()
    orders_this_month = Order.objects.filter(created_at__gte=month_start).count()

    total_users     = User.objects.count()
    new_users_month = User.objects.filter(date_joined__gte=month_start).count()
    new_users_week  = User.objects.filter(date_joined__gte=last_7).count()

    total_products = Product.objects.filter(is_active=True).count()
    low_stock      = Product.objects.filter(is_active=True, stock__lte=5).count()
    out_of_stock   = Product.objects.filter(is_active=True, stock=0).count()

    total_enrollments = Enrollment.objects.count()
    enrollments_month = Enrollment.objects.filter(
        created_at__gte=month_start
    ).count()

    sales_chart = (
        paid_orders
        .filter(created_at__gte=last_30)
        .annotate(day=TruncDay("created_at"))
        .values("day")
        .annotate(total=Sum("total"), count=Count("id"))
        .order_by("day")
    )

    top_products = (
        OrderItem.objects
        .filter(order__status__in=["paid", "shipped", "completed"])
        .values("product_name")
        .annotate(total_sold=Sum("quantity"), revenue=Sum("price"))
        .order_by("-total_sold")[:5]
    )

    recent_orders = Order.objects.select_related("user").order_by("-created_at")[:8]

    return Response({
        "revenue": {
            "total":        float(total_revenue),
            "this_month":   float(revenue_this_month),
            "last_30_days": float(revenue_last_30),
        },
        "orders": {
            "total":      total_orders,
            "pending":    pending_orders,
            "today":      orders_today,
            "this_month": orders_this_month,
        },
        "users": {
            "total":     total_users,
            "new_month": new_users_month,
            "new_week":  new_users_week,
        },
        "products": {
            "total":        total_products,
            "low_stock":    low_stock,
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


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_users(request):
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


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_payments(request):
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

    return Response({"results": data, "total_approved": float(total_approved)})


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_academy(request):
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
            # Path relativo — proxy Vite lo resuelve
            "thumbnail":        c.thumbnail.url if c.thumbnail else None,
        } for c in courses]
    })


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_services(request):
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

    old_status     = sr.status
    sr.status      = request.data.get("status", sr.status)
    sr.admin_notes = request.data.get("admin_notes", sr.admin_notes)
    sr.save(update_fields=["status", "admin_notes"])

    # Acepta → crea Booking automáticamente
    if sr.status == "accepted" and old_status != "accepted" and sr.service:
        from django.utils import timezone as tz
        scheduled = (
            tz.datetime.combine(
                sr.preferred_date,
                tz.datetime.min.time()
            ).replace(tzinfo=tz.get_current_timezone())
            if sr.preferred_date
            else tz.now() + timedelta(days=7)
        )
        Booking.objects.get_or_create(
            user=sr.user,
            service=sr.service,
            defaults={
                "scheduled_date": scheduled,
                "notes":          sr.message,
                "status":         "confirmed",
            }
        )

    return Response({"status": sr.status})


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_create_enrollment(request):
    user_id   = request.data.get("user_id")
    course_id = request.data.get("course_id")
    try:
        user   = User.objects.get(id=user_id)
        course = Course.objects.get(id=course_id)
    except (User.DoesNotExist, Course.DoesNotExist) as e:
        return Response({"error": str(e)}, status=404)

    enrollment, created = Enrollment.objects.get_or_create(
        user=user, course=course
    )
    return Response({
        "created":       created,
        "enrollment_id": str(enrollment.id),
        "user":          user.email,
        "course":        course.title,
    })


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_enrollments(request):
    enrollments = Enrollment.objects.select_related(
        "user", "course"
    ).order_by("-created_at")[:200]

    return Response({
        "results": [{
            "id":           str(e.id),
            "user_email":   e.user.email,
            "user_name":    f"{e.user.first_name} {e.user.last_name}".strip(),
            "course_title": e.course.title,
            "course_id":    str(e.course.id),
            "progress":     e.progress_percentage,
            "created_at":   e.created_at.strftime("%Y-%m-%d"),
        } for e in enrollments]
    })


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def analytics_full(request):
    now      = timezone.now()
    last_12m = now - timedelta(days=365)
    last_30  = now - timedelta(days=30)

    paid_orders = Order.objects.filter(
        status__in=["paid", "shipped", "completed"]
    )

    sales_by_month = (
        paid_orders.filter(created_at__gte=last_12m)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(total=Sum("total"), count=Count("id"))
        .order_by("month")
    )

    orders_by_status = (
        Order.objects
        .values("status")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    users_by_month = (
        User.objects.filter(date_joined__gte=last_12m)
        .annotate(month=TruncMonth("date_joined"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    revenue_by_provider = (
        Payment.objects.filter(status="approved")
        .values("provider")
        .annotate(total=Sum("amount"), count=Count("id"))
        .order_by("-total")
    )

    low_stock_products = (
        Product.objects
        .filter(is_active=True, stock__lte=10)
        .order_by("stock")
        .values("name", "stock", "sku")[:15]
    )

    revenue_by_category = (
        OrderItem.objects
        .filter(
            order__status__in=["paid", "shipped", "completed"],
            product__isnull=False
        )
        .values("product__category__name")
        .annotate(total=Sum("price"), count=Sum("quantity"))
        .order_by("-total")[:8]
    )

    enrollments_by_month = (
        Enrollment.objects.filter(created_at__gte=last_12m)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    total_revenue    = paid_orders.aggregate(t=Sum("total"))["t"] or 0
    avg_order_value  = paid_orders.aggregate(a=Avg("total"))["a"] or 0
    total_customers  = Order.objects.values("user").distinct().count()
    repeat_customers = (
        Order.objects.values("user")
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
                (repeat_customers / total_customers * 100)
                if total_customers else 0, 1
            ),
        },
        "sales_by_month": [
            {"month": i["month"].strftime("%b %Y"),
             "total": float(i["total"]), "count": i["count"]}
            for i in sales_by_month
        ],
        "orders_by_status": [
            {"status": i["status"], "count": i["count"]}
            for i in orders_by_status
        ],
        "users_by_month": [
            {"month": i["month"].strftime("%b %Y"), "count": i["count"]}
            for i in users_by_month
        ],
        "revenue_by_provider": [
            {"provider": i["provider"],
             "total": float(i["total"]), "count": i["count"]}
            for i in revenue_by_provider
        ],
        "low_stock_products": list(low_stock_products),
        "revenue_by_category": [
            {"category": i["product__category__name"] or "Sin categoría",
             "total": float(i["total"]), "count": i["count"]}
            for i in revenue_by_category
        ],
        "enrollments_by_month": [
            {"month": i["month"].strftime("%b %Y"), "count": i["count"]}
            for i in enrollments_by_month
        ],
    })

@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def import_products(request):
    """
    POST /api/v1/admin/products/import/
    Acepta .xlsx o .csv y crea/actualiza productos masivamente.
    """
    file = request.FILES.get("file")
    if not file:
        return Response({"error": "No se envió ningún archivo."}, status=400)

    name = file.name.lower()
    if name.endswith(".xlsx") or name.endswith(".xls"):
        result = import_from_excel(file)
    elif name.endswith(".csv"):
        result = import_from_csv(file)
    else:
        return Response({"error": "Formato no soportado. Usa .xlsx o .csv."}, status=400)

    if "error" in result:
        return Response(result, status=400)

    return Response(result, status=200)


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def download_template(request):
    """
    GET /api/v1/admin/products/template/
    Descarga el Excel plantilla con todas las columnas y ejemplos.
    """
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from django.http import HttpResponse

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Productos"

    headers = [
        "nombre", "descripcion_corta", "descripcion", "precio",
        "precio_comparacion", "stock", "sku", "categoria",
        "marca", "peso", "destacado", "activo", "tipo",
        "imagen_url", "seo_titulo", "seo_descripcion",
    ]

    # Estilos encabezado
    header_font  = Font(bold=True, color="000000", size=11)
    header_fill  = PatternFill("solid", fgColor="1AFF6E")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border  = Border(
        bottom=Side(style="thin", color="CCCCCC")
    )

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font      = header_font
        cell.fill      = header_fill
        cell.alignment = header_align
        cell.border    = thin_border
        ws.column_dimensions[cell.column_letter].width = max(16, len(header) + 4)

    # Fila de ejemplo
    examples = [
        "Shure SM58",
        "Micrófono vocal dinámico profesional",
        "El Shure SM58 es el micrófono vocal más utilizado en escenarios del mundo.",
        "150000",
        "180000",
        "10",
        "SM58-LC",
        "Micrófonos",
        "Shure",
        "0.3",
        "Si",
        "Si",
        "physical",
        "https://ejemplo.com/imagen.jpg",
        "Shure SM58 - Micrófono Vocal Profesional",
        "Compra el Shure SM58, el micrófono más confiable del mercado.",
    ]

    example_font = Font(color="555555", size=10, italic=True)
    for col, val in enumerate(examples, 1):
        cell = ws.cell(row=2, column=col, value=val)
        cell.font = example_font

    # Hoja de instrucciones
    ws2 = wb.create_sheet("Instrucciones")
    instrucciones = [
        ("INSTRUCCIONES DE USO", True),
        ("", False),
        ("COLUMNAS REQUERIDAS (obligatorias):", True),
        ("• nombre       → Nombre del producto (debe ser único)", False),
        ("• precio       → Precio en pesos, sin puntos ni $. Ej: 150000", False),
        ("• stock        → Cantidad disponible. Ej: 10", False),
        ("", False),
        ("COLUMNAS OPCIONALES:", True),
        ("• descripcion_corta   → Texto breve para listados", False),
        ("• descripcion         → Descripción completa del producto", False),
        ("• precio_comparacion  → Precio tachado (precio original antes del descuento)", False),
        ("• sku                 → Código interno del producto", False),
        ("• categoria           → Nombre de categoría. Para subcategoría: Audio Pro > Mezcladores", False),
        ("• marca               → Nombre de la marca", False),
        ("• peso                → Peso en kg. Ej: 0.5", False),
        ("• destacado           → Si / No (muestra en home)", False),
        ("• activo              → Si / No (visible en tienda)", False),
        ("• tipo                → physical / digital / course", False),
        ("• imagen_url          → URL de imagen principal", False),
        ("• seo_titulo          → Título para Google (máx 70 caracteres)", False),
        ("• seo_descripcion     → Descripción para Google (máx 160 caracteres)", False),
        ("", False),
        ("COMPORTAMIENTO:", True),
        ("• Si el producto ya existe (mismo nombre), se ACTUALIZA.", False),
        ("• Si no existe, se CREA.", False),
        ("• Las categorías y marcas se crean automáticamente si no existen.", False),
        ("• Puedes subir el archivo cuantas veces quieras, es seguro.", False),
    ]

    ws2.column_dimensions["A"].width = 70
    for row_num, (text, bold) in enumerate(instrucciones, 1):
        cell = ws2.cell(row=row_num, column=1, value=text)
        cell.font = Font(bold=bold, size=10 if not bold else 12)

    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = 'attachment; filename="plantilla_productos_levelproaudio.xlsx"'
    wb.save(response)
    return response
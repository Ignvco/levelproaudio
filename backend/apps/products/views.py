# apps/products/views.py
from rest_framework import viewsets, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Brand, Product, Favorite
from .serializers import (
    CategorySerializer,
    BrandSerializer,
    ProductListSerializer,
    ProductDetailSerializer,
)
from .filters import ProductFilter

_ACTIVE_PRODUCTS = Count("products", filter=Q(products__is_active=True))


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = CategorySerializer
    permission_classes = [AllowAny]
    lookup_field       = "slug"

    def get_queryset(self):
        return (Category.objects.filter(is_active=True)
                .annotate(product_count=_ACTIVE_PRODUCTS)
                .order_by("order", "name"))


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = BrandSerializer
    permission_classes = [AllowAny]
    lookup_field       = "slug"

    def get_queryset(self):
        return (Brand.objects.filter(is_active=True)
                .annotate(product_count=_ACTIVE_PRODUCTS)
                .order_by("name"))


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    lookup_field       = "slug"
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter, DjangoFilterBackend]
    search_fields      = ["name", "description", "brand__name"]
    ordering_fields    = ["price", "created_at", "name"]
    # category__slug se maneja manualmente en get_queryset para incluir hijos
    filterset_class    = ProductFilter

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        user = self.request.user
        if user.is_authenticated:
            ctx["favorite_ids"] = set(
                Favorite.objects.filter(user=user).values_list("product_id", flat=True)
            )
        return ctx

    def get_queryset(self):
        qs = Product.objects.filter(
            is_active=True
        ).select_related("category", "brand").prefetch_related("images")

        category_slug = self.request.query_params.get("category__slug")
        if category_slug:
            try:
                cat = Category.objects.get(slug=category_slug, is_active=True)
                child_ids = list(
                    Category.objects.filter(parent=cat, is_active=True)
                    .values_list("id", flat=True)
                )
                cat_ids = [cat.id] + child_ids
                qs = qs.filter(category__in=cat_ids)
            except Category.DoesNotExist:
                qs = qs.none()

        return qs


# ── Favoritos ─────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_favorites(request):
    """GET /api/v1/favorites/ — productos favoritos del usuario."""
    favs = (Favorite.objects.filter(user=request.user)
            .select_related("product", "product__brand")
            .prefetch_related("product__images"))
    favs = [f for f in favs if f.product and f.product.is_active]
    products = [f.product for f in favs]
    fav_ids = {p.id for p in products}
    data = ProductListSerializer(
        products, many=True,
        context={"request": request, "favorite_ids": fav_ids},
    ).data

    # Agrega price_when_added a cada producto (para el badge de "bajó de
    # precio" en el frontend, sin esperar al job diario de emails).
    price_map = {str(f.product_id): f.price_when_added for f in favs}
    for item in data:
        item["price_when_added"] = price_map.get(str(item["id"]))

    return Response({"count": len(data), "results": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_favorite(request):
    """POST /api/v1/favorites/toggle/ {product_id | slug} — agrega o quita."""
    product_id = request.data.get("product_id")
    slug       = request.data.get("slug")
    try:
        if product_id:
            product = Product.objects.get(id=product_id, is_active=True)
        elif slug:
            product = Product.objects.get(slug=slug, is_active=True)
        else:
            return Response({"error": "product_id o slug requerido"}, status=400)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado"}, status=404)

    fav = Favorite.objects.filter(user=request.user, product=product).first()
    if fav:
        fav.delete()
        favorited = False
    else:
        Favorite.objects.create(
            user=request.user, product=product,
            price_when_added=product.price,
            was_in_stock=product.stock > 0,
        )
        favorited = True

    return Response({"favorited": favorited, "product_id": product.id})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def favorite_ids(request):
    """GET /api/v1/favorites/ids/ — ids de productos favoritos (para pintar corazones)."""
    ids = list(
        Favorite.objects.filter(user=request.user).values_list("product_id", flat=True)
    )
    return Response({"ids": ids})


# ── Solicitudes bajo pedido ─────────────────────────────────────────
from rest_framework import status as drf_status
from core.admin_permissions import IsAdminOrStaff
from .models import SpecialOrderRequest
from .serializers import (
    SpecialOrderRequestSerializer, SpecialOrderRequestAdminSerializer,
)


@api_view(["POST"])
@permission_classes([AllowAny])
def create_special_order(request):
    """
    POST /api/v1/special-orders/
    Público: un cliente (con o sin cuenta) solicita un equipo bajo pedido.
    """
    serializer = SpecialOrderRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = request.user if request.user.is_authenticated else None
    obj = serializer.save(user=user)

    # Aviso al equipo (no rompe si el email falla)
    try:
        from apps.emails import send_special_order_notification
        send_special_order_notification(obj)
    except Exception:
        pass

    return Response(serializer.data, status=drf_status.HTTP_201_CREATED)


class AdminSpecialOrderViewSet(viewsets.ModelViewSet):
    """CRUD admin de solicitudes bajo pedido, para el panel de React."""
    queryset = SpecialOrderRequest.objects.all()
    serializer_class = SpecialOrderRequestAdminSerializer
    permission_classes = [IsAdminOrStaff]

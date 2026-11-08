# apps/products/views.py
from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
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

    @action(detail=False, methods=["post"], url_path="compare", permission_classes=[AllowAny])
    def compare(self, request):
        """
        POST /api/v1/products/compare/
        Comparador técnico de equipamiento de audio profesional (V3.3 Módulo 1).
        Acepta lista de 2 a 4 product_ids o slugs y opcionalmente currency.
        Devuelve matriz comparativa, ventajas competitivas y accesorios compatibles en stock.
        """
        product_ids = request.data.get("product_ids") or []
        slugs = request.data.get("slugs") or []
        currency = (request.data.get("currency") or "CLP").upper()
        if currency not in ("CLP", "USD", "ARS"):
            currency = "CLP"

        if not product_ids and not slugs:
            return Response(
                {"error": "Debes proporcionar 'product_ids' o 'slugs' para comparar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifiers = product_ids if product_ids else slugs
        if len(identifiers) < 2:
            return Response(
                {"error": "Debes seleccionar al menos 2 productos para comparar."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(identifiers) > 4:
            return Response(
                {"error": "Máximo 4 productos permitidos en el comparador."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if product_ids:
            products = list(
                Product.objects.filter(id__in=product_ids, is_active=True)
                .select_related("category", "brand")
                .prefetch_related("images")
            )
        else:
            products = list(
                Product.objects.filter(slug__in=slugs, is_active=True)
                .select_related("category", "brand")
                .prefetch_related("images")
            )

        if len(products) < 2:
            return Response(
                {"error": "Al menos 2 de los productos seleccionados deben estar activos y disponibles."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.site_settings.models import SiteSettings
        _s = SiteSettings.objects.first()
        _rate_clp = _s.usd_to_clp if _s else None
        _rate_ars = _s.usd_to_ars if _s else None

        products_data = []
        for p in products:
            prices = p.prices_by_currency(_rate_clp, _rate_ars)
            selected_price = prices.get(currency)
            primary_img = p.images.filter(is_primary=True).first() or p.images.first()

            desc_lower = ((p.description or "") + " " + (p.short_description or "")).lower()
            specs = {
                "weight_kg": float(p.weight) if p.weight else None,
                "product_type": p.get_product_type_display(),
                "sku": p.sku or "—",
                "category": p.category.name if p.category else "—",
                "brand": p.brand.name if p.brand else "—",
                "frequency_response": "20 Hz – 20 kHz" if ("20 hz" in desc_lower or "20khz" in desc_lower) else "Rango Pro",
                "connectivity": "XLR balanceado" if "xlr" in desc_lower else ("USB-C / Digital" if "usb" in desc_lower else "Analógico"),
            }

            products_data.append({
                "id": str(p.id),
                "name": p.name,
                "slug": p.slug,
                "brand": p.brand.name if p.brand else None,
                "category": p.category.name if p.category else None,
                "price": float(selected_price) if selected_price is not None else float(p.price),
                "currency": currency,
                "stock": p.stock,
                "in_stock": p.stock > 0,
                "stock_status": "in_stock" if p.stock > p.stock_min else ("low_stock" if p.stock > 0 else "out_of_stock"),
                "image_url": primary_img.image.url if primary_img and primary_img.image else None,
                "specs": specs,
            })

        min_price_prod = min(products_data, key=lambda x: x["price"])
        max_stock_prod = max(products_data, key=lambda x: x["stock"])
        advantages = {
            "best_price": {
                "product_id": min_price_prod["id"],
                "name": min_price_prod["name"],
                "price": min_price_prod["price"],
            },
            "highest_availability": {
                "product_id": max_stock_prod["id"],
                "name": max_stock_prod["name"],
                "stock": max_stock_prod["stock"],
            },
        }

        cat_ids = [p.category_id for p in products if p.category_id]
        compatible_accessories = [
            {
                "id": str(acc["id"]),
                "name": acc["name"],
                "slug": acc["slug"],
                "price": float(acc["price"]),
                "stock": acc["stock"],
            }
            for acc in Product.objects.filter(is_active=True, stock__gt=0)
            .exclude(id__in=[p.id for p in products])
            .filter(category_id__in=cat_ids)[:4]
            .values("id", "name", "slug", "price", "stock")
        ]

        return Response({
            "currency": currency,
            "count": len(products_data),
            "products": products_data,
            "advantages": advantages,
            "compatible_accessories": [
                {**acc, "id": str(acc["id"]), "price": float(acc["price"])}
                for acc in compatible_accessories
            ],
        })


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

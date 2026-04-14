# apps/products/views.py
from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Brand, Product
from .serializers import (
    CategorySerializer,
    BrandSerializer,
    ProductListSerializer,
    ProductDetailSerializer,
)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = Category.objects.filter(is_active=True).order_by("order", "name")
    serializer_class   = CategorySerializer
    permission_classes = [AllowAny]
    lookup_field       = "slug"


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = Brand.objects.filter(is_active=True)
    serializer_class   = BrandSerializer
    permission_classes = [AllowAny]
    lookup_field       = "slug"


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    lookup_field       = "slug"
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter, DjangoFilterBackend]
    search_fields      = ["name", "description", "brand__name"]
    ordering_fields    = ["price", "created_at", "name"]
    # category__slug se maneja manualmente en get_queryset para incluir hijos
    filterset_fields   = ["brand__slug", "is_featured"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def get_queryset(self):
        qs = Product.objects.filter(
            is_active=True
        ).select_related("category", "brand").prefetch_related("images")

        category_slug = self.request.query_params.get("category__slug")
        if category_slug:
            try:
                # Buscar la categoría por slug
                cat = Category.objects.get(slug=category_slug, is_active=True)
                # Incluir la categoría misma + todos sus hijos directos
                child_ids = list(
                    Category.objects.filter(parent=cat, is_active=True)
                    .values_list("id", flat=True)
                )
                cat_ids = [cat.id] + child_ids
                qs = qs.filter(category__in=cat_ids)
            except Category.DoesNotExist:
                qs = qs.none()

        return qs

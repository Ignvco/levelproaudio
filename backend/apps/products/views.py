# apps/products/views.py
# ViewSets — cada uno genera automáticamente los endpoints REST

from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from .models import Category, Brand, Product
from .serializers import (
    CategorySerializer,
    BrandSerializer,
    ProductListSerializer,
    ProductDetailSerializer
)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint de categorías — solo lectura, público.
    GET /api/v1/categories/
    GET /api/v1/categories/{slug}/
    """
    queryset = Category.objects.filter(is_active=True, parent=None)
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint de marcas — solo lectura, público.
    GET /api/v1/brands/
    GET /api/v1/brands/{slug}/
    """
    queryset = Brand.objects.filter(is_active=True)
    serializer_class = BrandSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint de productos — solo lectura, público.
    GET /api/v1/products/                         → listado
    GET /api/v1/products/{slug}/                  → detalle
    GET /api/v1/products/?category=parlantes       → filtro por categoría
    GET /api/v1/products/?brand=shure              → filtro por marca
    GET /api/v1/products/?search=sm58              → búsqueda
    GET /api/v1/products/?ordering=price           → orden por precio
    GET /api/v1/products/?is_featured=true         → destacados
    """
    queryset = Product.objects.filter(is_active=True).select_related(
        'category', 'brand'
    ).prefetch_related('images')
    permission_classes = [AllowAny]
    lookup_field = 'slug'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'category__slug': ['exact'],
        'brand__slug': ['exact'],
        'is_featured': ['exact'],
        'price': ['gte', 'lte'],       # price__gte=100 price__lte=500
    }
    search_fields = ['name', 'sku', 'short_description']
    ordering_fields = ['price', 'name', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """Usa el serializer liviano para lista y el completo para detalle."""
        if self.action == 'retrieve':
            return ProductDetailSerializer
        return ProductListSerializer
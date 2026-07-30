# apps/products/filters.py
import django_filters
from django.db.models import F
from .models import Product


class ProductFilter(django_filters.FilterSet):
    brand__slug = django_filters.CharFilter(field_name="brand__slug")
    is_featured = django_filters.BooleanFilter(field_name="is_featured")
    price_min   = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    price_max   = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    in_stock    = django_filters.BooleanFilter(method="filter_in_stock")
    on_sale     = django_filters.BooleanFilter(method="filter_on_sale")

    class Meta:
        model  = Product
        fields = ["brand__slug", "is_featured", "price_min", "price_max", "in_stock", "on_sale"]

    def filter_in_stock(self, queryset, name, value):
        if value:
            return queryset.filter(stock__gt=0)
        return queryset

    def filter_on_sale(self, queryset, name, value):
        if value:
            return queryset.filter(
                compare_price__isnull=False,
                compare_price__gt=F("price"),
            )
        return queryset

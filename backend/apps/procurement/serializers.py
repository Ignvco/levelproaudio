# apps/procurement/serializers.py
from rest_framework import serializers
from apps.products.models import Brand
from apps.procurement.models import (
    Supplier,
    SupplierContact,
    ProductSupplier,
    SupplierPriceHistory,
)
from core.rbac.constants import PERM_VIEW_COSTS
from core.rbac.permissions import is_effective_super_admin, user_has_capability


def _can_view_supplier_costs(context) -> bool:
    request = context.get("request") if context else None
    if not request or not request.user or not request.user.is_authenticated:
        return False
    return is_effective_super_admin(request.user) or user_has_capability(request.user, PERM_VIEW_COSTS)


class SupplierContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierContact
        fields = [
            "id", "supplier", "full_name", "role_title",
            "email", "phone", "is_primary", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "supplier", "created_at", "updated_at"]


class SupplierBrandSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name", "slug"]


class SupplierSerializer(serializers.ModelSerializer):
    contacts = SupplierContactSerializer(many=True, read_only=True)
    brands_detail = SupplierBrandSummarySerializer(source="brands", many=True, read_only=True)
    brand_ids = serializers.PrimaryKeyRelatedField(
        source="brands",
        queryset=Brand.objects.all(),
        many=True,
        write_only=True,
        required=False,
    )
    linked_products_count = serializers.IntegerField(read_only=True, required=False)
    expired_lists_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Supplier
        fields = [
            "id", "internal_code", "legal_name", "trade_name", "tax_id",
            "country", "address", "website", "primary_email", "primary_phone",
            "supplier_type", "currency", "payment_terms",
            "default_min_order_qty", "default_lead_time_days",
            "brands_detail", "brand_ids", "contacts",
            "is_active", "internal_notes",
            "linked_products_count", "expired_lists_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "internal_code": {"required": False, "allow_blank": True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not _can_view_supplier_costs(self.context):
            data.pop("internal_notes", None)
            data.pop("payment_terms", None)
        return data


class ProductSupplierSerializer(serializers.ModelSerializer):
    supplier_code = serializers.CharField(source="supplier.internal_code", read_only=True)
    supplier_name = serializers.SerializerMethodField()
    supplier_country = serializers.CharField(source="supplier.country", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, allow_null=True)
    internal_sku = serializers.CharField(read_only=True)
    is_cost_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductSupplier
        fields = [
            "id", "supplier", "supplier_code", "supplier_name", "supplier_country",
            "product", "product_name", "variant", "variant_name",
            "sku_registry", "internal_sku", "supplier_sku",
            "unit_cost", "currency", "tax_basis", "moq", "lead_time_days",
            "reported_availability", "reported_available_qty", "availability_updated_at",
            "cost_valid_from", "cost_valid_until", "is_cost_expired",
            "is_preferred", "is_active", "commercial_notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "sku_registry", "availability_updated_at", "created_at", "updated_at"]

    def get_supplier_name(self, obj):
        return obj.supplier.trade_name or obj.supplier.legal_name

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not _can_view_supplier_costs(self.context):
            data.pop("unit_cost", None)
            data.pop("commercial_notes", None)
        return data


class SupplierPriceHistorySerializer(serializers.ModelSerializer):
    supplier_code = serializers.CharField(source="supplier.internal_code", read_only=True)
    supplier_name = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, allow_null=True)
    changed_by_email = serializers.EmailField(source="changed_by.email", read_only=True, allow_null=True)

    class Meta:
        model = SupplierPriceHistory
        fields = [
            "id", "product_supplier", "supplier", "supplier_code", "supplier_name",
            "product", "product_name", "variant", "variant_name",
            "previous_cost", "new_cost", "previous_currency", "new_currency",
            "tax_basis", "valid_from", "valid_until", "recorded_at",
            "changed_by", "changed_by_email", "source", "notes",
        ]

    def get_supplier_name(self, obj):
        return obj.supplier.trade_name or obj.supplier.legal_name

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not _can_view_supplier_costs(self.context):
            data.pop("previous_cost", None)
            data.pop("new_cost", None)
        return data

# apps/orders/serializers.py

from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Cart, CartItem, Order, OrderItem
from apps.products.serializers import ProductListSerializer


class CartItemVariantSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    sku = serializers.CharField()
    effective_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    stock = serializers.IntegerField()


class CartItemSerializer(serializers.ModelSerializer):
    product  = ProductListSerializer(read_only=True)
    variant  = CartItemVariantSerializer(read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model  = CartItem
        fields = ["id", "product", "variant", "quantity", "subtotal"]


class CartSerializer(serializers.ModelSerializer):
    items       = CartItemSerializer(many=True, read_only=True)
    total       = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    items_count = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Cart
        fields = ["id", "items", "total", "items_count", "created_at"]


class OrderItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model  = OrderItem
        fields = ["id", "product_name", "variant_name", "variant_sku", "price", "quantity", "subtotal"]


class PaymentSummarySerializer(serializers.Serializer):
    """Serializer liviano para mostrar pagos dentro de una orden."""
    id       = serializers.UUIDField()
    provider = serializers.CharField()
    status   = serializers.CharField()
    amount   = serializers.DecimalField(max_digits=12, decimal_places=2)
    paid_at  = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()


class OrderSerializer(serializers.ModelSerializer):
    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"status": exc.messages}) from exc

    items          = OrderItemSerializer(many=True, read_only=True)
    items_count    = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    commercial_status_display  = serializers.CharField(source="get_commercial_status_display", read_only=True)
    financial_status_display   = serializers.CharField(source="get_financial_status_display", read_only=True)
    fulfillment_status_display = serializers.CharField(source="get_fulfillment_status_display", read_only=True)
    state_contract = serializers.SerializerMethodField()
    sales_rep_email = serializers.SerializerMethodField()
    assigned_warehouse_code = serializers.SerializerMethodField()
    payments       = PaymentSummarySerializer(many=True, read_only=True)

    def get_state_contract(self, obj):
        return obj.state_contract.to_dict()

    def get_sales_rep_email(self, obj):
        return obj.sales_rep.email if obj.sales_rep_id and obj.sales_rep else None

    def get_assigned_warehouse_code(self, obj):
        return obj.assigned_warehouse.code if obj.assigned_warehouse_id and obj.assigned_warehouse else None

    class Meta:
        model  = Order
        fields = [
            "id", "status", "status_display",
            "commercial_status", "commercial_status_display",
            "financial_status", "financial_status_display",
            "fulfillment_status", "fulfillment_status_display",
            "order_origin", "state_contract",
            "sales_rep", "sales_rep_email",
            "assigned_warehouse", "assigned_warehouse_code",
            "source_draft",
            "customer_name", "customer_phone", "customer_tax_id",
            "total", "currency", "items_count",
            "loyalty_points_redeemed", "loyalty_discount",
            "email", "shipping_address", "notes",
            "shipping_carrier", "tracking_number",
            "items", "payments",
            "created_at",
        ]

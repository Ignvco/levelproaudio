# apps/orders/serializers.py

from rest_framework import serializers
from .models import Cart, CartItem, Order, OrderItem
from apps.products.serializers import ProductListSerializer


class CartItemSerializer(serializers.ModelSerializer):
    product  = ProductListSerializer(read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model  = CartItem
        fields = ["id", "product", "quantity", "subtotal"]


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
        fields = ["id", "product_name", "price", "quantity", "subtotal"]


class PaymentSummarySerializer(serializers.Serializer):
    """Serializer liviano para mostrar pagos dentro de una orden."""
    id       = serializers.UUIDField()
    provider = serializers.CharField()
    status   = serializers.CharField()
    amount   = serializers.DecimalField(max_digits=12, decimal_places=2)
    paid_at  = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()


class OrderSerializer(serializers.ModelSerializer):
    items          = OrderItemSerializer(many=True, read_only=True)
    items_count    = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    payments       = PaymentSummarySerializer(many=True, read_only=True)  # ← agregado

    class Meta:
        model  = Order
        fields = [
            "id", "status", "status_display",
            "total", "items_count",
            "email", "shipping_address", "notes",
            "items", "payments",   # ← payments incluido
            "created_at",
        ]
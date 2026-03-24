# apps/orders/serializers.py
# Serializers de carrito y pedidos

from rest_framework import serializers
from .models import Cart, CartItem, Order, OrderItem
from apps.products.serializers import ProductListSerializer


class CartItemSerializer(serializers.ModelSerializer):
    """
    Serializer de ítems dentro del carrito.
    """

    product = ProductListSerializer(read_only=True)

    class Meta:
        model = CartItem
        fields = [
            'id',
            'product',
            'quantity'
        ]


class CartSerializer(serializers.ModelSerializer):
    """
    Serializer del carrito completo.
    """

    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = [
            'id',
            'items',
            'created_at'
        ]


class OrderItemSerializer(serializers.ModelSerializer):
    """
    Productos comprados dentro de un pedido.
    """

    class Meta:
        model = OrderItem
        fields = [
            'product_name',
            'price',
            'quantity'
        ]


class OrderSerializer(serializers.ModelSerializer):
    """
    Serializer de pedidos.
    """

    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'status',
            'total',
            'email',
            'shipping_address',
            'items',
            'created_at'
        ]
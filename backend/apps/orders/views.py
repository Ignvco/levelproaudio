# apps/orders/views.py
# Endpoints para carrito y pedidos

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Cart, Order
from .serializers import CartSerializer, OrderSerializer


class CartViewSet(viewsets.ModelViewSet):
    """
    Endpoint del carrito del usuario.

    GET  /api/v1/cart/        → ver carrito
    POST /api/v1/cart/        → crear carrito
    PATCH /api/v1/cart/{id}/  → actualizar
    """

    serializer_class = CartSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Cart.objects.filter(user=self.request.user).prefetch_related("items")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class OrderViewSet(viewsets.ModelViewSet):
    """
    Endpoint de pedidos del usuario.

    GET  /api/v1/orders/
    GET  /api/v1/orders/{id}/
    """

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related("items")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
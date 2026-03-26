# apps/orders/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from .models import Cart, CartItem, Order, OrderItem
from .serializers import CartSerializer, OrderSerializer, CartItemSerializer
from apps.products.models import Product


class CartViewSet(viewsets.ModelViewSet):
    """
    Carrito del usuario autenticado.
    GET    /api/v1/cart/           → ver carrito activo
    POST   /api/v1/cart/items/     → agregar item
    PATCH  /api/v1/cart/items/{id} → actualizar cantidad
    DELETE /api/v1/cart/items/{id} → eliminar item
    """
    serializer_class = CartSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Cart.objects.filter(
            user=self.request.user,
            is_active=True
        ).prefetch_related("items__product")

    def get_or_create_cart(self):
        cart, _ = Cart.objects.get_or_create(
            user=self.request.user,
            is_active=True
        )
        return cart

    @action(detail=False, methods=["get"])
    def active(self, request):
        """GET /api/v1/cart/active/ → carrito activo del usuario"""
        cart = self.get_or_create_cart()
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def add_item(self, request):
        """
        POST /api/v1/cart/add_item/
        Body: { product_id, quantity }
        """
        cart = self.get_or_create_cart()
        product_id = request.data.get("product_id")
        quantity = int(request.data.get("quantity", 1))

        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Producto no encontrado."},
                status=status.HTTP_404_NOT_FOUND
            )

        if product.stock < quantity:
            return Response(
                {"error": "Stock insuficiente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={"quantity": quantity}
        )

        if not created:
            item.quantity = min(item.quantity + quantity, product.stock)
            item.save()

        return Response(CartSerializer(cart).data)

    @action(detail=False, methods=["delete"])
    def clear(self, request):
        """DELETE /api/v1/cart/clear/ → vaciar carrito"""
        cart = self.get_or_create_cart()
        cart.items.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrderViewSet(viewsets.ModelViewSet):
    """
    Pedidos del usuario.
    GET  /api/v1/orders/       → historial
    GET  /api/v1/orders/{id}/  → detalle
    POST /api/v1/orders/       → crear orden
    """
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return Order.objects.filter(
            user=self.request.user
        ).prefetch_related("items").order_by("-created_at")

    @transaction.atomic
    def create(self, request):
        """
        Crea una orden con sus items en una sola transacción.
        Si algo falla, revierte todo — no quedan órdenes a medias.
        """
        data = request.data
        items_data = data.get("items", [])

        if not items_data:
            return Response(
                {"error": "La orden debe tener al menos un producto."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calcular total desde los items reales (no confiar en el frontend)
        total = sum(
            float(item["price"]) * int(item["quantity"])
            for item in items_data
        )

        order = Order.objects.create(
            user=request.user,
            email=data.get("email", request.user.email),
            shipping_address=data.get("shipping_address", ""),
            notes=data.get("notes", ""),
            total=total,
        )

        # Crear cada OrderItem y descontar stock
        for item_data in items_data:
            try:
                product = Product.objects.get(id=item_data["product"])
            except Product.DoesNotExist:
                raise ValueError(f"Producto {item_data['product']} no existe.")

            OrderItem.objects.create(
                order=order,
                product=product,
                product_name=item_data.get("product_name", product.name),
                price=item_data["price"],
                quantity=item_data["quantity"],
            )

            # Descontar stock
            product.stock = max(0, product.stock - int(item_data["quantity"]))
            product.save(update_fields=["stock"])

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
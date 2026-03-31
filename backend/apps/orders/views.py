# apps/orders/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from .models import Cart, CartItem, Order, OrderItem, OrderStatus
from .serializers import CartSerializer, OrderSerializer
from apps.products.models import Product


class CartViewSet(viewsets.ModelViewSet):
    serializer_class   = CartSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Cart.objects.filter(
            user=self.request.user, is_active=True
        ).prefetch_related("items__product")

    def get_or_create_cart(self):
        cart, _ = Cart.objects.get_or_create(
            user=self.request.user, is_active=True
        )
        return cart

    @action(detail=False, methods=["get"])
    def active(self, request):
        cart = self.get_or_create_cart()
        return Response(CartSerializer(cart).data)

    @action(detail=False, methods=["post"])
    def add_item(self, request):
        cart       = self.get_or_create_cart()
        product_id = request.data.get("product_id")
        quantity   = int(request.data.get("quantity", 1))

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
            cart=cart, product=product, defaults={"quantity": quantity}
        )
        if not created:
            item.quantity = min(item.quantity + quantity, product.stock)
            item.save()

        return Response(CartSerializer(cart).data)

    @action(detail=False, methods=["delete"])
    def clear(self, request):
        cart = self.get_or_create_cart()
        cart.items.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class   = OrderSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return Order.objects.filter(
            user=self.request.user
        ).prefetch_related("items", "payments").order_by("-created_at")

    @transaction.atomic
    def create(self, request):
        data       = request.data
        items_data = data.get("items", [])

        if not items_data:
            return Response(
                {"error": "La orden debe tener al menos un producto."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verifica stock ANTES de crear la orden
        for item_data in items_data:
            try:
                product = Product.objects.get(id=item_data["product"])
            except Product.DoesNotExist:
                return Response(
                    {"error": f"Producto {item_data['product']} no existe."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if product.stock < int(item_data["quantity"]):
                return Response(
                    {"error": f"Stock insuficiente para {product.name}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

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

        for item_data in items_data:
            product = Product.objects.get(id=item_data["product"])
            OrderItem.objects.create(
                order        = order,
                product      = product,
                product_name = item_data.get("product_name", product.name),
                price        = item_data["price"],
                quantity     = item_data["quantity"],
            )
            product.stock = max(0, product.stock - int(item_data["quantity"]))
            product.save(update_fields=["stock"])

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED
        )

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        order = self.get_object()

        if order.status != OrderStatus.PENDING:
            return Response(
                {"error": "Solo puedes cancelar órdenes pendientes."},
                status=status.HTTP_400_BAD_REQUEST
            )

        for item in order.items.all():
            if item.product:
                item.product.stock += item.quantity
                item.product.save(update_fields=["stock"])

        order.status = OrderStatus.CANCELLED
        order.save(update_fields=["status"])

        return Response(
            {"detail": "Orden cancelada. Stock restablecido."},
            status=status.HTTP_200_OK
        )
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

        # Verifica stock ANTES de crear la orden, y arma la lista de items
        # con el precio REAL del producto (nunca el que manda el cliente:
        # de lo contrario cualquiera podría comprar a cualquier precio).
        validated_items = []
        for item_data in items_data:
            try:
                product = Product.objects.get(id=item_data["product"], is_active=True)
            except Product.DoesNotExist:
                return Response(
                    {"error": f"Producto {item_data['product']} no existe."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            quantity = int(item_data["quantity"])
            if quantity < 1:
                return Response(
                    {"error": f"Cantidad inválida para {product.name}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if product.stock < quantity:
                return Response(
                    {"error": f"Stock insuficiente para {product.name}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            validated_items.append({
                "product": product,
                "quantity": quantity,
                "price": product.price,  # ← precio real de la BD
            })

        subtotal = sum(
            float(item["price"]) * item["quantity"]
            for item in validated_items
        )

        # ── Canje de puntos de fidelización (opcional) ──
        loyalty_points_redeemed = int(data.get("loyalty_points_redeemed", 0) or 0)
        loyalty_discount        = 0
        account = None
        if loyalty_points_redeemed > 0:
            from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig
            config     = LoyaltyConfig.get()
            account, _ = LoyaltyAccount.objects.get_or_create(user=request.user)
            # Validamos acá para devolver un mensaje claro; el canje real
            # (con bloqueo de fila) se hace después de crear la orden,
            # una vez que sabemos su id.
            if loyalty_points_redeemed < config.minimo_canje:
                return Response(
                    {"error": f"Mínimo de canje: {config.minimo_canje} puntos."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if loyalty_points_redeemed > account.puntos_disponibles:
                return Response(
                    {"error": "No tenés suficientes puntos disponibles."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            loyalty_discount = min(
                subtotal,
                loyalty_points_redeemed * float(config.peso_por_punto),
            )

        total = max(0, subtotal - float(loyalty_discount))

        order = Order.objects.create(
            user=request.user,
            email=data.get("email", request.user.email),
            shipping_address=data.get("shipping_address", ""),
            notes=data.get("notes", ""),
            total=total,
            loyalty_points_redeemed=loyalty_points_redeemed,
            loyalty_discount=loyalty_discount,
        )

        # Descontar puntos + registrar transacción, atado a esta orden.
        # canjear_puntos() bloquea la fila de la cuenta (select_for_update),
        # así que dos checkouts simultáneos del mismo usuario no pueden
        # gastar más puntos de los que realmente tiene.
        if loyalty_points_redeemed > 0:
            try:
                account.canjear_puntos(
                    loyalty_points_redeemed,
                    descripcion=f"Canje en Orden #{str(order.id)[:8].upper()}",
                    orden=order,
                )
            except ValueError as e:
                # Alguien más gastó los puntos entre la validación y este punto
                # (carrera real). Forzamos rollback de TODA la transacción
                # (orden + descuento de stock ya hechos), no solo del canje.
                transaction.set_rollback(True)
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        for item in validated_items:
            product = item["product"]
            OrderItem.objects.create(
                order        = order,
                product      = product,
                product_name = product.name,
                price        = item["price"],
                quantity     = item["quantity"],
            )
            product.stock = max(0, product.stock - item["quantity"])
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
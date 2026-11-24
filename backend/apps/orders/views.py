# apps/orders/views.py

from decimal import Decimal, ROUND_HALF_UP
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from collections.abc import Mapping
from .models import Cart, CartItem, Order, OrderItem, OrderStatus
from .serializers import CartSerializer, OrderSerializer
from .inventory import InventoryError, prepare_inventory, deduct_inventory
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
        from apps.products.models import ProductVariant

        cart       = self.get_or_create_cart()
        product_id = request.data.get("product_id")
        variant_id = request.data.get("variant_id") or request.data.get("variant")
        quantity   = int(request.data.get("quantity", 1))

        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Producto no encontrado."},
                status=status.HTTP_404_NOT_FOUND
            )

        variant = None
        if variant_id:
            try:
                variant = ProductVariant.objects.get(id=variant_id, product=product, is_active=True)
            except ProductVariant.DoesNotExist:
                return Response(
                    {"error": "Variante no encontrada o no disponible."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        elif product.variants.filter(is_active=True).exists():
            return Response(
                {"error": "Debes seleccionar una variante para este producto."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        available_stock = variant.stock if variant is not None else product.stock

        # Los productos "preorden" y "a pedido" son, por definición, para
        # vender sin stock físico disponible todavía — antes esta validación
        # los bloqueaba igual que a un producto normal, lo cual los hacía
        # imposibles de comprar (contradice el propósito del tipo).
        if product.product_type == Product.ProductType.STOCK and available_stock < quantity:
            return Response(
                {"error": "Stock insuficiente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        item, created = CartItem.objects.get_or_create(
            cart=cart, product=product, variant=variant, defaults={"quantity": quantity}
        )
        if not created:
            new_quantity = item.quantity + quantity
            if product.product_type == Product.ProductType.STOCK:
                new_quantity = min(new_quantity, available_stock)
            item.quantity = new_quantity
            item.save()

        return Response(CartSerializer(cart).data)

    @action(detail=False, methods=["delete"])
    def clear(self, request):
        cart = self.get_or_create_cart()
        cart.items.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


from rest_framework.throttling import UserRateThrottle


class OrderCreateThrottle(UserRateThrottle):
    """
    Antes, crear una orden no tenía ningún límite de velocidad — y como
    crear una orden DESCUENTA STOCK de inmediato (antes de que se pague),
    alguien podía spamear pedidos falsos de un producto con poco stock
    para agotarlo artificialmente y bloquear a clientes reales, sin
    gastar un peso. 20/hora es generoso para compras reales (varios
    intentos, reintentos de pago fallido) pero corta un ataque de spam.
    """
    scope = "order_create"


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class   = OrderSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "post", "delete", "head", "options"]

    def get_throttles(self):
        if self.action == "create":
            return [OrderCreateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        return Order.objects.filter(
            user=self.request.user
        ).prefetch_related("items", "payments").order_by("-created_at")

    @transaction.atomic
    def create(self, request):
        data       = request.data
        if not isinstance(data, Mapping):
            return Response({"error": "El pedido debe ser un objeto JSON."}, status=400)
        items_data = data.get("items", [])
        # Moneda de la orden (CLP/USD/ARS). El precio se recalcula en el
        # servidor en esta moneda — nunca se confía en el que manda el cliente.
        currency = data.get("currency") or "CLP"
        currency = currency.upper() if isinstance(currency, str) else "CLP"
        if currency not in ("CLP", "USD", "ARS"):
            currency = "CLP"

        # Cada punto tiene valor en pesos CLP. No aplicar descuento CLP a
        # importes USD/ARS ni asumir una tasa cambiaria inexistente.
        try:
            requested_points = int(data.get("loyalty_points_redeemed", 0) or 0)
        except (TypeError, ValueError):
            return Response({"error": "Cantidad de puntos inválida."}, status=400)
        if requested_points < 0:
            return Response({"error": "La cantidad de puntos no puede ser negativa."}, status=400)
        if currency != "CLP" and requested_points > 0:
            return Response({
                "error": "El canje de puntos está disponible solo para órdenes CLP."
            }, status=400)

        # Tasas para calcular precios en la moneda pedida cuando el
        # producto no tiene el precio manual cargado.
        from apps.site_settings.models import SiteSettings
        _s = SiteSettings.objects.first()
        _rate_clp = _s.usd_to_clp if _s else None
        _rate_ars = _s.usd_to_ars if _s else None

        try:
            validated_items, stock_demand = prepare_inventory(items_data)
        except InventoryError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        for item in validated_items:
            target = item.get("variant") or item["product"]
            item["price"] = target.prices_by_currency(_rate_clp, _rate_ars)[currency]

        q_step = Decimal("1") if currency == "CLP" else Decimal("0.01")
        subtotal = sum(
            (Decimal(str(item["price"])) * Decimal(str(item["quantity"])) for item in validated_items),
            Decimal("0.00"),
        ).quantize(q_step, rounding=ROUND_HALF_UP)

        # ── Canje de puntos de fidelización (opcional, Decimal + solo CLP sin FX explícito) ──
        loyalty_points_redeemed = requested_points
        loyalty_discount        = Decimal("0.00")
        account = None
        if loyalty_points_redeemed > 0:
            if currency != "CLP":
                return Response(
                    {"error": "El canje monetario de puntos Loyalty solo está habilitado en CLP sin política FX explícita."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig
            config     = LoyaltyConfig.get()
            account, _ = LoyaltyAccount.objects.get_or_create(user=request.user)
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
            raw_disc = (Decimal(loyalty_points_redeemed) * Decimal(str(config.peso_por_punto))).quantize(
                q_step, rounding=ROUND_HALF_UP
            )
            loyalty_discount = max(Decimal("0.00"), min(subtotal, raw_disc))

        # ── Cupón / Promoción comercial Gate 11 (Decimal, moneda aislada, idempotencia) ──
        from django.core.exceptions import ValidationError as DjangoValidationError
        from apps.orders.marketing_models import CouponRedemption
        from apps.orders.marketing_services import (
            evaluate_commercial_pricing,
            mark_cart_recovered_for_order,
            reserve_coupon_redemption,
        )

        coupon_code = (data.get("coupon_code") or "").strip().upper() or None
        idempotency_key = (
            data.get("idempotency_key")
            or request.headers.get("Idempotency-Key")
            or ""
        ).strip() or None

        if idempotency_key:
            existing_redemption = (
                CouponRedemption.objects.select_related("order")
                .filter(idempotency_key=f"checkout:{idempotency_key}", order__user=request.user)
                .first()
            )
            if existing_redemption and existing_redemption.order:
                return Response(OrderSerializer(existing_redemption.order).data, status=status.HTTP_200_OK)

        pricing_items = [
            {
                "product": item["product"],
                "variant": item.get("variant"),
                "quantity": item["quantity"],
                "line_subtotal": (Decimal(str(item["price"])) * Decimal(str(item["quantity"]))).quantize(
                    q_step, rounding=ROUND_HALF_UP
                ),
            }
            for item in validated_items
        ]
        try:
            pricing = evaluate_commercial_pricing(
                currency=currency,
                items=pricing_items,
                coupon_code=coupon_code,
                user=request.user,
                loyalty_discount=loyalty_discount,
            )
        except DjangoValidationError as exc:
            transaction.set_rollback(True)
            msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        total = max(Decimal("0.00"), pricing["final_total"].quantize(q_step, rounding=ROUND_HALF_UP))

        order = Order.objects.create(
            user=request.user,
            email=data.get("email", request.user.email),
            shipping_address=data.get("shipping_address", ""),
            notes=data.get("notes", ""),
            total=total,
            currency=currency,
            stock_deductions={str(pk): qty for pk, qty in stock_demand.items()},
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
            variant = item.get("variant")
            OrderItem.objects.create(
                order        = order,
                product      = product,
                variant      = variant,
                product_name = product.name,
                variant_name = variant.name if variant else "",
                variant_sku  = variant.sku if variant else "",
                price        = item["price"],
                quantity     = item["quantity"],
            )
        try:
            deduct_inventory(stock_demand, order=order, actor=request.user)
        except InventoryError as exc:
            transaction.set_rollback(True)
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if coupon_code:
            try:
                reserve_coupon_redemption(
                    code=coupon_code,
                    order=order,
                    user=request.user,
                    items=pricing_items,
                    idempotency_key=f"checkout:{idempotency_key}" if idempotency_key else f"checkout:{order.id}:{coupon_code}",
                    loyalty_discount=loyalty_discount,
                )
            except DjangoValidationError as exc:
                transaction.set_rollback(True)
                msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
                return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        elif pricing.get("promotion"):
            evaluate_commercial_pricing(
                currency=currency,
                items=pricing_items,
                user=request.user,
                loyalty_discount=loyalty_discount,
                order=order,
                persist_snapshot=True,
            )

        mark_cart_recovered_for_order(order)

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED
        )

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        order = self.get_object()
        order = Order.objects.select_for_update().get(pk=order.pk)

        if order.status != OrderStatus.PENDING:
            return Response(
                {"error": "Solo puedes cancelar órdenes pendientes."},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.status = OrderStatus.CANCELLED
        order.save(update_fields=["status"])

        from apps.orders.marketing_services import release_or_reverse_coupon_redemption
        release_or_reverse_coupon_redemption(order)

        return Response(
            {"detail": "Orden cancelada. Stock restablecido."},
            status=status.HTTP_200_OK
        )

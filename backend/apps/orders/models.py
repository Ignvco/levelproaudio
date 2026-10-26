# apps/orders/models.py

from django.db import models, router, transaction
from django.core.exceptions import ValidationError
from django.conf import settings
from core.models import TimeStampedModel
from apps.products.models import Product


# ---------------------------------------------------------
# ORDER STATUS
# ---------------------------------------------------------

class OrderStatus(models.TextChoices):
    PENDING = "pending", "Pendiente"
    PAID = "paid", "Pagado"
    SHIPPED = "shipped", "Enviado"
    COMPLETED = "completed", "Completado"
    CANCELLED = "cancelled", "Cancelado"


# ---------------------------------------------------------
# CART
# ---------------------------------------------------------

class Cart(TimeStampedModel):
    """
    Carrito activo de un usuario.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="carts"
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name        = "Carrito"
        verbose_name_plural = "Carritos"
        ordering            = ["-created_at"]

    def __str__(self):
        return f"Cart {self.id} - {self.user}"

    @property
    def total(self):
        """
        Total del carrito.
        """
        return sum(item.subtotal for item in self.items.all())

    @property
    def items_count(self):
        """
        Número total de productos en el carrito.
        """
        return sum(item.quantity for item in self.items.all())


# ---------------------------------------------------------
# CART ITEM
# ---------------------------------------------------------

class CartItem(TimeStampedModel):
    """
    Producto dentro del carrito.
    """

    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items"
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE
    )

    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("cart", "product")

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

    @property
    def price(self):
        return self.product.price

    @property
    def subtotal(self):
        return self.price * self.quantity


# ---------------------------------------------------------
# ORDER
# ---------------------------------------------------------

class Order(TimeStampedModel):
    """
    Pedido generado desde un carrito.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="orders"
    )

    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING
    )

    total = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    # Moneda en la que se cobró la orden (CLP/USD/ARS). Multi-moneda:
    # un argentino paga en USD (Payoneer), un chileno en CLP.
    currency = models.CharField(max_length=10, default="CLP")

    # None identifica pedidos históricos sin desglose; {} es una compra nueva
    # sin consumo de inventario físico (preorden/a pedido).
    stock_deductions = models.JSONField(null=True, blank=True, editable=False)

    # ── Loyalty: canje de puntos aplicado a esta orden ──
    loyalty_points_redeemed = models.PositiveIntegerField(
        default=0,
        help_text="Puntos canjeados en el momento del checkout."
    )
    loyalty_discount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Descuento en $ aplicado por canje de puntos."
    )

    email = models.EmailField()

    shipping_address = models.TextField()

    # ── Envío ──
    shipping_carrier = models.CharField(
        max_length=100, blank=True, default="",
        help_text="Transportista (ej: Chilexpress, Starken, Correos de Chile)",
    )
    tracking_number = models.CharField(
        max_length=100, blank=True, default="",
        help_text="Número de guía / seguimiento",
    )

    notes = models.TextField(
        blank=True,
        help_text="Notas del cliente"
    )

    class Meta:
        verbose_name        = "Pedido"
        verbose_name_plural = "Pedidos"
        ordering            = ["-created_at"]

    def __str__(self):
        return f"Order #{self.id}"

    def _validate_status_transition(self, previous_status):
        if previous_status == OrderStatus.CANCELLED and self.status != OrderStatus.CANCELLED:
            raise ValidationError({"status": "Una orden cancelada no se puede reabrir. Crea una nueva orden."})
        if previous_status != OrderStatus.PENDING and self.status == OrderStatus.PENDING:
            raise ValidationError({"status": "Una orden procesada no puede volver a pendiente."})

    def clean(self):
        super().clean()
        if not self._state.adding:
            previous_status = type(self).objects.get(pk=self.pk).status
            self._validate_status_transition(previous_status)

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        if self._state.adding or (update_fields is not None and "status" not in update_fields):
            return super().save(*args, **kwargs)
        using = kwargs.get("using") or router.db_for_write(type(self), instance=self)
        with transaction.atomic(using=using):
            previous = type(self).objects.using(using).select_for_update().get(pk=self.pk)
            self._validate_status_transition(previous.status)
            if previous.status == OrderStatus.PENDING and self.status == OrderStatus.CANCELLED:
                from .inventory import restore_inventory
                restore_inventory(previous)
            # Las cancelaciones de pedidos ya pagados/enviados no prueban que
            # la mercadería haya regresado: su devolución física sigue siendo manual.
            return super().save(*args, **kwargs)

    @property
    def items_count(self):
        return sum(item.quantity for item in self.items.all())


# ---------------------------------------------------------
# ORDER ITEM
# ---------------------------------------------------------

class OrderItem(TimeStampedModel):
    """
    Snapshot del producto al momento de la compra.
    """

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items"
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True
    )

    product_name = models.CharField(max_length=300)

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    quantity = models.PositiveIntegerField()

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"

    @property
    def subtotal(self):
        return self.price * self.quantity

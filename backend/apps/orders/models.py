# apps/orders/models.py

from django.db import models
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
        ordering = ["-created_at"]

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

    email = models.EmailField()

    shipping_address = models.TextField()

    notes = models.TextField(
        blank=True,
        help_text="Notas del cliente"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order #{self.id}"

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
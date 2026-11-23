# apps/orders/models.py
from decimal import Decimal
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

    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="cart_items",
    )

    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "product"],
                condition=models.Q(variant__isnull=True),
                name="uniq_cart_product_no_variant",
            ),
            models.UniqueConstraint(
                fields=["cart", "product", "variant"],
                condition=models.Q(variant__isnull=False),
                name="uniq_cart_product_variant",
            ),
        ]

    def __str__(self):
        label = f"{self.product.name} ({self.variant.name})" if self.variant else self.product.name
        return f"{label} x {self.quantity}"

    @property
    def price(self):
        if self.variant_id:
            return self.variant.effective_price
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
        default=OrderStatus.PENDING,
        db_index=True,
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

    # ── GATE 7 (BF-11, BF-12, BF-13): OMS Multi-Dimensional States & Commercial Origin ──
    class CommercialStatusChoices(models.TextChoices):
        DRAFT     = "draft",     "Borrador / Cotización asistida"
        CONFIRMED = "confirmed", "Confirmada"
        CANCELLED = "cancelled", "Cancelada"
        COMPLETED = "completed", "Completada"

    class FinancialStatusChoices(models.TextChoices):
        UNPAID             = "unpaid",             "Sin pago"
        PENDING            = "pending",            "Pago pendiente"
        AUTHORIZED         = "authorized",         "Autorizado"
        PAID               = "paid",               "Pagado"
        PARTIALLY_PAID     = "partially_paid",     "Pagado parcialmente"
        PARTIALLY_REFUNDED = "partially_refunded", "Reembolsado parcialmente"
        REFUNDED           = "refunded",           "Reembolsado"
        FAILED             = "failed",             "Pago fallido"

    class FulfillmentStatusChoices(models.TextChoices):
        UNFULFILLED       = "unfulfilled",       "Sin preparación"
        ALLOCATED         = "allocated",         "Reservado / En preparación"
        PARTIALLY_SHIPPED = "partially_shipped", "Despachado parcialmente"
        SHIPPED           = "shipped",           "Despachado"
        DELIVERED         = "delivered",         "Entregado"
        RETURNED          = "returned",          "Devuelto (RMA)"

    class OrderOriginChoices(models.TextChoices):
        ONLINE   = "online",   "Checkout Web Online"
        MANUAL   = "manual",   "Venta Manual Asistida"
        WHATSAPP = "whatsapp", "Enlace WhatsApp Checkout"
        B2B      = "b2b",      "Cotización B2B"

    commercial_status = models.CharField(
        max_length=20,
        choices=CommercialStatusChoices.choices,
        default=CommercialStatusChoices.CONFIRMED,
        db_index=True,
    )
    financial_status = models.CharField(
        max_length=24,
        choices=FinancialStatusChoices.choices,
        default=FinancialStatusChoices.PENDING,
        db_index=True,
    )
    fulfillment_status = models.CharField(
        max_length=24,
        choices=FulfillmentStatusChoices.choices,
        default=FulfillmentStatusChoices.ALLOCATED,
        db_index=True,
    )
    order_origin = models.CharField(
        max_length=20,
        choices=OrderOriginChoices.choices,
        default=OrderOriginChoices.ONLINE,
        db_index=True,
    )
    sales_rep = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assisted_orders",
        help_text="Ejecutivo comercial responsable de la orden.",
    )
    assigned_warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_orders",
        help_text="Bodega principal asignada para preparación y despacho.",
    )
    source_draft = models.OneToOneField(
        "DraftOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="converted_order_link",
        help_text="Borrador de venta manual que originó esta orden.",
    )
    customer_name = models.CharField(max_length=180, blank=True, default="")
    customer_phone = models.CharField(max_length=60, blank=True, default="")
    customer_tax_id = models.CharField(max_length=50, blank=True, default="")
    # ── GATE 8 (BF-40): Crédito comercial B2B ──
    payment_terms = models.CharField(max_length=24, blank=True, default="prepaid")
    credit_account = models.ForeignKey(
        "CommercialCreditAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        help_text="Cuenta de crédito comercial comprometida por esta orden (si aplica).",
    )

    class Meta:
        verbose_name        = "Pedido"
        verbose_name_plural = "Pedidos"
        ordering            = ["-created_at"]
        indexes             = [
            models.Index(fields=["status", "-created_at"], name="order_status_created_idx"),
            models.Index(fields=["currency", "status"], name="order_currency_status_idx"),
            models.Index(fields=["commercial_status", "financial_status", "fulfillment_status"], name="order_3d_states_idx"),
        ]

    def __str__(self):
        return f"Order #{self.id}"

    def _sync_3d_from_legacy_status(self):
        """Sincroniza los 3 ejes desde el campo plano legacy status cuando se muta directamente."""
        from core.contracts.states import OrderStateContract
        contract = OrderStateContract.from_legacy_status(self.status)
        self.commercial_status = contract.commercial.value
        self.financial_status = contract.financial.value
        self.fulfillment_status = contract.fulfillment.value

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
        if self._state.adding:
            # Si se creó especificando status legacy (ej. status="paid") y los 3 ejes están en su default,
            # sincronizar los 3 ejes con el estado legacy inicial.
            if (
                self.status != OrderStatus.PENDING
                and self.commercial_status == self.CommercialStatusChoices.CONFIRMED
                and self.financial_status == self.FinancialStatusChoices.PENDING
                and self.fulfillment_status == self.FulfillmentStatusChoices.ALLOCATED
            ):
                self._sync_3d_from_legacy_status()
            return super().save(*args, **kwargs)
        if update_fields is not None and "status" not in update_fields:
            return super().save(*args, **kwargs)
        using = kwargs.get("using") or router.db_for_write(type(self), instance=self)
        with transaction.atomic(using=using):
            previous = type(self).objects.using(using).select_for_update().get(pk=self.pk)
            self._validate_status_transition(previous.status)
            if previous.status == OrderStatus.PENDING and self.status == OrderStatus.CANCELLED:
                from .inventory import restore_inventory
                restore_inventory(previous)
            elif previous.status == OrderStatus.PENDING and self.status == OrderStatus.PAID:
                from apps.inventory.models import StockReservation
                from apps.inventory.services import consolidate_order_reservations

                has_expired = StockReservation.objects.filter(
                    order=previous, status=StockReservation.Status.EXPIRED
                ).exists()
                has_active = StockReservation.objects.filter(
                    order=previous,
                    status__in=[StockReservation.Status.TEMPORARY, StockReservation.Status.CONSOLIDATED],
                ).exists()
                if has_expired and not has_active:
                    raise ValidationError({
                        "status": "La reserva de inventario de esta orden expiró; requiere revisión antes de confirmar pago."
                    })
                consolidate_order_reservations(previous)
            elif previous.status in (OrderStatus.PENDING, OrderStatus.PAID) and self.status in (
                OrderStatus.SHIPPED, OrderStatus.COMPLETED
            ):
                from apps.inventory.services import (
                    InventoryServiceError,
                    consolidate_order_reservations,
                    dispatch_order_reservations,
                )
                if previous.status == OrderStatus.PENDING:
                    consolidate_order_reservations(previous)
                try:
                    dispatch_order_reservations(previous, allow_from_order_save=True)
                except InventoryServiceError as exc:
                    raise ValidationError({"status": str(exc)}) from exc

            # Sincronizar los 3 ejes si la mutación vino por la vía legacy (Order.status)
            if update_fields is None or not any(
                f in update_fields for f in ("commercial_status", "financial_status", "fulfillment_status")
            ):
                if previous.status != self.status:
                    # Si la orden ya estaba pagada y se cancela comercialmente, NO marcar financial_status=failed
                    if previous.financial_status in (
                        self.FinancialStatusChoices.PAID,
                        self.FinancialStatusChoices.PARTIALLY_PAID,
                        self.FinancialStatusChoices.PARTIALLY_REFUNDED,
                        self.FinancialStatusChoices.REFUNDED,
                    ) and self.status == OrderStatus.CANCELLED:
                        self.commercial_status = self.CommercialStatusChoices.CANCELLED
                        self.financial_status = previous.financial_status
                        self.fulfillment_status = previous.fulfillment_status
                    else:
                        self._sync_3d_from_legacy_status()
                    if update_fields is not None:
                        kwargs["update_fields"] = list(
                            set(update_fields) | {"commercial_status", "financial_status", "fulfillment_status"}
                        )
            return super().save(*args, **kwargs)

    @property
    def items_count(self):
        return sum(item.quantity for item in self.items.all())

    @property
    def money(self):
        """Contrato de moneda tipado y aislado para LevelPro OS V4.0."""
        from core.contracts.money import Money
        return Money(self.total, self.currency)

    @property
    def state_contract(self):
        """Contrato tri-dimensional desacoplado (comercial, financiero, logístico)."""
        from core.contracts.states import OrderStateContract
        return OrderStateContract.from_order(self)


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

    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
    )

    product_name = models.CharField(max_length=300)
    variant_name = models.CharField(max_length=250, blank=True, default="")
    variant_sku  = models.CharField(max_length=100, blank=True, default="")

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    quantity = models.PositiveIntegerField()

    # ── GATE 6 (BF-09 & BF-18): Snapshots inmutables de Costo de Venta (COGS) ──
    unit_cost_snapshot = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Costo unitario real congelado al momento de salida física / venta.",
    )
    total_cost_snapshot = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Costo total de venta (COGS) congelado para esta línea.",
    )
    cost_currency = models.CharField(
        max_length=3,
        blank=True,
        default="",
        help_text="Moneda del snapshot de costo (CLP, USD, ARS).",
    )
    costing_method_snapshot = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="Método de costeo aplicado (specific_serial, weighted_average, catalog_fallback).",
    )
    cost_frozen_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp en que se congeló definitivamente el costo de venta.",
    )
    tax_rate_snapshot = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Tasa de impuesto explícitamente verificada sobre la venta (None si no verificada).",
    )
    net_unit_revenue_snapshot = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Ingreso neto unitario verificado (sin conversión silenciosa si faltan datos tributarios).",
    )
    allocated_serial_numbers = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de números de serie cuyos costos específicos fueron consumidos en esta línea.",
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"

    @property
    def subtotal(self):
        return self.price * self.quantity


# ═══════════════════════════════════════════════════════════════
# B2B QUOTES & WHOLESALE (V3.3 Módulo 2)
# ═══════════════════════════════════════════════════════════════

class B2BQuoteStatus(models.TextChoices):
    DRAFT     = "draft",     "Borrador comercial"
    PENDING   = "pending",   "Pendiente de revisión"
    REVIEWED  = "reviewed",  "En evaluación técnica"
    APPROVED  = "approved",  "Aprobada"
    ISSUED    = "issued",    "Emitida"
    SENT      = "sent",      "Enviada al cliente"
    ACCEPTED  = "accepted",  "Aceptada por cliente"
    REJECTED  = "rejected",  "Rechazada"
    CONVERTED = "converted", "Convertida en pedido"
    EXPIRED   = "expired",   "Vencida"


class B2BQuote(TimeStampedModel):
    """Cotización B2B para estudios, productoras e instituciones (V3.3 + Gate 8 BF-20)."""
    quote_number     = models.CharField(max_length=40, unique=True, null=True, blank=True, db_index=True)
    version          = models.PositiveIntegerField(default=1)
    user             = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="b2b_quotes")
    organization     = models.ForeignKey("CustomerOrganization", on_delete=models.SET_NULL, null=True, blank=True, related_name="b2b_quotes")
    customer_profile = models.ForeignKey("CustomerProfile", on_delete=models.SET_NULL, null=True, blank=True, related_name="b2b_quotes")
    contact          = models.ForeignKey("CustomerContact", on_delete=models.SET_NULL, null=True, blank=True, related_name="b2b_quotes")
    sales_rep        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_b2b_quotes")
    company_name     = models.CharField(max_length=200, verbose_name="Razón Social / Empresa")
    tax_id           = models.CharField(max_length=50, help_text="RUT (Chile) o CUIT (Argentina)")
    contact_name     = models.CharField(max_length=150, verbose_name="Nombre de Contacto")
    email            = models.EmailField(verbose_name="Email de Contacto")
    phone            = models.CharField(max_length=50, blank=True, verbose_name="Teléfono")
    country          = models.CharField(max_length=10, blank=True, default="")
    tax_regime       = models.CharField(max_length=40, blank=True, default="")
    currency         = models.CharField(max_length=10, default="CLP")
    subtotal         = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_amount  = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    tax_amount       = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total            = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    valid_until      = models.DateField(null=True, blank=True)
    payment_terms    = models.CharField(max_length=40, blank=True, default="prepaid")
    delivery_terms   = models.CharField(max_length=220, blank=True, default="")
    status           = models.CharField(max_length=20, choices=B2BQuoteStatus.choices, default=B2BQuoteStatus.PENDING)
    client_notes     = models.TextField(blank=True, verbose_name="Notas del Cliente")
    admin_notes      = models.TextField(blank=True, verbose_name="Notas de Ventas")
    issued_at        = models.DateTimeField(null=True, blank=True)
    approved_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_b2b_quotes")
    approved_at      = models.DateTimeField(null=True, blank=True)
    shared_at        = models.DateTimeField(null=True, blank=True)
    share_token      = models.CharField(max_length=128, unique=True, null=True, blank=True, db_index=True)
    share_token_expires_at = models.DateTimeField(null=True, blank=True)
    conversion_idempotency_key = models.CharField(max_length=160, unique=True, null=True, blank=True)
    version_history  = models.JSONField(default=list, blank=True)
    converted_order  = models.OneToOneField("Order", null=True, blank=True, on_delete=models.SET_NULL, related_name="originating_b2b_quote")

    class Meta:
        verbose_name = "Cotización B2B"
        verbose_name_plural = "Cotizaciones B2B"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Cotización #{str(self.id)[:8].upper()} — {self.company_name}"


class B2BQuoteItem(TimeStampedModel):
    quote        = models.ForeignKey(B2BQuote, on_delete=models.CASCADE, related_name="items")
    product      = models.ForeignKey("products.Product", on_delete=models.SET_NULL, null=True, blank=True)
    variant      = models.ForeignKey("products.ProductVariant", on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=300)
    sku_snapshot = models.CharField(max_length=100, blank=True, default="")
    variant_name_snapshot = models.CharField(max_length=250, blank=True, default="")
    catalog_unit_price_snapshot = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    b2b_proposed_price_snapshot = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    unit_price   = models.DecimalField(max_digits=12, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    quantity     = models.PositiveIntegerField(default=1)
    subtotal     = models.DecimalField(max_digits=12, decimal_places=2)
    pricing_source = models.CharField(max_length=120, blank=True, default="")
    price_list_version = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        verbose_name = "Item de Cotización B2B"
        verbose_name_plural = "Items de Cotización B2B"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"


# ═══════════════════════════════════════════════════════════════
# GATE 7 (BF-11, BF-12, BF-13, BF-23): ORDER MANAGEMENT SYSTEM
# ═══════════════════════════════════════════════════════════════

class DraftOrder(TimeStampedModel):
    """
    BF-11 & BF-12: Venta Manual Asistida / Propuesta Comercial con snapshots inmutables,
    integración de reservas temporales WMS y generación de enlace seguro de WhatsApp Checkout.
    """

    class Status(models.TextChoices):
        DRAFT     = "draft",     "Borrador en edición"
        PROPOSED  = "proposed",  "Propuesta emitida"
        RESERVED  = "reserved",  "Stock reservado temporalmente"
        SHARED    = "shared",    "Enlace de pago compartido"
        CONVERTED = "converted", "Convertido en pedido"
        EXPIRED   = "expired",   "Vencido"
        CANCELLED = "cancelled", "Cancelado"

    class Channel(models.TextChoices):
        MANUAL   = "manual",   "Venta Manual Ejecutiva"
        WHATSAPP = "whatsapp", "WhatsApp Checkout"
        PHONE    = "phone",    "Atención Telefónica"
        SHOWROOM = "showroom", "Showroom / Sala de Ventas"

    draft_number = models.CharField(max_length=40, unique=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.MANUAL,
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="draft_orders",
    )
    customer_name = models.CharField(max_length=180)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=60, blank=True, default="")
    customer_tax_id = models.CharField(max_length=50, blank=True, default="")
    shipping_address = models.TextField(blank=True, default="")

    currency = models.CharField(max_length=10, default="CLP")
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    valid_until = models.DateTimeField(null=True, blank=True, db_index=True)
    reserve_inventory = models.BooleanField(default=False)
    reservation_session_key = models.CharField(max_length=120, blank=True, default="", db_index=True)
    reservation_expires_at = models.DateTimeField(null=True, blank=True)
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="draft_orders",
    )

    notes = models.TextField(blank=True, default="", help_text="Observaciones visibles para el cliente.")
    internal_notes = models.TextField(blank=True, default="", help_text="Notas internas privadas de ventas.")
    terms_snapshot = models.TextField(blank=True, default="")

    # BF-12: Token opaco y enlace seguro de WhatsApp Checkout
    checkout_token = models.CharField(max_length=128, unique=True, null=True, blank=True, db_index=True)
    checkout_token_expires_at = models.DateTimeField(null=True, blank=True)
    whatsapp_shared_at = models.DateTimeField(null=True, blank=True)

    # Conversión idempotente a Order
    converted_order = models.OneToOneField(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="originating_draft_order",
    )
    conversion_idempotency_key = models.CharField(max_length=160, unique=True, null=True, blank=True)

    sales_rep = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_draft_orders",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_draft_orders",
    )

    class Meta:
        verbose_name = "Borrador de Venta Manual"
        verbose_name_plural = "Borradores de Ventas Manuales"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.draft_number} — {self.customer_name} ({self.status})"


class DraftOrderItem(TimeStampedModel):
    """
    BF-11: Línea de propuesta comercial / venta manual con snapshots congelados de SKU,
    nombre, variante, precio de catálogo y precio autorizado.
    """

    draft_order = models.ForeignKey(
        DraftOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="draft_order_items",
    )
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="draft_order_items",
    )
    sku_snapshot = models.CharField(max_length=100)
    product_name_snapshot = models.CharField(max_length=300)
    variant_name_snapshot = models.CharField(max_length=250, blank=True, default="")
    product_type_snapshot = models.CharField(max_length=20, default="stock")
    quantity = models.PositiveIntegerField(default=1)
    catalog_unit_price_snapshot = models.DecimalField(max_digits=14, decimal_places=2)
    authorized_unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=10, default="CLP")
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    notes = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Ítem de Borrador de Venta"
        verbose_name_plural = "Ítems de Borrador de Venta"
        ordering = ["created_at", "pk"]

    def __str__(self):
        return f"{self.sku_snapshot} x {self.quantity} ({self.draft_order.draft_number})"


class ReturnMerchandiseAuthorization(TimeStampedModel):
    """
    BF-23: Autorización formal de devolución y reembolso (RMA).
    Diferencia estrictamente:
    1. Solicitud comercial (requested).
    2. Autorización de retorno (authorized / rejected).
    3. Recepción física en bodega (received).
    4. Inspección técnica (inspected).
    5. Reingreso controlado a stock vendible o no vendible (restocked / quarantined / scrapped).
    6. Resolución y ejecución de reembolso financiero (refund_status).
    """

    class Status(models.TextChoices):
        REQUESTED  = "requested",  "1. Devolución solicitada"
        AUTHORIZED = "authorized", "2. Retorno autorizado"
        REJECTED   = "rejected",   "Rechazada comercialmente"
        RECEIVED   = "received",   "3. Producto recibido físicamente"
        INSPECTED  = "inspected",  "4. Inspección física completada"
        RESTOCKED  = "restocked",  "5. Reincorporado a inventario"
        CLOSED     = "closed",     "6. Caso RMA cerrado"
        CANCELLED  = "cancelled",  "Cancelada"

    class ReasonCode(models.TextChoices):
        DEFECTIVE        = "defective",        "Falla técnica / Defecto de fábrica"
        DAMAGED_SHIPPING = "damaged_shipping", "Daño en transporte"
        WRONG_ITEM       = "wrong_item",       "Producto o variante incorrecta"
        COMMERCIAL_CHANGE = "commercial_change", "Cambio comercial autorizado"
        RETRACT          = "retract",          "Retracto legal"
        OTHER            = "other",            "Otro motivo"

    class RefundStatus(models.TextChoices):
        NONE                         = "none",                         "Sin reembolso"
        PENDING_APPROVAL             = "pending_approval",             "Pendiente de aprobación financiera"
        APPROVED_PENDING_EXECUTION   = "approved_pending_execution",   "Aprobado — Pendiente de ejecución autorizada"
        EXECUTED                     = "executed",                     "Reembolso ejecutado"
        REJECTED                     = "rejected",                     "Reembolso rechazado"

    rma_number = models.CharField(max_length=40, unique=True, db_index=True)
    order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
        related_name="rmas",
    )
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.REQUESTED,
        db_index=True,
    )
    reason_code = models.CharField(
        max_length=30,
        choices=ReasonCode.choices,
        default=ReasonCode.DEFECTIVE,
    )
    reason_details = models.TextField(blank=True, default="")
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rmas",
    )

    # Decisión comercial y reembolso financiero (desacoplado del reingreso físico)
    commercial_resolution = models.CharField(max_length=60, blank=True, default="")
    refund_status = models.CharField(
        max_length=32,
        choices=RefundStatus.choices,
        default=RefundStatus.NONE,
        db_index=True,
    )
    refund_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    refund_currency = models.CharField(max_length=10, default="CLP")
    refund_provider = models.CharField(max_length=40, blank=True, default="")
    refund_reference = models.CharField(max_length=140, blank=True, default="")
    refund_idempotency_key = models.CharField(max_length=160, unique=True, null=True, blank=True)

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_rmas",
    )
    authorized_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authorized_rmas",
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_rmas",
    )
    inspected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspected_rmas",
    )
    refund_resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="refund_resolved_rmas",
    )

    authorized_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    inspected_at = models.DateTimeField(null=True, blank=True)
    restocked_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Autorización de Devolución (RMA)"
        verbose_name_plural = "Autorizaciones de Devolución (RMA)"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.rma_number} (Order #{self.order_id}) — {self.status}"


class RMAItem(TimeStampedModel):
    """
    BF-23: Línea de devolución RMA referenciando OrderItem, SKU, variante, número de serie,
    condición física inspeccionada, decisión de inventario y movimientos compensatorios de Kardex y Costos.
    """

    class ConditionStatus(models.TextChoices):
        PENDING_INSPECTION = "pending_inspection", "Pendiente de inspección"
        SELLABLE_GOOD      = "sellable_good",      "Apto para venta (Sellable)"
        DAMAGED_NON_SELLABLE = "damaged_non_sellable", "Dañado / No elegible para venta"
        DEFECTIVE_WARRANTY = "defective_warranty", "Defectuoso (Garantía / Taller)"

    class RestockDecision(models.TextChoices):
        PENDING                  = "pending",                  "Pendiente de decisión"
        RESTOCK_SELLABLE         = "restock_sellable",         "Reingresar a stock vendible"
        RESTOCK_DAMAGED_QUARANTINE = "restock_damaged_quarantine", "Reingresar como dañado / no vendible"
        DO_NOT_RESTOCK           = "do_not_restock",           "No reingresar a inventario"

    rma = models.ForeignKey(
        ReturnMerchandiseAuthorization,
        on_delete=models.CASCADE,
        related_name="items",
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.PROTECT,
        related_name="rma_items",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="rma_items",
    )
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rma_items",
    )
    sku_snapshot = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=120, blank=True, default="", db_index=True)

    quantity_requested = models.PositiveIntegerField(default=1)
    quantity_received = models.PositiveIntegerField(default=0)
    quantity_accepted_sellable = models.PositiveIntegerField(default=0)
    quantity_damaged_non_sellable = models.PositiveIntegerField(default=0)

    condition_status = models.CharField(
        max_length=30,
        choices=ConditionStatus.choices,
        default=ConditionStatus.PENDING_INSPECTION,
    )
    restock_decision = models.CharField(
        max_length=32,
        choices=RestockDecision.choices,
        default=RestockDecision.PENDING,
    )
    inspection_notes = models.TextField(blank=True, default="")

    # Costo histórico preservado de la venta original y referencias compensatorias
    original_unit_cost_snapshot = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    cost_currency = models.CharField(max_length=10, blank=True, default="")
    return_inventory_movement = models.ForeignKey(
        "inventory.InventoryMovement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rma_return_items",
    )
    compensatory_cost_layer = models.ForeignKey(
        "procurement.CostLayer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rma_compensatory_items",
    )
    is_restocked = models.BooleanField(default=False, db_index=True)

    class Meta:
        verbose_name = "Línea de RMA"
        verbose_name_plural = "Líneas de RMA"
        ordering = ["created_at", "pk"]

    def __str__(self):
        return f"{self.rma.rma_number} | {self.sku_snapshot} x {self.quantity_requested}"


from .crm_models import (  # noqa: E402, F401
    B2BPriceList,
    B2BPriceListItem,
    B2BPriceTier,
    B2BQuotePDFSnapshot,
    CommercialCreditAccount,
    CommercialCreditDecision,
    CustomerContact,
    CustomerInteraction,
    CustomerOrganization,
    CustomerProfile,
    CustomerTechnicalProfile,
)



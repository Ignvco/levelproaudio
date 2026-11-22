# apps/procurement/models.py
"""
LEVELPRO OS V4.0 — GATE 3: SUPPLIER MANAGEMENT (BF-01 & BF-02)
Modelos de dominio:
- Supplier: Directorio empresarial de fabricantes, importadores, distribuidores y mayoristas.
- SupplierContact: Múltiples contactos comerciales por proveedor.
- ProductSupplier: Relación comercial M2M entre proveedor y Product/ProductVariant (usando identidad persistente + SkuRegistry).
- SupplierPriceHistory: Registro histórico inmutable (append-only) de costos de adquisición.
"""

from decimal import Decimal
from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from core.models import TimeStampedModel


class Supplier(TimeStampedModel):
    """Proveedor comercial nacional o internacional (BF-01)."""

    class SupplierType(models.TextChoices):
        MANUFACTURER = "manufacturer", "Fabricante"
        IMPORTER = "importer", "Importador"
        DISTRIBUTOR = "distributor", "Distribuidor"
        WHOLESALER = "wholesaler", "Mayorista"

    class Currency(models.TextChoices):
        CLP = "CLP", "Peso Chileno (CLP)"
        USD = "USD", "Dólar Estadounidense (USD)"
        ARS = "ARS", "Peso Argentino (ARS)"

    internal_code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Código interno",
    )
    legal_name = models.CharField(
        max_length=250,
        verbose_name="Razón social",
    )
    trade_name = models.CharField(
        max_length=250,
        blank=True,
        default="",
        verbose_name="Nombre comercial",
    )
    tax_id = models.CharField(
        max_length=80,
        blank=True,
        default="",
        db_index=True,
        verbose_name="Identificación tributaria (RUT/CUIT/EIN/VAT)",
    )
    country = models.CharField(
        max_length=100,
        default="Chile",
        db_index=True,
        verbose_name="País",
    )
    address = models.TextField(
        blank=True,
        default="",
        verbose_name="Dirección comercial",
    )
    website = models.URLField(
        blank=True,
        default="",
        verbose_name="Sitio web",
    )
    primary_email = models.EmailField(
        blank=True,
        default="",
        verbose_name="Correo electrónico principal",
    )
    primary_phone = models.CharField(
        max_length=60,
        blank=True,
        default="",
        verbose_name="Teléfono principal",
    )
    supplier_type = models.CharField(
        max_length=20,
        choices=SupplierType.choices,
        default=SupplierType.DISTRIBUTOR,
        db_index=True,
        verbose_name="Tipo de proveedor",
    )
    currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.USD,
        verbose_name="Moneda comercial",
    )
    payment_terms = models.CharField(
        max_length=150,
        blank=True,
        default="",
        verbose_name="Condiciones de pago",
    )
    default_min_order_qty = models.PositiveIntegerField(
        default=1,
        verbose_name="Cantidad mínima de compra habitual",
    )
    default_lead_time_days = models.PositiveIntegerField(
        default=7,
        verbose_name="Plazo habitual de abastecimiento (días)",
    )
    brands = models.ManyToManyField(
        "products.Brand",
        blank=True,
        related_name="suppliers",
        verbose_name="Marcas distribuidas",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Activo",
    )
    internal_notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Observaciones internas",
    )

    class Meta:
        verbose_name = "Proveedor"
        verbose_name_plural = "Proveedores"
        ordering = ["legal_name", "internal_code"]
        indexes = [
            models.Index(fields=["country", "is_active"], name="proc_sup_country_act_idx"),
            models.Index(fields=["supplier_type", "is_active"], name="proc_sup_type_act_idx"),
        ]

    def __str__(self):
        label = self.trade_name or self.legal_name
        return f"{self.internal_code} — {label}"

    def clean(self):
        super().clean()
        if self.internal_code:
            self.internal_code = str(self.internal_code).strip().upper()
        if not self.internal_code:
            raise ValidationError({"internal_code": "El código interno del proveedor es obligatorio."})
        if not self.legal_name or not str(self.legal_name).strip():
            raise ValidationError({"legal_name": "La razón social del proveedor es obligatoria."})
        if self.currency not in dict(self.Currency.choices):
            raise ValidationError({"currency": "Moneda comercial no soportada. Use CLP, USD o ARS."})


class SupplierContact(TimeStampedModel):
    """Contacto comercial asociado a un proveedor."""

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name="contacts",
    )
    full_name = models.CharField(max_length=150)
    role_title = models.CharField(max_length=120, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=60, blank=True, default="")
    is_primary = models.BooleanField(default=False)
    notes = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Contacto de proveedor"
        verbose_name_plural = "Contactos de proveedor"
        ordering = ["-is_primary", "full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.supplier.trade_name or self.supplier.legal_name})"


class ProductSupplier(TimeStampedModel):
    """
    Relación comercial M2M entre un proveedor y una unidad comercial del catálogo
    (Product simple o ProductVariant individual), vinculada por FK persistente y
    SkuRegistry (BF-02).
    """

    class TaxBasis(models.TextChoices):
        NET = "net", "Neto (sin impuestos)"
        TAX_INCLUDED = "tax_included", "Impuestos incluidos"

    class AvailabilityStatus(models.TextChoices):
        IN_STOCK = "in_stock", "Disponible"
        LOW_STOCK = "low_stock", "Stock limitado"
        ON_ORDER = "on_order", "Bajo pedido / Fabricación"
        OUT_OF_STOCK = "out_of_stock", "Sin stock en proveedor"
        UNKNOWN = "unknown", "No informado"

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="product_links",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="supplier_links",
    )
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="supplier_links",
    )
    sku_registry = models.ForeignKey(
        "products.SkuRegistry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supplier_links",
    )
    supplier_sku = models.CharField(
        max_length=120,
        blank=True,
        default="",
        db_index=True,
        verbose_name="SKU o código del proveedor",
    )
    unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        verbose_name="Costo unitario de adquisición",
    )
    currency = models.CharField(
        max_length=3,
        choices=Supplier.Currency.choices,
        default=Supplier.Currency.USD,
        verbose_name="Moneda del costo",
    )
    tax_basis = models.CharField(
        max_length=20,
        choices=TaxBasis.choices,
        default=TaxBasis.NET,
        verbose_name="Base tributaria del precio",
    )
    moq = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name="Cantidad mínima de compra (MOQ)",
    )
    lead_time_days = models.PositiveIntegerField(
        default=7,
        verbose_name="Plazo de abastecimiento (días)",
    )
    reported_availability = models.CharField(
        max_length=20,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.UNKNOWN,
        verbose_name="Disponibilidad informada por proveedor",
    )
    reported_available_qty = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Cantidad informada por proveedor (no es stock físico)",
    )
    availability_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de actualización de disponibilidad",
    )
    cost_valid_from = models.DateField(
        null=True,
        blank=True,
        verbose_name="Vigencia del costo desde",
    )
    cost_valid_until = models.DateField(
        null=True,
        blank=True,
        verbose_name="Vigencia del costo hasta",
    )
    is_preferred = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Proveedor preferente",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Activo",
    )
    commercial_notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Observaciones comerciales",
    )

    class Meta:
        verbose_name = "Relación producto-proveedor"
        verbose_name_plural = "Relaciones producto-proveedor"
        ordering = ["-is_preferred", "unit_cost", "lead_time_days"]
        constraints = [
            models.UniqueConstraint(
                fields=["supplier", "product"],
                condition=models.Q(variant__isnull=True),
                name="uniq_supplier_product_no_variant",
            ),
            models.UniqueConstraint(
                fields=["supplier", "product", "variant"],
                condition=models.Q(variant__isnull=False),
                name="uniq_supplier_product_variant",
            ),
            models.UniqueConstraint(
                fields=["product"],
                condition=models.Q(variant__isnull=True, is_preferred=True),
                name="uniq_preferred_supplier_product",
            ),
            models.UniqueConstraint(
                fields=["variant"],
                condition=models.Q(variant__isnull=False, is_preferred=True),
                name="uniq_preferred_supplier_variant",
            ),
        ]
        indexes = [
            models.Index(fields=["product", "variant", "is_active"], name="proc_ps_unit_act_idx"),
            models.Index(fields=["supplier", "is_active"], name="proc_ps_sup_act_idx"),
        ]

    def __str__(self):
        unit_label = f"{self.product.name} ({self.variant.name})" if self.variant_id else self.product.name
        return f"{self.supplier.trade_name or self.supplier.legal_name} → {unit_label}"

    @property
    def internal_sku(self) -> str:
        if self.variant_id:
            return self.variant.sku
        return self.product.sku or ""

    @property
    def is_cost_expired(self) -> bool:
        if self.cost_valid_until is None:
            return False
        return self.cost_valid_until < timezone.localdate()

    def clean(self):
        from apps.products.models import ProductVariant, SkuRegistry
        from core.contracts.money import Money

        super().clean()
        if self.variant_id and self.variant.product_id != self.product_id:
            raise ValidationError({"variant": "La variante seleccionada no pertenece al producto maestro indicado."})

        if self.product_id and not self.variant_id:
            if ProductVariant.objects.filter(product_id=self.product_id).exists():
                raise ValidationError({
                    "variant": "Este producto posee variantes; debe vincular la variante comercial específica."
                })

        if self.cost_valid_from and self.cost_valid_until and self.cost_valid_until < self.cost_valid_from:
            raise ValidationError({"cost_valid_until": "La fecha de término de vigencia no puede ser anterior a la fecha inicial."})

        try:
            Money(self.unit_cost, self.currency)
        except Exception as exc:
            raise ValidationError({"unit_cost": str(exc)})

        if self.is_preferred and not self.is_active:
            raise ValidationError({"is_preferred": "Una relación inactiva no puede ser marcada como proveedor preferente."})

        # Sincronizar referencia persistente a SkuRegistry
        if self.variant_id:
            reg = SkuRegistry.objects.filter(variant_id=self.variant_id).first()
            if reg:
                self.sku_registry = reg
        elif self.product_id:
            reg = SkuRegistry.objects.filter(product_id=self.product_id).first()
            if reg:
                self.sku_registry = reg

    def save(self, *args, **kwargs):
        from apps.products.models import SkuRegistry
        if self.sku_registry_id is None:
            if self.variant_id:
                self.sku_registry = SkuRegistry.objects.filter(variant_id=self.variant_id).first()
            elif self.product_id:
                self.sku_registry = SkuRegistry.objects.filter(product_id=self.product_id).first()
        super().save(*args, **kwargs)


class AppendOnlyQuerySet(models.QuerySet):
    """QuerySet inmutable: prohíbe updates y deletes masivos a nivel de ORM."""

    def update(self, **kwargs):
        raise PermissionDenied("Los registros históricos de costos son inmutables (append-only). Operación UPDATE denegada.")

    def delete(self):
        raise PermissionDenied("Los registros históricos de costos son inmutables (append-only). Operación DELETE denegada.")

    def bulk_update(self, objs, fields, **kwargs):
        raise PermissionDenied("Los registros históricos de costos son inmutables (append-only). Operación BULK UPDATE denegada.")


class AppendOnlyManager(models.Manager.from_queryset(AppendOnlyQuerySet)):
    """Manager operacional con semántica append-only."""
    pass


class SupplierPriceHistory(TimeStampedModel):
    """
    Registro histórico append-only de modificaciones de costos de proveedor.
    Nunca se sobrescribe retroactivamente. Protegido por aplicación y triggers PostgreSQL.
    """

    objects = AppendOnlyManager()

    class Source(models.TextChoices):
        INITIAL = "initial", "Alta inicial"
        MANUAL = "manual", "Edición manual"
        IMPORT = "import", "Importación Excel/CSV"

    product_supplier = models.ForeignKey(
        ProductSupplier,
        on_delete=models.PROTECT,
        related_name="price_history",
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="price_history",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="supplier_price_history",
    )
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="supplier_price_history",
    )
    previous_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    new_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
    )
    previous_currency = models.CharField(
        max_length=3,
        blank=True,
        default="",
    )
    new_currency = models.CharField(
        max_length=3,
        choices=Supplier.Currency.choices,
    )
    tax_basis = models.CharField(
        max_length=20,
        choices=ProductSupplier.TaxBasis.choices,
        default=ProductSupplier.TaxBasis.NET,
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supplier_cost_changes",
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
    )
    notes = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Historial de costo de proveedor"
        verbose_name_plural = "Historial de costos de proveedores"
        ordering = ["-recorded_at", "-created_at"]
        indexes = [
            models.Index(fields=["product", "variant", "-recorded_at"], name="proc_hist_unit_rec_idx"),
            models.Index(fields=["supplier", "-recorded_at"], name="proc_hist_sup_rec_idx"),
        ]

    def __str__(self):
        return f"{self.supplier.internal_code} · {self.previous_cost} -> {self.new_cost} {self.new_currency}"

    def save(self, *args, **kwargs):
        if not self._state.adding and self.pk:
            raise PermissionDenied("Los registros históricos de costos son inmutables: no se permite su modificación.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionDenied("Los registros históricos de costos son inmutables: no se permite su eliminación.")


# ══════════════════════════════════════════════════════════════════════════════
# GATE 5: PURCHASE ORDERS (BF-03), GOODS RECEIPTS (BF-04), CUSTOMS DOCS (BF-42)
# ══════════════════════════════════════════════════════════════════════════════


class PurchaseOrder(TimeStampedModel):
    """Orden de compra formal a proveedor nacional o internacional (BF-03)."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        APPROVED = "approved", "Aprobada"
        ISSUED = "issued", "Emitida"
        PARTIALLY_RECEIVED = "partially_received", "Recibida parcialmente"
        RECEIVED = "received", "Recibida completa"
        CLOSED = "closed", "Cerrada"
        CANCELLED = "cancelled", "Cancelada"

    po_number = models.CharField(
        max_length=40,
        unique=True,
        verbose_name="Número de orden",
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
    )
    destination_warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )
    status = models.CharField(
        max_length=25,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    currency = models.CharField(
        max_length=3,
        choices=Supplier.Currency.choices,
        default=Supplier.Currency.USD,
    )
    payment_terms_snapshot = models.CharField(max_length=150, blank=True, default="")
    incoterm_snapshot = models.CharField(max_length=40, blank=True, default="")
    tax_basis_snapshot = models.CharField(max_length=40, blank=True, default="net")
    delivery_address_snapshot = models.TextField(blank=True, default="")
    expected_delivery_date = models.DateField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_purchase_orders",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_purchase_orders",
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_purchase_orders",
    )
    internal_notes = models.TextField(blank=True, default="")
    external_notes = models.TextField(blank=True, default="")
    subtotal_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    revision_number = models.PositiveIntegerField(default=1)
    issued_pdf_version = models.PositiveIntegerField(default=0)
    issued_pdf_bytes = models.BinaryField(null=True, blank=True)
    issued_pdf_filename = models.CharField(max_length=150, blank=True, default="")
    special_order_requests = models.ManyToManyField(
        "products.SpecialOrderRequest",
        blank=True,
        related_name="purchase_orders",
    )

    class Meta:
        verbose_name = "Orden de compra"
        verbose_name_plural = "Órdenes de compra"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="proc_po_status_created_idx"),
            models.Index(fields=["supplier", "status"], name="proc_po_sup_status_idx"),
        ]

    def __str__(self):
        return f"{self.po_number} ({self.supplier.internal_code})"


class PurchaseOrderItem(TimeStampedModel):
    """Línea de orden de compra con snapshot comercial y control de pendientes (BF-03)."""

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="purchase_order_items",
    )
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="purchase_order_items",
    )
    sku_registry = models.ForeignKey(
        "products.SkuRegistry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="purchase_order_items",
    )
    product_supplier = models.ForeignKey(
        ProductSupplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_order_items",
    )
    internal_sku_snapshot = models.CharField(max_length=100, blank=True, default="")
    supplier_sku_snapshot = models.CharField(max_length=100, blank=True, default="")
    description_snapshot = models.CharField(max_length=350)
    quantity_ordered = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    quantity_received = models.PositiveIntegerField(default=0)
    unit_cost_snapshot = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0"))],
    )
    currency = models.CharField(
        max_length=3,
        choices=Supplier.Currency.choices,
        default=Supplier.Currency.USD,
    )
    tax_basis_snapshot = models.CharField(max_length=30, blank=True, default="net")
    line_subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        verbose_name = "Línea de orden de compra"
        verbose_name_plural = "Líneas de orden de compra"
        ordering = ["created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity_ordered__gte=1),
                name="proc_poi_qty_ord_gte_1",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_received__gte=0),
                name="proc_poi_qty_rec_gte_0",
            ),
        ]

    @property
    def quantity_pending(self) -> int:
        return max(0, int(self.quantity_ordered) - int(self.quantity_received))

    def clean(self):
        super().clean()
        if self.variant_id and self.variant.product_id != self.product_id:
            raise ValidationError("La variante no pertenece al producto indicado.")
        if self.quantity_received > self.quantity_ordered:
            raise ValidationError("La cantidad recibida no puede superar la cantidad solicitada sin autorización.")


class GoodsReceipt(TimeStampedModel):
    """Recepción física de mercadería desacoplada de la emisión de PO (BF-04)."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        CONFIRMED = "confirmed", "Confirmada"
        CANCELLED = "cancelled", "Anulada"

    receipt_number = models.CharField(max_length=40, unique=True)
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name="goods_receipts",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.PROTECT,
        related_name="goods_receipts",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    received_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_goods_receipts",
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="confirmed_goods_receipts",
    )
    delivery_note_number = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    discrepancy_notes = models.TextField(blank=True, default="")
    idempotency_key = models.CharField(max_length=120, unique=True, null=True, blank=True)

    class Meta:
        verbose_name = "Recepción de mercadería"
        verbose_name_plural = "Recepciones de mercadería"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["purchase_order", "status"], name="proc_gr_po_status_idx"),
        ]

    def __str__(self):
        return f"{self.receipt_number} ({self.purchase_order.po_number})"


class GoodsReceiptItem(TimeStampedModel):
    """Detalle por línea de recepción física, mermas, rechazos y seriales (BF-04)."""

    goods_receipt = models.ForeignKey(
        GoodsReceipt,
        on_delete=models.CASCADE,
        related_name="items",
    )
    purchase_order_item = models.ForeignKey(
        PurchaseOrderItem,
        on_delete=models.PROTECT,
        related_name="receipt_items",
    )
    quantity_arrived = models.PositiveIntegerField(default=0)
    quantity_accepted = models.PositiveIntegerField(default=0)
    quantity_damaged = models.PositiveIntegerField(default=0)
    quantity_rejected = models.PositiveIntegerField(default=0)
    serial_numbers = models.JSONField(default=list, blank=True)
    damaged_serial_numbers = models.JSONField(default=list, blank=True)
    discrepancy_reason = models.CharField(max_length=255, blank=True, default="")
    inventory_movement = models.ForeignKey(
        "inventory.InventoryMovement",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="goods_receipt_items",
    )

    class Meta:
        verbose_name = "Línea de recepción"
        verbose_name_plural = "Líneas de recepción"
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["goods_receipt", "purchase_order_item"],
                name="proc_gri_unique_gr_poi",
            ),
        ]

    @property
    def quantity_physical_received(self) -> int:
        return int(self.quantity_accepted) + int(self.quantity_damaged)

    def clean(self):
        super().clean()
        if self.quantity_accepted + self.quantity_damaged + self.quantity_rejected != self.quantity_arrived:
            raise ValidationError(
                "La suma de unidades aceptadas, dañadas y rechazadas debe igualar la cantidad llegada."
            )
        if self.quantity_physical_received <= 0 and self.quantity_rejected <= 0:
            raise ValidationError("Debe registrar al menos una unidad llegada.")


class CustomsDocument(TimeStampedModel):
    """Repositorio documental aduanero y comercial vinculado a PO (BF-42)."""

    class DocumentType(models.TextChoices):
        COMMERCIAL_INVOICE = "commercial_invoice", "Factura comercial"
        BILL_OF_LADING = "bill_of_lading", "Bill of Lading (BL)"
        AIR_WAYBILL = "air_waybill", "Air Waybill (AWB)"
        CUSTOMS_DUS = "customs_dus", "Documento Aduanero / DUS"
        PACKING_LIST = "packing_list", "Packing List"
        CERTIFICATE = "certificate", "Certificado / Anexo comercial"

    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Cargado"
        VERIFIED = "verified", "Revisado"
        SUPERSEDED = "superseded", "Reemplazado"
        ARCHIVED = "archived", "Archivado"

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="customs_documents",
    )
    document_type = models.CharField(
        max_length=30,
        choices=DocumentType.choices,
        db_index=True,
    )
    document_identifier = models.CharField(max_length=120)
    document_date = models.DateField(null=True, blank=True)
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, default="application/pdf")
    file_size = models.PositiveIntegerField(default=0)
    file_sha256 = models.CharField(max_length=64, blank=True, default="")
    file_bytes = models.BinaryField()
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UPLOADED,
        db_index=True,
    )
    notes = models.TextField(blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_customs_documents",
    )

    class Meta:
        verbose_name = "Documento aduanero"
        verbose_name_plural = "Documentos aduaneros"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["purchase_order", "document_type", "-version"], name="proc_doc_po_type_ver_idx"),
        ]

    def __str__(self):
        return f"{self.document_type} {self.document_identifier} v{self.version}"

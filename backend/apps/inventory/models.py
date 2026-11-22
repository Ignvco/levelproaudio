# apps/inventory/models.py
"""
LEVELPRO OS V4.0 — GATE 4: Warehouse Management System (WMS)
Modelos rectores:
- Warehouse (BF-05): Bodegas Central, Showroom y Tránsito
- WarehouseStock: Inventario dimensional (físico, reservado, no elegible, disponible derivado)
- InventoryMovement (BF-06): Kardex inmutable append-only
- StockReservation (BF-08): Reservas temporales y consolidadas
- SerialNumberTrack (BF-07 & BF-46): Trazabilidad unitaria de números de serie
- WarehouseTransfer / WarehouseTransferItem: Transferencias internas entre bodegas
"""

import uuid
from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from core.models import TimeStampedModel


class AppendOnlyQuerySet(models.QuerySet):
    """QuerySet inmutable para Kardex: prohíbe updates y deletes masivos."""

    def update(self, **kwargs):
        raise PermissionDenied("El Kardex (InventoryMovement) es inmutable (append-only). Operación UPDATE denegada.")

    def delete(self):
        raise PermissionDenied("El Kardex (InventoryMovement) es inmutable (append-only). Operación DELETE denegada.")

    def bulk_update(self, objs, fields, **kwargs):
        raise PermissionDenied("El Kardex (InventoryMovement) es inmutable (append-only). Operación BULK UPDATE denegada.")


class AppendOnlyManager(models.Manager.from_queryset(AppendOnlyQuerySet)):
    pass


class Warehouse(TimeStampedModel):
    """BF-05: Bodega o ubicación lógica de inventario."""

    class WarehouseType(models.TextChoices):
        CENTRAL = "central", "Bodega Central"
        SHOWROOM = "showroom", "Showroom / Sala de Ventas"
        TRANSIT = "transit", "Bodega en Tránsito"

    code = models.CharField(max_length=32, unique=True, db_index=True, verbose_name="Código único")
    name = models.CharField(max_length=120, verbose_name="Nombre")
    warehouse_type = models.CharField(
        max_length=20,
        choices=WarehouseType.choices,
        default=WarehouseType.CENTRAL,
        db_index=True,
    )
    address = models.TextField(blank=True, default="", verbose_name="Dirección")
    internal_locations = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de ubicaciones internas / racks / estantes (ej: ['A-01', 'B-02']).",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    is_sellable_online = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Si las existencias de esta bodega son elegibles para venta online pública.",
    )
    fulfillment_priority = models.PositiveIntegerField(
        default=100,
        db_index=True,
        help_text="Prioridad de preparación de pedidos (menor valor = mayor prioridad).",
    )
    can_receive = models.BooleanField(default=True)
    can_store = models.BooleanField(default=True)
    can_transfer = models.BooleanField(default=True)
    can_dispatch = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, db_index=True)

    class Meta:
        verbose_name = "Bodega"
        verbose_name_plural = "Bodegas"
        ordering = ["fulfillment_priority", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["is_default"],
                condition=Q(is_default=True, is_active=True),
                name="uniq_active_default_warehouse",
            ),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"

    def clean(self):
        super().clean()
        self.code = (self.code or "").strip().upper()
        if not self.code:
            raise ValidationError({"code": "El código de bodega es obligatorio."})
        if self.warehouse_type == self.WarehouseType.TRANSIT and self.is_sellable_online:
            raise ValidationError({
                "is_sellable_online": "Una bodega de tránsito no puede marcarse como elegible para venta online."
            })

    def save(self, *args, **kwargs):
        self.code = (self.code or "").strip().upper()
        if self.warehouse_type == self.WarehouseType.TRANSIT:
            self.is_sellable_online = False
        super().save(*args, **kwargs)


class WarehouseStock(TimeStampedModel):
    """
    Existencias dimensionales por unidad comercial (Product o ProductVariant) y Bodega.
    Fuente única de verdad del inventario.
    """

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="stock_rows",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.CASCADE,
        related_name="warehouse_stocks",
    )
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="warehouse_stocks",
    )
    sku_registry = models.ForeignKey(
        "products.SkuRegistry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="warehouse_stocks",
    )
    location_code = models.CharField(max_length=64, blank=True, default="")

    physical_quantity = models.PositiveIntegerField(default=0)
    reserved_quantity = models.PositiveIntegerField(default=0)
    non_sellable_quantity = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Stock por bodega"
        verbose_name_plural = "Stocks por bodega"
        ordering = ["warehouse__fulfillment_priority", "product__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["warehouse", "product"],
                condition=Q(variant__isnull=True),
                name="uniq_wh_stock_product",
            ),
            models.UniqueConstraint(
                fields=["warehouse", "product", "variant"],
                condition=Q(variant__isnull=False),
                name="uniq_wh_stock_variant",
            ),
            models.CheckConstraint(
                condition=Q(physical_quantity__gte=0) & Q(reserved_quantity__gte=0) & Q(non_sellable_quantity__gte=0),
                name="chk_wh_stock_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(non_sellable_quantity__lte=F("physical_quantity")),
                name="chk_wh_non_sellable_lte_physical",
            ),
            models.CheckConstraint(
                condition=Q(reserved_quantity__lte=F("physical_quantity") - F("non_sellable_quantity")),
                name="chk_wh_reserved_lte_eligible",
            ),
        ]
        indexes = [
            models.Index(fields=["product", "variant", "warehouse"], name="inv_ws_unit_wh_idx"),
        ]

    @property
    def eligible_physical_quantity(self) -> int:
        return max(0, int(self.physical_quantity) - int(self.non_sellable_quantity))

    @property
    def available_quantity(self) -> int:
        return max(0, self.eligible_physical_quantity - int(self.reserved_quantity))

    @property
    def internal_sku(self) -> str:
        if self.variant_id:
            return self.variant.sku
        return self.product.sku or ""

    def __str__(self):
        unit = f"{self.product.name} ({self.variant.name})" if self.variant_id else self.product.name
        return f"{self.warehouse.code} | {unit}: fis={self.physical_quantity} res={self.reserved_quantity} disp={self.available_quantity}"

    def clean(self):
        from apps.products.models import ProductVariant, SkuRegistry

        super().clean()
        if self.variant_id and self.variant.product_id != self.product_id:
            raise ValidationError({"variant": "La variante no pertenece al producto maestro."})
        if self.product_id and not self.variant_id:
            if ProductVariant.objects.filter(product_id=self.product_id).exists():
                raise ValidationError({
                    "variant": "Un producto con variantes debe administrar su stock en sus variantes."
                })
        if self.non_sellable_quantity > self.physical_quantity:
            raise ValidationError({"non_sellable_quantity": "El stock no elegible no puede superar al físico."})
        if self.reserved_quantity > self.eligible_physical_quantity:
            raise ValidationError({"reserved_quantity": "El stock reservado no puede superar al físico elegible."})

        if self.sku_registry_id is None:
            if self.variant_id:
                self.sku_registry = SkuRegistry.objects.filter(variant_id=self.variant_id).first()
            elif self.product_id:
                self.sku_registry = SkuRegistry.objects.filter(product_id=self.product_id).first()

    def save(self, *args, **kwargs):
        from apps.products.models import SkuRegistry
        if self.sku_registry_id is None:
            if self.variant_id:
                self.sku_registry = SkuRegistry.objects.filter(variant_id=self.variant_id).first()
            elif self.product_id:
                self.sku_registry = SkuRegistry.objects.filter(product_id=self.product_id).first()
        super().save(*args, **kwargs)


class InventoryMovement(TimeStampedModel):
    """BF-06: Kardex empresarial inmutable append-only."""

    class MovementType(models.TextChoices):
        OPENING = "opening", "Apertura de inventario"
        MANUAL_IN = "manual_in", "Entrada manual"
        RESERVE = "reserve", "Reserva"
        RELEASE = "release", "Liberación de reserva"
        DISPATCH = "dispatch", "Despacho"
        RETURN_IN = "return_in", "Devolución física"
        ADJUST_POS = "adjust_pos", "Ajuste positivo"
        ADJUST_NEG = "adjust_neg", "Ajuste negativo"
        TRANSFER_OUT = "transfer_out", "Salida por transferencia"
        TRANSFER_IN = "transfer_in", "Entrada por transferencia"
        REGULARIZATION = "regularization", "Regularización de seriales"

    objects = AppendOnlyManager()

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="movements")
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        null=True,
        blank=True,
        related_name="inventory_movements",
    )
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        null=True,
        blank=True,
        related_name="inventory_movements",
    )
    sku_registry = models.ForeignKey("products.SkuRegistry", on_delete=models.SET_NULL, null=True, blank=True)
    sku_snapshot = models.CharField(max_length=80, db_index=True)

    movement_type = models.CharField(max_length=24, choices=MovementType.choices, db_index=True)
    quantity = models.PositiveIntegerField()
    affected_dimensions = models.JSONField(default=dict)

    physical_before = models.PositiveIntegerField()
    physical_after = models.PositiveIntegerField()
    reserved_before = models.PositiveIntegerField()
    reserved_after = models.PositiveIntegerField()
    available_before = models.PositiveIntegerField()
    available_after = models.PositiveIntegerField()

    reason = models.CharField(max_length=255)
    source_document_type = models.CharField(max_length=60, blank=True, default="", db_index=True)
    source_document_id = models.CharField(max_length=80, blank=True, default="", db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_movements",
    )
    correlation_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    idempotency_key = models.CharField(max_length=160, null=True, blank=True, unique=True)
    serial_numbers = models.JSONField(default=list, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Movimiento de Kardex"
        verbose_name_plural = "Kardex de movimientos"
        ordering = ["-recorded_at", "-created_at"]
        indexes = [
            models.Index(fields=["product", "variant", "-recorded_at"], name="inv_kardex_unit_rec_idx"),
            models.Index(fields=["warehouse", "-recorded_at"], name="inv_kardex_wh_rec_idx"),
            models.Index(fields=["movement_type", "-recorded_at"], name="inv_kardex_type_rec_idx"),
        ]

    def __str__(self):
        return f"[{self.movement_type}] {self.sku_snapshot} x{self.quantity} ({self.warehouse.code})"

    def save(self, *args, **kwargs):
        if not self._state.adding and self.pk:
            raise PermissionDenied("El Kardex (InventoryMovement) es inmutable: no se permite su modificación.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionDenied("El Kardex (InventoryMovement) es inmutable: no se permite su eliminación.")


class StockReservation(TimeStampedModel):
    """BF-08: Reservas explícitas de inventario con TTL y consolidación por pago."""

    class Status(models.TextChoices):
        TEMPORARY = "temporary", "Reserva temporal (Checkout)"
        CONSOLIDATED = "consolidated", "Consolidada por pago / aprobación"
        RELEASED = "released", "Liberada por cancelación"
        CONSUMED = "consumed", "Consumida por despacho"
        EXPIRED = "expired", "Expirada por TTL"

    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="stock_reservations",
    )
    session_key = models.CharField(max_length=120, blank=True, default="", db_index=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="reservations")
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_reservations",
    )
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_reservations",
    )
    quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TEMPORARY, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    idempotency_key = models.CharField(max_length=160, null=True, blank=True, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_stock_reservations",
    )

    class Meta:
        verbose_name = "Reserva de stock"
        verbose_name_plural = "Reservas de stock"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "expires_at"], name="inv_res_stat_exp_idx"),
            models.Index(fields=["order", "status"], name="inv_res_ord_stat_idx"),
        ]

    def __str__(self):
        return f"Reserva {self.status} | {self.product_id} x{self.quantity} ({self.warehouse.code})"


class SerialNumberTrack(TimeStampedModel):
    """
    BF-07 & BF-46: Trazabilidad unitaria de números de serie.
    Ámbito de unicidad: por SKU comercial (product + variant), permitiendo que dos
    fabricantes distintos coincidan legítimamente en un formato de serial sin colisión.
    """

    class Status(models.TextChoices):
        IN_STOCK = "in_stock", "En bodega (Disponible)"
        RESERVED = "reserved", "Reservado / Asignado"
        IN_TRANSIT = "in_transit", "En tránsito entre bodegas"
        DISPATCHED = "dispatched", "Despachado a cliente"
        RETURNED = "returned", "Devuelto / En inspección"
        DAMAGED = "damaged", "Dañado / No elegible"
        DECOMMISSIONED = "decommissioned", "Baja definitiva"

    serial_number = models.CharField(max_length=120, db_index=True)
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT, related_name="serials")
    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="serials",
    )
    sku_registry = models.ForeignKey("products.SkuRegistry", on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="serials",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_STOCK, db_index=True)
    reservation = models.ForeignKey(
        StockReservation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_serials",
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispatched_serials",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchased_serials",
    )
    received_at = models.DateTimeField(default=timezone.now)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Número de serie"
        verbose_name_plural = "Números de serie"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["product", "serial_number"],
                condition=Q(variant__isnull=True),
                name="uniq_serial_per_product",
            ),
            models.UniqueConstraint(
                fields=["product", "variant", "serial_number"],
                condition=Q(variant__isnull=False),
                name="uniq_serial_per_variant",
            ),
        ]
        indexes = [
            models.Index(fields=["serial_number", "status"], name="inv_ser_num_stat_idx"),
            models.Index(fields=["warehouse", "status"], name="inv_ser_wh_stat_idx"),
        ]

    def __str__(self):
        return f"{self.serial_number} ({self.get_status_display()})"

    def clean(self):
        from apps.products.models import SkuRegistry
        super().clean()
        self.serial_number = (self.serial_number or "").strip()
        if not self.serial_number:
            raise ValidationError({"serial_number": "El número de serie no puede estar vacío."})
        if self.variant_id and self.variant.product_id != self.product_id:
            raise ValidationError({"variant": "La variante no pertenece al producto."})
        if self.sku_registry_id is None:
            if self.variant_id:
                self.sku_registry = SkuRegistry.objects.filter(variant_id=self.variant_id).first()
            elif self.product_id:
                self.sku_registry = SkuRegistry.objects.filter(product_id=self.product_id).first()


class WarehouseTransfer(TimeStampedModel):
    """Transferencia interna entre bodegas con correlación de Kardex y seriales."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        IN_TRANSIT = "in_transit", "En tránsito"
        RECEIVED = "received", "Recibida"
        CANCELLED = "cancelled", "Cancelada"

    code = models.CharField(max_length=32, unique=True, db_index=True)
    source_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="outgoing_transfers",
    )
    destination_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="incoming_transfers",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    correlation_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_transfers",
    )
    dispatched_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispatched_transfers",
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_transfers",
    )
    dispatched_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Transferencia entre bodegas"
        verbose_name_plural = "Transferencias entre bodegas"
        ordering = ["-created_at"]

    def clean(self):
        super().clean()
        if self.source_warehouse_id and self.source_warehouse_id == self.destination_warehouse_id:
            raise ValidationError("La bodega de origen y destino deben ser distintas.")


class WarehouseTransferItem(TimeStampedModel):
    transfer = models.ForeignKey(WarehouseTransfer, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT)
    variant = models.ForeignKey("products.ProductVariant", on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.PositiveIntegerField()
    serial_numbers = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = "Ítem de transferencia"
        verbose_name_plural = "Ítems de transferencia"

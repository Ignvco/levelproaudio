# apps/orders/logistics_models.py
"""
LEVELPRO OS V4.0 — GATE 10: LOGISTICS & AFTER-SALES MODELS
- BF-25: Carrier, CarrierService, ShippingQuoteSnapshot, Shipment, ShipmentPackage,
         ShipmentLabel, ShippingManifest, ShippingManifestItem, TrackingEvent, DeliveryIncident,
         LogisticsNotificationOutbox
- BF-22: WarrantyPolicySnapshot, WarrantyClaim
- BF-43: RepairWorkOrder, RepairDiagnosis, RepairPartUsage, RepairTestResult, RepairDelivery
"""

from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from core.models import TimeStampedModel


# ═══════════════════════════════════════════════════════════════════════════
# 1. BF-25: COURIERS, ENVÍOS, BULTOS, ETIQUETAS, MANIFIESTOS Y TRACKING
# ═══════════════════════════════════════════════════════════════════════════

class Carrier(TimeStampedModel):
    class IntegrationStatus(models.TextChoices):
        SIMULATED_QA = "simulated_qa", "Simulado QA"
        INTEGRATION_PENDING = "integration_pending", "Integración pendiente"
        SANDBOX = "sandbox", "Sandbox autorizado"
        LIVE = "live", "Producción autorizada"

    code = models.CharField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    country = models.CharField(max_length=10, default="CL")
    integration_status = models.CharField(
        max_length=30, choices=IntegrationStatus.choices, default=IntegrationStatus.INTEGRATION_PENDING
    )
    docs_url = models.URLField(blank=True, default="")
    volumetric_divisor = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("4000.00"))
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["country", "code"]

    def __str__(self):
        return f"{self.name} ({self.country})"


class CarrierService(TimeStampedModel):
    carrier = models.ForeignKey(Carrier, on_delete=models.CASCADE, related_name="services")
    service_code = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=140)
    delivery_window = models.CharField(max_length=80, blank=True, default="")
    base_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    per_kg_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=10, default="CLP")
    rate_table_id = models.CharField(max_length=60, blank=True, default="")
    tariff_version = models.CharField(max_length=40, blank=True, default="")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.carrier.code}:{self.service_code}"


class ShippingQuoteSnapshot(TimeStampedModel):
    order = models.ForeignKey("orders.Order", on_delete=models.SET_NULL, null=True, blank=True, related_name="shipping_quotes")
    carrier = models.ForeignKey(Carrier, on_delete=models.PROTECT)
    carrier_service = models.ForeignKey(CarrierService, on_delete=models.PROTECT)
    origin = models.CharField(max_length=120)
    destination = models.CharField(max_length=160)
    currency = models.CharField(max_length=10, default="CLP")
    physical_weight_kg = models.DecimalField(max_digits=10, decimal_places=2)
    volumetric_weight_kg = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    billable_weight_kg = models.DecimalField(max_digits=10, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    quote_source = models.CharField(max_length=40, default="qa_simulation")
    verification_status = models.CharField(max_length=30, default="simulated_qa_only")
    is_commercial_valid = models.BooleanField(default=False)
    valid_until = models.DateTimeField(null=True, blank=True)
    payload_snapshot = models.JSONField(default=dict, blank=True)


class Shipment(TimeStampedModel):
    class Status(models.TextChoices):
        RESERVED = "reserved", "Reservado"
        PREPARING = "preparing", "En preparación"
        PACKED = "packed", "Empaquetado"
        READY_FOR_PICKUP = "ready_for_pickup", "Listo para retiro"
        HANDED_OVER = "handed_over", "Entregado al transportista"
        IN_TRANSIT = "in_transit", "En tránsito"
        DELIVERED = "delivered", "Entregado"
        INCIDENT = "incident", "Con incidencia"
        CANCELLED = "cancelled", "Cancelado"

    shipment_number = models.CharField(max_length=40, unique=True, db_index=True)
    order = models.ForeignKey("orders.Order", on_delete=models.PROTECT, related_name="shipments")
    warehouse = models.ForeignKey("inventory.Warehouse", on_delete=models.PROTECT, related_name="shipments")
    carrier = models.ForeignKey(Carrier, on_delete=models.PROTECT, null=True, blank=True, related_name="shipments")
    carrier_service = models.ForeignKey(CarrierService, on_delete=models.PROTECT, null=True, blank=True)
    quote_snapshot = models.ForeignKey(ShippingQuoteSnapshot, on_delete=models.SET_NULL, null=True, blank=True)
    destination_address = models.CharField(max_length=255)
    destination_city = models.CharField(max_length=120, blank=True, default="")
    destination_country = models.CharField(max_length=10, default="CL")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.RESERVED, db_index=True)
    tracking_number = models.CharField(max_length=120, blank=True, default="", db_index=True)
    external_reference = models.CharField(max_length=120, blank=True, default="")
    is_partial = models.BooleanField(default=False)
    idempotency_key = models.CharField(max_length=120, unique=True, null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_shipments")
    dispatched_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="dispatched_shipments")
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.shipment_number} ({self.status})"


class ShipmentPackage(TimeStampedModel):
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="packages")
    package_number = models.PositiveIntegerField(default=1)
    total_packages = models.PositiveIntegerField(default=1)
    gross_weight_kg = models.DecimalField(max_digits=10, decimal_places=2)
    length_cm = models.DecimalField(max_digits=10, decimal_places=2)
    width_cm = models.DecimalField(max_digits=10, decimal_places=2)
    height_cm = models.DecimalField(max_digits=10, decimal_places=2)
    volumetric_weight_kg = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    billable_weight_kg = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    is_fragile = models.BooleanField(default=False)
    declared_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=10, default="CLP")
    commercial_content = models.CharField(max_length=255, blank=True, default="")
    items_snapshot = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["shipment", "package_number"]


class ShipmentLabel(TimeStampedModel):
    class LabelType(models.TextChoices):
        INTERNAL_LOGISTIC = "internal_logistic", "Etiqueta logística interna"
        COURIER_LABEL = "courier_label", "Etiqueta emitida por courier"
        PICKUP_RECEIPT = "pickup_receipt", "Comprobante de retiro"

    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="labels")
    package = models.ForeignKey(ShipmentPackage, on_delete=models.SET_NULL, null=True, blank=True)
    label_type = models.CharField(max_length=30, choices=LabelType.choices, default=LabelType.INTERNAL_LOGISTIC)
    barcode_value = models.CharField(max_length=120)
    tracking_number = models.CharField(max_length=120, blank=True, default="")
    pdf_sha256 = models.CharField(max_length=64, blank=True, default="")
    is_official_dte = models.BooleanField(default=False)
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    idempotency_key = models.CharField(max_length=120, unique=True, null=True, blank=True)


class ShippingManifest(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        READY = "ready", "Listo"
        CLOSED = "closed", "Cerrado (Inmutable)"
        HANDED_OVER = "handed_over", "Entregado al transportista"
        CANCELLED = "cancelled", "Cancelado"

    manifest_number = models.CharField(max_length=40, unique=True, db_index=True)
    operational_date = models.DateField(default=timezone.now)
    warehouse = models.ForeignKey("inventory.Warehouse", on_delete=models.PROTECT)
    carrier = models.ForeignKey(Carrier, on_delete=models.PROTECT)
    responsible = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    total_shipments = models.PositiveIntegerField(default=0)
    total_packages = models.PositiveIntegerField(default=0)
    closed_at = models.DateTimeField(null=True, blank=True)
    handed_over_at = models.DateTimeField(null=True, blank=True)
    handover_evidence = models.CharField(max_length=255, blank=True, default="")
    pdf_sha256 = models.CharField(max_length=64, blank=True, default="")
    closed_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-operational_date", "-created_at"]

    def __str__(self):
        return f"{self.manifest_number} ({self.status})"


class ShippingManifestItem(TimeStampedModel):
    manifest = models.ForeignKey(ShippingManifest, on_delete=models.CASCADE, related_name="items")
    shipment = models.OneToOneField(Shipment, on_delete=models.PROTECT, related_name="manifest_item")


class TrackingEvent(TimeStampedModel):
    class NormalizedStatus(models.TextChoices):
        LABEL_CREATED = "label_created", "Etiqueta creada"
        AWAITING_PICKUP = "awaiting_pickup", "Esperando retiro"
        PICKED_UP = "picked_up", "Retirado"
        IN_TRANSIT = "in_transit", "En tránsito"
        OUT_FOR_DELIVERY = "out_for_delivery", "En reparto"
        DELIVERED = "delivered", "Entregado"
        DELIVERY_ATTEMPT_FAILED = "delivery_attempt_failed", "Intento fallido"
        RETURNED_TO_SENDER = "returned_to_sender", "Devuelto al remitente"
        EXCEPTION = "exception", "Incidencia / Excepción"

    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="tracking_events")
    external_event_id = models.CharField(max_length=120, blank=True, default="")
    original_code = models.CharField(max_length=80, blank=True, default="")
    normalized_status = models.CharField(max_length=40, choices=NormalizedStatus.choices)
    source = models.CharField(max_length=30, default="simulated_qa")
    verification_status = models.CharField(max_length=30, default="simulated")
    location = models.CharField(max_length=160, blank=True, default="")
    occurred_at = models.DateTimeField(default=timezone.now)
    received_at = models.DateTimeField(auto_now_add=True)
    raw_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["occurred_at", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["shipment", "external_event_id"],
                condition=~Q(external_event_id=""),
                name="uniq_tracking_event_per_shipment_ext_id",
            )
        ]


class DeliveryIncident(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Abierta"
        INVESTIGATING = "investigating", "En investigación"
        RESOLVED = "resolved", "Resuelta"

    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="incidents")
    incident_type = models.CharField(max_length=60)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    resolution_notes = models.TextField(blank=True, default="")
    resolved_at = models.DateTimeField(null=True, blank=True)


class LogisticsNotificationOutbox(TimeStampedModel):
    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="logistics_notifications")
    event_type = models.CharField(max_length=60)
    channel = models.CharField(max_length=20, default="email")
    recipient_masked = models.CharField(max_length=160, blank=True, default="")
    status = models.CharField(max_length=20, default="queued")
    idempotency_key = models.CharField(max_length=160, unique=True)
    payload = models.JSONField(default=dict, blank=True)


# ═══════════════════════════════════════════════════════════════════════════
# 2. BF-22: GARANTÍAS POR NÚMERO DE SERIE
# ═══════════════════════════════════════════════════════════════════════════

class WarrantyPolicySnapshot(TimeStampedModel):
    product = models.ForeignKey("products.Product", on_delete=models.CASCADE, related_name="warranty_policies")
    variant = models.ForeignKey("products.ProductVariant", on_delete=models.CASCADE, null=True, blank=True)
    manufacturer_days = models.PositiveIntegerField(null=True, blank=True)
    legal_days = models.PositiveIntegerField(null=True, blank=True)
    commercial_days = models.PositiveIntegerField(null=True, blank=True)
    policy_notes = models.TextField(blank=True, default="")
    source_reference = models.CharField(max_length=160, blank=True, default="")


class WarrantyClaim(TimeStampedModel):
    class Status(models.TextChoices):
        RECEIVED = "received", "Reclamo recibido"
        PRELIMINARY_EVALUATION = "preliminary_evaluation", "Evaluación preliminar"
        PENDING_VERIFICATION = "pending_verification", "Pendiente de verificación"
        COVERAGE_CONFIRMED = "coverage_confirmed", "Cobertura confirmada"
        IN_TECHNICAL_REVIEW = "in_technical_review", "En revisión técnica"
        APPROVED = "approved", "Resolución aprobada"
        REJECTED = "rejected", "Resolución rechazada"
        REPAIR = "repair", "Reparación"
        REPLACEMENT = "replacement", "Reemplazo"
        CLOSED = "closed", "Cerrado"

    claim_number = models.CharField(max_length=40, unique=True, db_index=True)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="warranty_claims")
    order = models.ForeignKey("orders.Order", on_delete=models.PROTECT, related_name="warranty_claims")
    order_item = models.ForeignKey("orders.OrderItem", on_delete=models.PROTECT, related_name="warranty_claims")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT)
    variant = models.ForeignKey("products.ProductVariant", on_delete=models.PROTECT, null=True, blank=True)
    serial_track = models.ForeignKey("inventory.SerialNumberTrack", on_delete=models.PROTECT, null=True, blank=True, related_name="warranty_claims")
    rma = models.ForeignKey("orders.ReturnMerchandiseAuthorization", on_delete=models.SET_NULL, null=True, blank=True, related_name="warranty_claims")
    warranty_type = models.CharField(max_length=40, default="pending_verification")
    coverage_status = models.CharField(max_length=30, default="pending_verification")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.RECEIVED, db_index=True)
    reason = models.TextField()
    evidence_notes = models.TextField(blank=True, default="")
    resolution_notes = models.TextField(blank=True, default="")
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_warranty_claims")
    idempotency_key = models.CharField(max_length=120, unique=True, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.claim_number} ({self.status})"


# ═══════════════════════════════════════════════════════════════════════════
# 3. BF-43: SERVICIO TÉCNICO DE TALLER
# ═══════════════════════════════════════════════════════════════════════════

class RepairWorkOrder(TimeStampedModel):
    class ServiceMode(models.TextChoices):
        IN_WARRANTY = "in_warranty", "En garantía"
        OUT_OF_WARRANTY = "out_of_warranty", "Fuera de garantía"
        COMMERCIAL_SERVICE = "commercial_service", "Servicio técnico comercial"

    class Status(models.TextChoices):
        RECEIVED = "received", "Recibido"
        AWAITING_DIAGNOSIS = "awaiting_diagnosis", "Esperando diagnóstico"
        DIAGNOSIS_IN_PROGRESS = "diagnosis_in_progress", "Diagnóstico en curso"
        AWAITING_PARTS = "awaiting_parts", "Esperando repuestos"
        AWAITING_APPROVAL = "awaiting_approval", "Esperando aprobación cliente"
        APPROVED = "approved", "Aprobado"
        REPAIR_IN_PROGRESS = "repair_in_progress", "Reparación en curso"
        TESTING = "testing", "En pruebas técnicas"
        READY_FOR_DELIVERY = "ready_for_delivery", "Listo para entrega"
        DELIVERED = "delivered", "Entregado"
        CLOSED = "closed", "Cerrado"
        CANCELLED = "cancelled", "Cancelado"

    work_order_number = models.CharField(max_length=40, unique=True, db_index=True)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="repair_work_orders")
    warranty_claim = models.ForeignKey(WarrantyClaim, on_delete=models.SET_NULL, null=True, blank=True, related_name="repair_work_orders")
    rma = models.ForeignKey("orders.ReturnMerchandiseAuthorization", on_delete=models.SET_NULL, null=True, blank=True, related_name="repair_work_orders")
    product = models.ForeignKey("products.Product", on_delete=models.SET_NULL, null=True, blank=True)
    variant = models.ForeignKey("products.ProductVariant", on_delete=models.SET_NULL, null=True, blank=True)
    equipment_brand = models.CharField(max_length=120, blank=True, default="")
    equipment_model = models.CharField(max_length=160)
    serial_number = models.CharField(max_length=120, blank=True, default="", db_index=True)
    service_mode = models.CharField(max_length=30, choices=ServiceMode.choices, default=ServiceMode.OUT_OF_WARRANTY)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.RECEIVED, db_index=True)
    received_accessories = models.TextField(blank=True, default="")
    initial_physical_condition = models.TextField(blank=True, default="")
    reported_symptoms = models.TextField()
    assigned_technician = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_repairs")
    budget_diagnostic_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    budget_labor_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    budget_parts_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    budget_tax_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    budget_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    budget_currency = models.CharField(max_length=10, default="CLP")
    customer_approved_at = models.DateTimeField(null=True, blank=True)
    reincidence_of = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="reincidences")
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.work_order_number} ({self.status})"


class RepairDiagnosis(TimeStampedModel):
    work_order = models.ForeignKey(RepairWorkOrder, on_delete=models.CASCADE, related_name="diagnoses")
    technician = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    technical_findings = models.TextField()
    proposed_work = models.TextField()
    internal_notes = models.TextField(blank=True, default="")
    customer_notes = models.TextField(blank=True, default="")


class RepairPartUsage(TimeStampedModel):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Solicitado"
        RESERVED = "reserved", "Reservado"
        CONSUMED = "consumed", "Utilizado (Descontado WMS)"
        RETURNED = "returned", "Devuelto"
        DEFECTIVE = "defective", "Defectuoso"

    work_order = models.ForeignKey(RepairWorkOrder, on_delete=models.CASCADE, related_name="parts_used")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT)
    variant = models.ForeignKey("products.ProductVariant", on_delete=models.PROTECT, null=True, blank=True)
    warehouse = models.ForeignKey("inventory.Warehouse", on_delete=models.PROTECT)
    serial_track = models.ForeignKey("inventory.SerialNumberTrack", on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    kardex_movement = models.ForeignKey("inventory.InventoryMovement", on_delete=models.SET_NULL, null=True, blank=True)
    idempotency_key = models.CharField(max_length=120, unique=True, null=True, blank=True)


class RepairTestResult(TimeStampedModel):
    work_order = models.ForeignKey(RepairWorkOrder, on_delete=models.CASCADE, related_name="test_results")
    test_category = models.CharField(max_length=60)
    procedure = models.TextField()
    result = models.CharField(max_length=20, default="pass")
    instrument_used = models.CharField(max_length=120, blank=True, default="")
    measurements = models.TextField(blank=True, default="")
    technician = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)


class RepairDelivery(TimeStampedModel):
    work_order = models.OneToOneField(RepairWorkOrder, on_delete=models.CASCADE, related_name="delivery")
    delivered_to_name = models.CharField(max_length=160)
    delivered_to_id = models.CharField(max_length=60, blank=True, default="")
    delivery_notes = models.TextField(blank=True, default="")
    evidence_reference = models.CharField(max_length=160, blank=True, default="")
    delivered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    delivered_at = models.DateTimeField(default=timezone.now)

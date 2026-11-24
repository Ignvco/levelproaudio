# apps/orders/marketing_models.py
"""
LEVELPRO OS V4.0 — GATE 11: MARKETING & CUSTOMER GROWTH MODELS
- BF-26: Coupon, CouponRedemption
- BF-27: PromotionCampaign (separada de rewards.Campaign), PromotionActivationEvent, PricingAdjustmentSnapshot
- BF-28: MarketingConsent, MarketingSuppression, AbandonedCartTrigger, CartRecoveryAttempt,
         MarketingMessageOutbox, MarketingDeliveryEvent
"""

from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from core.models import TimeStampedModel


class Coupon(TimeStampedModel):
    class DiscountType(models.TextChoices):
        PERCENTAGE = "percentage", "Porcentaje (%)"
        FIXED_AMOUNT = "fixed_amount", "Importe fijo"

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        ACTIVE = "active", "Activo"
        PAUSED = "paused", "Pausado"
        EXPIRED = "expired", "Expirado"
        CANCELLED = "cancelled", "Cancelado"

    class AccumulationRule(models.TextChoices):
        BLOCKED = "blocked", "Bloqueado (no acumulable)"
        ALLOW_WITH_PROMOTION = "allow_with_promotion", "Acumulable con promoción autorizada"
        ALLOW_WITH_LOYALTY = "allow_with_loyalty", "Acumulable con Loyalty autorizado"

    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=140)
    description = models.TextField(blank=True, default="")
    currency = models.CharField(max_length=10, default="CLP", db_index=True)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices, default=DiscountType.PERCENTAGE)
    discount_value = models.DecimalField(max_digits=12, decimal_places=2)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    business_timezone = models.CharField(max_length=60, default="America/Santiago")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    max_total_uses = models.PositiveIntegerField(null=True, blank=True)
    max_uses_per_customer = models.PositiveIntegerField(default=1)
    min_eligible_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    max_discount_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    included_products = models.ManyToManyField("products.Product", blank=True, related_name="included_coupons")
    excluded_products = models.ManyToManyField("products.Product", blank=True, related_name="excluded_coupons")
    included_categories = models.ManyToManyField("products.Category", blank=True, related_name="included_coupons")
    included_brands = models.ManyToManyField("products.Brand", blank=True, related_name="included_coupons")
    customer_segments = models.JSONField(default=list, blank=True)
    accumulation_rule = models.CharField(max_length=30, choices=AccumulationRule.choices, default=AccumulationRule.BLOCKED)
    min_margin_percent = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code} ({self.currency} {self.status})"


class CouponRedemption(TimeStampedModel):
    class Status(models.TextChoices):
        PROVISIONAL = "provisional", "Validación / Provisional"
        RESERVED = "reserved", "Reservado"
        CONFIRMED = "confirmed", "Consumo confirmado"
        RELEASED = "released", "Liberado"
        CANCELLED = "cancelled", "Anulado"
        REVERSED = "reversed", "Reversado"

    coupon = models.ForeignKey(Coupon, on_delete=models.PROTECT, related_name="redemptions")
    order = models.ForeignKey("orders.Order", on_delete=models.PROTECT, null=True, blank=True, related_name="coupon_redemptions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="coupon_redemptions")
    currency = models.CharField(max_length=10, default="CLP")
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROVISIONAL, db_index=True)
    idempotency_key = models.CharField(max_length=140, unique=True, null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["coupon", "order"],
                condition=Q(order__isnull=False, status__in=["reserved", "confirmed"]),
                name="uniq_active_coupon_per_order",
            )
        ]


class PromotionCampaign(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        SCHEDULED = "scheduled", "Programada"
        ACTIVE = "active", "Activa"
        PAUSED = "paused", "Pausada"
        FINISHED = "finished", "Finalizada"
        CANCELLED = "cancelled", "Cancelada"

    name = models.CharField(max_length=160)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    business_timezone = models.CharField(max_length=60, default="America/Santiago")
    currency = models.CharField(max_length=10, default="CLP", db_index=True)
    market = models.CharField(max_length=10, default="CL")
    discount_type = models.CharField(max_length=20, choices=Coupon.DiscountType.choices, default=Coupon.DiscountType.PERCENTAGE)
    discount_value = models.DecimalField(max_digits=12, decimal_places=2)
    priority = models.PositiveIntegerField(default=10)
    accumulation_rule = models.CharField(max_length=30, choices=Coupon.AccumulationRule.choices, default=Coupon.AccumulationRule.BLOCKED)
    min_margin_percent = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    included_products = models.ManyToManyField("products.Product", blank=True, related_name="promotion_campaigns")
    included_categories = models.ManyToManyField("products.Category", blank=True, related_name="promotion_campaigns")
    included_brands = models.ManyToManyField("products.Brand", blank=True, related_name="promotion_campaigns")
    version = models.PositiveIntegerField(default=1)
    is_archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_promotions")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_promotions")

    class Meta:
        ordering = ["priority", "-created_at"]

    def __str__(self):
        return f"{self.name} [{self.currency} / {self.status}]"


class PromotionActivationEvent(TimeStampedModel):
    campaign = models.ForeignKey(PromotionCampaign, on_delete=models.CASCADE, related_name="activation_events")
    event_type = models.CharField(max_length=30)
    scheduled_window_key = models.CharField(max_length=160, unique=True)
    triggered_at = models.DateTimeField(default=timezone.now)
    notes = models.CharField(max_length=255, blank=True, default="")


class PricingAdjustmentSnapshot(TimeStampedModel):
    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, null=True, blank=True, related_name="pricing_snapshots")
    currency = models.CharField(max_length=10, default="CLP")
    reference_subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    b2b_discount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    promotion_discount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    coupon_discount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    loyalty_discount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    effective_discount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    final_total = models.DecimalField(max_digits=14, decimal_places=2)
    calculated_margin_percent = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    cost_status = models.CharField(max_length=20, default="pending")
    price_source = models.CharField(max_length=60, default="public_catalog")
    applied_rule_ids = models.JSONField(default=list, blank=True)
    rules_version = models.CharField(max_length=40, default="v11.1")
    breakdown_json = models.JSONField(default=dict, blank=True)


class MarketingConsent(TimeStampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="marketing_consent")
    email = models.EmailField(unique=True, db_index=True)
    promotional_opt_in = models.BooleanField(default=False)
    transactional_enabled = models.BooleanField(default=True)
    channel = models.CharField(max_length=20, default="email")
    consent_origin = models.CharField(max_length=30, default="customer_direct")
    consent_source = models.CharField(max_length=80, default="explicit_form")
    evidence_reference = models.CharField(max_length=255, blank=True, default="")
    policy_version = models.CharField(max_length=30, default="2026.11")
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="recorded_marketing_consents")
    consented_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)


class MarketingSuppression(TimeStampedModel):
    email = models.EmailField(unique=True, db_index=True)
    reason = models.CharField(max_length=60)
    suppressed_at = models.DateTimeField(default=timezone.now)


class AbandonedCartTrigger(TimeStampedModel):
    class Status(models.TextChoices):
        ELIGIBLE = "eligible", "Elegible"
        SCHEDULED = "scheduled", "Programado"
        SUPPRESSED = "suppressed", "Suprimido"
        ATTEMPTED = "attempted", "Intentado"
        SENT = "sent", "Enviado (pendiente entrega)"
        FAILED = "failed", "Fallido"
        RECOVERED = "recovered", "Recuperado"
        EXPIRED = "expired", "Expirado"

    cart = models.ForeignKey("orders.Cart", on_delete=models.CASCADE, related_name="abandonment_triggers")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    last_activity_at = models.DateTimeField()
    detected_at = models.DateTimeField(default=timezone.now)
    eligible_after_minutes = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ELIGIBLE, db_index=True)
    attempts_count = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=2)
    channel = models.CharField(max_length=20, default="email")
    suppression_reason = models.CharField(max_length=120, blank=True, default="")
    recovery_token = models.CharField(max_length=160, unique=True)
    token_expires_at = models.DateTimeField()
    recovered_order = models.ForeignKey("orders.Order", on_delete=models.SET_NULL, null=True, blank=True)


class CartRecoveryAttempt(TimeStampedModel):
    trigger = models.ForeignKey(AbandonedCartTrigger, on_delete=models.CASCADE, related_name="recovery_attempts")
    attempt_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, default="queued")
    idempotency_key = models.CharField(max_length=160, unique=True)
    provider_message_id = models.CharField(max_length=120, blank=True, default="")
    error_detail = models.TextField(blank=True, default="")


class MarketingMessageOutbox(TimeStampedModel):
    channel_class = models.CharField(max_length=40, default="commercial_cart_recovery")
    recipient_email = models.EmailField(db_index=True)
    subject = models.CharField(max_length=200)
    status = models.CharField(max_length=20, default="pending", db_index=True)
    idempotency_key = models.CharField(max_length=160, unique=True)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)


class MarketingDeliveryEvent(TimeStampedModel):
    outbox = models.ForeignKey(MarketingMessageOutbox, on_delete=models.CASCADE, related_name="delivery_events")
    event_type = models.CharField(max_length=30)
    provider_ref = models.CharField(max_length=120, blank=True, default="")
    occurred_at = models.DateTimeField(default=timezone.now)

# apps/orders/marketing_services.py
"""
LEVELPRO OS V4.0 — GATE 11: MARKETING & CUSTOMER GROWTH SERVICES
- BF-26: Cupones (validación, reserva, confirmación, liberación/reversa, límites, moneda, margen)
- BF-27: Promociones programadas (scheduler idempotente por ventana, prioridad, acumulación)
- BF-28: Carritos abandonados & recuperación (detección, consentimiento, supresión, tokens opacos, outbox QA)
- PricingAdjustmentSnapshot: desglose auditable sin float()
"""

from __future__ import annotations

import logging
import secrets
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.orders.marketing_models import (
    AbandonedCartTrigger,
    CartRecoveryAttempt,
    Coupon,
    CouponRedemption,
    MarketingConsent,
    MarketingDeliveryEvent,
    MarketingMessageOutbox,
    MarketingSuppression,
    PricingAdjustmentSnapshot,
    PromotionActivationEvent,
    PromotionCampaign,
)
from apps.orders.models import Cart, Order, OrderStatus
from apps.procurement.models import CostLayer, WeightedAverageCostState

logger = logging.getLogger(__name__)

TWO_DEC = Decimal("0.01")
ZERO = Decimal("0.00")
SUPPORTED_CURRENCIES = {"CLP", "USD", "ARS"}


def _q2(val: Decimal | int | float | str) -> Decimal:
    return Decimal(str(val)).quantize(TWO_DEC, rounding=ROUND_HALF_UP)


def _normalize_currency(currency: str | None) -> str:
    cur = (currency or "CLP").strip().upper()
    if cur not in SUPPORTED_CURRENCIES:
        raise ValidationError(f"Moneda no soportada para marketing: {cur}")
    return cur


def _unit_cost_for_item(product, variant, currency: str) -> Decimal | None:
    """Obtiene costo unitario en la moneda exacta desde Gate 6 (WAC o CostLayer) sin mezclar monedas."""
    wac_qs = WeightedAverageCostState.objects.filter(product=product, currency=currency)
    if variant is not None:
        wac = wac_qs.filter(variant=variant, average_unit_cost__gt=0).first()
        if wac:
            return Decimal(wac.average_unit_cost)
    wac = wac_qs.filter(variant__isnull=True, average_unit_cost__gt=0).first()
    if wac:
        return Decimal(wac.average_unit_cost)

    layer_qs = CostLayer.objects.filter(
        product=product,
        valuation_currency=currency,
        quantity_available__gt=0,
    ).order_by("effective_date", "created_at")
    if variant is not None:
        layer = layer_qs.filter(variant=variant).first() or layer_qs.first()
    else:
        layer = layer_qs.first()
    if layer and layer.landed_unit_cost is not None:
        return Decimal(layer.landed_unit_cost)

    if currency == "CLP" and getattr(product, "cost_clp", None):
        val = Decimal(str(product.cost_clp))
        if val > ZERO:
            return val
    if currency == "USD" and getattr(product, "cost_usd", None):
        val = Decimal(str(product.cost_usd))
        if val > ZERO:
            return val
    return None


def _compute_margin_info(
    items: list[dict[str, Any]],
    net_revenue: Decimal,
    currency: str,
) -> tuple[Decimal | None, str]:
    """Calcula margen bruto sobre ingreso neto si existen costos en la misma moneda."""
    if net_revenue <= ZERO:
        return Decimal("0.00"), "known"
    total_cost = ZERO
    missing_cost = False
    for it in items:
        product = it.get("product")
        variant = it.get("variant")
        qty = int(it.get("quantity", 1) or 1)
        if product is None:
            missing_cost = True
            continue
        unit_cost = _unit_cost_for_item(product, variant, currency)
        if unit_cost is None:
            missing_cost = True
        else:
            total_cost += unit_cost * qty
    if missing_cost:
        return None, "pending"
    margin_pct = _q2(((net_revenue - total_cost) / net_revenue) * Decimal("100"))
    return margin_pct, "known"


def _item_matches_scope(
    product,
    included_products_ids: set[int],
    excluded_products_ids: set[int],
    included_category_ids: set[int],
    included_brand_ids: set[int],
) -> bool:
    has_include_filter = bool(included_products_ids or included_category_ids or included_brand_ids)
    if product is None:
        return not has_include_filter and not excluded_products_ids
    if product.id in excluded_products_ids:
        return False
    if not has_include_filter:
        return True
    if product.id in included_products_ids:
        return True
    if getattr(product, "category_id", None) in included_category_ids:
        return True
    if getattr(product, "brand_id", None) in included_brand_ids:
        return True
    return False


def _calculate_discount_for_rule(
    discount_type: str,
    discount_value: Decimal,
    eligible_subtotal: Decimal,
    max_discount_amount: Decimal | None = None,
) -> Decimal:
    if eligible_subtotal <= ZERO or discount_value <= ZERO:
        return ZERO
    if discount_type == Coupon.DiscountType.PERCENTAGE:
        raw = _q2((eligible_subtotal * discount_value) / Decimal("100"))
    else:
        raw = _q2(discount_value)
    if max_discount_amount is not None:
        raw = min(raw, _q2(max_discount_amount))
    return min(raw, eligible_subtotal)


# ---------------------------------------------------------------------------
# BF-27: SCHEDULED PROMOTIONS & SCHEDULER
# ---------------------------------------------------------------------------

def create_promotion_campaign(data: dict[str, Any], user=None) -> PromotionCampaign:
    currency = _normalize_currency(data.get("currency", "CLP"))
    starts_at = data["starts_at"]
    ends_at = data["ends_at"]
    if ends_at <= starts_at:
        raise ValidationError("ends_at debe ser posterior a starts_at.")
    discount_value = _q2(data["discount_value"])
    if discount_value <= ZERO:
        raise ValidationError("discount_value debe ser mayor a cero.")
    if data.get("discount_type", Coupon.DiscountType.PERCENTAGE) == Coupon.DiscountType.PERCENTAGE and discount_value > Decimal("90.00"):
        raise ValidationError("El porcentaje promocional no puede superar 90%.")

    tz_name = data.get("business_timezone") or "America/Santiago"
    ZoneInfo(tz_name)  # valida timezone IANA

    campaign = PromotionCampaign.objects.create(
        name=data["name"].strip(),
        description=data.get("description", ""),
        status=data.get("status", PromotionCampaign.Status.SCHEDULED),
        starts_at=starts_at,
        ends_at=ends_at,
        business_timezone=tz_name,
        currency=currency,
        market=data.get("market", "CL"),
        discount_type=data.get("discount_type", Coupon.DiscountType.PERCENTAGE),
        discount_value=discount_value,
        priority=int(data.get("priority", 10)),
        accumulation_rule=data.get("accumulation_rule", Coupon.AccumulationRule.BLOCKED),
        min_margin_percent=data.get("min_margin_percent"),
        created_by=user if getattr(user, "is_authenticated", False) else None,
        approved_by=data.get("approved_by"),
    )
    if data.get("included_product_ids"):
        campaign.included_products.set(data["included_product_ids"])
    if data.get("included_category_ids"):
        campaign.included_categories.set(data["included_category_ids"])
    if data.get("included_brand_ids"):
        campaign.included_brands.set(data["included_brand_ids"])
    return campaign


@transaction.atomic
def run_scheduled_promotions_tick(now=None) -> dict[str, int]:
    """
    Evalúa promociones programadas y activas de manera idempotente.
    Usa PromotionActivationEvent.scheduled_window_key para no duplicar activaciones/cierres concurrentes.
    """
    now = now or timezone.now()
    activated = 0
    finished = 0

    candidates = PromotionCampaign.objects.select_for_update().filter(
        is_archived=False,
        status__in=[PromotionCampaign.Status.SCHEDULED, PromotionCampaign.Status.ACTIVE],
    )
    for camp in candidates:
        if camp.status == PromotionCampaign.Status.SCHEDULED and camp.starts_at <= now < camp.ends_at:
            window_key = f"promo:{camp.id}:v{camp.version}:start:{camp.starts_at.isoformat()}"
            try:
                with transaction.atomic():
                    PromotionActivationEvent.objects.create(
                        campaign=camp,
                        event_type="activated",
                        scheduled_window_key=window_key,
                        triggered_at=now,
                        notes=f"Activación automática ({camp.business_timezone})",
                    )
                camp.status = PromotionCampaign.Status.ACTIVE
                camp.save(update_fields=["status", "updated_at"])
                activated += 1
            except IntegrityError:
                pass
        elif camp.status in [PromotionCampaign.Status.ACTIVE, PromotionCampaign.Status.SCHEDULED] and now >= camp.ends_at:
            window_key = f"promo:{camp.id}:v{camp.version}:end:{camp.ends_at.isoformat()}"
            try:
                with transaction.atomic():
                    PromotionActivationEvent.objects.create(
                        campaign=camp,
                        event_type="finished",
                        scheduled_window_key=window_key,
                        triggered_at=now,
                        notes=f"Finalización automática ({camp.business_timezone})",
                    )
                camp.status = PromotionCampaign.Status.FINISHED
                camp.save(update_fields=["status", "updated_at"])
                finished += 1
            except IntegrityError:
                pass

    return {"activated": activated, "finished": finished}


def _find_best_active_promotion(
    items: list[dict[str, Any]],
    currency: str,
    now=None,
) -> tuple[PromotionCampaign | None, Decimal]:
    now = now or timezone.now()
    active_promos = PromotionCampaign.objects.filter(
        is_archived=False,
        status=PromotionCampaign.Status.ACTIVE,
        currency=currency,
        starts_at__lte=now,
        ends_at__gt=now,
    ).order_by("priority", "id")

    for promo in active_promos:
        inc_p = set(promo.included_products.values_list("id", flat=True))
        inc_c = set(promo.included_categories.values_list("id", flat=True))
        inc_b = set(promo.included_brands.values_list("id", flat=True))
        eligible_subtotal = ZERO
        for it in items:
            product = it.get("product")
            if _item_matches_scope(product, inc_p, set(), inc_c, inc_b):
                eligible_subtotal += _q2(it["line_subtotal"])
        if eligible_subtotal <= ZERO:
            continue
        discount = _calculate_discount_for_rule(promo.discount_type, promo.discount_value, eligible_subtotal)
        if discount > ZERO:
            return promo, discount
    return None, ZERO


# ---------------------------------------------------------------------------
# BF-26: COUPONS & COMMERCIAL PRICING PRECEDENCE
# ---------------------------------------------------------------------------

def validate_and_price_coupon(
    *,
    code: str,
    currency: str,
    items: list[dict[str, Any]],
    user=None,
    has_b2b_discount: bool = False,
    b2b_discount: Decimal = ZERO,
    has_already_discounted_items: bool = False,
    loyalty_discount: Decimal = ZERO,
    now=None,
) -> dict[str, Any]:
    """
    Valida cupón y retorna desglose completo sin mutar inventario ni redenciones.
    """
    now = now or timezone.now()
    cur = _normalize_currency(currency)
    normalized_code = (code or "").strip().upper()
    if not normalized_code:
        raise ValidationError("Debe ingresar un código de cupón.")

    coupon = Coupon.objects.filter(code__iexact=normalized_code, is_archived=False).first()
    if not coupon:
        raise ValidationError("Cupón inválido o inexistente.")

    if coupon.status != Coupon.Status.ACTIVE:
        raise ValidationError(f"El cupón {coupon.code} no está activo (estado: {coupon.status}).")
    if now < coupon.starts_at:
        raise ValidationError(f"El cupón {coupon.code} aún no inicia su vigencia.")
    if now >= coupon.ends_at:
        raise ValidationError(f"El cupón {coupon.code} ha expirado.")
    if coupon.currency != cur:
        raise ValidationError(f"Cupón válido solo para {coupon.currency}; no aplicable a carrito en {cur}.")

    if coupon.max_total_uses is not None:
        used_total = coupon.redemptions.filter(
            status__in=[CouponRedemption.Status.RESERVED, CouponRedemption.Status.CONFIRMED]
        ).count()
        if used_total >= coupon.max_total_uses:
            raise ValidationError(f"El cupón {coupon.code} alcanzó su límite global de usos.")

    if user and getattr(user, "is_authenticated", False) and coupon.max_uses_per_customer is not None:
        used_by_user = coupon.redemptions.filter(
            user=user,
            status__in=[CouponRedemption.Status.RESERVED, CouponRedemption.Status.CONFIRMED],
        ).count()
        if used_by_user >= coupon.max_uses_per_customer:
            raise ValidationError(f"Ya alcanzó el máximo de usos permitidos para el cupón {coupon.code}.")

    # Reglas de no acumulación por defecto
    if has_b2b_discount and b2b_discount > ZERO:
        raise ValidationError("Los precios B2B no son acumulables con cupones promocionales.")
    if has_already_discounted_items and coupon.accumulation_rule == Coupon.AccumulationRule.BLOCKED:
        raise ValidationError("El cupón no es acumulable con productos que ya tienen descuento.")
    if loyalty_discount > ZERO and coupon.accumulation_rule != Coupon.AccumulationRule.ALLOW_WITH_LOYALTY:
        raise ValidationError("El cupón no es acumulable con canje de puntos Loyalty.")

    # Promoción activa en el carrito
    promo, promo_discount = _find_best_active_promotion(items, cur, now=now)
    if promo and promo_discount > ZERO:
        allow_stack = (
            coupon.accumulation_rule == Coupon.AccumulationRule.ALLOW_WITH_PROMOTION
            and promo.accumulation_rule == Coupon.AccumulationRule.ALLOW_WITH_PROMOTION
        )
        if not allow_stack:
            raise ValidationError(
                f"El cupón {coupon.code} no es acumulable con la promoción activa '{promo.name}'."
            )

    inc_p = set(coupon.included_products.values_list("id", flat=True))
    exc_p = set(coupon.excluded_products.values_list("id", flat=True))
    inc_c = set(coupon.included_categories.values_list("id", flat=True))
    inc_b = set(coupon.included_brands.values_list("id", flat=True))

    reference_subtotal = ZERO
    eligible_subtotal = ZERO
    for it in items:
        line_sub = _q2(it["line_subtotal"])
        reference_subtotal += line_sub
        if _item_matches_scope(it.get("product"), inc_p, exc_p, inc_c, inc_b):
            eligible_subtotal += line_sub

    if eligible_subtotal <= ZERO:
        raise ValidationError(f"Ningún producto del carrito es elegible para el cupón {coupon.code}.")

    # Si hay promoción acumulable, el cupón se calcula sobre la base neta post-promoción para no exceder 100%
    net_eligible_base = max(ZERO, eligible_subtotal - promo_discount)
    if net_eligible_base < coupon.min_eligible_amount:
        raise ValidationError(
            f"El monto elegible mínimo para {coupon.code} es {coupon.min_eligible_amount} {cur}."
        )

    coupon_discount = _calculate_discount_for_rule(
        coupon.discount_type,
        coupon.discount_value,
        net_eligible_base,
        max_discount_amount=coupon.max_discount_amount,
    )
    total_discount = _q2(promo_discount + coupon_discount + loyalty_discount)
    final_total = max(ZERO, _q2(reference_subtotal - total_discount))

    margin_pct, cost_status = _compute_margin_info(items, final_total, cur)
    if coupon.min_margin_percent is not None and margin_pct is not None and margin_pct < coupon.min_margin_percent:
        raise ValidationError(
            f"Cupón bloqueado por margen mínimo ({margin_pct}% < {coupon.min_margin_percent}%)."
        )

    applied_rule_ids = []
    if promo and promo_discount > ZERO:
        applied_rule_ids.append(f"promo:{promo.id}")
    applied_rule_ids.append(f"coupon:{coupon.code}")

    return {
        "valid": True,
        "coupon": coupon,
        "promotion": promo,
        "currency": cur,
        "reference_subtotal": reference_subtotal,
        "b2b_discount": ZERO,
        "promotion_discount": promo_discount,
        "coupon_discount": coupon_discount,
        "loyalty_discount": _q2(loyalty_discount),
        "effective_discount": total_discount,
        "final_total": final_total,
        "calculated_margin_percent": margin_pct,
        "cost_status": cost_status,
        "price_source": "coupon_and_promotion" if promo else "coupon",
        "applied_rule_ids": applied_rule_ids,
    }


def evaluate_commercial_pricing(
    *,
    currency: str,
    items: list[dict[str, Any]],
    coupon_code: str | None = None,
    user=None,
    b2b_discount: Decimal = ZERO,
    has_already_discounted_items: bool = False,
    loyalty_discount: Decimal = ZERO,
    order: Order | None = None,
    persist_snapshot: bool = False,
    now=None,
) -> dict[str, Any]:
    now = now or timezone.now()
    cur = _normalize_currency(currency)
    reference_subtotal = sum((_q2(it["line_subtotal"]) for it in items), ZERO)

    if coupon_code:
        result = validate_and_price_coupon(
            code=coupon_code,
            currency=cur,
            items=items,
            user=user,
            has_b2b_discount=b2b_discount > ZERO,
            b2b_discount=b2b_discount,
            has_already_discounted_items=has_already_discounted_items,
            loyalty_discount=loyalty_discount,
            now=now,
        )
    else:
        promo, promo_discount = _find_best_active_promotion(items, cur, now=now)
        if b2b_discount > ZERO:
            promo = None
            promo_discount = ZERO
        total_discount = _q2(b2b_discount + promo_discount + loyalty_discount)
        final_total = max(ZERO, _q2(reference_subtotal - total_discount))
        margin_pct, cost_status = _compute_margin_info(items, final_total, cur)
        if promo and promo.min_margin_percent is not None and margin_pct is not None and margin_pct < promo.min_margin_percent:
            promo = None
            promo_discount = ZERO
            total_discount = _q2(b2b_discount + loyalty_discount)
            final_total = max(ZERO, _q2(reference_subtotal - total_discount))
            margin_pct, cost_status = _compute_margin_info(items, final_total, cur)

        applied_rule_ids = []
        if b2b_discount > ZERO:
            applied_rule_ids.append("b2b_contract")
        if promo and promo_discount > ZERO:
            applied_rule_ids.append(f"promo:{promo.id}")
        if loyalty_discount > ZERO:
            applied_rule_ids.append("loyalty_points")

        result = {
            "valid": True,
            "coupon": None,
            "promotion": promo,
            "currency": cur,
            "reference_subtotal": reference_subtotal,
            "b2b_discount": _q2(b2b_discount),
            "promotion_discount": promo_discount,
            "coupon_discount": ZERO,
            "loyalty_discount": _q2(loyalty_discount),
            "effective_discount": total_discount,
            "final_total": final_total,
            "calculated_margin_percent": margin_pct,
            "cost_status": cost_status,
            "price_source": "b2b_contract" if b2b_discount > ZERO else ("promotion" if promo else "public_catalog"),
            "applied_rule_ids": applied_rule_ids,
        }

    if persist_snapshot:
        snapshot = PricingAdjustmentSnapshot.objects.create(
            order=order,
            currency=cur,
            reference_subtotal=result["reference_subtotal"],
            b2b_discount=result["b2b_discount"],
            promotion_discount=result["promotion_discount"],
            coupon_discount=result["coupon_discount"],
            loyalty_discount=result["loyalty_discount"],
            effective_discount=result["effective_discount"],
            tax_amount=ZERO,
            final_total=result["final_total"],
            calculated_margin_percent=result["calculated_margin_percent"],
            cost_status=result["cost_status"],
            price_source=result["price_source"],
            applied_rule_ids=result["applied_rule_ids"],
            breakdown_json={
                "coupon_code": result["coupon"].code if result.get("coupon") else None,
                "promotion_id": result["promotion"].id if result.get("promotion") else None,
                "promotion_name": result["promotion"].name if result.get("promotion") else None,
            },
        )
        result["snapshot_id"] = snapshot.id
    return result


@transaction.atomic
def reserve_coupon_redemption(
    *,
    code: str,
    order: Order,
    user=None,
    items: list[dict[str, Any]] | None = None,
    idempotency_key: str | None = None,
) -> CouponRedemption:
    """
    Reserva un uso de cupón con lock transaccional sobre Coupon para evitar race conditions.
    """
    if idempotency_key:
        existing = CouponRedemption.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing

    normalized_code = (code or "").strip().upper()
    coupon = Coupon.objects.select_for_update().filter(code__iexact=normalized_code, is_archived=False).first()
    if not coupon:
        raise ValidationError("Cupón inválido o inexistente.")

    if items is None:
        items = [
            {
                "product": oi.product,
                "variant": getattr(oi, "variant", None),
                "quantity": oi.quantity,
                "line_subtotal": _q2(Decimal(oi.price) * oi.quantity),
            }
            for oi in order.items.select_related("product").all()
        ]

    pricing = validate_and_price_coupon(
        code=coupon.code,
        currency=getattr(order, "currency", "CLP") or "CLP",
        items=items,
        user=user or order.user,
    )

    redemption, created = CouponRedemption.objects.get_or_create(
        coupon=coupon,
        order=order,
        status=CouponRedemption.Status.RESERVED,
        defaults={
            "user": user or order.user,
            "currency": pricing["currency"],
            "discount_amount": pricing["coupon_discount"],
            "idempotency_key": idempotency_key or f"reserve:{order.id}:{coupon.code}",
        },
    )
    if created:
        PricingAdjustmentSnapshot.objects.create(
            order=order,
            currency=pricing["currency"],
            reference_subtotal=pricing["reference_subtotal"],
            b2b_discount=pricing["b2b_discount"],
            promotion_discount=pricing["promotion_discount"],
            coupon_discount=pricing["coupon_discount"],
            loyalty_discount=pricing["loyalty_discount"],
            effective_discount=pricing["effective_discount"],
            tax_amount=ZERO,
            final_total=pricing["final_total"],
            calculated_margin_percent=pricing["calculated_margin_percent"],
            cost_status=pricing["cost_status"],
            price_source=pricing["price_source"],
            applied_rule_ids=pricing["applied_rule_ids"],
            breakdown_json={
                "coupon_code": coupon.code,
                "promotion_id": pricing["promotion"].id if pricing.get("promotion") else None,
            },
        )
    return redemption


@transaction.atomic
def confirm_coupon_redemption(order: Order) -> CouponRedemption | None:
    redemption = (
        CouponRedemption.objects.select_for_update()
        .filter(order=order, status__in=[CouponRedemption.Status.RESERVED, CouponRedemption.Status.CONFIRMED])
        .first()
    )
    if not redemption:
        return None
    if redemption.status != CouponRedemption.Status.CONFIRMED:
        redemption.status = CouponRedemption.Status.CONFIRMED
        redemption.confirmed_at = timezone.now()
        redemption.save(update_fields=["status", "confirmed_at", "updated_at"])
    return redemption


@transaction.atomic
def release_or_reverse_coupon_redemption(order: Order) -> CouponRedemption | None:
    redemption = (
        CouponRedemption.objects.select_for_update()
        .filter(order=order, status__in=[CouponRedemption.Status.RESERVED, CouponRedemption.Status.CONFIRMED])
        .first()
    )
    if not redemption:
        return None
    target_status = (
        CouponRedemption.Status.REVERSED
        if redemption.status == CouponRedemption.Status.CONFIRMED
        else CouponRedemption.Status.RELEASED
    )
    redemption.status = target_status
    redemption.released_at = timezone.now()
    redemption.save(update_fields=["status", "released_at", "updated_at"])
    return redemption


# ---------------------------------------------------------------------------
# BF-28: CONSENT, SUPPRESSION & ABANDONED CART RECOVERY
# ---------------------------------------------------------------------------

def record_marketing_consent(
    *,
    email: str,
    promotional_opt_in: bool,
    user=None,
    consent_source: str = "explicit_form",
    policy_version: str = "2026.11",
) -> MarketingConsent:
    norm_email = (email or "").strip().lower()
    if not norm_email:
        raise ValidationError("Email requerido para consentimiento.")
    now = timezone.now()
    consent, _ = MarketingConsent.objects.update_or_create(
        email=norm_email,
        defaults={
            "user": user if getattr(user, "is_authenticated", False) else None,
            "promotional_opt_in": promotional_opt_in,
            "consent_source": consent_source,
            "policy_version": policy_version,
            "consented_at": now if promotional_opt_in else None,
            "revoked_at": None if promotional_opt_in else now,
        },
    )
    if promotional_opt_in:
        MarketingSuppression.objects.filter(email=norm_email).delete()
    else:
        MarketingSuppression.objects.update_or_create(
            email=norm_email,
            defaults={"reason": "opt_out_revoked", "suppressed_at": now},
        )
    return consent


def unsubscribe_marketing_email(email: str, reason: str = "unsubscribe_link") -> MarketingConsent:
    norm_email = (email or "").strip().lower()
    if not norm_email:
        raise ValidationError("Email requerido para desuscripción.")
    now = timezone.now()
    consent, _ = MarketingConsent.objects.update_or_create(
        email=norm_email,
        defaults={
            "promotional_opt_in": False,
            "revoked_at": now,
            "consent_source": reason,
        },
    )
    MarketingSuppression.objects.update_or_create(
        email=norm_email,
        defaults={"reason": reason, "suppressed_at": now},
    )
    AbandonedCartTrigger.objects.filter(
        Q(user__email__iexact=norm_email),
        status__in=[AbandonedCartTrigger.Status.ELIGIBLE, AbandonedCartTrigger.Status.SCHEDULED],
    ).update(status=AbandonedCartTrigger.Status.SUPPRESSED, suppression_reason=reason)
    return consent


def _has_recent_paid_order(user, since_dt) -> bool:
    if not user:
        return False
    return Order.objects.filter(
        user=user,
        created_at__gte=since_dt,
        status__in=[OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED],
    ).exists()


def _is_email_eligible_for_commercial_recovery(email: str) -> tuple[bool, str]:
    norm_email = (email or "").strip().lower()
    if not norm_email:
        return False, "missing_email"
    if MarketingSuppression.objects.filter(email=norm_email).exists():
        return False, "suppressed_email"
    consent = MarketingConsent.objects.filter(email=norm_email).first()
    if not consent or not consent.promotional_opt_in or consent.revoked_at is not None:
        return False, "no_promotional_opt_in"
    return True, ""


@transaction.atomic
def detect_abandoned_carts(
    *,
    inactivity_minutes: int = 60,
    now=None,
) -> list[AbandonedCartTrigger]:
    now = now or timezone.now()
    cutoff = now - timezone.timedelta(minutes=inactivity_minutes)
    carts = Cart.objects.filter(is_active=True, updated_at__lte=cutoff).select_related("user")
    triggers: list[AbandonedCartTrigger] = []

    for cart in carts:
        if not cart.items.exists():
            continue
        user = cart.user
        if not user or not getattr(user, "email", None):
            continue

        if _has_recent_paid_order(user, cart.updated_at):
            continue

        existing = AbandonedCartTrigger.objects.filter(
            cart=cart,
            status__in=[
                AbandonedCartTrigger.Status.ELIGIBLE,
                AbandonedCartTrigger.Status.SCHEDULED,
                AbandonedCartTrigger.Status.ATTEMPTED,
                AbandonedCartTrigger.Status.SENT,
                AbandonedCartTrigger.Status.RECOVERED,
            ],
        ).first()
        if existing:
            triggers.append(existing)
            continue

        eligible, reason = _is_email_eligible_for_commercial_recovery(user.email)
        status = AbandonedCartTrigger.Status.ELIGIBLE if eligible else AbandonedCartTrigger.Status.SUPPRESSED
        trigger = AbandonedCartTrigger.objects.create(
            cart=cart,
            user=user,
            last_activity_at=cart.updated_at,
            detected_at=now,
            eligible_after_minutes=inactivity_minutes,
            status=status,
            suppression_reason=reason,
            recovery_token=f"mktrec_{secrets.token_urlsafe(32)}",
            token_expires_at=now + timezone.timedelta(hours=72),
        )
        triggers.append(trigger)
    return triggers


@transaction.atomic
def prepare_and_dispatch_cart_recovery(
    trigger_id: int,
    *,
    now=None,
) -> dict[str, Any]:
    """
    Prepara envío idempotente de recuperación de carrito.
    En QA/Dev no envía correos reales: persiste outbox en `skipped_qa`.
    """
    now = now or timezone.now()
    trigger = AbandonedCartTrigger.objects.select_for_update().get(id=trigger_id)
    cart = trigger.cart
    user = trigger.user

    if trigger.status == AbandonedCartTrigger.Status.RECOVERED:
        return {"status": "suppressed", "reason": "already_recovered", "trigger_id": trigger.id}
    if not cart.is_active or not cart.items.exists():
        trigger.status = AbandonedCartTrigger.Status.SUPPRESSED
        trigger.suppression_reason = "cart_empty_or_inactive"
        trigger.save(update_fields=["status", "suppression_reason", "updated_at"])
        return {"status": "suppressed", "reason": "cart_empty_or_inactive", "trigger_id": trigger.id}
    if _has_recent_paid_order(user, trigger.last_activity_at):
        trigger.status = AbandonedCartTrigger.Status.RECOVERED
        trigger.suppression_reason = "order_already_paid"
        trigger.save(update_fields=["status", "suppression_reason", "updated_at"])
        return {"status": "suppressed", "reason": "order_already_paid", "trigger_id": trigger.id}

    email = getattr(user, "email", "") or ""
    eligible, reason = _is_email_eligible_for_commercial_recovery(email)
    if not eligible:
        trigger.status = AbandonedCartTrigger.Status.SUPPRESSED
        trigger.suppression_reason = reason
        trigger.save(update_fields=["status", "suppression_reason", "updated_at"])
        return {"status": "suppressed", "reason": reason, "trigger_id": trigger.id}

    if trigger.attempts_count >= trigger.max_attempts:
        trigger.status = AbandonedCartTrigger.Status.SUPPRESSED
        trigger.suppression_reason = "max_attempts_reached"
        trigger.save(update_fields=["status", "suppression_reason", "updated_at"])
        return {"status": "suppressed", "reason": "max_attempts_reached", "trigger_id": trigger.id}

    next_attempt = trigger.attempts_count + 1
    idem_key = f"cart_recovery:{trigger.id}:attempt:{next_attempt}"
    is_qa_mode = getattr(settings, "DEBUG", True) or not getattr(settings, "MARKETING_REAL_DISPATCH_ENABLED", False)
    outbox_status = "skipped_qa" if is_qa_mode else "queued"

    try:
        with transaction.atomic():
            attempt = CartRecoveryAttempt.objects.create(
                trigger=trigger,
                attempt_number=next_attempt,
                status=outbox_status,
                idempotency_key=idem_key,
            )
            outbox = MarketingMessageOutbox.objects.create(
                channel_class="commercial_cart_recovery",
                recipient_email=email.strip().lower(),
                subject="Tu carrito en LevelPro Audio sigue disponible",
                status=outbox_status,
                idempotency_key=idem_key,
                attempts=1,
                payload={
                    "trigger_id": str(trigger.id),
                    "cart_id": str(cart.id),
                    "recovery_path": f"/cart/recover/{trigger.recovery_token}",
                    "qa_mode": is_qa_mode,
                },
            )
            MarketingDeliveryEvent.objects.create(
                outbox=outbox,
                event_type=outbox_status,
                provider_ref=f"qa-sim-{outbox.id}" if is_qa_mode else "",
                occurred_at=now,
            )
    except IntegrityError:
        return {"status": "duplicate_skipped", "trigger_id": trigger.id}

    trigger.attempts_count = next_attempt
    trigger.status = AbandonedCartTrigger.Status.ATTEMPTED
    trigger.save(update_fields=["attempts_count", "status", "updated_at"])
    return {
        "status": outbox_status,
        "trigger_id": trigger.id,
        "attempt_id": attempt.id,
        "outbox_id": outbox.id,
        "recovery_token": trigger.recovery_token,
    }


def resolve_cart_recovery_token(token: str, now=None) -> dict[str, Any]:
    """
    Resuelve un enlace opaco de recuperación de carrito sin exponer PII de terceros.
    Revalida vigencia de token, disponibilidad de stock y estado activo del carrito.
    """
    now = now or timezone.now()
    clean_token = (token or "").strip()
    if not clean_token:
        raise ValidationError("Token de recuperación inválido.")

    trigger = AbandonedCartTrigger.objects.select_related("cart").filter(recovery_token=clean_token).first()
    if not trigger:
        raise ValidationError("Enlace de recuperación inválido o adulterado.")
    if now >= trigger.token_expires_at:
        trigger.status = AbandonedCartTrigger.Status.EXPIRED
        trigger.save(update_fields=["status", "updated_at"])
        raise ValidationError("El enlace de recuperación ha expirado.")
    if trigger.status == AbandonedCartTrigger.Status.RECOVERED:
        raise ValidationError("Este carrito ya fue recuperado en una orden completada.")

    cart = trigger.cart
    if not cart.is_active:
        raise ValidationError("El carrito asociado ya no está activo.")

    items_summary = []
    stock_warnings = []
    for ci in cart.items.select_related("product", "variant").all():
        available = getattr(ci.variant, "stock", None) if ci.variant else getattr(ci.product, "stock", None)
        if available is not None and available < ci.quantity:
            stock_warnings.append(f"{ci.product.name}: stock disponible {available}")
        items_summary.append({
            "product_id": ci.product_id,
            "product_name": ci.product.name,
            "sku": getattr(ci.variant, "sku", None) or getattr(ci.product, "sku", ""),
            "quantity": ci.quantity,
            "available_stock": available,
        })

    return {
        "valid": True,
        "trigger_id": trigger.id,
        "cart_id": cart.id,
        "items": items_summary,
        "stock_warnings": stock_warnings,
        "expires_at": trigger.token_expires_at.isoformat(),
    }


@transaction.atomic
def mark_cart_recovered_for_order(order: Order, cart: Cart | None = None) -> int:
    qs = AbandonedCartTrigger.objects.select_for_update().filter(
        status__in=[
            AbandonedCartTrigger.Status.ELIGIBLE,
            AbandonedCartTrigger.Status.SCHEDULED,
            AbandonedCartTrigger.Status.ATTEMPTED,
            AbandonedCartTrigger.Status.SENT,
        ]
    )
    if cart is not None:
        qs = qs.filter(cart=cart)
    elif order.user_id:
        qs = qs.filter(user_id=order.user_id)
    else:
        return 0
    return qs.update(
        status=AbandonedCartTrigger.Status.RECOVERED,
        recovered_order=order,
        suppression_reason="converted_to_order",
    )

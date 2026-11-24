# apps/orders/marketing_views.py
"""
LEVELPRO OS V4.0 — GATE 11: MARKETING & CUSTOMER GROWTH REST API VIEWS
Rutas rectoras:
- /api/v1/admin/marketing/coupons/
- /api/v1/admin/marketing/abandoned-carts/
- /api/v1/admin/marketing/promotions/
- /api/v1/admin/marketing/consents/
- /api/v1/admin/marketing/outbox/
- /api/v1/marketing/coupons/validate/ (público throttled, sin fuga de costos/PII)
- /api/v1/marketing/recovery/<token>/ (público throttled, opaco)
- /api/v1/marketing/unsubscribe/
"""

from __future__ import annotations

from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db.models import Count, Sum
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from apps.loyalty.models import LoyaltyAccount
from apps.orders.marketing_models import (
    AbandonedCartTrigger,
    Coupon,
    CouponRedemption,
    MarketingConsent,
    MarketingMessageOutbox,
    MarketingSuppression,
    PricingAdjustmentSnapshot,
    PromotionCampaign,
)
from apps.orders.marketing_services import (
    create_promotion_campaign,
    detect_abandoned_carts,
    evaluate_commercial_pricing,
    prepare_and_dispatch_cart_recovery,
    record_marketing_consent,
    resolve_cart_recovery_token,
    run_scheduled_promotions_tick,
    unsubscribe_marketing_email,
    validate_and_price_coupon,
)
from apps.products.models import Product
from apps.rewards.models import Campaign as RewardsCampaign, StickerPurchase, Winner
from core.admin_permissions import IsAdminOrStaff


class MarketingCouponThrottle(AnonRateThrottle):
    rate = "20/min"


def _parse_dt(value):
    if not value:
        return None
    dt = parse_datetime(str(value))
    if dt and timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _serialize_coupon(c: Coupon) -> dict:
    used_count = c.redemptions.filter(
        status__in=[CouponRedemption.Status.RESERVED, CouponRedemption.Status.CONFIRMED]
    ).count()
    return {
        "id": c.id,
        "code": c.code,
        "name": c.name,
        "description": c.description,
        "currency": c.currency,
        "discount_type": c.discount_type,
        "discount_value": str(c.discount_value),
        "starts_at": c.starts_at.isoformat(),
        "ends_at": c.ends_at.isoformat(),
        "business_timezone": c.business_timezone,
        "status": c.status,
        "max_total_uses": c.max_total_uses,
        "max_uses_per_customer": c.max_uses_per_customer,
        "used_count": used_count,
        "min_eligible_amount": str(c.min_eligible_amount),
        "max_discount_amount": str(c.max_discount_amount) if c.max_discount_amount is not None else None,
        "customer_segments": c.customer_segments,
        "accumulation_rule": c.accumulation_rule,
        "min_margin_percent": str(c.min_margin_percent) if c.min_margin_percent is not None else None,
        "included_product_ids": list(c.included_products.values_list("id", flat=True)),
        "excluded_product_ids": list(c.excluded_products.values_list("id", flat=True)),
        "included_category_ids": list(c.included_categories.values_list("id", flat=True)),
        "included_brand_ids": list(c.included_brands.values_list("id", flat=True)),
        "created_at": c.created_at.isoformat(),
    }


def _serialize_promotion(p: PromotionCampaign) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "status": p.status,
        "starts_at": p.starts_at.isoformat(),
        "ends_at": p.ends_at.isoformat(),
        "business_timezone": p.business_timezone,
        "currency": p.currency,
        "market": p.market,
        "discount_type": p.discount_type,
        "discount_value": str(p.discount_value),
        "priority": p.priority,
        "accumulation_rule": p.accumulation_rule,
        "min_margin_percent": str(p.min_margin_percent) if p.min_margin_percent is not None else None,
        "version": p.version,
        "included_product_ids": list(p.included_products.values_list("id", flat=True)),
        "included_category_ids": list(p.included_categories.values_list("id", flat=True)),
        "included_brand_ids": list(p.included_brands.values_list("id", flat=True)),
        "created_at": p.created_at.isoformat(),
    }


def _build_items_from_payload(raw_items: list[dict]) -> list[dict]:
    items = []
    for row in raw_items or []:
        prod_id = row.get("product_id")
        qty = int(row.get("quantity", 1) or 1)
        product = Product.objects.filter(id=prod_id).first() if prod_id else None
        unit_price = Decimal(str(row.get("unit_price", "0.00")))
        line_sub = Decimal(str(row.get("line_subtotal", unit_price * qty)))
        items.append({
            "product": product,
            "variant": None,
            "quantity": qty,
            "line_subtotal": line_sub,
        })
    return items


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def marketing_dashboard_view(request):
    now = timezone.now()
    active_coupons = Coupon.objects.filter(is_archived=False, status=Coupon.Status.ACTIVE, starts_at__lte=now, ends_at__gt=now).count()
    active_promos = PromotionCampaign.objects.filter(is_archived=False, status=PromotionCampaign.Status.ACTIVE).count()
    scheduled_promos = PromotionCampaign.objects.filter(is_archived=False, status=PromotionCampaign.Status.SCHEDULED).count()
    abandoned_eligible = AbandonedCartTrigger.objects.filter(status=AbandonedCartTrigger.Status.ELIGIBLE).count()
    abandoned_recovered = AbandonedCartTrigger.objects.filter(status=AbandonedCartTrigger.Status.RECOVERED).count()
    abandoned_suppressed = AbandonedCartTrigger.objects.filter(status=AbandonedCartTrigger.Status.SUPPRESSED).count()
    outbox_count = MarketingMessageOutbox.objects.count()
    consented_count = MarketingConsent.objects.filter(promotional_opt_in=True, revoked_at__isnull=True).count()
    suppressed_emails = MarketingSuppression.objects.count()

    redemptions_by_currency = list(
        CouponRedemption.objects.filter(status__in=[CouponRedemption.Status.RESERVED, CouponRedemption.Status.CONFIRMED])
        .values("currency")
        .annotate(count=Count("id"), total_discount=Sum("discount_amount"))
        .order_by("currency")
    )

    loyalty_summary = {
        "accounts_count": LoyaltyAccount.objects.count(),
        "total_points_balance": LoyaltyAccount.objects.aggregate(total=Sum("puntos_totales"))["total"] or 0,
    }
    rewards_summary = {
        "campaigns_count": RewardsCampaign.objects.count(),
        "active_campaigns": RewardsCampaign.objects.filter(status="active").count(),
        "stickers_count": StickerPurchase.objects.count(),
        "winners_count": Winner.objects.count(),
        "domain_separation": "strict_no_cross_discount",
    }

    return Response({
        "kpis": {
            "active_coupons": active_coupons,
            "active_promotions": active_promos,
            "scheduled_promotions": scheduled_promos,
            "abandoned_eligible": abandoned_eligible,
            "abandoned_recovered": abandoned_recovered,
            "abandoned_suppressed": abandoned_suppressed,
            "outbox_messages": outbox_count,
            "consented_contacts": consented_count,
            "suppressed_contacts": suppressed_emails,
        },
        "redemptions_by_currency": [
            {
                "currency": r["currency"],
                "count": r["count"],
                "total_discount": str(r["total_discount"] or Decimal("0.00")),
            }
            for r in redemptions_by_currency
        ],
        "loyalty_summary": loyalty_summary,
        "rewards_summary": rewards_summary,
    })


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def marketing_coupons_view(request):
    if request.method == "GET":
        qs = Coupon.objects.filter(is_archived=False)
        status_filter = request.query_params.get("status")
        currency_filter = request.query_params.get("currency")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if currency_filter:
            qs = qs.filter(currency=currency_filter.upper())
        return Response({"results": [_serialize_coupon(c) for c in qs[:100]]})

    data = request.data
    starts_at = _parse_dt(data.get("starts_at")) or timezone.now()
    ends_at = _parse_dt(data.get("ends_at")) or (starts_at + timezone.timedelta(days=30))
    if ends_at <= starts_at:
        return Response({"detail": "ends_at debe ser posterior a starts_at."}, status=status.HTTP_400_BAD_REQUEST)

    code = (data.get("code") or "").strip().upper()
    if not code:
        return Response({"detail": "El código del cupón es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
    if Coupon.objects.filter(code__iexact=code).exists():
        return Response({"detail": f"Ya existe un cupón con código {code}."}, status=status.HTTP_400_BAD_REQUEST)

    coupon = Coupon.objects.create(
        code=code,
        name=(data.get("name") or code).strip(),
        description=data.get("description", ""),
        currency=(data.get("currency") or "CLP").upper(),
        discount_type=data.get("discount_type", Coupon.DiscountType.PERCENTAGE),
        discount_value=Decimal(str(data.get("discount_value", "10.00"))),
        starts_at=starts_at,
        ends_at=ends_at,
        business_timezone=data.get("business_timezone") or "America/Santiago",
        status=data.get("status", Coupon.Status.ACTIVE),
        max_total_uses=data.get("max_total_uses"),
        max_uses_per_customer=data.get("max_uses_per_customer", 1),
        min_eligible_amount=Decimal(str(data.get("min_eligible_amount", "0.00"))),
        max_discount_amount=Decimal(str(data["max_discount_amount"])) if data.get("max_discount_amount") not in (None, "") else None,
        customer_segments=data.get("customer_segments") or [],
        accumulation_rule=data.get("accumulation_rule", Coupon.AccumulationRule.BLOCKED),
        min_margin_percent=Decimal(str(data["min_margin_percent"])) if data.get("min_margin_percent") not in (None, "") else None,
        created_by=request.user,
    )
    if data.get("included_product_ids"):
        coupon.included_products.set(data["included_product_ids"])
    if data.get("excluded_product_ids"):
        coupon.excluded_products.set(data["excluded_product_ids"])
    if data.get("included_category_ids"):
        coupon.included_categories.set(data["included_category_ids"])
    if data.get("included_brand_ids"):
        coupon.included_brands.set(data["included_brand_ids"])
    return Response(_serialize_coupon(coupon), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdminOrStaff])
def marketing_coupon_detail_view(request, coupon_id: int):
    coupon = Coupon.objects.filter(id=coupon_id, is_archived=False).first()
    if not coupon:
        return Response({"detail": "Cupón no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        coupon.status = Coupon.Status.CANCELLED
        coupon.is_archived = True
        coupon.save(update_fields=["status", "is_archived", "updated_at"])
        return Response({"status": "archived"})

    data = request.data
    for field in ["name", "description", "status", "accumulation_rule", "business_timezone"]:
        if field in data:
            setattr(coupon, field, data[field])
    if "max_total_uses" in data:
        coupon.max_total_uses = data["max_total_uses"]
    if "max_uses_per_customer" in data:
        coupon.max_uses_per_customer = data["max_uses_per_customer"]
    if "min_margin_percent" in data:
        coupon.min_margin_percent = Decimal(str(data["min_margin_percent"])) if data["min_margin_percent"] not in (None, "") else None
    coupon.save()
    return Response(_serialize_coupon(coupon))


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def marketing_coupon_redemptions_view(request, coupon_id: int):
    coupon = Coupon.objects.filter(id=coupon_id).first()
    if not coupon:
        return Response({"detail": "Cupón no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    rows = coupon.redemptions.select_related("order", "user").order_by("-created_at")[:100]
    return Response({
        "coupon_code": coupon.code,
        "results": [
            {
                "id": r.id,
                "order_id": r.order_id,
                "user_email": r.user.email if r.user else None,
                "currency": r.currency,
                "discount_amount": str(r.discount_amount),
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
    })


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_pricing_preview_view(request):
    data = request.data
    items = _build_items_from_payload(data.get("items") or [])
    if not items and data.get("subtotal"):
        items = [{"product": None, "variant": None, "quantity": 1, "line_subtotal": Decimal(str(data["subtotal"]))}]
    try:
        res = evaluate_commercial_pricing(
            currency=data.get("currency", "CLP"),
            items=items,
            coupon_code=data.get("coupon_code") or None,
            user=request.user,
            b2b_discount=Decimal(str(data.get("b2b_discount", "0.00"))),
            has_already_discounted_items=bool(data.get("has_already_discounted_items", False)),
            loyalty_discount=Decimal(str(data.get("loyalty_discount", "0.00"))),
        )
    except ValidationError as exc:
        return Response({"valid": False, "detail": exc.messages[0] if getattr(exc, "messages", None) else str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "valid": True,
        "currency": res["currency"],
        "reference_subtotal": str(res["reference_subtotal"]),
        "b2b_discount": str(res["b2b_discount"]),
        "promotion_discount": str(res["promotion_discount"]),
        "coupon_discount": str(res["coupon_discount"]),
        "loyalty_discount": str(res["loyalty_discount"]),
        "effective_discount": str(res["effective_discount"]),
        "final_total": str(res["final_total"]),
        "calculated_margin_percent": str(res["calculated_margin_percent"]) if res["calculated_margin_percent"] is not None else None,
        "cost_status": res["cost_status"],
        "price_source": res["price_source"],
        "applied_rule_ids": res["applied_rule_ids"],
    })


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def marketing_promotions_view(request):
    if request.method == "GET":
        qs = PromotionCampaign.objects.filter(is_archived=False)
        return Response({"results": [_serialize_promotion(p) for p in qs[:100]]})

    data = request.data
    starts_at = _parse_dt(data.get("starts_at")) or timezone.now()
    ends_at = _parse_dt(data.get("ends_at")) or (starts_at + timezone.timedelta(days=7))
    try:
        promo = create_promotion_campaign(
            {
                "name": data.get("name", ""),
                "description": data.get("description", ""),
                "status": data.get("status", PromotionCampaign.Status.SCHEDULED),
                "starts_at": starts_at,
                "ends_at": ends_at,
                "business_timezone": data.get("business_timezone", "America/Santiago"),
                "currency": data.get("currency", "CLP"),
                "market": data.get("market", "CL"),
                "discount_type": data.get("discount_type", Coupon.DiscountType.PERCENTAGE),
                "discount_value": data.get("discount_value", "10.00"),
                "priority": data.get("priority", 10),
                "accumulation_rule": data.get("accumulation_rule", Coupon.AccumulationRule.BLOCKED),
                "min_margin_percent": Decimal(str(data["min_margin_percent"])) if data.get("min_margin_percent") not in (None, "") else None,
                "included_product_ids": data.get("included_product_ids") or [],
                "included_category_ids": data.get("included_category_ids") or [],
                "included_brand_ids": data.get("included_brand_ids") or [],
            },
            user=request.user,
        )
    except ValidationError as exc:
        return Response({"detail": exc.messages[0] if getattr(exc, "messages", None) else str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(_serialize_promotion(promo), status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([IsAdminOrStaff])
def marketing_promotion_detail_view(request, promo_id: int):
    promo = PromotionCampaign.objects.filter(id=promo_id, is_archived=False).first()
    if not promo:
        return Response({"detail": "Promoción no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    for field in ["status", "priority", "accumulation_rule", "name"]:
        if field in request.data:
            setattr(promo, field, request.data[field])
    promo.version += 1
    promo.save()
    return Response(_serialize_promotion(promo))


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def marketing_scheduler_tick_view(request):
    res = run_scheduled_promotions_tick()
    return Response(res)


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def marketing_abandoned_carts_view(request):
    qs = AbandonedCartTrigger.objects.select_related("cart", "user", "recovered_order").order_by("-detected_at")[:100]
    return Response({
        "results": [
            {
                "id": t.id,
                "cart_id": t.cart_id,
                "user_email": t.user.email if t.user else None,
                "status": t.status,
                "attempts_count": t.attempts_count,
                "max_attempts": t.max_attempts,
                "suppression_reason": t.suppression_reason,
                "last_activity_at": t.last_activity_at.isoformat(),
                "detected_at": t.detected_at.isoformat(),
                "token_expires_at": t.token_expires_at.isoformat(),
                "recovered_order_id": t.recovered_order_id,
            }
            for t in qs
        ]
    })


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def marketing_detect_abandoned_carts_view(request):
    mins = int(request.data.get("inactivity_minutes", 60))
    triggers = detect_abandoned_carts(inactivity_minutes=mins)
    return Response({"detected_count": len(triggers), "trigger_ids": [t.id for t in triggers]})


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def marketing_dispatch_cart_recovery_view(request, trigger_id: int):
    if not AbandonedCartTrigger.objects.filter(id=trigger_id).exists():
        return Response({"detail": "Trigger no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    res = prepare_and_dispatch_cart_recovery(trigger_id)
    return Response(res)


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def marketing_consents_view(request):
    if request.method == "GET":
        consents = MarketingConsent.objects.order_by("-updated_at")[:100]
        return Response({
            "results": [
                {
                    "id": c.id,
                    "email": c.email,
                    "promotional_opt_in": c.promotional_opt_in,
                    "consent_source": c.consent_source,
                    "policy_version": c.policy_version,
                    "consented_at": c.consented_at.isoformat() if c.consented_at else None,
                    "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
                }
                for c in consents
            ]
        })

    try:
        consent = record_marketing_consent(
            email=request.data.get("email", ""),
            promotional_opt_in=bool(request.data.get("promotional_opt_in", False)),
            consent_source=request.data.get("consent_source", "admin_panel"),
        )
    except ValidationError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
        "id": consent.id,
        "email": consent.email,
        "promotional_opt_in": consent.promotional_opt_in,
    }, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def marketing_outbox_view(request):
    rows = MarketingMessageOutbox.objects.order_by("-created_at")[:100]
    return Response({
        "results": [
            {
                "id": m.id,
                "channel_class": m.channel_class,
                "recipient_email": m.recipient_email,
                "subject": m.subject,
                "status": m.status,
                "attempts": m.attempts,
                "created_at": m.created_at.isoformat(),
            }
            for m in rows
        ]
    })


# ---------------------------------------------------------------------------
# PUBLIC / STOREFRONT ENDPOINTS (THROTTLED, ZERO COST / ZERO PII LEAKS)
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([MarketingCouponThrottle])
def public_validate_coupon_view(request):
    data = request.data
    items = _build_items_from_payload(data.get("items") or [])
    if not items and data.get("subtotal"):
        items = [{"product": None, "variant": None, "quantity": 1, "line_subtotal": Decimal(str(data["subtotal"]))}]
    try:
        res = validate_and_price_coupon(
            code=data.get("code", ""),
            currency=data.get("currency", "CLP"),
            items=items,
            user=request.user if request.user.is_authenticated else None,
        )
    except ValidationError as exc:
        return Response({"valid": False, "detail": exc.messages[0] if getattr(exc, "messages", None) else str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "valid": True,
        "code": res["coupon"].code,
        "currency": res["currency"],
        "reference_subtotal": str(res["reference_subtotal"]),
        "promotion_discount": str(res["promotion_discount"]),
        "coupon_discount": str(res["coupon_discount"]),
        "effective_discount": str(res["effective_discount"]),
        "final_total": str(res["final_total"]),
    })


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([MarketingCouponThrottle])
def public_resolve_recovery_token_view(request, token: str):
    try:
        res = resolve_cart_recovery_token(token)
    except ValidationError as exc:
        return Response({"valid": False, "detail": exc.messages[0] if getattr(exc, "messages", None) else str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(res)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([MarketingCouponThrottle])
def public_marketing_unsubscribe_view(request):
    try:
        consent = unsubscribe_marketing_email(request.data.get("email", ""))
    except ValidationError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"unsubscribed": True, "email": consent.email})

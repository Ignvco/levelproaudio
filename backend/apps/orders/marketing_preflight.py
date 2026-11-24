# apps/orders/marketing_preflight.py
"""
LEVELPRO OS V4.0 — GATE 11 PREFLIGHT CONTRACTS (MKT11-PF-01..05)
- MKT11-PF-01: Precisión monetaria Decimal/Money sin float() ni mezcla de monedas.
- MKT11-PF-02: Integridad Loyalty (CLP-only sin FX explícito, sin doble otorgamiento/reverso).
- MKT11-PF-03: Preservación estricta de LevelPro Rewards (PromotionCampaign != rewards.Campaign).
- MKT11-PF-04: Separación de comunicaciones transaccionales vs comerciales; True != entrega garantizada.
- MKT11-PF-05: Precedencia única de precios y bloqueo de acumulación ambigua por defecto.
"""

from decimal import Decimal, ROUND_HALF_UP


REWARDS_DOMAIN_SEPARATION_CONTRACT = {
    "promotion_model": "orders.PromotionCampaign",
    "rewards_model": "rewards.Campaign",
    "auto_grant_entries_on_discount": False,
    "auto_alter_stickers": False,
    "auto_modify_winners": False,
}

COMMUNICATION_CHANNEL_CLASSES = {
    "transactional_order_confirmation": {"requires_marketing_consent": False, "category": "transactional"},
    "transactional_service_notice": {"requires_marketing_consent": False, "category": "transactional"},
    "commercial_cart_recovery": {"requires_marketing_consent": True, "category": "commercial"},
    "commercial_promotional": {"requires_marketing_consent": True, "category": "commercial"},
}

PRICING_PRECEDENCE_POLICY = (
    "b2b_negotiated_price",
    "scheduled_promotion_campaign",
    "coupon_discount",
    "loyalty_redemption",
)


def compute_decimal_cart_totals(
    *,
    line_items: list[dict],
    currency: str,
    discount_amount: Decimal = Decimal("0.00"),
) -> dict:
    """
    MKT11-PF-01: Cálculo monetario determinista en Decimal aislado por moneda.
    """
    curr = (currency or "").strip().upper()
    if curr not in ("CLP", "USD", "ARS"):
        raise ValueError(f"Moneda '{curr}' no soportada en cálculo comercial.")

    q_step = Decimal("1") if curr == "CLP" else Decimal("0.01")
    subtotal = Decimal("0.00")
    for item in line_items:
        item_curr = (item.get("currency") or curr).strip().upper()
        if item_curr != curr:
            raise ValueError(f"Prohibido mezclar monedas ({item_curr} != {curr}) en el mismo carrito.")
        unit = Decimal(str(item["unit_price"]))
        qty = Decimal(str(item["quantity"]))
        if unit < Decimal("0.00") or qty <= Decimal("0"):
            raise ValueError("Precio unitario no negativo y cantidad positiva obligatorios.")
        subtotal += (unit * qty).quantize(q_step, rounding=ROUND_HALF_UP)

    disc = max(Decimal("0.00"), Decimal(str(discount_amount or "0.00")).quantize(q_step, rounding=ROUND_HALF_UP))
    effective_disc = min(subtotal, disc)
    total = max(Decimal("0.00"), (subtotal - effective_disc).quantize(q_step, rounding=ROUND_HALF_UP))
    return {
        "currency": curr,
        "subtotal": subtotal,
        "discount": effective_disc,
        "total": total,
    }

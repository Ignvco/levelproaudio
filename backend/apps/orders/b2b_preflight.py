# apps/orders/b2b_preflight.py
"""
LEVELPRO OS V4.0 — GATE 8 PREFLIGHT (CRM-PF-01..04)
Contratos transaccionales y de seguridad para evolución B2B -> CRM/OMS/WMS:
- CRM-PF-01: Integración B2BQuote -> Order mediante OMS/WMS (prepare_inventory + reserve_stock_for_order + estados 3D).
- CRM-PF-02: Contrato explícito de jurisdicción tributaria (país, base imponible y régimen) sin asumir CLP => IVA 19%.
- CRM-PF-03: Precisión monetaria Decimal/Money (sin float() en cálculos ni respuestas B2B).
- CRM-PF-04: Privacidad y minimización de PII en direcciones, auditoría y vistas administrativas.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.db import transaction

from apps.inventory.services import (
    InventoryServiceError,
    get_default_warehouse,
    reserve_stock_for_order,
)
from apps.orders.inventory import InventoryError, prepare_inventory
from apps.orders.models import (
    B2BQuote,
    B2BQuoteStatus,
    Order,
    OrderItem,
    OrderStatus,
)
from core.audit.constants import CATEGORY_ORDER_STATUS
from core.audit.services import record_audit_event
from core.contracts.money import Money


class B2BPreflightError(ValueError):
    """Error de negocio o contrato durante el flujo B2B."""


@dataclass(frozen=True)
class B2BTaxContract:
    country: str
    tax_regime: str
    tax_basis: str
    tax_rate: Decimal
    is_resolved: bool
    reason: str = ""

    def compute_tax(self, net_amount: Decimal) -> Decimal:
        base = Decimal(str(net_amount or "0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if not self.is_resolved or self.tax_rate <= Decimal("0.00"):
            return Decimal("0.00")
        return (base * self.tax_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def resolve_b2b_tax_contract(
    *,
    country: Optional[str],
    currency: str,
    tax_regime: Optional[str] = None,
) -> B2BTaxContract:
    """
    CRM-PF-02: Determina la tasa impositiva aplicable mediante contrato explícito
    de país, moneda y régimen tributario, reutilizando la configuración existente
    (IVA 19% SII Chile en apps.billing.shipping_and_tax).
    - Nunca asume que moneda CLP implica por sí sola jurisdicción chilena.
    - No inventa tasas fiscales nuevas.
    """
    c_code = (country or "").strip().upper()
    curr = (currency or "CLP").strip().upper()
    regime = (tax_regime or "").strip().upper()

    if regime in ("EXEMPT", "EXEMPT_EXPORT", "EXPORT"):
        return B2BTaxContract(
            country=c_code or "INTL",
            tax_regime="EXEMPT_EXPORT",
            tax_basis="net_exempt",
            tax_rate=Decimal("0.00"),
            is_resolved=True,
            reason="Operación declarada explícitamente como exenta / exportación.",
        )

    if not c_code:
        return B2BTaxContract(
            country="",
            tax_regime="PENDING_JURISDICTION",
            tax_basis="unresolved",
            tax_rate=Decimal("0.00"),
            is_resolved=False,
            reason=(
                "Jurisdicción tributaria no especificada: debe indicar país y régimen fiscal "
                "antes de emitir definitivamente la cotización."
            ),
        )

    if c_code in ("CL", "CHILE"):
        if curr != "CLP":
            return B2BTaxContract(
                country="CL",
                tax_regime="UNRESOLVED_CURRENCY",
                tax_basis="unresolved",
                tax_rate=Decimal("0.00"),
                is_resolved=False,
                reason="Para régimen tributario SII Chile (IVA 19%), la moneda debe ser CLP o declararse exenta de exportación.",
            )
        # Reutiliza tasa oficial IVA 19% SII definida en apps.billing.shipping_and_tax
        return B2BTaxContract(
            country="CL",
            tax_regime="CL_IVA_19",
            tax_basis="net_plus_iva",
            tax_rate=Decimal("0.19"),
            is_resolved=True,
            reason="IVA 19% SII Chile aplicado sobre base neta.",
        )

    if c_code in ("AR", "ARGENTINA"):
        if regime == "AR_NET_NO_TAX_QUOTE":
            return B2BTaxContract(
                country="AR",
                tax_regime="AR_NET_NO_TAX_QUOTE",
                tax_basis="net_without_tax",
                tax_rate=Decimal("0.00"),
                is_resolved=True,
                reason="Cotización neta Argentina sin percepción tributaria automática.",
            )
        return B2BTaxContract(
            country="AR",
            tax_regime="PENDING_AR_REGIME",
            tax_basis="unresolved",
            tax_rate=Decimal("0.00"),
            is_resolved=False,
            reason=(
                "Jurisdicción Argentina requiere declarar régimen aplicable ('AR_NET_NO_TAX_QUOTE' o 'EXEMPT_EXPORT') "
                "para evitar tasas fiscales inventadas."
            ),
        )

    return B2BTaxContract(
        country=c_code,
        tax_regime="PENDING_JURISDICTION",
        tax_basis="unresolved",
        tax_rate=Decimal("0.00"),
        is_resolved=False,
        reason=f"No existe configuración tributaria autorizada para país '{c_code}' sin régimen 'EXEMPT_EXPORT'.",
    )


def format_money_str(amount, currency: str) -> str:
    """CRM-PF-03: Serialización monetaria exacta mediante Money sin conversión a float."""
    dec = Decimal(str(amount if amount is not None else "0.00")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return str(Money(dec, (currency or "CLP").upper()).amount)


@transaction.atomic
def convert_b2b_quote_to_order(
    quote: B2BQuote,
    *,
    idempotency_key: Optional[str] = None,
    shipping_address: Optional[str] = None,
    actor=None,
) -> tuple[Order, bool]:
    """
    CRM-PF-01: Convierte una B2BQuote aprobada en Order integrando OMS y WMS:
    - Bloqueo pesimista select_for_update() sobre B2BQuote.
    - Idempotencia explícita cuando se provee idempotency_key.
    - Validación y expansión de variantes/bundles/PREORDER/ON_DEMAND vía prepare_inventory().
    - Reserva de stock elegible vía reserve_stock_for_order() (sin sobreventa).
    - Estados tridimensionales Gate 7 y origen B2B.
    - Sin duplicar RUT/CUIT en shipping_address libre (CRM-PF-04).
    Retorna (order, is_replay).
    """
    locked_quote = (
        B2BQuote.objects.select_for_update()
        .prefetch_related("items__product", "items__variant")
        .get(pk=quote.pk)
    )

    if locked_quote.status == B2BQuoteStatus.CONVERTED and locked_quote.converted_order_id:
        if idempotency_key:
            return locked_quote.converted_order, True
        raise B2BPreflightError("Esta cotización ya fue convertida en orden de compra.")

    if locked_quote.status != B2BQuoteStatus.APPROVED:
        raise B2BPreflightError("Solo cotizaciones en estado 'approved' pueden ser convertidas en pedido.")

    quote_items = list(locked_quote.items.all())
    if not quote_items:
        raise B2BPreflightError("La cotización no contiene productos para convertir.")

    prepare_input = []
    for item in quote_items:
        if not item.product_id:
            raise B2BPreflightError(f"El producto '{item.product_name}' ya no se encuentra vinculado en el catálogo.")
        prepare_input.append({
            "product": str(item.product_id),
            "variant": str(item.variant_id) if item.variant_id else None,
            "quantity": item.quantity,
        })

    try:
        _, stock_demand = prepare_inventory(prepare_input)
    except InventoryError as exc:
        raise B2BPreflightError(str(exc)) from exc

    fulfillment_init = (
        Order.FulfillmentStatusChoices.ALLOCATED
        if stock_demand
        else Order.FulfillmentStatusChoices.UNFULFILLED
    )
    eff_address = (shipping_address or f"Despacho B2B — {locked_quote.company_name}").strip()

    order = Order.objects.create(
        user=locked_quote.user,
        email=locked_quote.email,
        customer_name=locked_quote.contact_name,
        customer_phone=locked_quote.phone,
        customer_tax_id=locked_quote.tax_id,
        shipping_address=eff_address,
        notes=f"Generada desde Cotización B2B #{str(locked_quote.id)[:8].upper()}. {locked_quote.client_notes}".strip(),
        total=locked_quote.total,
        currency=locked_quote.currency,
        status=OrderStatus.PENDING,
        commercial_status=Order.CommercialStatusChoices.CONFIRMED,
        financial_status=Order.FinancialStatusChoices.PENDING,
        fulfillment_status=fulfillment_init,
        order_origin=Order.OrderOriginChoices.B2B,
        assigned_warehouse=get_default_warehouse(),
        stock_deductions={str(k): int(v) for k, v in stock_demand.items()},
        loyalty_points_redeemed=0,
        loyalty_discount=Decimal("0.00"),
    )

    # Preservar snapshots de precio autorizado (aplicando descuento global proporcional si existe)
    disc_factor = Decimal("1.00")
    if locked_quote.subtotal and locked_quote.subtotal > Decimal("0.00") and locked_quote.discount_amount > Decimal("0.00"):
        net_ratio = max(Decimal("0.00"), locked_quote.subtotal - locked_quote.discount_amount) / locked_quote.subtotal
        disc_factor = net_ratio

    for item in quote_items:
        unit_price = (item.unit_price * disc_factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        sku_snap = item.variant.sku if item.variant else (item.product.sku or "")
        OrderItem.objects.create(
            order=order,
            product=item.product,
            variant=item.variant,
            product_name=item.product_name,
            variant_name=item.variant.name if item.variant else "",
            variant_sku=sku_snap,
            price=unit_price,
            quantity=item.quantity,
        )

    if stock_demand:
        try:
            reserve_stock_for_order(order, stock_demand, actor=actor)
        except InventoryServiceError as exc:
            raise B2BPreflightError(str(exc)) from exc

    locked_quote.converted_order = order
    locked_quote.status = B2BQuoteStatus.CONVERTED
    locked_quote.save(update_fields=["converted_order", "status", "updated_at"])

    record_audit_event(
        module="orders",
        action="B2B_QUOTE_CONVERTED",
        event_category=CATEGORY_ORDER_STATUS,
        resource_type="B2BQuote",
        resource_id=str(locked_quote.id),
        resource_repr=f"Cotización B2B #{str(locked_quote.id)[:8].upper()} convertida en Orden #{order.id}",
        actor=actor,
        new_values={
            "order_id": str(order.id),
            "total": str(order.total),
            "currency": order.currency,
            "order_origin": order.order_origin,
        },
        mandatory=True,
    )

    return order, False

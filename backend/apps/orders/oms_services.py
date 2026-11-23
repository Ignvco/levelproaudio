# apps/orders/oms_services.py
"""
LEVELPRO OS V4.0 — GATE 7: ORDER MANAGEMENT SYSTEM (OMS)
Servicios transaccionales para:
- BF-11: Ventas Manuales (DraftOrder, DraftOrderItem, reservas temporales, snapshots de precios autorizados, conversión idempotente).
- BF-12: WhatsApp Checkout (enlace HTTPS con token firmado/opaco, validación de vencimiento/estado, recuperación sanitizada sin PII sensible).
- BF-13: Desacoplamiento tri-dimensional de estados (Comercial, Financiero, Logístico) con matriz de equivalencias legacy.
- BF-23: Devoluciones y Reembolsos (ReturnMerchandiseAuthorization, RMAItem, recepción física, inspección, reingreso controlado con movimientos compensatorios de Kardex y Costos, y resolución de reembolsos).
"""

import secrets
import urllib.parse
import uuid
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.analytics.models import IncomeRecord
from apps.inventory.models import InventoryMovement, SerialNumberTrack, StockReservation, Warehouse, WarehouseStock
from apps.inventory.services import (
    InventoryServiceError,
    consolidate_order_reservations,
    dispatch_order_reservations,
    get_default_warehouse,
    receive_stock_into_warehouse,
    release_order_reservations,
    reserve_stock_for_order,
    sync_legacy_stock_projection,
)
from apps.orders.inventory import InventoryError, _get_sellable_available, prepare_inventory
from apps.orders.models import (
    DraftOrder,
    DraftOrderItem,
    Order,
    OrderItem,
    OrderStatus,
    ReturnMerchandiseAuthorization,
    RMAItem,
)
from apps.payments.models import Payment, PaymentStatus
from apps.procurement.costing_services import record_wac_physical_return
from apps.procurement.models import CostConsumptionRecord, CostLayer, SerialCostUnit, WeightedAverageCostState
from apps.products.models import Product, ProductVariant, SkuRegistry
from apps.site_settings.models import SiteSettings
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_FINANCIAL_OPERATION,
    CATEGORY_MODIFICATION,
    CATEGORY_ORDER_STATUS,
    CATEGORY_PAYMENT_OPERATION,
    CATEGORY_PRICE_CHANGE,
    CATEGORY_STOCK_ADJUSTMENT,
    SEVERITY_HIGH,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)
from core.audit.services import record_audit_event
from core.contracts.states import (
    CommercialStatus,
    FinancialStatus,
    FulfillmentStatus,
    OrderStateContract,
    StateTransitionError,
)
from core.rbac.constants import (
    MODULE_FINANCES,
    MODULE_INVENTORY,
    MODULE_LOGISTICS,
    MODULE_ORDERS,
    PERM_ADJUST_INVENTORY,
    PERM_APPLY_DISCOUNTS,
    PERM_APPROVE_PAYMENTS,
    PERM_EDIT_PRICES,
    PERM_MANAGE_FINANCES,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability


class OMSServiceError(ValueError):
    """Error de negocio o validación del Order Management System (Gate 7)."""
    pass


class OMSPermissionError(PermissionError):
    """Error de autorización granular RBAC en operaciones OMS."""
    pass


SUPPORTED_CURRENCIES = ("CLP", "USD", "ARS")
WHATSAPP_TOKEN_SALT = "levelpro.v4.gate7.whatsapp_checkout"


# ── Tabla Oficial de Equivalencias BF-13 (Legacy <-> 3D) ────────────────────
LEGACY_TO_3D_EQUIVALENCE_TABLE = [
    {
        "legacy_status": "pending",
        "commercial_status": "confirmed",
        "financial_status": "pending",
        "fulfillment_status": "allocated",
        "description": "Pedido confirmado comercialmente, pendiente de cobro y con stock reservado.",
    },
    {
        "legacy_status": "paid",
        "commercial_status": "confirmed",
        "financial_status": "paid",
        "fulfillment_status": "allocated",
        "description": "Pedido confirmado y 100% pagado, con reserva consolidada listo para preparación/despacho.",
    },
    {
        "legacy_status": "shipped",
        "commercial_status": "confirmed",
        "financial_status": "paid",
        "fulfillment_status": "shipped",
        "description": "Pedido pagado y despachado físicamente desde bodega (Kardex DISPATCH + COGS congelado).",
    },
    {
        "legacy_status": "completed",
        "commercial_status": "completed",
        "financial_status": "paid",
        "fulfillment_status": "delivered",
        "description": "Pedido entregado al cliente y cerrado comercialmente.",
    },
    {
        "legacy_status": "cancelled",
        "commercial_status": "cancelled",
        "financial_status": "failed (o conserva paid/refunded si hubo cobro previo)",
        "fulfillment_status": "unfulfilled (o conserva shipped/returned si hubo despacho previo)",
        "description": "Cancelación comercial desacoplada: no equivale automáticamente a reembolso ni a devolución física.",
    },
]


def _next_oms_code(model_cls, field_name: str, prefix: str) -> str:
    today_str = timezone.now().strftime("%Y%m%d")
    base = f"{prefix}-{today_str}-"
    last = (
        model_cls.objects.filter(**{f"{field_name}__startswith": base})
        .order_by(f"-{field_name}")
        .values_list(field_name, flat=True)
        .first()
    )
    seq = 1
    if last:
        tail = last.replace(base, "")
        if tail.isdigit():
            seq = int(tail) + 1
    return f"{base}{seq:04d}"


def _to_dec(val, field_label: str = "valor", allow_zero: bool = True) -> Decimal:
    try:
        d = Decimal(str(val))
    except Exception as exc:
        raise OMSServiceError(f"El campo '{field_label}' debe ser un número decimal válido.") from exc
    if d.is_nan() or d.is_infinite():
        raise OMSServiceError(f"El campo '{field_label}' no es un decimal finito.")
    if allow_zero and d < Decimal("0"):
        raise OMSServiceError(f"El campo '{field_label}' no puede ser negativo.")
    if not allow_zero and d <= Decimal("0"):
        raise OMSServiceError(f"El campo '{field_label}' debe ser mayor que cero.")
    return d


def _get_catalog_unit_price(product: Product, variant: ProductVariant | None, currency: str) -> Decimal:
    site_settings = SiteSettings.objects.first()
    rate_clp = site_settings.usd_to_clp if site_settings else None
    rate_ars = site_settings.usd_to_ars if site_settings else None
    target = variant if variant is not None else product
    prices = target.prices_by_currency(rate_clp, rate_ars)
    raw = prices.get(currency) or target.price
    return Decimal(str(raw)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ═══════════════════════════════════════════════════════════════════════════
# 1. RESERVAS TEMPORALES EN BORRADORES (DraftOrder -> StockReservation)
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def release_draft_order_reservations(
    draft: DraftOrder,
    *,
    reason: str = "Liberación de reserva temporal de borrador",
    mark_expired: bool = False,
    actor=None,
) -> int:
    """
    Libera exclusivamente las reservas temporales (TEMPORARY) vinculadas a un DraftOrder
    a través de su reservation_session_key (`draft:<uuid>`).
    """
    session_key = draft.reservation_session_key or f"draft:{draft.id}"
    target_status = StockReservation.Status.EXPIRED if mark_expired else StockReservation.Status.RELEASED
    reservations = list(
        StockReservation.objects.select_for_update(of=("self",))
        .select_related("warehouse", "product", "variant")
        .filter(
            order__isnull=True,
            session_key=session_key,
            status=StockReservation.Status.TEMPORARY,
        )
        .order_by("warehouse_id", "pk")
    )
    if not reservations:
        return 0

    corr_id = uuid.uuid4()
    released = 0
    for res in reservations:
        if res.product_id is None:
            res.status = target_status
            res.save(update_fields=["status", "updated_at"])
            released += 1
            continue
        ws = WarehouseStock.objects.select_for_update().get(
            warehouse=res.warehouse,
            product=res.product,
            variant=res.variant,
        )
        phys_before = ws.physical_quantity
        res_before = ws.reserved_quantity
        avail_before = ws.available_quantity
        rel_qty = min(res.quantity, res_before)
        if rel_qty > 0:
            ws.reserved_quantity = res_before - rel_qty
            ws.save(update_fields=["reserved_quantity", "updated_at"])

        res.status = target_status
        res.save(update_fields=["status", "updated_at"])

        InventoryMovement.objects.create(
            warehouse=res.warehouse,
            product=res.product,
            variant=res.variant,
            sku_snapshot=res.variant.sku if res.variant_id else (res.product.sku or ""),
            movement_type=InventoryMovement.MovementType.RELEASE,
            quantity=res.quantity,
            affected_dimensions={"physical": 0, "reserved": -rel_qty, "available": rel_qty},
            physical_before=phys_before,
            physical_after=phys_before,
            reserved_before=res_before,
            reserved_after=ws.reserved_quantity,
            available_before=avail_before,
            available_after=ws.available_quantity,
            reason=reason,
            source_document_type="DRAFT_ORDER",
            source_document_id=str(draft.id),
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            correlation_id=corr_id,
            idempotency_key=f"kardex_draft_rel:{res.id}",
        )
        sync_legacy_stock_projection(res.product, res.variant)
        released += 1

    return released


@transaction.atomic
def reserve_stock_for_draft_order(
    draft: DraftOrder,
    demand: dict,
    *,
    ttl_minutes: int = 120,
    actor=None,
) -> list[StockReservation]:
    """
    Crea reservas temporales (TEMPORARY con TTL finito) para un DraftOrder sin inmovilizar
    inventario indefinidamente.
    - Respeta modalidades STOCK, PREORDER y ON_DEMAND (prepare_inventory solo genera demanda física para STOCK).
    - No reserva productos fuera de stock.
    - Bajo concurrencia usa select_for_update() sobre WarehouseStock.
    """
    release_draft_order_reservations(draft, reason="Actualización de reserva de borrador", actor=actor)
    if not demand:
        return []

    session_key = f"draft:{draft.id}"
    expires_at = timezone.now() + timedelta(minutes=max(5, int(ttl_minutes or 120)))
    corr_id = uuid.uuid4()
    created_reservations = []

    for target_key in sorted(demand, key=str):
        qty_needed = int(demand[target_key])
        if qty_needed <= 0:
            continue

        if isinstance(target_key, str) and target_key.startswith("variant:"):
            vid = uuid.UUID(target_key.split(":", 1)[1])
            variant = ProductVariant.objects.select_related("product").get(pk=vid)
            product = variant.product
        else:
            product = Product.objects.get(pk=target_key)
            variant = None

        qs = WarehouseStock.objects.select_for_update().filter(
            product=product,
            variant=variant,
            warehouse__is_active=True,
            warehouse__is_sellable_online=True,
        )
        if draft.warehouse_id:
            qs_pref = list(qs.filter(warehouse_id=draft.warehouse_id))
            qs_other = list(qs.exclude(warehouse_id=draft.warehouse_id).order_by("warehouse__fulfillment_priority", "pk"))
            stock_rows = qs_pref + qs_other
        else:
            stock_rows = list(qs.order_by("warehouse__fulfillment_priority", "pk"))

        total_avail = sum(r.available_quantity for r in stock_rows)
        if total_avail < qty_needed:
            label = f"{product.name} ({variant.name})" if variant else product.name
            raise OMSServiceError(f"Stock insuficiente en WMS para reservar '{label}' (disponible={total_avail}, solicitado={qty_needed}).")

        remaining = qty_needed
        for ws in stock_rows:
            if remaining <= 0:
                break
            avail = ws.available_quantity
            if avail <= 0:
                continue
            take = min(avail, remaining)
            phys_before = ws.physical_quantity
            res_before = ws.reserved_quantity
            avail_before = ws.available_quantity

            ws.reserved_quantity = res_before + take
            ws.save(update_fields=["reserved_quantity", "updated_at"])

            res_obj = StockReservation.objects.create(
                order=None,
                session_key=session_key,
                warehouse=ws.warehouse,
                product=product,
                variant=variant,
                quantity=take,
                status=StockReservation.Status.TEMPORARY,
                expires_at=expires_at,
                idempotency_key=f"draft_res:{draft.id}:{ws.warehouse_id}:{target_key}:{uuid.uuid4().hex[:8]}",
                created_by=actor if getattr(actor, "is_authenticated", False) else None,
            )
            created_reservations.append(res_obj)

            InventoryMovement.objects.create(
                warehouse=ws.warehouse,
                product=product,
                variant=variant,
                sku_snapshot=variant.sku if variant else (product.sku or ""),
                movement_type=InventoryMovement.MovementType.RESERVE,
                quantity=take,
                affected_dimensions={"physical": 0, "reserved": take, "available": -take},
                physical_before=phys_before,
                physical_after=phys_before,
                reserved_before=res_before,
                reserved_after=ws.reserved_quantity,
                available_before=avail_before,
                available_after=ws.available_quantity,
                reason=f"Reserva temporal por borrador de venta #{draft.draft_number}",
                source_document_type="DRAFT_ORDER",
                source_document_id=str(draft.id),
                actor=actor if getattr(actor, "is_authenticated", False) else None,
                correlation_id=corr_id,
                idempotency_key=f"kardex_draft_res:{res_obj.id}",
            )
            remaining -= take

        sync_legacy_stock_projection(product, variant)

    draft.reservation_session_key = session_key
    draft.reservation_expires_at = expires_at
    draft.reserve_inventory = True
    if draft.status in (DraftOrder.Status.DRAFT, DraftOrder.Status.PROPOSED):
        draft.status = DraftOrder.Status.RESERVED
    draft.save(update_fields=["reservation_session_key", "reservation_expires_at", "reserve_inventory", "status", "updated_at"])
    return created_reservations


# ═══════════════════════════════════════════════════════════════════════════
# 2. BF-11: CREACIÓN, EDICIÓN Y CONVERSIÓN IDEMPOTENTE DE VENTAS MANUALES
# ═══════════════════════════════════════════════════════════════════════════

def _validate_draft_items_and_pricing(
    *,
    items_payload: list[dict],
    currency: str,
    global_discount_percent: Decimal,
    actor=None,
) -> tuple[list[dict], dict, Decimal, Decimal, Decimal]:
    if not items_payload or not isinstance(items_payload, list):
        raise OMSServiceError("Debe incluir al menos un producto en la venta manual.")

    can_edit_prices = is_effective_super_admin(actor) or (
        actor is not None and user_has_capability(actor, PERM_EDIT_PRICES)
    )
    can_apply_discounts = is_effective_super_admin(actor) or (
        actor is not None and user_has_capability(actor, PERM_APPLY_DISCOUNTS)
    )

    if global_discount_percent > Decimal("0.00") and not (can_edit_prices and can_apply_discounts):
        raise OMSPermissionError(
            "No posee autorización ('edit_prices' y 'apply_discounts') para aplicar descuentos comerciales."
        )

    prepare_input = []
    for raw in items_payload:
        pid = raw.get("product_id") or raw.get("product")
        vid = raw.get("variant_id") or raw.get("variant")
        qty = raw.get("quantity", 1)
        prepare_input.append({"product": pid, "variant": vid, "quantity": qty})

    try:
        _, stock_demand = prepare_inventory(prepare_input)
    except InventoryError as exc:
        raise OMSServiceError(str(exc)) from exc

    prepared_lines = []
    subtotal = Decimal("0.00")

    for raw in items_payload:
        pid = raw.get("product_id") or raw.get("product")
        vid = raw.get("variant_id") or raw.get("variant")
        qty = int(raw.get("quantity", 1))
        product = Product.objects.get(pk=pid, is_active=True)
        variant = ProductVariant.objects.get(pk=vid, product=product, is_active=True) if vid else None

        cat_price = _get_catalog_unit_price(product, variant, currency)
        custom_price_raw = raw.get("authorized_unit_price") if raw.get("authorized_unit_price") is not None else raw.get("unit_price")
        line_disc_pct = _to_dec(raw.get("discount_percent", "0.00"), "discount_percent", allow_zero=True).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if line_disc_pct > Decimal("100.00"):
            raise OMSServiceError("El porcentaje de descuento por línea no puede superar 100%.")

        if custom_price_raw is not None:
            auth_price = _to_dec(custom_price_raw, "authorized_unit_price", allow_zero=False).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if auth_price != cat_price and not can_edit_prices:
                raise OMSPermissionError(
                    f"No posee autorización ('edit_prices') para modificar el precio de '{product.name}'."
                )
        else:
            auth_price = cat_price

        if line_disc_pct > Decimal("0.00"):
            if not (can_edit_prices and can_apply_discounts):
                raise OMSPermissionError(
                    "No posee autorización ('edit_prices' y 'apply_discounts') para aplicar descuentos por línea."
                )
            effective_unit = (auth_price * (Decimal("100.00") - line_disc_pct) / Decimal("100.00")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            effective_unit = auth_price

        # Validar contra política de margen mínimo de seguridad si existe costo conocido en la misma moneda
        wac = WeightedAverageCostState.objects.filter(
            product=product, variant=variant, currency=currency, average_unit_cost__gt=0
        ).first()
        ref_cost = wac.average_unit_cost if wac else (
            Decimal(str(variant.effective_cost_price if variant else (product.cost_price or 0)))
            if currency == "CLP"
            else None
        )
        if ref_cost is not None and ref_cost > Decimal("0") and effective_unit < ref_cost:
            if not is_effective_super_admin(actor) and not user_has_capability(actor, PERM_MANAGE_FINANCES):
                raise OMSPermissionError(
                    f"El precio autorizado para '{product.name}' ({effective_unit} {currency}) es inferior al costo "
                    f"registrado ({ref_cost.quantize(Decimal('0.01'))} {currency}). Requiere autorización financiera."
                )

        line_sub = (effective_unit * Decimal(qty)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        subtotal += line_sub
        sku_snap = variant.sku if variant else (product.sku or f"PROD-{str(product.id)[:8].upper()}")

        prepared_lines.append({
            "product": product,
            "variant": variant,
            "sku_snapshot": sku_snap,
            "product_name_snapshot": product.name,
            "variant_name_snapshot": variant.name if variant else "",
            "product_type_snapshot": product.product_type,
            "quantity": qty,
            "catalog_unit_price_snapshot": cat_price,
            "authorized_unit_price": effective_unit,
            "currency": currency,
            "discount_percent": line_disc_pct,
            "subtotal": line_sub,
            "notes": str(raw.get("notes") or "")[:255],
        })

    discount_amount = (subtotal * global_discount_percent / Decimal("100.00")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total = max(Decimal("0.00"), subtotal - discount_amount)
    return prepared_lines, stock_demand, subtotal, discount_amount, total


@transaction.atomic
def create_manual_draft_order(
    *,
    customer_name: str,
    customer_email: str,
    items: list[dict],
    currency: str = "CLP",
    customer=None,
    customer_phone: str = "",
    customer_tax_id: str = "",
    shipping_address: str = "",
    channel: str = DraftOrder.Channel.MANUAL,
    discount_percent=Decimal("0.00"),
    valid_hours: int = 48,
    reserve_inventory: bool = True,
    reservation_ttl_minutes: int = 120,
    warehouse: Warehouse = None,
    notes: str = "",
    internal_notes: str = "",
    terms_snapshot: str = "",
    actor=None,
) -> DraftOrder:
    """
    BF-11: Crea un DraftOrder con snapshots congelados de SKU, nombre, precio y condiciones.
    Si reserve_inventory=True, bloquea temporalmente el stock en WMS con TTL finito.
    """
    curr = (currency or "CLP").strip().upper()
    if curr not in SUPPORTED_CURRENCIES:
        raise OMSServiceError(f"Moneda no soportada: '{curr}'.")

    c_name = (customer_name or "").strip()
    c_email = (customer_email or "").strip()
    if not c_name or not c_email:
        raise OMSServiceError("El nombre y email del cliente son obligatorios para crear una venta manual.")

    disc_pct = _to_dec(discount_percent or "0.00", "discount_percent", allow_zero=True).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if disc_pct > Decimal("100.00"):
        raise OMSServiceError("El descuento global no puede superar el 100%.")

    prepared_lines, stock_demand, subtotal, discount_amount, total = _validate_draft_items_and_pricing(
        items_payload=items,
        currency=curr,
        global_discount_percent=disc_pct,
        actor=actor,
    )

    valid_until = timezone.now() + timedelta(hours=max(1, int(valid_hours or 48)))
    target_wh = warehouse or get_default_warehouse()

    draft = DraftOrder.objects.create(
        draft_number=_next_oms_code(DraftOrder, "draft_number", "DRF"),
        status=DraftOrder.Status.PROPOSED,
        channel=channel if channel in DraftOrder.Channel.values else DraftOrder.Channel.MANUAL,
        customer=customer,
        customer_name=c_name,
        customer_email=c_email,
        customer_phone=(customer_phone or "").strip(),
        customer_tax_id=(customer_tax_id or "").strip(),
        shipping_address=(shipping_address or "").strip(),
        currency=curr,
        subtotal=subtotal,
        discount_percent=disc_pct,
        discount_amount=discount_amount,
        tax_amount=Decimal("0.00"),
        total=total,
        valid_until=valid_until,
        reserve_inventory=bool(reserve_inventory),
        warehouse=target_wh,
        notes=(notes or "").strip(),
        internal_notes=(internal_notes or "").strip(),
        terms_snapshot=(terms_snapshot or "Propuesta comercial sujeta a vigencia indicada.").strip(),
        sales_rep=actor if getattr(actor, "is_authenticated", False) else None,
    )

    for ln in prepared_lines:
        DraftOrderItem.objects.create(draft_order=draft, **ln)

    if reserve_inventory and stock_demand:
        reserve_stock_for_draft_order(
            draft,
            stock_demand,
            ttl_minutes=reservation_ttl_minutes,
            actor=actor,
        )

    record_audit_event(
        module=MODULE_ORDERS,
        action="MANUAL_DRAFT_ORDER_CREATED",
        event_category=CATEGORY_CREATION,
        resource_type="DraftOrder",
        resource_id=str(draft.id),
        resource_repr=str(draft),
        actor=actor,
        new_values={
            "draft_number": draft.draft_number,
            "customer_email": draft.customer_email,
            "currency": draft.currency,
            "total": str(draft.total),
            "reserve_inventory": draft.reserve_inventory,
            "status": draft.status,
        },
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return draft


@transaction.atomic
def update_manual_draft_order(
    draft: DraftOrder,
    *,
    payload: dict,
    actor=None,
) -> DraftOrder:
    """
    BF-11: Actualiza un DraftOrder que aún no ha sido convertido ni cancelado.
    """
    locked_draft = DraftOrder.objects.select_for_update().get(pk=draft.pk)
    if locked_draft.status in (DraftOrder.Status.CONVERTED, DraftOrder.Status.CANCELLED):
        raise OMSServiceError(f"No se puede editar un borrador en estado '{locked_draft.status}'.")

    if "customer_name" in payload:
        locked_draft.customer_name = (payload["customer_name"] or "").strip() or locked_draft.customer_name
    if "customer_email" in payload:
        locked_draft.customer_email = (payload["customer_email"] or "").strip() or locked_draft.customer_email
    if "customer_phone" in payload:
        locked_draft.customer_phone = (payload["customer_phone"] or "").strip()
    if "customer_tax_id" in payload:
        locked_draft.customer_tax_id = (payload["customer_tax_id"] or "").strip()
    if "shipping_address" in payload:
        locked_draft.shipping_address = (payload["shipping_address"] or "").strip()
    if "notes" in payload:
        locked_draft.notes = (payload["notes"] or "").strip()
    if "internal_notes" in payload:
        locked_draft.internal_notes = (payload["internal_notes"] or "").strip()
    if "currency" in payload and payload["currency"]:
        curr = str(payload["currency"]).strip().upper()
        if curr not in SUPPORTED_CURRENCIES:
            raise OMSServiceError(f"Moneda no soportada: '{curr}'.")
        locked_draft.currency = curr

    disc_pct = (
        _to_dec(payload["discount_percent"], "discount_percent", allow_zero=True).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if "discount_percent" in payload
        else locked_draft.discount_percent
    )
    locked_draft.discount_percent = disc_pct

    if "items" in payload and payload["items"] is not None:
        prepared_lines, stock_demand, subtotal, discount_amount, total = _validate_draft_items_and_pricing(
            items_payload=payload["items"],
            currency=locked_draft.currency,
            global_discount_percent=disc_pct,
            actor=actor,
        )
        locked_draft.items.all().delete()
        for ln in prepared_lines:
            DraftOrderItem.objects.create(draft_order=locked_draft, **ln)
        locked_draft.subtotal = subtotal
        locked_draft.discount_amount = discount_amount
        locked_draft.total = total

        if payload.get("reserve_inventory", locked_draft.reserve_inventory):
            reserve_stock_for_draft_order(
                locked_draft,
                stock_demand,
                ttl_minutes=int(payload.get("reservation_ttl_minutes", 120)),
                actor=actor,
            )
    else:
        locked_draft.discount_amount = (
            locked_draft.subtotal * locked_draft.discount_percent / Decimal("100.00")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        locked_draft.total = max(Decimal("0.00"), locked_draft.subtotal - locked_draft.discount_amount)

    locked_draft.save()

    record_audit_event(
        module=MODULE_ORDERS,
        action="MANUAL_DRAFT_ORDER_UPDATED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="DraftOrder",
        resource_id=str(locked_draft.id),
        resource_repr=str(locked_draft),
        actor=actor,
        new_values={
            "status": locked_draft.status,
            "total": str(locked_draft.total),
            "currency": locked_draft.currency,
        },
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked_draft


@transaction.atomic
def cancel_or_expire_draft_order(
    draft: DraftOrder,
    *,
    mark_expired: bool = False,
    reason: str = "Cancelación de borrador de venta manual",
    actor=None,
) -> DraftOrder:
    """
    Cancela o marca como vencido un DraftOrder y libera exclusivamente sus reservas temporales elegibles.
    """
    locked_draft = DraftOrder.objects.select_for_update().get(pk=draft.pk)
    if locked_draft.status == DraftOrder.Status.CONVERTED:
        raise OMSServiceError("No se puede cancelar ni vencer un borrador que ya fue convertido en orden.")
    if locked_draft.status in (DraftOrder.Status.CANCELLED, DraftOrder.Status.EXPIRED):
        return locked_draft

    release_draft_order_reservations(
        locked_draft,
        reason=reason,
        mark_expired=mark_expired,
        actor=actor,
    )
    locked_draft.status = DraftOrder.Status.EXPIRED if mark_expired else DraftOrder.Status.CANCELLED
    locked_draft.save(update_fields=["status", "updated_at"])

    record_audit_event(
        module=MODULE_ORDERS,
        action="MANUAL_DRAFT_ORDER_EXPIRED" if mark_expired else "MANUAL_DRAFT_ORDER_CANCELLED",
        event_category=CATEGORY_ORDER_STATUS,
        resource_type="DraftOrder",
        resource_id=str(locked_draft.id),
        resource_repr=str(locked_draft),
        actor=actor,
        new_values={"status": locked_draft.status, "reason": reason},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked_draft


@transaction.atomic
def convert_draft_order_to_order(
    draft: DraftOrder,
    *,
    idempotency_key: str = None,
    shipping_address_override: str = None,
    origin_override: str = None,
    actor=None,
) -> Order:
    """
    BF-11 & BF-12: Convierte un DraftOrder en una Order comercial de manera estrictamente idempotente.
    - Conserva snapshots congelados de SKU, nombre, precio autorizado, moneda y condiciones (no usa precio dinámico del catálogo).
    - Transfiere las reservas temporales del borrador a la orden (sin duplicar reserva ni descontar dos veces).
      Si el borrador no tenía reserva previa o había expirado, valida disponibilidad y crea la reserva para la orden.
    - Impide creación de órdenes duplicadas ante reintentos concurrentes.
    """
    locked_draft = DraftOrder.objects.select_for_update().get(pk=draft.pk)

    # 1. Idempotencia: si ya fue convertido, retornar la misma Order si la clave coincide (o si no se envió otra distinta)
    if locked_draft.status == DraftOrder.Status.CONVERTED and locked_draft.converted_order_id:
        if (
            idempotency_key
            and locked_draft.conversion_idempotency_key
            and locked_draft.conversion_idempotency_key != idempotency_key
        ):
            raise OMSServiceError("Conflicto de idempotencia al convertir el borrador en orden.")
        return locked_draft.converted_order

    if idempotency_key:
        existing_by_key = DraftOrder.objects.filter(conversion_idempotency_key=idempotency_key).exclude(pk=locked_draft.pk).first()
        if existing_by_key is not None:
            raise OMSServiceError("La clave de idempotencia ya fue utilizada en otro borrador de venta.")

    if locked_draft.status == DraftOrder.Status.CANCELLED:
        raise OMSServiceError("No se puede convertir un borrador cancelado.")

    now = timezone.now()
    if locked_draft.valid_until and locked_draft.valid_until <= now:
        cancel_or_expire_draft_order(
            locked_draft,
            mark_expired=True,
            reason="Expiración automática al intentar convertir propuesta vencida",
            actor=actor,
        )
        raise OMSServiceError("La propuesta comercial ha vencido y no puede convertirse en pedido.")

    draft_items = list(locked_draft.items.select_related("product", "variant").all())
    if not draft_items:
        raise OMSServiceError("El borrador no contiene productos para convertir.")

    # Calcular demanda física real (respetando STOCK, BUNDLE, PREORDER, ON_DEMAND)
    prepare_input = [
        {"product": it.product_id, "variant": it.variant_id, "quantity": it.quantity}
        for it in draft_items
    ]

    # Verificar si ya existen reservas temporales activas del borrador
    session_key = locked_draft.reservation_session_key or f"draft:{locked_draft.id}"
    active_draft_reservations = list(
        StockReservation.objects.select_for_update()
        .filter(
            order__isnull=True,
            session_key=session_key,
            status=StockReservation.Status.TEMPORARY,
        )
    )
    # Si alguna reserva temporal ya venció por TTL, liberarla antes de validar stock
    if active_draft_reservations and any(r.expires_at and r.expires_at <= now for r in active_draft_reservations):
        release_draft_order_reservations(
            locked_draft,
            reason="Liberación de reserva vencida previa a conversión",
            mark_expired=True,
            actor=actor,
        )
        active_draft_reservations = []

    if not active_draft_reservations:
        try:
            _, stock_demand = prepare_inventory(prepare_input)
        except InventoryError as exc:
            raise OMSServiceError(str(exc)) from exc
    else:
        stock_demand = {}
        for r in active_draft_reservations:
            k = f"variant:{r.variant_id}" if r.variant_id else str(r.product_id)
            stock_demand[k] = stock_demand.get(k, 0) + r.quantity

    eff_origin = origin_override or (
        Order.OrderOriginChoices.WHATSAPP
        if locked_draft.channel == DraftOrder.Channel.WHATSAPP
        else Order.OrderOriginChoices.MANUAL
    )
    eff_address = (shipping_address_override or locked_draft.shipping_address or "Por confirmar en despacho").strip()
    fulfillment_init = (
        Order.FulfillmentStatusChoices.ALLOCATED
        if stock_demand
        else Order.FulfillmentStatusChoices.UNFULFILLED
    )

    order = Order.objects.create(
        user=locked_draft.customer,
        email=locked_draft.customer_email,
        customer_name=locked_draft.customer_name,
        customer_phone=locked_draft.customer_phone,
        customer_tax_id=locked_draft.customer_tax_id,
        shipping_address=eff_address,
        notes=f"[{locked_draft.draft_number}] {locked_draft.notes}".strip(),
        total=locked_draft.total,
        currency=locked_draft.currency,
        status=OrderStatus.PENDING,
        commercial_status=Order.CommercialStatusChoices.CONFIRMED,
        financial_status=Order.FinancialStatusChoices.PENDING,
        fulfillment_status=fulfillment_init,
        order_origin=eff_origin,
        sales_rep=locked_draft.sales_rep or (actor if getattr(actor, "is_authenticated", False) else None),
        assigned_warehouse=locked_draft.warehouse or get_default_warehouse(),
        source_draft=locked_draft,
        stock_deductions={str(k): int(v) for k, v in stock_demand.items()},
    )

    # Crear OrderItems preservando el snapshot de precio autorizado de la propuesta (y descuento global proporcional si existe)
    disc_factor = (Decimal("100.00") - locked_draft.discount_percent) / Decimal("100.00")
    for dit in draft_items:
        unit_price = (dit.authorized_unit_price * disc_factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        OrderItem.objects.create(
            order=order,
            product=dit.product,
            variant=dit.variant,
            product_name=dit.product_name_snapshot,
            variant_name=dit.variant_name_snapshot,
            variant_sku=dit.sku_snapshot,
            price=unit_price,
            quantity=dit.quantity,
        )

    # Transferir reservas existentes del borrador a la orden (sin doble reserva) o crear nuevas si no tenía
    if active_draft_reservations:
        new_exp = now + timedelta(minutes=120)
        for res in active_draft_reservations:
            res.order = order
            res.expires_at = new_exp
            res.save(update_fields=["order", "expires_at", "updated_at"])
    elif stock_demand:
        try:
            reserve_stock_for_order(order, stock_demand, actor=actor)
        except InventoryServiceError as exc:
            raise OMSServiceError(str(exc)) from exc

    locked_draft.converted_order = order
    locked_draft.status = DraftOrder.Status.CONVERTED
    if idempotency_key:
        locked_draft.conversion_idempotency_key = idempotency_key
    locked_draft.save(update_fields=["converted_order", "status", "conversion_idempotency_key", "updated_at"])

    record_audit_event(
        module=MODULE_ORDERS,
        action="MANUAL_DRAFT_ORDER_CONVERTED",
        event_category=CATEGORY_ORDER_STATUS,
        resource_type="Order",
        resource_id=str(order.id),
        resource_repr=f"Orden #{order.id} desde {locked_draft.draft_number}",
        actor=actor,
        new_values={
            "order_id": str(order.id),
            "draft_id": str(locked_draft.id),
            "draft_number": locked_draft.draft_number,
            "total": str(order.total),
            "currency": order.currency,
            "origin": order.order_origin,
        },
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return order


# ═══════════════════════════════════════════════════════════════════════════
# 3. BF-12: WHATSAPP CHECKOUT (ENLACES SEGUROS FIRMADOS Y SANITIZADOS)
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def generate_whatsapp_checkout_link(
    draft: DraftOrder,
    *,
    expires_in_hours: int = 48,
    base_frontend_url: str = None,
    actor=None,
) -> dict:
    """
    BF-12: Genera un enlace HTTPS válido con token firmado criptográficamente (HMAC-SHA256 vía django.core.signing)
    y referencia opaca en BD, más el enlace de compartición wa.me.
    - NO incluye información financiera privada, direcciones, RUT, teléfono ni precios manipulables en parámetros de URL.
    - El enlace compartido NO equivale a un pago confirmado.
    """
    locked_draft = DraftOrder.objects.select_for_update().get(pk=draft.pk)
    if locked_draft.status in (DraftOrder.Status.CANCELLED, DraftOrder.Status.EXPIRED):
        raise OMSServiceError(f"No se puede generar enlace de checkout para un borrador en estado '{locked_draft.status}'.")

    now = timezone.now()
    exp_hours = max(1, int(expires_in_hours or 48))
    expires_at = now + timedelta(hours=exp_hours)
    if locked_draft.valid_until and locked_draft.valid_until < expires_at:
        locked_draft.valid_until = expires_at

    nonce = secrets.token_hex(4)
    signer = signing.Signer(salt=WHATSAPP_TOKEN_SALT)
    signed_token = signer.sign(f"{locked_draft.id.hex}.{nonce}")

    locked_draft.checkout_token = signed_token
    locked_draft.checkout_token_expires_at = expires_at
    locked_draft.whatsapp_shared_at = now
    if locked_draft.status in (DraftOrder.Status.DRAFT, DraftOrder.Status.PROPOSED, DraftOrder.Status.RESERVED):
        locked_draft.status = DraftOrder.Status.SHARED
    locked_draft.save(
        update_fields=[
            "checkout_token",
            "checkout_token_expires_at",
            "whatsapp_shared_at",
            "valid_until",
            "status",
            "updated_at",
        ]
    )

    base_url = (base_frontend_url or getattr(settings, "FRONTEND_URL", "") or "https://levelproaudio.cl").rstrip("/")
    if base_url.startswith("http://"):
        https_base = "https://" + base_url[len("http://"):]
    elif not base_url.startswith("https://"):
        https_base = f"https://{base_url}"
    else:
        https_base = base_url

    checkout_url = f"{https_base}/checkout/assisted/{urllib.parse.quote(signed_token, safe='')}"
    share_text = (
        f"Hola, te compartimos tu propuesta comercial LevelPro Audio ({locked_draft.draft_number}) "
        f"en {locked_draft.currency}. Revísala y continúa al checkout seguro aquí: {checkout_url}"
    )
    wa_me_url = f"https://wa.me/?text={urllib.parse.quote(share_text, safe='')}"

    record_audit_event(
        module=MODULE_ORDERS,
        action="WHATSAPP_CHECKOUT_LINK_GENERATED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="DraftOrder",
        resource_id=str(locked_draft.id),
        resource_repr=str(locked_draft),
        actor=actor,
        new_values={
            "draft_number": locked_draft.draft_number,
            "expires_at": expires_at.isoformat(),
            "status": locked_draft.status,
        },
        severity=SEVERITY_INFO,
        mandatory=True,
    )

    return {
        "draft_id": str(locked_draft.id),
        "draft_number": locked_draft.draft_number,
        "checkout_token": signed_token,
        "checkout_url": checkout_url,
        "wa_me_url": wa_me_url,
        "expires_at": expires_at.isoformat(),
        "currency": locked_draft.currency,
        "total": str(locked_draft.total),
        "status": locked_draft.status,
    }


def resolve_whatsapp_checkout_token(token: str) -> DraftOrder:
    """
    BF-12: Valida criptográficamente el token firmado, verifica su correspondencia en BD,
    vigencia temporal y estado del borrador.
    Rechaza tokens manipulados, revocados, expirados o cancelados.
    """
    if not token or not isinstance(token, str):
        raise OMSServiceError("Token de checkout inválido o vacío.")

    signer = signing.Signer(salt=WHATSAPP_TOKEN_SALT)
    try:
        raw_val = signer.unsign(token)
    except signing.BadSignature as exc:
        raise OMSServiceError("Enlace de checkout inválido o manipulado (firma criptográfica rechazada).") from exc

    raw_id = (raw_val.split(".", 1)[0] if "." in raw_val else "").strip()
    try:
        draft_id = str(uuid.UUID(raw_id))
    except Exception as exc:
        raise OMSServiceError("Payload de token de checkout incompleto.") from exc

    draft = DraftOrder.objects.prefetch_related("items__product", "items__variant").filter(
        pk=draft_id,
        checkout_token=token,
    ).first()
    if draft is None:
        raise OMSServiceError("El enlace de checkout no existe o fue reemplazado por una versión más reciente.")

    now = timezone.now()
    if (
        (draft.checkout_token_expires_at and draft.checkout_token_expires_at <= now)
        or (draft.valid_until and draft.valid_until <= now)
        or draft.status == DraftOrder.Status.EXPIRED
    ):
        raise OMSServiceError("El enlace de la propuesta comercial ha expirado.")

    if draft.status == DraftOrder.Status.CANCELLED:
        raise OMSServiceError("Esta propuesta comercial fue cancelada.")

    return draft


def serialize_public_whatsapp_proposal(draft: DraftOrder) -> dict:
    """
    BF-12: Resumen público sanitizado de la propuesta comercial para continuar al checkout.
    PROHIBIDO exponer PII sensible del cliente (email, teléfono, dirección, RUT/CUIT),
    notas internas ni costos/márgenes de la empresa.
    """
    items_summary = []
    for it in draft.items.all():
        avail = _get_sellable_available(
            it.product,
            it.variant,
            legacy_stock=(it.variant.stock if it.variant else it.product.stock),
        )
        items_summary.append({
            "id": str(it.id),
            "product_id": str(it.product_id),
            "variant_id": str(it.variant_id) if it.variant_id else None,
            "sku": it.sku_snapshot,
            "product_name": it.product_name_snapshot,
            "variant_name": it.variant_name_snapshot,
            "product_type": it.product_type_snapshot,
            "quantity": it.quantity,
            "unit_price": str(it.authorized_unit_price),
            "subtotal": str(it.subtotal),
            "currency": it.currency,
            "is_available": (
                True
                if it.product_type_snapshot in (Product.ProductType.PREORDER, Product.ProductType.ON_DEMAND)
                or draft.reserve_inventory
                else avail >= it.quantity
            ),
        })

    return {
        "draft_number": draft.draft_number,
        "status": draft.status,
        "currency": draft.currency,
        "subtotal": str(draft.subtotal),
        "discount_percent": str(draft.discount_percent),
        "discount_amount": str(draft.discount_amount),
        "total": str(draft.total),
        "valid_until": draft.valid_until.isoformat() if draft.valid_until else None,
        "expires_at": draft.checkout_token_expires_at.isoformat() if draft.checkout_token_expires_at else None,
        "notes": draft.notes,
        "terms": draft.terms_snapshot,
        "reserve_inventory": draft.reserve_inventory,
        "converted_order_id": str(draft.converted_order_id) if draft.converted_order_id else None,
        "items": items_summary,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 4. BF-13: TRANSICIONES MULTIDIMENSIONALES Y PREPARACIÓN / DESPACHO OMS
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def transition_order_dimensions(
    order: Order,
    *,
    commercial_status: str = None,
    financial_status: str = None,
    fulfillment_status: str = None,
    serial_assignments: dict = None,
    shipping_carrier: str = None,
    tracking_number: str = None,
    reason: str = "",
    actor=None,
) -> Order:
    """
    BF-13: Ejecuta una transición verificada sobre una o más de las tres dimensiones del pedido
    (Comercial, Financiero, Logístico) respetando:
    - OrderStateContract (matrices de transición y reglas transversales).
    - Segregación RBAC por dimensión (approve_payments para financiero, ventas/gerencia para comercial,
      logística/bodega/gerencia para despacho).
    - Una cancelación comercial NO ejecuta reembolso automático ni devolución física automática.
    - Si pasa a PAID: consolida reservas (o bloquea si la reserva ya expiró, exigiendo revisión empresarial).
    - Si pasa a SHIPPED: ejecuta dispatch_order_reservations() de forma idempotente y congela COGS.
    """
    locked_order = Order.objects.select_for_update().get(pk=order.pk)
    prev_contract = OrderStateContract(
        commercial=CommercialStatus(locked_order.commercial_status),
        financial=FinancialStatus(locked_order.financial_status),
        fulfillment=FulfillmentStatus(locked_order.fulfillment_status),
    )

    tgt_c = CommercialStatus(commercial_status) if commercial_status else None
    tgt_f = FinancialStatus(financial_status) if financial_status else None
    tgt_l = FulfillmentStatus(fulfillment_status) if fulfillment_status else None

    # Validación RBAC por eje
    if actor is not None and not is_effective_super_admin(actor):
        if tgt_f and tgt_f != prev_contract.financial:
            if not user_has_capability(actor, PERM_APPROVE_PAYMENTS) and not user_has_capability(actor, PERM_MANAGE_FINANCES):
                raise OMSPermissionError(
                    "No posee autorización ('approve_payments') para modificar el estado financiero de la orden."
                )

    # Validar contrato tri-dimensional
    # Nota especial BF-13: Si se cancela comercialmente una orden que ya fue despachada o pagada,
    # una cancelación comercial NO revierte automáticamente el pago ni el despacho físico,
    # pero no se permite cancelar comercialmente sin RMA si ya fue entregada.
    try:
        new_contract = prev_contract.transition_to(
            commercial=tgt_c,
            financial=tgt_f,
            fulfillment=tgt_l,
        )
    except StateTransitionError as exc:
        raise OMSServiceError(str(exc)) from exc

    # Efectos operativos coordinados por dimensión:
    # A) Transición Comercial a CANCELLED
    if tgt_c == CommercialStatus.CANCELLED and prev_contract.commercial != CommercialStatus.CANCELLED:
        # Si aún no fue despachada físicamente, liberar reservas activas (sin reembolsar pagos aprobados automáticamente)
        if prev_contract.fulfillment in (FulfillmentStatus.UNFULFILLED, FulfillmentStatus.ALLOCATED):
            release_order_reservations(
                locked_order,
                reason=reason or "Liberación por cancelación comercial de orden",
                actor=actor,
            )
            new_contract = OrderStateContract(
                commercial=CommercialStatus.CANCELLED,
                financial=new_contract.financial,
                fulfillment=FulfillmentStatus.UNFULFILLED,
            )

    # B) Transición Financiera a PAID
    if tgt_f == FinancialStatus.PAID and prev_contract.financial != FinancialStatus.PAID:
        has_expired = StockReservation.objects.filter(
            order=locked_order, status=StockReservation.Status.EXPIRED
        ).exists()
        has_active = StockReservation.objects.filter(
            order=locked_order,
            status__in=[StockReservation.Status.TEMPORARY, StockReservation.Status.CONSOLIDATED],
        ).exists()
        if has_expired and not has_active:
            raise OMSServiceError(
                "La reserva de inventario de esta orden expiró; el pago debe derivarse a revisión empresarial (IN_REVIEW)."
            )
        consolidate_order_reservations(locked_order, actor=actor)

    # C) Transición Logística a SHIPPED
    if tgt_l == FulfillmentStatus.SHIPPED and prev_contract.fulfillment != FulfillmentStatus.SHIPPED:
        consolidate_order_reservations(locked_order, actor=actor)
        try:
            dispatch_order_reservations(
                locked_order,
                serial_assignments=serial_assignments,
                actor=actor,
            )
        except InventoryServiceError as exc:
            raise OMSServiceError(str(exc)) from exc

    locked_order.commercial_status = new_contract.commercial.value
    locked_order.financial_status = new_contract.financial.value
    locked_order.fulfillment_status = new_contract.fulfillment.value
    locked_order.status = new_contract.to_legacy_status()

    update_fields = [
        "commercial_status",
        "financial_status",
        "fulfillment_status",
        "status",
        "updated_at",
    ]
    if shipping_carrier is not None:
        locked_order.shipping_carrier = shipping_carrier.strip()
        update_fields.append("shipping_carrier")
    if tracking_number is not None:
        locked_order.tracking_number = tracking_number.strip()
        update_fields.append("tracking_number")

    # Usar queryset.update + refresh o super save con los 3 ejes ya incluidos para no re-ejecutar hooks legacy redundantes
    Order.objects.filter(pk=locked_order.pk).update(
        commercial_status=locked_order.commercial_status,
        financial_status=locked_order.financial_status,
        fulfillment_status=locked_order.fulfillment_status,
        status=locked_order.status,
        shipping_carrier=locked_order.shipping_carrier,
        tracking_number=locked_order.tracking_number,
        updated_at=timezone.now(),
    )

    # Si pasó a PAID, asegurar creación de IncomeRecord (las distribuciones de costo esperan al despacho según OMS-PF-03)
    if tgt_f == FinancialStatus.PAID and not IncomeRecord.objects.filter(order=locked_order).exists():
        if locked_order.total and locked_order.total > Decimal("0"):
            rec = IncomeRecord.objects.create(
                order=locked_order,
                payment=locked_order.payments.filter(status=PaymentStatus.APPROVED).first(),
                amount=locked_order.total,
                currency=locked_order.currency,
                description=f"Venta — Orden #{str(locked_order.id)[:8].upper()}",
                source="payment",
            )
            rec.create_distributions()

    record_audit_event(
        module=MODULE_ORDERS,
        action="ORDER_3D_STATE_TRANSITION",
        event_category=CATEGORY_ORDER_STATUS,
        resource_type="Order",
        resource_id=str(locked_order.id),
        resource_repr=f"Orden #{locked_order.id}",
        actor=actor,
        previous_values=prev_contract.to_dict(),
        new_values=new_contract.to_dict(),
        metadata={"reason": reason},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked_order


@transaction.atomic
def record_order_payment_attempt(
    order: Order,
    *,
    provider: str,
    amount,
    currency: str = None,
    external_id: str = "",
    approve_immediately: bool = False,
    actor=None,
) -> dict:
    """
    Sección 8: Gestión de intentos de pago con:
    - Idempotencia por external_id (pagos duplicados no crean cobros ni IncomeRecord duplicados).
    - Pagos tardíos sobre órdenes canceladas o con reserva expirada -> PaymentStatus.IN_REVIEW
      sin reabrir la orden ni regenerar inventario automáticamente.
    - Pagos parciales -> Order.financial_status = PARTIALLY_PAID (mantiene orden no despachable hasta cubrir 100%).
    - Pago total -> Order.financial_status = PAID y consolida reservas activas.
    """
    locked_order = Order.objects.select_for_update().get(pk=order.pk)
    pay_curr = (currency or locked_order.currency or "CLP").strip().upper()
    if pay_curr != (locked_order.currency or "CLP").strip().upper():
        raise OMSServiceError(
            f"Inconsistencia monetaria: la orden está en '{locked_order.currency}' y el pago en '{pay_curr}'."
        )

    pay_amt = _to_dec(amount, "amount", allow_zero=False).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    ext_id = (external_id or "").strip()

    # 1. Deduplicación idempotente por external_id
    if ext_id:
        existing = Payment.objects.filter(order=locked_order, provider=provider, external_id=ext_id).first()
        if existing is not None:
            return {
                "payment": existing,
                "order": locked_order,
                "is_duplicate": True,
                "financial_status": locked_order.financial_status,
                "payment_status": existing.status,
            }

    target_pay_status = PaymentStatus.APPROVED if approve_immediately else PaymentStatus.PENDING

    # 2. Verificar si la orden está cancelada o su reserva ya expiró
    has_expired_res = StockReservation.objects.filter(
        order=locked_order, status=StockReservation.Status.EXPIRED
    ).exists()
    has_active_res = StockReservation.objects.filter(
        order=locked_order,
        status__in=[StockReservation.Status.TEMPORARY, StockReservation.Status.CONSOLIDATED],
    ).exists()

    is_late_or_expired_conflict = (
        locked_order.commercial_status == Order.CommercialStatusChoices.CANCELLED
        or locked_order.status == OrderStatus.CANCELLED
        or (has_expired_res and not has_active_res)
    )

    if approve_immediately and is_late_or_expired_conflict:
        target_pay_status = PaymentStatus.IN_REVIEW

    payment = Payment.objects.create(
        order=locked_order,
        provider=provider,
        status=target_pay_status,
        amount=pay_amt,
        currency=pay_curr,
        external_id=ext_id,
        paid_at=timezone.now() if target_pay_status == PaymentStatus.APPROVED else None,
    )
    # Refresh in case Payment.save() downgraded status to IN_REVIEW
    payment.refresh_from_db()
    locked_order.refresh_from_db()

    if payment.status == PaymentStatus.IN_REVIEW:
        record_audit_event(
            module=MODULE_FINANCES,
            action="PAYMENT_FLAGGED_IN_REVIEW",
            event_category=CATEGORY_PAYMENT_OPERATION,
            resource_type="Payment",
            resource_id=str(payment.id),
            resource_repr=str(payment),
            actor=actor,
            new_values={
                "order_id": str(locked_order.id),
                "payment_status": payment.status,
                "order_commercial_status": locked_order.commercial_status,
                "has_expired_reservation": has_expired_res,
            },
            severity=SEVERITY_HIGH,
            mandatory=True,
        )
        return {
            "payment": payment,
            "order": locked_order,
            "is_duplicate": False,
            "financial_status": locked_order.financial_status,
            "payment_status": payment.status,
        }

    if payment.status == PaymentStatus.APPROVED:
        total_approved = (
            locked_order.payments.filter(status=PaymentStatus.APPROVED).aggregate(t=Sum("amount"))["t"]
            or Decimal("0.00")
        )
        # Crear IncomeRecord por este pago parcial o total sin duplicar
        if not IncomeRecord.objects.filter(payment=payment).exists():
            # Si el signal post_save de Payment creó un IncomeRecord por el total de la orden en un pago parcial,
            # ajustarlo al monto real de este pago parcial.
            sig_rec = IncomeRecord.objects.filter(order=locked_order, payment=payment).first()
            if sig_rec is not None and sig_rec.amount != pay_amt:
                sig_rec.amount = pay_amt
                sig_rec.save(update_fields=["amount", "updated_at"])
                sig_rec.distributions.all().delete()
                sig_rec.create_distributions()
        else:
            sig_rec = IncomeRecord.objects.filter(payment=payment).first()
            if sig_rec and sig_rec.amount != pay_amt:
                sig_rec.amount = pay_amt
                sig_rec.save(update_fields=["amount", "updated_at"])
                sig_rec.distributions.all().delete()
                sig_rec.create_distributions()

        if total_approved >= locked_order.total:
            consolidate_order_reservations(locked_order, actor=actor)
            locked_order.financial_status = Order.FinancialStatusChoices.PAID
            if locked_order.status == OrderStatus.PENDING:
                locked_order.status = OrderStatus.PAID
            Order.objects.filter(pk=locked_order.pk).update(
                financial_status=locked_order.financial_status,
                status=locked_order.status,
                updated_at=timezone.now(),
            )
        elif total_approved > Decimal("0.00"):
            locked_order.financial_status = Order.FinancialStatusChoices.PARTIALLY_PAID
            Order.objects.filter(pk=locked_order.pk).update(
                financial_status=locked_order.financial_status,
                updated_at=timezone.now(),
            )

    return {
        "payment": payment,
        "order": locked_order,
        "is_duplicate": False,
        "financial_status": locked_order.financial_status,
        "payment_status": payment.status,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 5. BF-23: DEVOLUCIONES Y REEMBOLSOS (RMA, INSPECCIÓN Y COSTOS COMPENSATORIOS)
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def create_rma_request(
    *,
    order: Order,
    items: list[dict],
    reason_code: str = ReturnMerchandiseAuthorization.ReasonCode.DEFECTIVE,
    reason_details: str = "",
    warehouse: Warehouse = None,
    notes: str = "",
    actor=None,
) -> ReturnMerchandiseAuthorization:
    """
    BF-23 (Etapa 1): Crea una solicitud formal de devolución (RMA) en estado REQUESTED.
    - Valida que las líneas pertenezcan a la orden y que las cantidades o seriales no hayan sido
      devueltos previamente en otro RMA activo/completado.
    - NO altera existencias físicas ni ejecuta reembolsos al solicitarse.
    """
    locked_order = Order.objects.select_for_update().get(pk=order.pk)
    if locked_order.fulfillment_status not in (
        Order.FulfillmentStatusChoices.SHIPPED,
        Order.FulfillmentStatusChoices.DELIVERED,
        Order.FulfillmentStatusChoices.PARTIALLY_SHIPPED,
        Order.FulfillmentStatusChoices.RETURNED,
    ) and locked_order.status not in (OrderStatus.SHIPPED, OrderStatus.COMPLETED):
        raise OMSServiceError(
            "Solo se pueden crear solicitudes RMA para órdenes que ya han sido despachadas físicamente."
        )

    if not items or not isinstance(items, list):
        raise OMSServiceError("Debe especificar al menos una línea de producto para solicitar RMA.")

    target_wh = warehouse or locked_order.assigned_warehouse or get_default_warehouse()
    validated_rma_lines = []

    for idx, raw in enumerate(items):
        oi_id = raw.get("order_item_id") or raw.get("order_item")
        oi = OrderItem.objects.select_related("product", "variant").filter(pk=oi_id, order=locked_order).first()
        if oi is None:
            raise OMSServiceError(f"La línea #{idx + 1} no pertenece a la orden #{locked_order.id}.")
        if oi.product is None:
            raise OMSServiceError(f"El producto de la línea '{oi.product_name}' ya no existe.")

        qty_req = int(raw.get("quantity_requested") or raw.get("quantity") or 1)
        if qty_req <= 0:
            raise OMSServiceError("La cantidad a devolver debe ser mayor que cero.")

        # Verificar cantidad previamente devuelta o en trámite para este OrderItem
        already_requested = (
            RMAItem.objects.filter(order_item=oi)
            .exclude(
                rma__status__in=[
                    ReturnMerchandiseAuthorization.Status.REJECTED,
                    ReturnMerchandiseAuthorization.Status.CANCELLED,
                ]
            )
            .aggregate(t=Sum("quantity_requested"))["t"]
            or 0
        )
        if already_requested + qty_req > oi.quantity:
            raise OMSServiceError(
                f"La cantidad solicitada para '{oi.product_name}' ({qty_req}) supera las unidades "
                f"elegibles de la compra (compradas={oi.quantity}, ya en RMA={already_requested})."
            )

        sn = (raw.get("serial_number") or "").strip()
        if oi.product.serialization_mode == Product.SerializationMode.REQUIRED:
            if not sn:
                raise OMSServiceError(
                    f"El producto serializado '{oi.product_name}' requiere indicar el número de serie exacto a devolver."
                )
            if qty_req != 1:
                raise OMSServiceError(
                    "Para equipos serializados obligatorios, cada línea RMA debe corresponder a 1 unidad con su serial."
                )

        if sn:
            # Validar que el serial haya sido despachado en esta orden y no haya sido ya devuelto
            if oi.allocated_serial_numbers and sn not in oi.allocated_serial_numbers:
                raise OMSServiceError(
                    f"El número de serie '{sn}' no figura entre los seriales despachados en esta línea ({oi.allocated_serial_numbers})."
                )
            dup_sn_rma = (
                RMAItem.objects.filter(product=oi.product, variant=oi.variant, serial_number=sn)
                .exclude(
                    rma__status__in=[
                        ReturnMerchandiseAuthorization.Status.REJECTED,
                        ReturnMerchandiseAuthorization.Status.CANCELLED,
                    ]
                )
                .exists()
            )
            if dup_sn_rma:
                raise OMSServiceError(
                    f"El número de serie '{sn}' ya posee una devolución RMA registrada o en curso."
                )

        sku_snap = oi.variant_sku or (oi.variant.sku if oi.variant else (oi.product.sku or ""))
        validated_rma_lines.append({
            "order_item": oi,
            "product": oi.product,
            "variant": oi.variant,
            "sku_snapshot": sku_snap,
            "serial_number": sn,
            "quantity_requested": qty_req,
            "original_unit_cost_snapshot": oi.unit_cost_snapshot,
            "cost_currency": oi.cost_currency or locked_order.currency,
        })

    rma = ReturnMerchandiseAuthorization.objects.create(
        rma_number=_next_oms_code(ReturnMerchandiseAuthorization, "rma_number", "RMA"),
        order=locked_order,
        status=ReturnMerchandiseAuthorization.Status.REQUESTED,
        reason_code=reason_code if reason_code in ReturnMerchandiseAuthorization.ReasonCode.values else ReturnMerchandiseAuthorization.ReasonCode.DEFECTIVE,
        reason_details=(reason_details or "").strip(),
        warehouse=target_wh,
        refund_currency=locked_order.currency,
        requested_by=actor if getattr(actor, "is_authenticated", False) else None,
        notes=(notes or "").strip(),
    )

    for ln in validated_rma_lines:
        RMAItem.objects.create(rma=rma, **ln)

    record_audit_event(
        module=MODULE_ORDERS,
        action="RMA_REQUEST_CREATED",
        event_category=CATEGORY_CREATION,
        resource_type="ReturnMerchandiseAuthorization",
        resource_id=str(rma.id),
        resource_repr=str(rma),
        actor=actor,
        new_values={
            "rma_number": rma.rma_number,
            "order_id": str(locked_order.id),
            "reason_code": rma.reason_code,
            "items_count": len(validated_rma_lines),
        },
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return rma


@transaction.atomic
def authorize_or_reject_rma(
    rma: ReturnMerchandiseAuthorization,
    *,
    approve: bool,
    notes: str = "",
    actor=None,
) -> ReturnMerchandiseAuthorization:
    """
    BF-23 (Etapa 2): Autoriza o rechaza comercialmente el retorno de mercadería.
    Sigue sin modificar WarehouseStock hasta que el equipo llegue físicamente y sea inspeccionado.
    """
    locked_rma = ReturnMerchandiseAuthorization.objects.select_for_update().get(pk=rma.pk)
    if locked_rma.status != ReturnMerchandiseAuthorization.Status.REQUESTED:
        raise OMSServiceError(f"Solo se puede autorizar o rechazar un RMA en estado 'requested' (actual: '{locked_rma.status}').")

    now = timezone.now()
    locked_rma.status = (
        ReturnMerchandiseAuthorization.Status.AUTHORIZED
        if approve
        else ReturnMerchandiseAuthorization.Status.REJECTED
    )
    locked_rma.authorized_by = actor if getattr(actor, "is_authenticated", False) else None
    locked_rma.authorized_at = now
    if notes:
        locked_rma.notes = f"{locked_rma.notes}\n{notes}".strip()
    locked_rma.save(update_fields=["status", "authorized_by", "authorized_at", "notes", "updated_at"])

    record_audit_event(
        module=MODULE_ORDERS,
        action="RMA_AUTHORIZED" if approve else "RMA_REJECTED",
        event_category=CATEGORY_ORDER_STATUS,
        resource_type="ReturnMerchandiseAuthorization",
        resource_id=str(locked_rma.id),
        resource_repr=str(locked_rma),
        actor=actor,
        new_values={"status": locked_rma.status, "notes": notes},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked_rma


@transaction.atomic
def receive_and_inspect_rma(
    rma: ReturnMerchandiseAuthorization,
    *,
    inspections: list[dict],
    warehouse: Warehouse = None,
    notes: str = "",
    idempotency_key: str = None,
    actor=None,
) -> ReturnMerchandiseAuthorization:
    """
    BF-23 & Sección 11 (Etapas 3, 4 y 5): Recepción física en bodega, inspección técnica y
    reincorporación controlada al inventario con movimientos compensatorios de Kardex y Costos.
    - Requiere que el RMA esté AUTHORIZED (o RECEIVED/INSPECTED pendiente de restock).
    - Bloquea doble recepción/reingreso de la misma línea o del mismo serial (`is_restocked=True`).
    - Producto apto (`SELLABLE_GOOD` + `RESTOCK_SELLABLE`):
      Incrementa `physical_quantity` (vendible) en `WarehouseStock` vía `RETURN_IN`,
      pasa `SerialNumberTrack` a `IN_STOCK`, restaura `SerialCostUnit` (`is_consumed=False`)
      o reingresa al pool `WeightedAverageCostState` a su costo histórico de salida sin generar utilidad ficticia,
      y crea una capa compensatoria `CostLayer(source_document_type='RMA_RETURN')` para preservar paridad WAC/FIFO.
    - Producto dañado (`DAMAGED_NON_SELLABLE` / `DEFECTIVE_WARRANTY` + `RESTOCK_DAMAGED_QUARANTINE`):
      Incrementa `physical_quantity` y `non_sellable_quantity` simultáneamente (disponible para venta = +0),
      marca `SerialNumberTrack` como `DAMAGED` (no elegible para venta), marca `SerialCostUnit(is_damaged=True)`
      y registra en pool WAC como `damaged_quantity` / `damaged_value`.
    """
    locked_rma = ReturnMerchandiseAuthorization.objects.select_for_update().get(pk=rma.pk)
    allowed_statuses = [
        ReturnMerchandiseAuthorization.Status.AUTHORIZED,
        ReturnMerchandiseAuthorization.Status.RECEIVED,
        ReturnMerchandiseAuthorization.Status.INSPECTED,
    ]
    if idempotency_key:
        allowed_statuses.append(ReturnMerchandiseAuthorization.Status.RESTOCKED)

    if locked_rma.status not in allowed_statuses:
        raise OMSServiceError(
            f"El RMA debe estar autorizado antes de recibir e inspeccionar físicamente (estado actual: '{locked_rma.status}')."
        )

    target_wh = warehouse or locked_rma.warehouse or get_default_warehouse()
    if locked_rma.warehouse_id != target_wh.id:
        locked_rma.warehouse = target_wh

    now = timezone.now()
    insp_by_item_id = {str(x.get("rma_item_id") or x.get("id")): x for x in (inspections or [])}
    rma_items = list(locked_rma.items.select_for_update().all())

    any_restocked = False
    for rma_item in rma_items:
        spec = insp_by_item_id.get(str(rma_item.id))
        if spec is None and len(inspections or []) == 1 and len(rma_items) == 1:
            spec = inspections[0]
        if spec is None:
            continue

        qty_rec = int(spec.get("quantity_received", rma_item.quantity_requested))
        if qty_rec <= 0 or qty_rec > rma_item.quantity_requested:
            raise OMSServiceError(
                f"La cantidad recibida ({qty_rec}) para '{rma_item.sku_snapshot}' debe estar entre 1 y {rma_item.quantity_requested}."
            )

        cond = str(spec.get("condition_status") or RMAItem.ConditionStatus.SELLABLE_GOOD).strip()
        if cond not in RMAItem.ConditionStatus.values:
            raise OMSServiceError(f"Condición de inspección inválida: '{cond}'.")

        decision = str(
            spec.get("restock_decision")
            or (
                RMAItem.RestockDecision.RESTOCK_SELLABLE
                if cond == RMAItem.ConditionStatus.SELLABLE_GOOD
                else RMAItem.RestockDecision.RESTOCK_DAMAGED_QUARANTINE
            )
        ).strip()
        if decision not in RMAItem.RestockDecision.values:
            raise OMSServiceError(f"Decisión de inventario inválida: '{decision}'.")

        if rma_item.is_restocked:
            if (
                idempotency_key
                and rma_item.quantity_received == qty_rec
                and rma_item.condition_status == cond
                and rma_item.restock_decision == decision
            ):
                continue
            raise OMSServiceError(
                f"La línea RMA '{rma_item.sku_snapshot}' ya fue recibida y reincorporada al inventario. Prohibido duplicar entrada física."
            )

        # Regla crítica BF-23: Un producto dañado o defectuoso JAMÁS puede reingresar a stock vendible
        if cond in (RMAItem.ConditionStatus.DAMAGED_NON_SELLABLE, RMAItem.ConditionStatus.DEFECTIVE_WARRANTY):
            if decision == RMAItem.RestockDecision.RESTOCK_SELLABLE:
                raise OMSServiceError(
                    f"Invariante de calidad: el producto '{rma_item.sku_snapshot}' fue inspeccionado como '{cond}' "
                    f"y no puede reincorporarse como stock vendible."
                )

        is_damaged = (
            cond in (RMAItem.ConditionStatus.DAMAGED_NON_SELLABLE, RMAItem.ConditionStatus.DEFECTIVE_WARRANTY)
            or decision == RMAItem.RestockDecision.RESTOCK_DAMAGED_QUARANTINE
        )

        rma_item.quantity_received = qty_rec
        rma_item.condition_status = cond
        rma_item.restock_decision = decision
        rma_item.inspection_notes = str(spec.get("inspection_notes") or "").strip()

        if decision in (RMAItem.RestockDecision.RESTOCK_SELLABLE, RMAItem.RestockDecision.RESTOCK_DAMAGED_QUARANTINE):
            qty_dmg = qty_rec if is_damaged else 0
            qty_sell = 0 if is_damaged else qty_rec
            rma_item.quantity_accepted_sellable = qty_sell
            rma_item.quantity_damaged_non_sellable = qty_dmg

            sn_list = [rma_item.serial_number] if rma_item.serial_number else []
            dmg_sn_list = [rma_item.serial_number] if (rma_item.serial_number and is_damaged) else []

            # 1. Entrada física controlada en WMS y Kardex (RETURN_IN)
            try:
                _, mov = receive_stock_into_warehouse(
                    warehouse=target_wh,
                    product=rma_item.product,
                    variant=rma_item.variant,
                    quantity=qty_rec,
                    quantity_damaged=qty_dmg,
                    serial_numbers=sn_list,
                    damaged_serial_numbers=dmg_sn_list,
                    movement_type=InventoryMovement.MovementType.RETURN_IN,
                    reason=f"Retorno físico inspeccionado {locked_rma.rma_number} ({cond})",
                    source_document_type="RMA",
                    source_document_id=str(locked_rma.id),
                    actor=actor,
                    idempotency_key=f"rma_return_in:{locked_rma.id}:{rma_item.id}",
                )
            except InventoryServiceError as exc:
                raise OMSServiceError(str(exc)) from exc

            # Si el serial era OPTIONAL (no REQUIRED), adjust_stock no actualizó SerialNumberTrack automáticamente:
            if rma_item.serial_number and rma_item.product.serialization_mode != Product.SerializationMode.REQUIRED:
                sn_track = SerialNumberTrack.objects.select_for_update().filter(
                    product=rma_item.product,
                    variant=rma_item.variant,
                    serial_number=rma_item.serial_number,
                ).first()
                if sn_track is not None:
                    if sn_track.status != SerialNumberTrack.Status.DISPATCHED:
                        raise OMSServiceError(
                            f"El número de serie '{rma_item.serial_number}' no se encuentra en estado despachado."
                        )
                    sn_track.status = (
                        SerialNumberTrack.Status.DAMAGED if is_damaged else SerialNumberTrack.Status.IN_STOCK
                    )
                    sn_track.warehouse = target_wh
                    sn_track.order = None
                    sn_track.reservation = None
                    sn_track.notes = f"Devuelto vía {locked_rma.rma_number} ({cond})"[:255]
                    sn_track.save(update_fields=["status", "warehouse", "order", "reservation", "notes", "updated_at"])

            # 2. Integración Compensatoria con Capas de Costos, SerialCostUnit y WAC (Sección 11)
            # No se borra jamás el CostConsumptionRecord original; se crea o restaura capacidad mediante compensación.
            hist_unit_cost = (
                rma_item.original_unit_cost_snapshot
                or rma_item.order_item.unit_cost_snapshot
                or (rma_item.variant.effective_cost_price if rma_item.variant else rma_item.product.cost_price)
                or Decimal("0.0000")
            )
            hist_unit_cost = Decimal(str(hist_unit_cost)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            cost_curr = (
                rma_item.cost_currency
                or rma_item.order_item.cost_currency
                or locked_rma.order.currency
                or "CLP"
            ).strip().upper()

            comp_layer = None
            if rma_item.serial_number:
                scu = SerialCostUnit.objects.select_for_update().filter(
                    product=rma_item.product,
                    variant=rma_item.variant,
                    serial_number_snapshot=rma_item.serial_number,
                ).first()
                if scu is not None:
                    hist_unit_cost = scu.landed_unit_cost
                    cost_curr = scu.valuation_currency
                    scu.is_damaged = is_damaged
                    scu.is_consumed = is_damaged  # Si vuelve apto para venta, puede volver a despacharse; si vuelve dañado, queda bloqueado
                    scu.save(update_fields=["is_damaged", "is_consumed", "updated_at"])

            # Crear capa compensatoria de retorno (append-only trace) referenciando al RMA y movimiento RETURN_IN
            sku_reg = SkuRegistry.objects.filter(product=rma_item.product, variant=rma_item.variant).first()
            tot_layer_cost = (hist_unit_cost * Decimal(qty_rec)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            rem_layer_val = (hist_unit_cost * Decimal(qty_sell)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            method = (
                CostLayer.CostingMethod.SPECIFIC_SERIAL
                if rma_item.serial_number
                else CostLayer.CostingMethod.WEIGHTED_AVERAGE
            )

            comp_layer = CostLayer.objects.create(
                layer_code=_next_oms_code(CostLayer, "layer_code", "CLRMA"),
                costing_method=method,
                status=CostLayer.Status.FINALIZED if qty_sell > 0 else CostLayer.Status.DEPLETED,
                product=rma_item.product,
                variant=rma_item.variant,
                sku_registry=sku_reg,
                sku_snapshot=rma_item.sku_snapshot,
                warehouse=target_wh,
                inventory_movement=mov,
                source_document_type="RMA_RETURN",
                source_document_id=str(locked_rma.id),
                effective_date=now,
                acquisition_currency=cost_curr,
                valuation_currency=cost_curr,
                quantity_received=qty_rec,
                quantity_damaged=qty_dmg,
                quantity_available=qty_sell,
                quantity_consumed=0,
                original_unit_cost=hist_unit_cost,
                base_unit_cost=hist_unit_cost,
                allocated_expenses_total=Decimal("0.00"),
                unit_allocated_expense=Decimal("0.0000"),
                landed_unit_cost=hist_unit_cost,
                total_layer_cost=tot_layer_cost,
                remaining_layer_value=rem_layer_val,
                serial_numbers=sn_list,
                is_finalized=True,
                finalized_at=now,
                finalized_by=actor if getattr(actor, "is_authenticated", False) else None,
            )

            if rma_item.serial_number:
                scu = SerialCostUnit.objects.select_for_update().filter(
                    product=rma_item.product,
                    variant=rma_item.variant,
                    serial_number_snapshot=rma_item.serial_number,
                ).first()
                if scu is not None:
                    scu.cost_layer = comp_layer
                    scu.save(update_fields=["cost_layer", "updated_at"])

            # Reincorporar valor al pool WAC a su costo histórico de salida (vendible o dañado)
            record_wac_physical_return(
                product=rma_item.product,
                variant=rma_item.variant,
                currency=cost_curr,
                quantity=qty_rec,
                returned_unit_cost=hist_unit_cost,
                is_damaged=is_damaged,
            )

            rma_item.original_unit_cost_snapshot = hist_unit_cost
            rma_item.cost_currency = cost_curr
            rma_item.return_inventory_movement = mov
            rma_item.compensatory_cost_layer = comp_layer
            rma_item.is_restocked = True
            any_restocked = True

        rma_item.save()

    locked_rma.received_by = locked_rma.received_by or (actor if getattr(actor, "is_authenticated", False) else None)
    locked_rma.inspected_by = actor if getattr(actor, "is_authenticated", False) else None
    locked_rma.received_at = locked_rma.received_at or now
    locked_rma.inspected_at = now
    if any_restocked:
        locked_rma.restocked_at = now
        locked_rma.status = ReturnMerchandiseAuthorization.Status.RESTOCKED
    elif locked_rma.status != ReturnMerchandiseAuthorization.Status.RESTOCKED:
        locked_rma.status = ReturnMerchandiseAuthorization.Status.INSPECTED
    if notes:
        locked_rma.notes = f"{locked_rma.notes}\n{notes}".strip()
    locked_rma.save()

    # Verificar si todas las unidades de la orden fueron devueltas físicamente
    order = Order.objects.select_for_update().get(pk=locked_rma.order_id)
    total_ordered_qty = sum(it.quantity for it in order.items.all())
    total_returned_qty = (
        RMAItem.objects.filter(
            rma__order=order,
            is_restocked=True,
        ).aggregate(t=Sum("quantity_received"))["t"]
        or 0
    )
    if total_returned_qty >= total_ordered_qty and total_ordered_qty > 0:
        order.fulfillment_status = Order.FulfillmentStatusChoices.RETURNED
        Order.objects.filter(pk=order.pk).update(
            fulfillment_status=order.fulfillment_status,
            updated_at=now,
        )

    record_audit_event(
        module=MODULE_INVENTORY,
        action="RMA_PHYSICAL_INSPECTION_AND_RESTOCK",
        event_category=CATEGORY_STOCK_ADJUSTMENT,
        resource_type="ReturnMerchandiseAuthorization",
        resource_id=str(locked_rma.id),
        resource_repr=str(locked_rma),
        actor=actor,
        new_values={
            "rma_number": locked_rma.rma_number,
            "status": locked_rma.status,
            "warehouse": target_wh.code,
            "any_restocked": any_restocked,
        },
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked_rma


@transaction.atomic
def resolve_rma_refund(
    rma: ReturnMerchandiseAuthorization,
    *,
    refund_amount,
    execute_now: bool = False,
    provider: str = "",
    reference: str = "",
    idempotency_key: str = None,
    notes: str = "",
    actor=None,
) -> ReturnMerchandiseAuthorization:
    """
    BF-23 (Etapa 6): Resolución y registro de reembolso financiero vinculado a un RMA (o reembolso sin entrada física).
    - Requiere capacidad financiera (`approve_payments` o `manage_finances`).
    - NO incrementa jamás WarehouseStock (el inventario depende exclusivamente de `receive_and_inspect_rma`).
    - No ejecuta reembolsos monetarios reales hacia pasarelas externas en QA; cuando no exista soporte
      directo o `execute_now=False`, registra el estado `APPROVED_PENDING_EXECUTION`.
    - Cuando se confirma la ejecución autorizada (`execute_now=True`), actualiza `Order.financial_status`
      (`PARTIALLY_REFUNDED` o `REFUNDED`) y crea un registro compensatorio en `IncomeRecord` / `IncomeDistribution`
      sin borrar ni sobrescribir los registros históricos originales.
    - Protegido por `refund_idempotency_key` para impedir duplicación de movimientos financieros.
    """
    if actor is not None and not is_effective_super_admin(actor):
        if not (user_has_capability(actor, PERM_APPROVE_PAYMENTS) or user_has_capability(actor, PERM_MANAGE_FINANCES)):
            raise OMSPermissionError(
                "No posee autorización ('approve_payments' / 'manage_finances') para aprobar o ejecutar reembolsos."
            )

    locked_rma = ReturnMerchandiseAuthorization.objects.select_for_update().get(pk=rma.pk)
    locked_order = Order.objects.select_for_update().get(pk=locked_rma.order_id)

    # Idempotencia de reembolso
    if locked_rma.refund_status == ReturnMerchandiseAuthorization.RefundStatus.EXECUTED:
        if idempotency_key and locked_rma.refund_idempotency_key and locked_rma.refund_idempotency_key != idempotency_key:
            raise OMSServiceError("Conflicto de idempotencia sobre un reembolso RMA ya ejecutado.")
        return locked_rma

    if idempotency_key:
        conflict = (
            ReturnMerchandiseAuthorization.objects.filter(refund_idempotency_key=idempotency_key)
            .exclude(pk=locked_rma.pk)
            .first()
        )
        if conflict is not None:
            raise OMSServiceError("La clave de idempotencia de reembolso ya fue utilizada en otro RMA.")

    amt = _to_dec(refund_amount, "refund_amount", allow_zero=False).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    already_refunded = (
        ReturnMerchandiseAuthorization.objects.filter(
            order=locked_order,
            refund_status=ReturnMerchandiseAuthorization.RefundStatus.EXECUTED,
        )
        .exclude(pk=locked_rma.pk)
        .aggregate(t=Sum("refund_amount"))["t"]
        or Decimal("0.00")
    )
    if already_refunded + amt > locked_order.total:
        raise OMSServiceError(
            f"El monto de reembolso ({amt}) más reembolsos previos ({already_refunded}) supera el total de la orden ({locked_order.total})."
        )

    now = timezone.now()
    eff_provider = (provider or "").strip()[:40]
    eff_reference = (reference or "").strip()[:140]
    if execute_now and (not eff_provider or not eff_reference):
        raise OMSServiceError(
            "Se requiere evidencia de ejecución autorizada (proveedor y referencia/comprobante de transacción) "
            "para marcar el reembolso como ejecutado."
        )

    locked_rma.refund_amount = amt
    locked_rma.refund_currency = locked_order.currency
    locked_rma.refund_provider = eff_provider or "manual_treasury"
    locked_rma.refund_reference = eff_reference
    if idempotency_key:
        locked_rma.refund_idempotency_key = idempotency_key
    locked_rma.refund_resolved_by = actor if getattr(actor, "is_authenticated", False) else None

    if not execute_now:
        locked_rma.refund_status = ReturnMerchandiseAuthorization.RefundStatus.APPROVED_PENDING_EXECUTION
        if notes:
            locked_rma.notes = f"{locked_rma.notes}\n{notes}".strip()
        locked_rma.save()
    else:
        locked_rma.refund_status = ReturnMerchandiseAuthorization.RefundStatus.EXECUTED
        locked_rma.refunded_at = now
        if locked_rma.status == ReturnMerchandiseAuthorization.Status.RESTOCKED:
            locked_rma.status = ReturnMerchandiseAuthorization.Status.CLOSED
        if notes:
            locked_rma.notes = f"{locked_rma.notes}\n{notes}".strip()
        locked_rma.save()

        total_refunded_now = already_refunded + amt
        is_full_refund = total_refunded_now >= locked_order.total

        locked_order.financial_status = (
            Order.FinancialStatusChoices.REFUNDED
            if is_full_refund
            else Order.FinancialStatusChoices.PARTIALLY_REFUNDED
        )
        if is_full_refund:
            locked_order.commercial_status = Order.CommercialStatusChoices.CANCELLED
            for p in locked_order.payments.filter(status=PaymentStatus.APPROVED):
                p.status = PaymentStatus.REFUNDED
                p.save(update_fields=["status", "updated_at"])

        Order.objects.filter(pk=locked_order.pk).update(
            financial_status=locked_order.financial_status,
            commercial_status=locked_order.commercial_status,
            updated_at=now,
        )

    record_audit_event(
        module=MODULE_FINANCES,
        action="RMA_REFUND_EXECUTED" if execute_now else "RMA_REFUND_APPROVED_PENDING_EXECUTION",
        event_category=CATEGORY_FINANCIAL_OPERATION,
        resource_type="ReturnMerchandiseAuthorization",
        resource_id=str(locked_rma.id),
        resource_repr=str(locked_rma),
        actor=actor,
        new_values={
            "rma_number": locked_rma.rma_number,
            "order_id": str(locked_order.id),
            "refund_status": locked_rma.refund_status,
            "refund_amount": str(locked_rma.refund_amount),
            "refund_currency": locked_rma.refund_currency,
            "order_financial_status": locked_order.financial_status,
        },
        severity=SEVERITY_HIGH,
        mandatory=True,
    )
    return locked_rma

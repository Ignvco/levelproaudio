"""
LEVELPRO OS V4.0 — GATE 6: Motor Transaccional de Cost & Pricing Intelligence
Implementa:
- BF-09: Historial y Capas de Costos (CostLayer, SerialCostUnit, WeightedAverageCostState, CostConsumptionRecord)
- BF-18: Landed Cost Definitivo (LandedCostAllocation, LandedCostExpense, LandedCostLineAllocation, CostAdjustmentEntry)
- Congelamiento de Costo de Venta (COGS) en OrderItem al despachar
- Cálculo de Rentabilidad (Margen sobre ventas vs Markup sobre costo) y Simulador de Precios
"""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.inventory.models import InventoryMovement, SerialNumberTrack, Warehouse
from apps.orders.models import Order, OrderItem
from apps.procurement.models import (
    CostAdjustmentEntry,
    CostConsumptionRecord,
    CostLayer,
    ExchangeRateSnapshot,
    GoodsReceipt,
    GoodsReceiptItem,
    LandedCostAllocation,
    LandedCostExpense,
    LandedCostLineAllocation,
    MarginPolicy,
    PricingSimulationProposal,
    ProductSupplier,
    PurchaseOrder,
    PurchaseOrderItem,
    SerialCostUnit,
    Supplier,
    WeightedAverageCostState,
)
from apps.products.models import Brand, Category, Product, ProductVariant, SkuRegistry
from core.audit.constants import (
    CATEGORY_COST_CHANGE,
    CATEGORY_CREATION,
    CATEGORY_FINANCIAL_OPERATION,
    CATEGORY_MODIFICATION,
    CATEGORY_PRICE_CHANGE,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)
from core.audit.services import record_audit_event
from core.contracts.money import SUPPORTED_CURRENCIES
from core.rbac.constants import MODULE_FINANCES, MODULE_PURCHASES


class CostingServiceError(ValueError):
    """Error controlado del motor de costos, prorrateo landed y rentabilidad (Gate 6)."""


def _to_decimal(val, field_name: str = "monto", allow_zero: bool = True) -> Decimal:
    if isinstance(val, float):
        raise CostingServiceError(
            f"Prohibido utilizar tipo 'float' en '{field_name}'. Utilice Decimal, int o string numérico."
        )
    if val is None:
        raise CostingServiceError(f"El campo '{field_name}' es obligatorio.")
    try:
        dec = Decimal(str(val))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise CostingServiceError(f"Valor numérico inválido para '{field_name}': {val}") from exc
    if allow_zero and dec < Decimal("0"):
        raise CostingServiceError(f"El campo '{field_name}' no puede ser negativo.")
    if not allow_zero and dec <= Decimal("0"):
        raise CostingServiceError(f"El campo '{field_name}' debe ser estrictamente mayor que cero.")
    return dec


def _next_code(model_cls, field_name: str, prefix_tag: str) -> str:
    year = timezone.now().year
    prefix = f"{prefix_tag}-{year}-"
    last = (
        model_cls.objects.filter(**{f"{field_name}__startswith": prefix})
        .order_by(f"-{field_name}")
        .values_list(field_name, flat=True)
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = model_cls.objects.count() + 1
    return f"{prefix}{seq:05d}"


@transaction.atomic
def create_exchange_rate_snapshot(
    *,
    source_currency: str,
    target_currency: str,
    rate,
    rate_source: str,
    effective_date=None,
    original_amount=None,
    rounding_policy: str = "ROUND_HALF_UP",
    actor=None,
) -> ExchangeRateSnapshot:
    src = (source_currency or "").strip().upper()
    dst = (target_currency or "").strip().upper()
    if src not in SUPPORTED_CURRENCIES or dst not in SUPPORTED_CURRENCIES:
        raise CostingServiceError(f"Monedas no soportadas en conversión: '{src}' -> '{dst}'.")
    dec_rate = _to_decimal(rate, "rate", allow_zero=False).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    if src == dst and dec_rate != Decimal("1.000000"):
        raise CostingServiceError("La tasa de conversión entre la misma moneda debe ser exactamente 1.")
    clean_source = (rate_source or "").strip()
    if not clean_source:
        raise CostingServiceError("Toda conversión multimoneda requiere una fuente documentada ('rate_source').")

    orig_dec = None
    conv_dec = None
    if original_amount is not None:
        orig_dec = _to_decimal(original_amount, "original_amount", allow_zero=True).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        conv_dec = (orig_dec * dec_rate).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    return ExchangeRateSnapshot.objects.create(
        source_currency=src,
        target_currency=dst,
        rate=dec_rate,
        rate_source=clean_source[:120],
        effective_date=effective_date or timezone.localdate(),
        rounding_policy=rounding_policy[:30],
        original_amount=orig_dec,
        converted_amount=conv_dec,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )


def _get_or_lock_wac_state(product: Product, variant: ProductVariant, currency: str) -> WeightedAverageCostState:
    curr = (currency or "").strip().upper()
    if curr not in SUPPORTED_CURRENCIES:
        raise CostingServiceError(f"Moneda no soportada para WAC: '{currency}'.")
    sku_snap = variant.sku if variant is not None else (product.sku or "")
    wac, _ = WeightedAverageCostState.objects.get_or_create(
        product=product,
        variant=variant,
        currency=curr,
        defaults={
            "sku_snapshot": sku_snap,
            "total_quantity": 0,
            "sellable_quantity": 0,
            "damaged_quantity": 0,
            "total_value": Decimal("0.0000"),
            "sellable_value": Decimal("0.0000"),
            "damaged_value": Decimal("0.0000"),
            "average_unit_cost": Decimal("0.0000"),
        },
    )
    return WeightedAverageCostState.objects.select_for_update().get(pk=wac.pk)


@transaction.atomic
def record_wac_receipt(
    *,
    product: Product,
    variant: ProductVariant = None,
    currency: str,
    quantity_accepted: int,
    quantity_damaged: int = 0,
    unit_cost,
    movement: InventoryMovement = None,
) -> WeightedAverageCostState:
    """
    Sección 10: Actualiza el promedio ponderado móvil (WAC) al ingresar mercadería fungible.
    Diferencia unidades vendibles de unidades dañadas conservando consistencia exacta entre cantidades y valores.
    """
    acc = int(quantity_accepted or 0)
    dmg = int(quantity_damaged or 0)
    if acc < 0 or dmg < 0 or (acc + dmg) <= 0:
        raise CostingServiceError("Cantidades de entrada WAC inválidas.")
    u_cost = _to_decimal(unit_cost, "unit_cost", allow_zero=True).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    wac = _get_or_lock_wac_state(product, variant, currency)
    added_sellable_val = (u_cost * acc).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    added_damaged_val = (u_cost * dmg).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    new_sell_qty = wac.sellable_quantity + acc
    new_dmg_qty = wac.damaged_quantity + dmg
    new_tot_qty = new_sell_qty + new_dmg_qty

    new_sell_val = (wac.sellable_value + added_sellable_val).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    new_dmg_val = (wac.damaged_value + added_damaged_val).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    new_tot_val = (new_sell_val + new_dmg_val).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    new_avg = (
        (new_tot_val / Decimal(new_tot_qty)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if new_tot_qty > 0
        else Decimal("0.0000")
    )

    wac.sellable_quantity = new_sell_qty
    wac.damaged_quantity = new_dmg_qty
    wac.total_quantity = new_tot_qty
    wac.sellable_value = new_sell_val
    wac.damaged_value = new_dmg_val
    wac.total_value = new_tot_val
    wac.average_unit_cost = new_avg
    if movement is not None:
        wac.last_movement = movement
    wac.save()
    return wac


@transaction.atomic
def apply_wac_value_delta(
    *,
    product: Product,
    variant: ProductVariant = None,
    currency: str,
    sellable_value_delta: Decimal,
    damaged_value_delta: Decimal = Decimal("0.0000"),
) -> WeightedAverageCostState:
    """
    Aplica un incremento/decremento de valor capitalizado (ej. gastos de Landed Cost sobre unidades en mano)
    al pool WAC sin alterar las cantidades físicas, recalculando el costo unitario promedio ponderado.
    """
    wac = _get_or_lock_wac_state(product, variant, currency)
    new_sell_val = (wac.sellable_value + sellable_value_delta).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    new_dmg_val = (wac.damaged_value + damaged_value_delta).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    if new_sell_val < Decimal("0") or new_dmg_val < Decimal("0"):
        raise CostingServiceError("El valor acumulado de inventario WAC no puede ser negativo.")
    new_tot_val = (new_sell_val + new_dmg_val).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    wac.sellable_value = new_sell_val
    wac.damaged_value = new_dmg_val
    wac.total_value = new_tot_val
    if wac.total_quantity > 0:
        wac.average_unit_cost = (new_tot_val / Decimal(wac.total_quantity)).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    wac.save()
    return wac


@transaction.atomic
def record_wac_internal_transfer(
    *,
    product: Product,
    variant: ProductVariant = None,
    currency: str,
    quantity: int,
    source_warehouse: Warehouse,
    destination_warehouse: Warehouse,
) -> dict:
    """
    Sección 10: Las transferencias internas entre bodegas conservan exactamente el costo unitario
    y valor total sin generar utilidad ficticia.
    """
    qty = int(quantity)
    if qty <= 0:
        raise CostingServiceError("La cantidad transferida debe ser positiva.")
    wac = _get_or_lock_wac_state(product, variant, currency)
    transferred_value = (wac.average_unit_cost * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {
        "sku": wac.sku_snapshot,
        "currency": wac.currency,
        "quantity": qty,
        "unit_cost_preserved": wac.average_unit_cost,
        "transferred_value": transferred_value,
        "fictitious_profit": Decimal("0.00"),
        "source_warehouse": source_warehouse.code,
        "destination_warehouse": destination_warehouse.code,
    }


@transaction.atomic
def record_wac_damage_reclassification(
    *,
    product: Product,
    variant: ProductVariant = None,
    currency: str,
    quantity_damaged: int,
) -> WeightedAverageCostState:
    """Reclasifica unidades vendibles a dañadas conservando el costo promedio unitario."""
    qty = int(quantity_damaged)
    if qty <= 0:
        raise CostingServiceError("La cantidad a reclasificar como dañada debe ser positiva.")
    wac = _get_or_lock_wac_state(product, variant, currency)
    if qty > wac.sellable_quantity:
        raise CostingServiceError("No hay suficiente stock vendible en WAC para reclasificar como dañado.")
    moved_val = (wac.average_unit_cost * qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    if qty == wac.sellable_quantity:
        moved_val = wac.sellable_value
    wac.sellable_quantity -= qty
    wac.damaged_quantity += qty
    wac.sellable_value = max(Decimal("0.0000"), wac.sellable_value - moved_val)
    wac.damaged_value = (wac.damaged_value + moved_val).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    wac.total_value = (wac.sellable_value + wac.damaged_value).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    wac.save()
    return wac


@transaction.atomic
def record_wac_physical_return(
    *,
    product: Product,
    variant: ProductVariant = None,
    currency: str,
    quantity: int,
    returned_unit_cost,
    is_damaged: bool = False,
) -> WeightedAverageCostState:
    """Reingresa una devolución física al pool WAC a su costo histórico de salida."""
    qty = int(quantity)
    if qty <= 0:
        raise CostingServiceError("La cantidad devuelta debe ser positiva.")
    return record_wac_receipt(
        product=product,
        variant=variant,
        currency=currency,
        quantity_accepted=0 if is_damaged else qty,
        quantity_damaged=qty if is_damaged else 0,
        unit_cost=returned_unit_cost,
    )


@transaction.atomic
def create_cost_layers_for_confirmed_receipt(
    gr: GoodsReceipt,
    *,
    valuation_currency: str = None,
    fx_rate_payload: dict = None,
    actor=None,
) -> list[CostLayer]:
    """
    BF-09: Crea las capas de costo (CostLayer) y unidades serializadas (SerialCostUnit)
    al confirmar una GoodsReceipt. Idempotente por GoodsReceiptItem.
    """
    locked_gr = GoodsReceipt.objects.select_for_update().get(pk=gr.pk)
    if locked_gr.status != GoodsReceipt.Status.CONFIRMED:
        raise CostingServiceError("Solo recepciones confirmadas pueden generar capas de costo.")

    po = locked_gr.purchase_order
    acq_curr = (po.currency or "USD").strip().upper()
    val_curr = (valuation_currency or acq_curr).strip().upper()
    if val_curr not in SUPPORTED_CURRENCIES:
        raise CostingServiceError(f"Moneda de valuación no soportada: '{val_curr}'.")

    fx_snap = None
    if acq_curr != val_curr:
        if not fx_rate_payload or fx_rate_payload.get("rate") is None or not fx_rate_payload.get("rate_source"):
            raise CostingServiceError(
                f"Se requiere tipo de cambio explícito ('rate' y 'rate_source') para valorar recepción "
                f"de '{acq_curr}' en '{val_curr}'."
            )
        fx_snap = create_exchange_rate_snapshot(
            source_currency=acq_curr,
            target_currency=val_curr,
            rate=fx_rate_payload["rate"],
            rate_source=fx_rate_payload["rate_source"],
            effective_date=fx_rate_payload.get("effective_date"),
            actor=actor,
        )

    created_layers = []
    for item in locked_gr.items.select_related(
        "purchase_order_item",
        "purchase_order_item__product",
        "purchase_order_item__variant",
        "purchase_order_item__sku_registry",
        "inventory_movement",
    ).order_by("pk"):
        existing = CostLayer.objects.filter(goods_receipt_item=item).first()
        if existing is not None:
            created_layers.append(existing)
            continue

        phys_qty = item.quantity_physical_received
        if phys_qty <= 0:
            continue

        poi = item.purchase_order_item
        product = poi.product
        variant = poi.variant
        sku_reg = poi.sku_registry or SkuRegistry.objects.filter(product=product, variant=variant).first()
        sku_snap = poi.internal_sku_snapshot or (variant.sku if variant else (product.sku or ""))

        orig_unit_cost = poi.unit_cost_snapshot.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if fx_snap is not None:
            base_unit_cost = (orig_unit_cost * fx_snap.rate).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            base_unit_cost = orig_unit_cost

        serials = list(item.serial_numbers or [])
        damaged_set = set(item.damaged_serial_numbers or [])
        is_serial_method = (
            product.serialization_mode == Product.SerializationMode.REQUIRED or len(serials) > 0
        )
        method = (
            CostLayer.CostingMethod.SPECIFIC_SERIAL
            if is_serial_method
            else CostLayer.CostingMethod.WEIGHTED_AVERAGE
        )

        total_cost = (base_unit_cost * phys_qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        rem_value = (base_unit_cost * int(item.quantity_accepted)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        layer = CostLayer.objects.create(
            layer_code=_next_code(CostLayer, "layer_code", "CL"),
            costing_method=method,
            status=CostLayer.Status.PROVISIONAL,
            purchase_order=po,
            goods_receipt=locked_gr,
            goods_receipt_item=item,
            supplier=po.supplier,
            product=product,
            variant=variant,
            sku_registry=sku_reg,
            sku_snapshot=sku_snap,
            warehouse=locked_gr.warehouse,
            inventory_movement=item.inventory_movement,
            source_document_type="GOODS_RECEIPT",
            source_document_id=str(locked_gr.id),
            effective_date=locked_gr.confirmed_at or timezone.now(),
            acquisition_currency=acq_curr,
            valuation_currency=val_curr,
            fx_snapshot=fx_snap,
            quantity_received=phys_qty,
            quantity_damaged=int(item.quantity_damaged),
            quantity_available=int(item.quantity_accepted),
            quantity_consumed=0,
            original_unit_cost=orig_unit_cost,
            base_unit_cost=base_unit_cost,
            allocated_expenses_total=Decimal("0.00"),
            unit_allocated_expense=Decimal("0.0000"),
            landed_unit_cost=base_unit_cost,
            total_layer_cost=total_cost,
            remaining_layer_value=rem_value,
            serial_numbers=serials,
            is_finalized=False,
        )

        if serials:
            for sn in serials:
                sn_track = SerialNumberTrack.objects.filter(
                    product=product, variant=variant, serial_number=sn
                ).first()
                if sn_track is not None and not SerialCostUnit.objects.filter(serial_track=sn_track).exists():
                    SerialCostUnit.objects.create(
                        serial_track=sn_track,
                        cost_layer=layer,
                        purchase_order=po,
                        goods_receipt=locked_gr,
                        goods_receipt_item=item,
                        product=product,
                        variant=variant,
                        serial_number_snapshot=sn,
                        acquisition_currency=acq_curr,
                        valuation_currency=val_curr,
                        original_unit_cost=orig_unit_cost,
                        base_unit_cost=base_unit_cost,
                        allocated_expense=Decimal("0.0000"),
                        landed_unit_cost=base_unit_cost,
                        is_damaged=(sn in damaged_set),
                        is_finalized=False,
                        is_consumed=False,
                    )

        record_wac_receipt(
            product=product,
            variant=variant,
            currency=val_curr,
            quantity_accepted=int(item.quantity_accepted),
            quantity_damaged=int(item.quantity_damaged),
            unit_cost=base_unit_cost,
            movement=item.inventory_movement,
        )
        created_layers.append(layer)

    return created_layers


def compute_landed_cost_distribution(
    *,
    lines: list[dict],
    expenses: list[dict],
    rounding_policy: str = "ROUND_HALF_UP_MAX_BASE_RESIDUAL",
) -> dict:
    """
    BF-18 (Sección 7): Motor matemático puro, determinista y auditable de prorrateo de Landed Cost.
    - Soporta distribución por valor CIF ('by_cif_value'), por peso ('by_weight'),
      por cantidad ('by_quantity') y asignación específica ('specific_line').
    - Separa impuestos recuperables (no capitalizables) de gastos e impuestos capitalizables.
    - Bloquea el cálculo si algún gasto requiere peso y alguna partida carece de peso verificable (> 0).
    - Resuelve diferencias de redondeo mediante política determinista: el residual de centavos se asigna
      a la partida con mayor base de participación (desempatando por menor índice de partida).
    - Garantiza: Suma de costos definitivos == CIF total + gastos capitalizados.
    """
    if not lines:
        raise CostingServiceError("Debe incluir al menos una partida para calcular Landed Cost.")

    normalized_lines = []
    total_cif = Decimal("0.00")

    for idx, raw_line in enumerate(lines):
        qty = int(raw_line.get("quantity", 1))
        if qty <= 0:
            raise CostingServiceError(f"La cantidad en la partida #{idx + 1} debe ser mayor que cero.")

        if raw_line.get("cif_total") is not None:
            cif_total = _to_decimal(raw_line["cif_total"], "cif_total", allow_zero=True).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            cif_unit = (cif_total / Decimal(qty)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        elif raw_line.get("cif_unit") is not None:
            cif_unit = _to_decimal(raw_line["cif_unit"], "cif_unit", allow_zero=True).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
            cif_total = (cif_unit * Decimal(qty)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            raise CostingServiceError(f"Debe especificar 'cif_total' o 'cif_unit' para la partida #{idx + 1}.")

        total_weight = None
        unit_weight = None
        if raw_line.get("total_weight") is not None:
            total_weight = _to_decimal(raw_line["total_weight"], "total_weight", allow_zero=True).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
            unit_weight = (total_weight / Decimal(qty)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        elif raw_line.get("weight") is not None or raw_line.get("unit_weight") is not None:
            raw_w = raw_line.get("weight") if raw_line.get("weight") is not None else raw_line.get("unit_weight")
            unit_weight = _to_decimal(raw_w, "weight", allow_zero=True).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
            # Si se pasa 'weight' como peso total de la partida (cuando qty=1 o explícito)
            if raw_line.get("weight_is_total", True) and raw_line.get("unit_weight") is None:
                total_weight = unit_weight
                unit_weight = (total_weight / Decimal(qty)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            else:
                total_weight = (unit_weight * Decimal(qty)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        total_cif += cif_total
        normalized_lines.append({
            "index": idx,
            "line_id": str(raw_line.get("line_id") or raw_line.get("sku") or f"line-{idx + 1}"),
            "sku": str(raw_line.get("sku") or f"SKU-{idx + 1}"),
            "quantity": qty,
            "cif_base_unit": cif_unit,
            "cif_base_total": cif_total,
            "unit_weight": unit_weight,
            "total_weight": total_weight,
            "allocated_expenses_total": Decimal("0.00"),
            "rounding_adjustment": Decimal("0.00"),
            "expense_breakdown": {},
        })

    total_capitalizable = Decimal("0.00")
    total_non_capitalizable_taxes = Decimal("0.00")
    expense_audit_log = []

    for exp_idx, raw_exp in enumerate(expenses or []):
        exp_id = str(raw_exp.get("id") or raw_exp.get("category") or f"exp-{exp_idx + 1}")
        category = str(raw_exp.get("category") or "other_capitalizable").strip()
        method = str(raw_exp.get("proration_method") or "by_cif_value").strip()
        amount = _to_decimal(
            raw_exp.get("converted_amount") if raw_exp.get("converted_amount") is not None else raw_exp.get("amount"),
            f"expense[{exp_id}].amount",
            allow_zero=False,
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        is_recoverable = bool(
            raw_exp.get("is_recoverable_tax", False)
            or category == LandedCostExpense.Category.RECOVERABLE_TAX
        )
        is_cap = bool(raw_exp.get("is_capitalizable", not is_recoverable)) and not is_recoverable

        if not is_cap:
            total_non_capitalizable_taxes += amount
            expense_audit_log.append({
                "expense_id": exp_id,
                "category": category,
                "proration_method": method,
                "amount": str(amount),
                "is_capitalizable": False,
                "is_recoverable_tax": is_recoverable,
                "allocations": {},
            })
            continue

        total_capitalizable += amount

        # Construir vector de bases B_i según el método de prorrateo
        bases = []
        if method == LandedCostExpense.ProrationMethod.BY_CIF_VALUE:
            for ln in normalized_lines:
                bases.append(ln["cif_base_total"])
        elif method == LandedCostExpense.ProrationMethod.BY_WEIGHT:
            for ln in normalized_lines:
                if ln["total_weight"] is None or ln["total_weight"] <= Decimal("0"):
                    raise CostingServiceError(
                        f"Bloqueo de cálculo Landed Cost: el gasto '{category}' requiere prorrateo por peso, "
                        f"pero la partida '{ln['sku']}' carece de un peso verificable (> 0). Prohibido inventar pesos."
                    )
                bases.append(ln["total_weight"])
        elif method == LandedCostExpense.ProrationMethod.BY_QUANTITY:
            for ln in normalized_lines:
                bases.append(Decimal(ln["quantity"]))
        elif method == LandedCostExpense.ProrationMethod.SPECIFIC_LINE:
            target_id = str(raw_exp.get("target_line_id") or "")
            for ln in normalized_lines:
                bases.append(Decimal("1") if ln["line_id"] == target_id or ln["sku"] == target_id else Decimal("0"))
        else:
            raise CostingServiceError(f"Método de prorrateo no soportado: '{method}'.")

        total_base = sum(bases, Decimal("0"))
        if total_base <= Decimal("0"):
            raise CostingServiceError(
                f"La base total de prorrateo para el gasto '{category}' ({method}) es cero."
            )

        shares = []
        for b in bases:
            raw_share = (amount * b) / total_base
            rounded_share = raw_share.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            shares.append(rounded_share)

        residual = amount - sum(shares, Decimal("0.00"))
        winner_idx = None
        if residual != Decimal("0.00"):
            # Política determinista: asignar residual a la partida con mayor base B_i (desempate: menor índice)
            winner_idx = max(range(len(normalized_lines)), key=lambda i: (bases[i], -i))
            shares[winner_idx] = (shares[winner_idx] + residual).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            normalized_lines[winner_idx]["rounding_adjustment"] = (
                normalized_lines[winner_idx]["rounding_adjustment"] + residual
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        alloc_map = {}
        for i, ln in enumerate(normalized_lines):
            ln["allocated_expenses_total"] = (ln["allocated_expenses_total"] + shares[i]).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            ln["expense_breakdown"][exp_id] = {
                "category": category,
                "method": method,
                "base_value": str(bases[i]),
                "total_base": str(total_base),
                "allocated_amount": str(shares[i]),
                "rounding_residual_applied": str(residual if i == winner_idx else Decimal("0.00")),
            }
            alloc_map[ln["line_id"]] = str(shares[i])

        expense_audit_log.append({
            "expense_id": exp_id,
            "category": category,
            "proration_method": method,
            "amount": str(amount),
            "total_base": str(total_base),
            "rounding_residual": str(residual),
            "residual_winner_line": normalized_lines[winner_idx]["line_id"] if winner_idx is not None else None,
            "is_capitalizable": True,
            "allocations": alloc_map,
        })

    for ln in normalized_lines:
        qty_dec = Decimal(ln["quantity"])
        ln["allocated_expense_unit"] = (ln["allocated_expenses_total"] / qty_dec).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        ln["landed_total_cost"] = (ln["cif_base_total"] + ln["allocated_expenses_total"]).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        ln["landed_unit_cost"] = (ln["landed_total_cost"] / qty_dec).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )

    total_landed = sum((ln["landed_total_cost"] for ln in normalized_lines), Decimal("0.00"))
    expected_total_landed = (total_cif + total_capitalizable).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if total_landed != expected_total_landed:
        raise CostingServiceError(
            f"Violación de conservación de totales Landed Cost: calculado={total_landed}, esperado={expected_total_landed}."
        )

    return {
        "rounding_policy": rounding_policy,
        "total_cif_base": total_cif,
        "total_capitalizable_expenses": total_capitalizable,
        "total_non_capitalizable_taxes": total_non_capitalizable_taxes,
        "total_landed_cost": total_landed,
        "lines": normalized_lines,
        "expenses_audit": expense_audit_log,
    }


@transaction.atomic
def create_or_simulate_landed_cost_allocation(
    *,
    purchase_order: PurchaseOrder,
    expenses: list[dict],
    goods_receipt: GoodsReceipt = None,
    valuation_currency: str = None,
    po_fx_payload: dict = None,
    line_weights_override: dict = None,
    is_late_adjustment: bool = False,
    notes: str = "",
    actor=None,
) -> LandedCostAllocation:
    """
    BF-18: Crea y calcula una LandedCostAllocation sobre una GoodsReceipt confirmada (o sobre la PO).
    - Respeta recepciones parciales: si se vincula a una GoodsReceipt de 4 de 10 unidades,
      calcula la base CIF y distribuye los gastos de esa recepción exclusivamente sobre las 4 unidades recibidas.
    - Registra snapshots multimoneda explícitos para la PO y para cada gasto en otra divisa.
    """
    locked_po = PurchaseOrder.objects.select_for_update().get(pk=purchase_order.pk)
    locked_gr = None
    if goods_receipt is not None:
        locked_gr = GoodsReceipt.objects.select_for_update().get(pk=goods_receipt.pk)
        if locked_gr.purchase_order_id != locked_po.pk:
            raise CostingServiceError("La recepción indicada no pertenece a la orden de compra.")
        if locked_gr.status != GoodsReceipt.Status.CONFIRMED:
            raise CostingServiceError("Solo recepciones confirmadas pueden recibir asignación de Landed Cost.")

    po_curr = (locked_po.currency or "USD").strip().upper()
    val_curr = (valuation_currency or po_curr).strip().upper()
    if val_curr not in SUPPORTED_CURRENCIES:
        raise CostingServiceError(f"Moneda de valuación no soportada: '{val_curr}'.")

    po_fx_snap = None
    po_fx_rate = Decimal("1.000000")
    if po_curr != val_curr:
        if not po_fx_payload or po_fx_payload.get("rate") is None or not po_fx_payload.get("rate_source"):
            raise CostingServiceError(
                f"Se requiere tipo de cambio explícito ('rate' y 'rate_source') para convertir la base CIF "
                f"de la PO ('{po_curr}') a la moneda de valuación ('{val_curr}')."
            )
        po_fx_snap = create_exchange_rate_snapshot(
            source_currency=po_curr,
            target_currency=val_curr,
            rate=po_fx_payload["rate"],
            rate_source=po_fx_payload["rate_source"],
            effective_date=po_fx_payload.get("effective_date"),
            actor=actor,
        )
        po_fx_rate = po_fx_snap.rate

    line_weights_override = line_weights_override or {}
    calc_lines_input = []
    target_records = []

    if locked_gr is not None:
        create_cost_layers_for_confirmed_receipt(locked_gr, actor=actor)
        for gri in locked_gr.items.select_related(
            "purchase_order_item",
            "purchase_order_item__product",
            "purchase_order_item__variant",
        ).order_by("pk"):
            phys_qty = gri.quantity_physical_received
            if phys_qty <= 0:
                continue
            poi = gri.purchase_order_item
            prod = poi.product
            var = poi.variant
            sku_snap = poi.internal_sku_snapshot or (var.sku if var else (prod.sku or ""))

            # Si es ajuste tardío, la base CIF ya está en la capa; usamos la base CIF del lote para prorratear
            cif_unit_val = (poi.unit_cost_snapshot * po_fx_rate).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            cif_total_val = (cif_unit_val * Decimal(phys_qty)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            override_w = (
                line_weights_override.get(str(gri.id))
                or line_weights_override.get(str(poi.id))
                or line_weights_override.get(sku_snap)
            )
            cat_unit_w = var.effective_weight if var is not None else prod.weight
            unit_w = None
            total_w = None
            if override_w is not None:
                total_w = _to_decimal(override_w, f"weight[{sku_snap}]", allow_zero=True)
                unit_w = (total_w / Decimal(phys_qty)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            elif cat_unit_w is not None and cat_unit_w > Decimal("0"):
                unit_w = Decimal(str(cat_unit_w)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                total_w = (unit_w * Decimal(phys_qty)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

            layer = CostLayer.objects.filter(goods_receipt_item=gri).first()
            calc_lines_input.append({
                "line_id": str(gri.id),
                "sku": sku_snap,
                "quantity": phys_qty,
                "cif_unit": cif_unit_val,
                "cif_total": cif_total_val,
                "unit_weight": unit_w,
                "total_weight": total_w,
            })
            target_records.append({
                "poi": poi,
                "gri": gri,
                "layer": layer,
                "product": prod,
                "variant": var,
                "sku": sku_snap,
            })
    else:
        for poi in locked_po.items.select_related("product", "variant").order_by("pk"):
            qty = poi.quantity_received if poi.quantity_received > 0 else poi.quantity_ordered
            prod = poi.product
            var = poi.variant
            sku_snap = poi.internal_sku_snapshot or (var.sku if var else (prod.sku or ""))
            cif_unit_val = (poi.unit_cost_snapshot * po_fx_rate).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            cif_total_val = (cif_unit_val * Decimal(qty)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            override_w = line_weights_override.get(str(poi.id)) or line_weights_override.get(sku_snap)
            cat_unit_w = var.effective_weight if var is not None else prod.weight
            unit_w = None
            total_w = None
            if override_w is not None:
                total_w = _to_decimal(override_w, f"weight[{sku_snap}]", allow_zero=True)
                unit_w = (total_w / Decimal(qty)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            elif cat_unit_w is not None and cat_unit_w > Decimal("0"):
                unit_w = Decimal(str(cat_unit_w)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                total_w = (unit_w * Decimal(qty)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

            calc_lines_input.append({
                "line_id": str(poi.id),
                "sku": sku_snap,
                "quantity": qty,
                "cif_unit": cif_unit_val,
                "cif_total": cif_total_val,
                "unit_weight": unit_w,
                "total_weight": total_w,
            })
            target_records.append({
                "poi": poi,
                "gri": None,
                "layer": None,
                "product": prod,
                "variant": var,
                "sku": sku_snap,
            })

    allocation = LandedCostAllocation.objects.create(
        allocation_code=_next_code(LandedCostAllocation, "allocation_code", "LC"),
        purchase_order=locked_po,
        goods_receipt=locked_gr,
        status=LandedCostAllocation.Status.DRAFT,
        valuation_currency=val_curr,
        po_to_valuation_fx=po_fx_snap,
        is_late_adjustment=bool(is_late_adjustment),
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
        notes=notes or "",
    )

    prepared_expenses_for_calc = []
    for idx, raw_exp in enumerate(expenses or []):
        cat = str(raw_exp.get("category") or LandedCostExpense.Category.OTHER_CAPITALIZABLE).strip()
        if cat not in LandedCostExpense.Category.values:
            raise CostingServiceError(f"Categoría de gasto inválida: '{cat}'.")
        method = str(raw_exp.get("proration_method") or LandedCostExpense.ProrationMethod.BY_CIF_VALUE).strip()
        if method not in LandedCostExpense.ProrationMethod.values:
            raise CostingServiceError(f"Método de prorrateo inválido: '{method}'.")

        exp_curr = str(raw_exp.get("currency") or val_curr).strip().upper()
        if exp_curr not in SUPPORTED_CURRENCIES:
            raise CostingServiceError(f"Moneda de gasto no soportada: '{exp_curr}'.")
        raw_amt = _to_decimal(raw_exp.get("amount"), f"expenses[{idx}].amount", allow_zero=False).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        exp_fx_snap = None
        if exp_curr != val_curr:
            fx_rate_val = raw_exp.get("fx_rate")
            fx_source_val = (raw_exp.get("fx_source") or raw_exp.get("rate_source") or "").strip()
            if fx_rate_val is None or not fx_source_val:
                raise CostingServiceError(
                    f"El gasto '{cat}' en '{exp_curr}' requiere tasa de conversión explícita ('fx_rate') "
                    f"y fuente ('fx_source') hacia '{val_curr}'."
                )
            exp_fx_snap = create_exchange_rate_snapshot(
                source_currency=exp_curr,
                target_currency=val_curr,
                rate=fx_rate_val,
                rate_source=fx_source_val,
                effective_date=raw_exp.get("expense_date"),
                original_amount=raw_amt,
                actor=actor,
            )
            conv_amt = exp_fx_snap.converted_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            conv_amt = raw_amt

        is_rec_tax = bool(
            raw_exp.get("is_recoverable_tax", False)
            or cat == LandedCostExpense.Category.RECOVERABLE_TAX
        )
        is_cap = bool(raw_exp.get("is_capitalizable", not is_rec_tax)) and not is_rec_tax

        exp_obj = LandedCostExpense.objects.create(
            allocation=allocation,
            category=cat,
            proration_method=method,
            source_document_type=str(raw_exp.get("source_document_type") or "INVOICE")[:60],
            source_document_number=str(raw_exp.get("source_document_number") or f"DOC-{idx + 1}")[:120],
            expense_date=raw_exp.get("expense_date") or timezone.localdate(),
            amount=raw_amt,
            currency=exp_curr,
            fx_snapshot=exp_fx_snap,
            converted_amount=conv_amt,
            is_capitalizable=is_cap,
            is_recoverable_tax=is_rec_tax,
            validation_status=LandedCostExpense.ValidationStatus.VALIDATED,
            responsible=actor if getattr(actor, "is_authenticated", False) else None,
            notes=str(raw_exp.get("notes") or "")[:255],
        )
        prepared_expenses_for_calc.append({
            "id": str(exp_obj.id),
            "category": cat,
            "proration_method": method,
            "amount": raw_amt,
            "converted_amount": conv_amt,
            "is_capitalizable": is_cap,
            "is_recoverable_tax": is_rec_tax,
            "target_line_id": raw_exp.get("target_line_id"),
        })

    dist = compute_landed_cost_distribution(
        lines=calc_lines_input,
        expenses=prepared_expenses_for_calc,
    )

    for ln_res, rec in zip(dist["lines"], target_records):
        LandedCostLineAllocation.objects.create(
            allocation=allocation,
            purchase_order_item=rec["poi"],
            goods_receipt_item=rec["gri"],
            cost_layer=rec["layer"],
            product=rec["product"],
            variant=rec["variant"],
            sku_snapshot=rec["sku"],
            quantity_allocated=ln_res["quantity"],
            unit_weight_snapshot=ln_res["unit_weight"],
            total_weight_snapshot=ln_res["total_weight"],
            cif_base_unit=ln_res["cif_base_unit"],
            cif_base_total=ln_res["cif_base_total"],
            allocated_expenses_total=ln_res["allocated_expenses_total"],
            allocated_expense_unit=ln_res["allocated_expense_unit"],
            rounding_adjustment=ln_res["rounding_adjustment"],
            landed_total_cost=ln_res["landed_total_cost"],
            landed_unit_cost=ln_res["landed_unit_cost"],
            expense_breakdown=ln_res["expense_breakdown"],
        )

    allocation.total_cif_base = dist["total_cif_base"]
    allocation.total_capitalizable_expenses = dist["total_capitalizable_expenses"]
    allocation.total_non_capitalizable_taxes = dist["total_non_capitalizable_taxes"]
    allocation.total_landed_cost = dist["total_landed_cost"]
    allocation.calculation_snapshot = {
        "rounding_policy": dist["rounding_policy"],
        "total_cif_base": str(dist["total_cif_base"]),
        "total_capitalizable_expenses": str(dist["total_capitalizable_expenses"]),
        "total_non_capitalizable_taxes": str(dist["total_non_capitalizable_taxes"]),
        "total_landed_cost": str(dist["total_landed_cost"]),
        "expenses_audit": dist["expenses_audit"],
    }
    allocation.status = LandedCostAllocation.Status.VALIDATED
    allocation.validated_at = timezone.now()
    allocation.validated_by = actor if getattr(actor, "is_authenticated", False) else None
    allocation.save()

    record_audit_event(
        module=MODULE_PURCHASES,
        action="LANDED_COST_ALLOCATION_CREATED",
        event_category=CATEGORY_COST_CHANGE,
        resource_type="LandedCostAllocation",
        resource_id=str(allocation.id),
        resource_repr=str(allocation),
        new_values={
            "allocation_code": allocation.allocation_code,
            "po_number": locked_po.po_number,
            "valuation_currency": val_curr,
            "total_cif_base": str(allocation.total_cif_base),
            "total_capitalizable_expenses": str(allocation.total_capitalizable_expenses),
            "total_landed_cost": str(allocation.total_landed_cost),
        },
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return allocation


@transaction.atomic
def finalize_landed_cost_allocation(
    allocation: LandedCostAllocation,
    *,
    idempotency_key: str = None,
    actor=None,
) -> LandedCostAllocation:
    """
    BF-18 (Secciones 6, 9, 10, 11): Finaliza atómicamente una LandedCostAllocation.
    - Protege contra doble confirmación concurrente con select_for_update e idempotency_key.
    - Si es finalización inicial sobre unidades en mano, actualiza CostLayer, SerialCostUnit y WAC.
    - Si la capa ya fue finalizada previamente o existen unidades ya vendidas/consumidas (gasto tardío),
      genera CostAdjustmentEntry separando el monto capitalizado al stock disponible de la variación
      sobre unidades ya vendidas, SIN reescribir jamás el costo histórico congelado en OrderItem.
    """
    if idempotency_key:
        conflict = (
            LandedCostAllocation.objects.filter(idempotency_key=idempotency_key)
            .exclude(pk=allocation.pk)
            .first()
        )
        if conflict is not None:
            raise CostingServiceError(
                f"Conflicto de idempotencia: la clave ya pertenece a la asignación '{conflict.allocation_code}'."
            )

    locked_alloc = LandedCostAllocation.objects.select_for_update().get(pk=allocation.pk)

    if locked_alloc.status == LandedCostAllocation.Status.FINALIZED:
        if idempotency_key and locked_alloc.idempotency_key and locked_alloc.idempotency_key != idempotency_key:
            raise CostingServiceError("Conflicto de idempotencia sobre asignación de Landed Cost ya finalizada.")
        return locked_alloc

    if locked_alloc.status == LandedCostAllocation.Status.CANCELLED:
        raise CostingServiceError("No se puede finalizar una asignación de Landed Cost anulada.")

    if locked_alloc.goods_receipt_id and not locked_alloc.is_late_adjustment:
        other_finalized = (
            LandedCostAllocation.objects.filter(
                goods_receipt_id=locked_alloc.goods_receipt_id,
                status=LandedCostAllocation.Status.FINALIZED,
                is_late_adjustment=False,
            )
            .exclude(pk=locked_alloc.pk)
            .exists()
        )
        if other_finalized:
            raise CostingServiceError(
                "Esta recepción ya posee un Landed Cost definitivo finalizado. "
                "Para gastos posteriores utilice un ajuste tardío versionado ('is_late_adjustment=True')."
            )

    now = timezone.now()
    val_curr = locked_alloc.valuation_currency

    for line_alloc in locked_alloc.line_allocations.select_related(
        "purchase_order_item", "goods_receipt_item", "cost_layer", "product", "variant"
    ).order_by("pk"):
        layer = line_alloc.cost_layer
        if layer is None and line_alloc.goods_receipt_item_id:
            layer = CostLayer.objects.filter(goods_receipt_item_id=line_alloc.goods_receipt_item_id).first()

        if layer is None:
            continue

        layer = CostLayer.objects.select_for_update().get(pk=layer.pk)
        prev_val_curr = layer.valuation_currency
        prev_base_unit = layer.base_unit_cost
        prev_landed_unit = layer.landed_unit_cost

        # Si la capa ya tuvo consumos o es un ajuste tardío explícito:
        if layer.is_finalized or layer.quantity_consumed > 0 or locked_alloc.is_late_adjustment:
            if layer.valuation_currency != val_curr:
                raise CostingServiceError(
                    f"El ajuste tardío debe estar en la misma moneda de valuación de la capa ('{layer.valuation_currency}')."
                )
            total_adj = line_alloc.allocated_expenses_total
            qty_rec = layer.quantity_received
            qty_on_hand = layer.quantity_available
            qty_consumed = layer.quantity_consumed
            unit_adj = (total_adj / Decimal(qty_rec)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

            cap_to_inv = (unit_adj * Decimal(qty_on_hand)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            var_consumed = (total_adj - cap_to_inv).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            new_unit_cost = (prev_landed_unit + unit_adj).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            layer.allocated_expenses_total = (layer.allocated_expenses_total + cap_to_inv).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            layer.unit_allocated_expense = (layer.unit_allocated_expense + unit_adj).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
            layer.landed_unit_cost = new_unit_cost
            layer.total_layer_cost = (layer.total_layer_cost + cap_to_inv).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            layer.remaining_layer_value = (new_unit_cost * Decimal(qty_on_hand)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            layer.status = CostLayer.Status.ADJUSTED if qty_on_hand > 0 else CostLayer.Status.DEPLETED
            layer.is_finalized = True
            layer.version += 1
            layer.save()

            # Actualizar únicamente los seriales NO consumidos (los ya vendidos permanecen congelados)
            for scu in SerialCostUnit.objects.select_for_update().filter(cost_layer=layer, is_consumed=False):
                scu.allocated_expense = (scu.allocated_expense + unit_adj).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
                scu.landed_unit_cost = (scu.landed_unit_cost + unit_adj).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
                scu.is_finalized = True
                scu.save()

            if qty_on_hand > 0:
                apply_wac_value_delta(
                    product=layer.product,
                    variant=layer.variant,
                    currency=val_curr,
                    sellable_value_delta=cap_to_inv.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP),
                )

            CostAdjustmentEntry.objects.create(
                adjustment_code=_next_code(CostAdjustmentEntry, "adjustment_code", "CADJ"),
                cost_layer=layer,
                allocation=locked_alloc,
                version=layer.version,
                currency=val_curr,
                total_adjustment_amount=total_adj,
                quantity_on_hand_at_adjustment=qty_on_hand,
                quantity_already_consumed=qty_consumed,
                capitalized_to_inventory_amount=cap_to_inv,
                variance_on_consumed_amount=var_consumed,
                previous_unit_cost=prev_landed_unit,
                new_unit_cost=new_unit_cost,
                reason=locked_alloc.notes or f"Ajuste Landed Cost {locked_alloc.allocation_code}",
                created_by=actor if getattr(actor, "is_authenticated", False) else None,
            )
        else:
            # Finalización inicial de la capa provisional
            if prev_val_curr != val_curr:
                # Si la capa provisional estaba en moneda de adquisición (ej. USD) y se finaliza en CLP:
                # retirar del WAC provisional en prev_val_curr y registrar en val_curr
                wac_old = _get_or_lock_wac_state(layer.product, layer.variant, prev_val_curr)
                old_sell_val = (prev_base_unit * Decimal(layer.quantity_available)).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
                old_dmg_val = (prev_base_unit * Decimal(layer.quantity_damaged)).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
                wac_old.sellable_quantity = max(0, wac_old.sellable_quantity - layer.quantity_available)
                wac_old.damaged_quantity = max(0, wac_old.damaged_quantity - layer.quantity_damaged)
                wac_old.total_quantity = wac_old.sellable_quantity + wac_old.damaged_quantity
                wac_old.sellable_value = max(Decimal("0.0000"), wac_old.sellable_value - old_sell_val)
                wac_old.damaged_value = max(Decimal("0.0000"), wac_old.damaged_value - old_dmg_val)
                wac_old.total_value = wac_old.sellable_value + wac_old.damaged_value
                wac_old.average_unit_cost = (
                    (wac_old.total_value / Decimal(wac_old.total_quantity)).quantize(
                        Decimal("0.0001"), rounding=ROUND_HALF_UP
                    )
                    if wac_old.total_quantity > 0
                    else Decimal("0.0000")
                )
                wac_old.save()

                record_wac_receipt(
                    product=layer.product,
                    variant=layer.variant,
                    currency=val_curr,
                    quantity_accepted=layer.quantity_available,
                    quantity_damaged=layer.quantity_damaged,
                    unit_cost=line_alloc.landed_unit_cost,
                    movement=layer.inventory_movement,
                )
            else:
                # Misma moneda: agregar el delta de gastos capitalizados al pool WAC
                qty_rec = max(1, layer.quantity_received)
                sell_share = (
                    line_alloc.allocated_expenses_total * Decimal(layer.quantity_available) / Decimal(qty_rec)
                ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                dmg_share = (
                    line_alloc.allocated_expenses_total.quantize(Decimal("0.0001")) - sell_share
                ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                apply_wac_value_delta(
                    product=layer.product,
                    variant=layer.variant,
                    currency=val_curr,
                    sellable_value_delta=sell_share,
                    damaged_value_delta=dmg_share,
                )

            layer.valuation_currency = val_curr
            if locked_alloc.po_to_valuation_fx_id:
                layer.fx_snapshot = locked_alloc.po_to_valuation_fx
            layer.base_unit_cost = line_alloc.cif_base_unit
            layer.allocated_expenses_total = line_alloc.allocated_expenses_total
            layer.unit_allocated_expense = line_alloc.allocated_expense_unit
            layer.landed_unit_cost = line_alloc.landed_unit_cost
            layer.total_layer_cost = line_alloc.landed_total_cost
            layer.remaining_layer_value = (
                line_alloc.landed_unit_cost * Decimal(layer.quantity_available)
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            layer.status = CostLayer.Status.FINALIZED
            layer.is_finalized = True
            layer.finalized_at = now
            layer.finalized_by = actor if getattr(actor, "is_authenticated", False) else None
            layer.save()

            for scu in SerialCostUnit.objects.select_for_update().filter(cost_layer=layer):
                scu.valuation_currency = val_curr
                scu.base_unit_cost = line_alloc.cif_base_unit
                scu.allocated_expense = line_alloc.allocated_expense_unit
                scu.landed_unit_cost = line_alloc.landed_unit_cost
                scu.is_finalized = True
                scu.save()

        line_alloc.cost_layer = layer
        line_alloc.save(update_fields=["cost_layer", "updated_at"])

    locked_alloc.status = LandedCostAllocation.Status.FINALIZED
    locked_alloc.finalized_at = now
    locked_alloc.finalized_by = actor if getattr(actor, "is_authenticated", False) else None
    if idempotency_key:
        locked_alloc.idempotency_key = idempotency_key
    locked_alloc.save(
        update_fields=["status", "finalized_at", "finalized_by", "idempotency_key", "updated_at"]
    )

    record_audit_event(
        module=MODULE_PURCHASES,
        action="LANDED_COST_ALLOCATION_FINALIZED",
        event_category=CATEGORY_COST_CHANGE,
        resource_type="LandedCostAllocation",
        resource_id=str(locked_alloc.id),
        resource_repr=str(locked_alloc),
        new_values={
            "allocation_code": locked_alloc.allocation_code,
            "status": locked_alloc.status,
            "total_landed_cost": str(locked_alloc.total_landed_cost),
            "valuation_currency": locked_alloc.valuation_currency,
        },
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked_alloc


@transaction.atomic
def freeze_order_cogs_on_dispatch(
    order: Order,
    *,
    movements: list[InventoryMovement] = None,
    explicit_fx_payload: dict = None,
    actor=None,
) -> list[CostConsumptionRecord]:
    """
    Sección 9, 10 y 12 + GATE 7 Preflight (OMS-PF-01, OMS-PF-02, OMS-PF-03):
    Congela el costo de venta (COGS) en cada OrderItem en el momento efectivo de salida física (DISPATCH).
    - OMS-PF-01 (Paridad WAC/FIFO): Verifica que la cantidad consumida de CostLayer (FIFO) coincida
      exactamente con la cantidad debitada del pool WAC. Si el consumo FIFO queda incompleto, lanza
      CostingServiceError para revertir atómicamente WMS, Kardex, CostLayer, WAC y OrderItem.
    - OMS-PF-02 (Coherencia Monetaria): Prohibido seleccionar automáticamente un pool WAC o CostLayer
      en otra moneda sin evidencia explícita y persistida de conversión (ExchangeRateSnapshot).
      Si no existe costo en la moneda de la orden ni conversión explícita, declara el costeo
      'pending_reconciliation' sin inventar costos cruzados.
    - OMS-PF-03 (Sincronización con IncomeRecord): Al congelar definitivamente el COGS en el despacho,
      concilia cualquier IncomeRecord de la orden cuyo costo había quedado pendiente por pago previo al despacho.
    """
    movements = movements or list(
        InventoryMovement.objects.filter(
            source_document_type="ORDER",
            source_document_id=str(order.id),
            movement_type=InventoryMovement.MovementType.DISPATCH,
        ).order_by("recorded_at")
    )
    now = timezone.now()
    order_curr = (order.currency or "CLP").strip().upper()
    consumptions = []
    any_frozen = False

    for item in OrderItem.objects.select_for_update().filter(order=order):
        if item.cost_frozen_at is not None and item.costing_method_snapshot != "pending_reconciliation":
            continue
        if item.product is None:
            continue

        product = item.product
        variant = item.variant
        qty_needed = int(item.quantity)
        if qty_needed <= 0:
            continue

        # 1. Buscar movimientos de despacho para este SKU
        item_movements = [
            m for m in movements if m.product_id == product.id and m.variant_id == (variant.id if variant else None)
        ]
        dispatched_serials = [
            sn for m in item_movements for sn in (m.serial_numbers or []) if str(sn).strip()
        ]
        wh = item_movements[0].warehouse if item_movements else Warehouse.objects.filter(is_active=True).first()

        if dispatched_serials:
            # Costeo por identificación específica de seriales
            total_serial_cost = Decimal("0.0000")
            serial_curr = None
            allocated_sns = []

            for idx, sn in enumerate(dispatched_serials[:qty_needed]):
                idem_key = f"cogs_sn:{order.id}:{item.id}:{sn}"
                existing_cc = CostConsumptionRecord.objects.filter(idempotency_key=idem_key).first()
                if existing_cc:
                    consumptions.append(existing_cc)
                    total_serial_cost += existing_cc.unit_cost
                    serial_curr = existing_cc.currency
                    allocated_sns.append(sn)
                    continue

                scu = (
                    SerialCostUnit.objects.select_for_update()
                    .select_related("cost_layer")
                    .filter(product=product, variant=variant, serial_number_snapshot=sn)
                    .first()
                )
                if scu is not None:
                    if scu.is_consumed and scu.consumed_by_order_item_id != item.id:
                        raise CostingServiceError(
                            f"El costo del número de serie '{sn}' ya fue consumido en otra venta."
                        )
                    layer = CostLayer.objects.select_for_update().get(pk=scu.cost_layer_id)
                    if not scu.is_consumed:
                        if layer.quantity_available < 1:
                            raise CostingServiceError(
                                f"La capa '{layer.layer_code}' no posee disponibilidad suficiente para consumir serial '{sn}'."
                            )
                        layer.quantity_available -= 1
                        layer.quantity_consumed += 1
                        layer.remaining_layer_value = (
                            layer.landed_unit_cost * Decimal(layer.quantity_available)
                        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                        if layer.quantity_available == 0:
                            layer.status = CostLayer.Status.DEPLETED
                        layer.save()

                        scu.is_consumed = True
                        scu.consumed_by_order = order
                        scu.consumed_by_order_item = item
                        scu.consumed_at = now
                        scu.save()

                        # Sincronizar WAC pool si estaba contabilizado
                        wac = WeightedAverageCostState.objects.select_for_update().filter(
                            product=product, variant=variant, currency=scu.valuation_currency
                        ).first()
                        if wac and wac.sellable_quantity > 0:
                            wac.sellable_quantity = max(0, wac.sellable_quantity - 1)
                            wac.total_quantity = wac.sellable_quantity + wac.damaged_quantity
                            wac.sellable_value = max(Decimal("0.0000"), wac.sellable_value - scu.landed_unit_cost)
                            wac.total_value = wac.sellable_value + wac.damaged_value
                            wac.average_unit_cost = (
                                (wac.total_value / Decimal(wac.total_quantity)).quantize(
                                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                                )
                                if wac.total_quantity > 0
                                else Decimal("0.0000")
                            )
                            wac.save()

                    u_cost = scu.landed_unit_cost
                    curr = scu.valuation_currency
                    if curr != order_curr:
                        if (
                            explicit_fx_payload
                            and str(explicit_fx_payload.get("source_currency", "")).strip().upper() == curr
                            and str(explicit_fx_payload.get("target_currency", order_curr)).strip().upper() == order_curr
                            and explicit_fx_payload.get("rate") is not None
                            and explicit_fx_payload.get("rate_source")
                        ):
                            fx_snap = create_exchange_rate_snapshot(
                                source_currency=curr,
                                target_currency=order_curr,
                                rate=explicit_fx_payload["rate"],
                                rate_source=explicit_fx_payload["rate_source"],
                                effective_date=explicit_fx_payload.get("effective_date"),
                                original_amount=u_cost,
                                actor=actor,
                            )
                            u_cost = (u_cost * fx_snap.rate).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                            curr = order_curr
                        else:
                            # OMS-PF-02: Serial en otra moneda sin conversión explícita -> conservar en su moneda real
                            # pero si la orden está en otra moneda y no hay FX, registrar en su moneda nativa de serial
                            pass

                    cc = CostConsumptionRecord.objects.create(
                        order=order,
                        order_item=item,
                        inventory_movement=item_movements[0] if item_movements else None,
                        cost_layer=layer,
                        serial_cost_unit=scu,
                        product=product,
                        variant=variant,
                        warehouse=wh,
                        quantity=1,
                        unit_cost=u_cost,
                        total_cost=u_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
                        currency=curr,
                        costing_method=CostLayer.CostingMethod.SPECIFIC_SERIAL,
                        serial_number=sn,
                        idempotency_key=idem_key,
                        actor=actor if getattr(actor, "is_authenticated", False) else None,
                    )
                    consumptions.append(cc)
                    total_serial_cost += u_cost
                    serial_curr = curr
                    allocated_sns.append(sn)

            if allocated_sns:
                avg_sn_cost = (total_serial_cost / Decimal(len(allocated_sns))).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
                item.unit_cost_snapshot = avg_sn_cost
                item.total_cost_snapshot = total_serial_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                item.cost_currency = serial_curr or order_curr
                item.costing_method_snapshot = CostLayer.CostingMethod.SPECIFIC_SERIAL
                item.allocated_serial_numbers = allocated_sns
                item.cost_frozen_at = now
                item.save(
                    update_fields=[
                        "unit_cost_snapshot",
                        "total_cost_snapshot",
                        "cost_currency",
                        "costing_method_snapshot",
                        "allocated_serial_numbers",
                        "cost_frozen_at",
                        "updated_at",
                    ]
                )
                any_frozen = True
                continue

        # 2. Costeo de inventario fungible por promedio ponderado móvil (WAC) + consumo de capas (OMS-PF-01 & OMS-PF-02)
        wac = (
            WeightedAverageCostState.objects.select_for_update()
            .filter(product=product, variant=variant, currency=order_curr, total_quantity__gt=0)
            .first()
        )
        fx_snap_for_wac = None
        if wac is None and explicit_fx_payload:
            src_curr = str(explicit_fx_payload.get("source_currency") or "").strip().upper()
            tgt_curr = str(explicit_fx_payload.get("target_currency") or order_curr).strip().upper()
            if (
                src_curr
                and tgt_curr == order_curr
                and explicit_fx_payload.get("rate") is not None
                and explicit_fx_payload.get("rate_source")
            ):
                foreign_wac = (
                    WeightedAverageCostState.objects.select_for_update()
                    .filter(product=product, variant=variant, currency=src_curr, total_quantity__gt=0)
                    .first()
                )
                if foreign_wac is not None:
                    wac = foreign_wac
                    fx_snap_for_wac = create_exchange_rate_snapshot(
                        source_currency=src_curr,
                        target_currency=order_curr,
                        rate=explicit_fx_payload["rate"],
                        rate_source=explicit_fx_payload["rate_source"],
                        effective_date=explicit_fx_payload.get("effective_date"),
                        original_amount=foreign_wac.average_unit_cost,
                        actor=actor,
                    )

        if wac is not None and wac.average_unit_cost > Decimal("0"):
            if qty_needed > wac.sellable_quantity:
                raise CostingServiceError(
                    f"Consumo de costo superior a cantidad disponible en WAC para '{wac.sku_snapshot}': "
                    f"solicitado={qty_needed}, disponible={wac.sellable_quantity}."
                )

            # OMS-PF-01: Verificar paridad estricta entre WAC y disponibilidad en CostLayer ANTES de confirmar
            pool_curr = wac.currency
            avail_layers = list(
                CostLayer.objects.select_for_update()
                .filter(product=product, variant=variant, valuation_currency=pool_curr, quantity_available__gt=0)
                .order_by("effective_date", "created_at")
            )
            total_layer_avail = sum(lyr.quantity_available for lyr in avail_layers)
            if total_layer_avail < qty_needed:
                raise CostingServiceError(
                    f"Discrepancia de paridad WAC/FIFO para '{wac.sku_snapshot}': "
                    f"WAC disponible={wac.sellable_quantity}, CostLayer disponible={total_layer_avail}, "
                    f"solicitado={qty_needed}. Salida bloqueada para preservar integridad contable."
                )

            raw_u_cost = wac.average_unit_cost
            val_deducted = (raw_u_cost * Decimal(qty_needed)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            if qty_needed == wac.sellable_quantity:
                val_deducted = wac.sellable_value

            wac.sellable_quantity -= qty_needed
            wac.total_quantity = wac.sellable_quantity + wac.damaged_quantity
            wac.sellable_value = max(Decimal("0.0000"), wac.sellable_value - val_deducted)
            wac.total_value = (wac.sellable_value + wac.damaged_value).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            if wac.total_quantity == 0:
                wac.average_unit_cost = Decimal("0.0000")
            wac.save()

            # Consumir cantidades en CostLayer (FIFO) verificando consumo exacto
            rem_to_consume = qty_needed
            primary_layer = None
            for lyr in avail_layers:
                if rem_to_consume <= 0:
                    break
                take = min(rem_to_consume, lyr.quantity_available)
                lyr.quantity_available -= take
                lyr.quantity_consumed += take
                lyr.remaining_layer_value = (
                    lyr.landed_unit_cost * Decimal(lyr.quantity_available)
                ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                if lyr.quantity_available == 0:
                    lyr.status = CostLayer.Status.DEPLETED
                lyr.save()
                if primary_layer is None:
                    primary_layer = lyr
                rem_to_consume -= take

            if rem_to_consume != 0:
                raise CostingServiceError(
                    f"Consumo FIFO incompleto para '{wac.sku_snapshot}': faltaron {rem_to_consume} unidades en CostLayer."
                )

            if fx_snap_for_wac is not None:
                u_cost = (raw_u_cost * fx_snap_for_wac.rate).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                curr = order_curr
            else:
                u_cost = raw_u_cost
                curr = pool_curr

            tot_cost = (u_cost * Decimal(qty_needed)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            idem_key = f"cogs_wac:{order.id}:{item.id}"
            cc, _ = CostConsumptionRecord.objects.get_or_create(
                idempotency_key=idem_key,
                defaults={
                    "order": order,
                    "order_item": item,
                    "inventory_movement": item_movements[0] if item_movements else None,
                    "cost_layer": primary_layer,
                    "product": product,
                    "variant": variant,
                    "warehouse": wh,
                    "quantity": qty_needed,
                    "unit_cost": u_cost,
                    "total_cost": tot_cost,
                    "currency": curr,
                    "costing_method": CostLayer.CostingMethod.WEIGHTED_AVERAGE,
                    "actor": actor if getattr(actor, "is_authenticated", False) else None,
                },
            )
            consumptions.append(cc)
            item.unit_cost_snapshot = u_cost
            item.total_cost_snapshot = tot_cost
            item.cost_currency = curr
            item.costing_method_snapshot = CostLayer.CostingMethod.WEIGHTED_AVERAGE
            item.cost_frozen_at = now
            item.save(
                update_fields=[
                    "unit_cost_snapshot",
                    "total_cost_snapshot",
                    "cost_currency",
                    "costing_method_snapshot",
                    "cost_frozen_at",
                    "updated_at",
                ]
            )
            any_frozen = True
        else:
            # OMS-PF-02: Verificar si existe WAC en OTRA moneda sin conversión explícita
            has_foreign_wac = (
                WeightedAverageCostState.objects.filter(
                    product=product, variant=variant, total_quantity__gt=0, average_unit_cost__gt=0
                )
                .exclude(currency=order_curr)
                .exists()
            )
            if has_foreign_wac or order_curr != "CLP":
                # No utilizar automáticamente costos de otra moneda como si fueran comparables.
                # Declarar el costeo pendiente de reconciliación sin inventar snapshots.
                item.unit_cost_snapshot = None
                item.total_cost_snapshot = None
                item.cost_currency = ""
                item.costing_method_snapshot = "pending_reconciliation"
                item.cost_frozen_at = None
                item.save(
                    update_fields=[
                        "unit_cost_snapshot",
                        "total_cost_snapshot",
                        "cost_currency",
                        "costing_method_snapshot",
                        "cost_frozen_at",
                        "updated_at",
                    ]
                )
            else:
                # Fallback exclusivo para inventario legacy pre-Gate 6 en CLP sin capas WAC
                cat_cost = variant.effective_cost_price if variant else product.cost_price
                if cat_cost is not None:
                    u_cost = Decimal(str(cat_cost)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                    tot_cost = (u_cost * Decimal(qty_needed)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    item.unit_cost_snapshot = u_cost
                    item.total_cost_snapshot = tot_cost
                    item.cost_currency = "CLP"
                    item.costing_method_snapshot = "catalog_fallback"
                    item.cost_frozen_at = now
                    item.save(
                        update_fields=[
                            "unit_cost_snapshot",
                            "total_cost_snapshot",
                            "cost_currency",
                            "costing_method_snapshot",
                            "cost_frozen_at",
                            "updated_at",
                        ]
                    )
                    any_frozen = True

    # OMS-PF-03: Si se congelaron costos al despachar, actualizar cualquier IncomeRecord de la orden
    # cuyas distribuciones hayan quedado pendientes de asignación de costo por pago previo al despacho.
    if any_frozen:
        from apps.analytics.models import IncomeRecord

        for inc_rec in IncomeRecord.objects.filter(order=order):
            inc_rec.create_distributions()

    return consumptions


def calculate_profitability_metrics(
    *,
    sale_price,
    sale_currency: str,
    unit_cost,
    cost_currency: str,
    quantity: int = 1,
    price_tax_basis: str = "net",
    verified_tax_rate_percent=None,
    explicit_fx_rate=None,
    min_margin_percent: Decimal = Decimal("20.00"),
) -> dict:
    """
    Sección 12 y 14: Calcula métricas reales de rentabilidad diferenciando estrictamente:
    - Margen sobre ventas (%): (IngresoNeto - Costo) / IngresoNeto * 100
    - Markup / Recargo sobre costo (%): (IngresoNeto - Costo) / Costo * 100
    - Margen bruto monetario: IngresoNeto - Costo
    Reglas de protección:
    - Prohibido convertir silenciosamente precios brutos (con impuesto incluido) a precios netos
      si no se provee 'verified_tax_rate_percent'.
    - Prohibido mezclar monedas distintas si no se provee 'explicit_fx_rate'.
    - Si faltan datos verificables, retorna status='pending_calculation' sin inventar rentabilidad.
    """
    s_curr = (sale_currency or "").strip().upper()
    c_curr = (cost_currency or "").strip().upper()
    qty = max(1, int(quantity or 1))

    if sale_price is None or unit_cost is None:
        return {
            "status": "pending_calculation",
            "reason": "missing_price_or_cost",
            "currency": s_curr or c_curr,
            "net_unit_revenue": None,
            "unit_cost": None,
            "gross_margin_unit": None,
            "gross_margin_total": None,
            "margin_on_sales_percent": None,
            "markup_on_cost_percent": None,
            "below_min_margin": False,
        }

    raw_price = _to_decimal(sale_price, "sale_price", allow_zero=True)
    raw_cost = _to_decimal(unit_cost, "unit_cost", allow_zero=True)

    # 1. Validar base tributaria del precio
    basis = (price_tax_basis or "net").strip().lower()
    if basis in ("gross", "tax_included", "iva_incluido"):
        if verified_tax_rate_percent is None:
            return {
                "status": "pending_calculation",
                "reason": "unverified_tax_rate_on_gross_price",
                "currency": s_curr,
                "net_unit_revenue": None,
                "unit_cost": str(raw_cost.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)),
                "gross_margin_unit": None,
                "gross_margin_total": None,
                "margin_on_sales_percent": None,
                "markup_on_cost_percent": None,
                "below_min_margin": False,
            }
        tax_rate = _to_decimal(verified_tax_rate_percent, "verified_tax_rate_percent", allow_zero=True)
        divisor = Decimal("1.00") + (tax_rate / Decimal("100.00"))
        net_unit_rev = (raw_price / divisor).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        net_unit_rev = raw_price.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    # 2. Validar aislamiento monetario
    if s_curr != c_curr:
        if explicit_fx_rate is None:
            return {
                "status": "pending_calculation",
                "reason": f"currency_mismatch_without_fx ({c_curr} vs {s_curr})",
                "currency": s_curr,
                "net_unit_revenue": str(net_unit_rev),
                "unit_cost": None,
                "gross_margin_unit": None,
                "gross_margin_total": None,
                "margin_on_sales_percent": None,
                "markup_on_cost_percent": None,
                "below_min_margin": False,
            }
        fx_dec = _to_decimal(explicit_fx_rate, "explicit_fx_rate", allow_zero=False)
        effective_unit_cost = (raw_cost * fx_dec).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        effective_unit_cost = raw_cost.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    gross_margin_unit = (net_unit_rev - effective_unit_cost).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    gross_margin_total = (gross_margin_unit * Decimal(qty)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    margin_on_sales = (
        ((gross_margin_unit / net_unit_rev) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if net_unit_rev > Decimal("0")
        else None
    )
    markup_on_cost = (
        ((gross_margin_unit / effective_unit_cost) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if effective_unit_cost > Decimal("0")
        else None
    )

    min_m = _to_decimal(min_margin_percent, "min_margin_percent", allow_zero=True)
    below_min = bool(margin_on_sales is not None and margin_on_sales < min_m)

    return {
        "status": "calculated",
        "reason": None,
        "currency": s_curr,
        "net_unit_revenue": net_unit_rev,
        "unit_cost": effective_unit_cost,
        "gross_margin_unit": gross_margin_unit,
        "gross_margin_total": gross_margin_total,
        "margin_on_sales_percent": margin_on_sales,
        "markup_on_cost_percent": markup_on_cost,
        "min_margin_threshold_percent": min_m,
        "below_min_margin": below_min,
    }


def resolve_effective_margin_policy(product: Product) -> tuple[Decimal, Decimal]:
    """Resuelve (min_margin_percent, target_margin_percent) aplicable al producto."""
    pol = (
        MarginPolicy.objects.filter(is_active=True, product=product).first()
        or (MarginPolicy.objects.filter(is_active=True, brand=product.brand).first() if product.brand_id else None)
        or (MarginPolicy.objects.filter(is_active=True, category=product.category).first() if product.category_id else None)
        or MarginPolicy.objects.filter(is_active=True, product__isnull=True, brand__isnull=True, category__isnull=True).first()
    )
    if pol is not None:
        return pol.min_margin_percent, pol.target_margin_percent
    return Decimal("20.00"), Decimal("35.00")


@transaction.atomic
def simulate_pricing_scenario(
    *,
    product: Product,
    variant: ProductVariant = None,
    currency: str = "CLP",
    base_landed_cost=None,
    cost_currency: str = None,
    fx_scenario_rate=None,
    proposed_net_price=None,
    target_margin_percent=None,
    tax_rate_percent=None,
    save_proposal: bool = False,
    notes: str = "",
    actor=None,
) -> dict:
    """
    Sección 14: Simulador de precios y rentabilidad.
    - No actualiza automáticamente los precios públicos del catálogo.
    - Si save_proposal=True, crea una PricingSimulationProposal en estado 'proposed'.
    """
    curr = (currency or "CLP").strip().upper()
    if curr not in SUPPORTED_CURRENCIES:
        raise CostingServiceError(f"Moneda no soportada en simulador: '{curr}'.")

    min_margin, default_target_margin = resolve_effective_margin_policy(product)
    eff_target_margin = (
        _to_decimal(target_margin_percent, "target_margin_percent", allow_zero=True)
        if target_margin_percent is not None
        else default_target_margin
    )
    if eff_target_margin >= Decimal("100.00"):
        raise CostingServiceError("El margen sobre ventas objetivo debe ser menor al 100%.")

    # Resolver costo base si no se envió explícitamente
    if base_landed_cost is not None:
        raw_cost = _to_decimal(base_landed_cost, "base_landed_cost", allow_zero=False)
        c_curr = (cost_currency or curr).strip().upper()
    else:
        wac = WeightedAverageCostState.objects.filter(
            product=product, variant=variant, currency=curr, average_unit_cost__gt=0
        ).first()
        if wac is not None:
            raw_cost = wac.average_unit_cost
            c_curr = wac.currency
        else:
            latest_layer = (
                CostLayer.objects.filter(product=product, variant=variant)
                .order_by("-effective_date", "-created_at")
                .first()
            )
            if latest_layer is not None:
                raw_cost = latest_layer.landed_unit_cost
                c_curr = latest_layer.valuation_currency
            else:
                cat_c = variant.effective_cost_price if variant else product.cost_price
                if cat_c is None or cat_c <= Decimal("0"):
                    raise CostingServiceError("El SKU no posee costo registrado para simular.")
                raw_cost = Decimal(str(cat_c))
                c_curr = "CLP"

    fx_dec = None
    if c_curr != curr:
        if fx_scenario_rate is None:
            raise CostingServiceError(
                f"El costo está en '{c_curr}' y la simulación en '{curr}'; indique 'fx_scenario_rate' explícito."
            )
        fx_dec = _to_decimal(fx_scenario_rate, "fx_scenario_rate", allow_zero=False)
        cost_in_curr = (raw_cost * fx_dec).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        if fx_scenario_rate is not None:
            fx_dec = _to_decimal(fx_scenario_rate, "fx_scenario_rate", allow_zero=False)
        cost_in_curr = raw_cost.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    if curr == "CLP":
        current_price = (variant.effective_price if variant else product.price) or Decimal("0.00")
    elif curr == "USD":
        current_price = (variant.price_usd if variant and variant.price_usd is not None else product.price_usd) or Decimal("0.00")
    else:
        current_price = (variant.price_ars if variant and variant.price_ars is not None else product.price_ars) or Decimal("0.00")

    # Precio recomendado para alcanzar target_margin_percent sobre ventas: P = C / (1 - M/100)
    recommended_net_price = (
        cost_in_curr / (Decimal("1.00") - (eff_target_margin / Decimal("100.00")))
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    min_safe_net_price = (
        cost_in_curr / (Decimal("1.00") - (min_margin / Decimal("100.00")))
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    sim_net_price = (
        _to_decimal(proposed_net_price, "proposed_net_price", allow_zero=False).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if proposed_net_price is not None
        else recommended_net_price
    )

    metrics = calculate_profitability_metrics(
        sale_price=sim_net_price,
        sale_currency=curr,
        unit_cost=cost_in_curr,
        cost_currency=curr,
        price_tax_basis="net",
        min_margin_percent=min_margin,
    )

    tax_dec = None
    gross_price = None
    if tax_rate_percent is not None:
        tax_dec = _to_decimal(tax_rate_percent, "tax_rate_percent", allow_zero=True).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        gross_price = (sim_net_price * (Decimal("1.00") + tax_dec / Decimal("100.00"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    proposal_id = None
    if save_proposal:
        prop = PricingSimulationProposal.objects.create(
            product=product,
            variant=variant,
            currency=curr,
            base_landed_cost=cost_in_curr,
            current_net_price=current_price,
            proposed_net_price=sim_net_price,
            tax_rate_percent=tax_dec,
            proposed_gross_price=gross_price,
            projected_margin_percent=metrics["margin_on_sales_percent"] or Decimal("0.00"),
            projected_markup_percent=metrics["markup_on_cost_percent"] or Decimal("0.00"),
            projected_gross_profit=metrics["gross_margin_total"] or Decimal("0.00"),
            fx_scenario_rate=fx_dec,
            status=PricingSimulationProposal.Status.PROPOSED,
            notes=notes[:255],
            created_by=actor if getattr(actor, "is_authenticated", False) else None,
        )
        proposal_id = str(prop.id)
        record_audit_event(
            module=MODULE_FINANCES,
            action="PRICING_PROPOSAL_CREATED",
            event_category=CATEGORY_PRICE_CHANGE,
            resource_type="PricingSimulationProposal",
            resource_id=proposal_id,
            resource_repr=f"{product.name} ({curr})",
            new_values={
                "currency": curr,
                "base_landed_cost": str(cost_in_curr),
                "current_net_price": str(current_price),
                "proposed_net_price": str(sim_net_price),
                "projected_margin_percent": str(metrics["margin_on_sales_percent"]),
            },
            actor=actor,
            severity=SEVERITY_INFO,
            mandatory=True,
        )

    return {
        "proposal_id": proposal_id,
        "product_id": str(product.id),
        "product_name": product.name,
        "variant_id": str(variant.id) if variant else None,
        "sku": variant.sku if variant else (product.sku or ""),
        "currency": curr,
        "base_landed_cost": str(cost_in_curr),
        "current_catalog_price": str(current_price),
        "recommended_net_price": str(recommended_net_price),
        "min_safe_net_price": str(min_safe_net_price),
        "simulated_net_price": str(sim_net_price),
        "tax_rate_percent": str(tax_dec) if tax_dec is not None else None,
        "simulated_gross_price": str(gross_price) if gross_price is not None else None,
        "projected_gross_profit": str(metrics["gross_margin_total"]),
        "projected_margin_on_sales_percent": str(metrics["margin_on_sales_percent"]),
        "projected_markup_on_cost_percent": str(metrics["markup_on_cost_percent"]),
        "min_margin_threshold_percent": str(min_margin),
        "target_margin_percent": str(eff_target_margin),
        "below_min_margin": metrics["below_min_margin"],
        "catalog_mutated": False,
    }


@transaction.atomic
def approve_and_apply_pricing_proposal(proposal: PricingSimulationProposal, *, actor=None) -> PricingSimulationProposal:
    """
    Aplica explícitamente una propuesta comercial aprobada al precio del catálogo (requiere confirmación y permiso edit_prices).
    """
    locked = PricingSimulationProposal.objects.select_for_update().get(pk=proposal.pk)
    if locked.status == PricingSimulationProposal.Status.APPROVED_APPLIED:
        return locked
    if locked.status == PricingSimulationProposal.Status.REJECTED:
        raise CostingServiceError("No se puede aplicar una propuesta de precios rechazada.")

    target_obj = locked.variant if locked.variant_id else locked.product
    prev_val = None
    if locked.currency == "CLP":
        prev_val = target_obj.price
        target_obj.price = locked.proposed_net_price
        target_obj.save(update_fields=["price", "updated_at"])
    elif locked.currency == "USD":
        prev_val = target_obj.price_usd
        target_obj.price_usd = locked.proposed_net_price
        target_obj.save(update_fields=["price_usd", "updated_at"])
    elif locked.currency == "ARS":
        prev_val = target_obj.price_ars
        target_obj.price_ars = locked.proposed_net_price
        target_obj.save(update_fields=["price_ars", "updated_at"])

    locked.status = PricingSimulationProposal.Status.APPROVED_APPLIED
    locked.approved_by = actor if getattr(actor, "is_authenticated", False) else None
    locked.approved_at = timezone.now()
    locked.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    record_audit_event(
        module=MODULE_FINANCES,
        action="PRICING_PROPOSAL_APPROVED_APPLIED",
        event_category=CATEGORY_PRICE_CHANGE,
        resource_type="PricingSimulationProposal",
        resource_id=str(locked.id),
        resource_repr=str(target_obj),
        previous_values={"price": str(prev_val) if prev_val is not None else None, "currency": locked.currency},
        new_values={"price": str(locked.proposed_net_price), "currency": locked.currency},
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked

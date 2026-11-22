# apps/procurement/services.py
"""
LEVELPRO OS V4.0 — GATE 3: Servicios Transaccionales de Proveedores (BF-01 & BF-02)
"""

from decimal import Decimal, ROUND_HALF_UP
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.procurement.models import (
    Supplier,
    ProductSupplier,
    SupplierPriceHistory,
)
from core.contracts.money import Money, SUPPORTED_CURRENCIES
from core.audit.services import record_audit_event
from core.audit.sanitizer import compute_state_diff
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_MODIFICATION,
    CATEGORY_DELETION,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)
from core.rbac.constants import MODULE_PURCHASES


def generate_supplier_internal_code() -> str:
    """Genera código interno correlativo SUP-XXXX si no se entrega uno explícito."""
    existing = Supplier.objects.filter(internal_code__startswith="SUP-").values_list("internal_code", flat=True)
    max_num = 0
    for code in existing:
        part = code.replace("SUP-", "", 1)
        if part.isdigit():
            max_num = max(max_num, int(part))
    return f"SUP-{max_num + 1:04d}"


@transaction.atomic
def deactivate_supplier(supplier: Supplier, actor) -> Supplier:
    """Desactivación lógica auditada de proveedor; preserva historial y relaciones."""
    locked = Supplier.objects.select_for_update().get(pk=supplier.pk)
    if not locked.is_active:
        return locked

    locked.is_active = False
    locked.save(update_fields=["is_active", "updated_at"])
    # Si era preferente en algún SKU, deja de serlo al quedar inactivo
    ProductSupplier.objects.filter(supplier=locked, is_preferred=True).update(is_preferred=False)

    record_audit_event(
        module=MODULE_PURCHASES,
        action="SUPPLIER_DEACTIVATED",
        event_category=CATEGORY_DELETION,
        resource_type="Supplier",
        resource_id=str(locked.id),
        resource_repr=str(locked),
        previous_values={"is_active": True},
        new_values={"is_active": False},
        changed_fields=["is_active"],
        actor=actor,
        severity=SEVERITY_WARNING,
        mandatory=True,
    )
    return locked


@transaction.atomic
def reactivate_supplier(supplier: Supplier, actor) -> Supplier:
    """Reactivación lógica auditada de proveedor."""
    locked = Supplier.objects.select_for_update().get(pk=supplier.pk)
    if locked.is_active:
        return locked

    locked.is_active = True
    locked.save(update_fields=["is_active", "updated_at"])

    record_audit_event(
        module=MODULE_PURCHASES,
        action="SUPPLIER_REACTIVATED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="Supplier",
        resource_id=str(locked.id),
        resource_repr=str(locked),
        previous_values={"is_active": False},
        new_values={"is_active": True},
        changed_fields=["is_active"],
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked


@transaction.atomic
def upsert_product_supplier(
    *,
    supplier: Supplier,
    product,
    variant=None,
    unit_cost: Decimal,
    currency: str,
    tax_basis: str = ProductSupplier.TaxBasis.NET,
    supplier_sku: str = "",
    moq: int = 1,
    lead_time_days: int = 7,
    reported_availability: str = ProductSupplier.AvailabilityStatus.UNKNOWN,
    reported_available_qty=None,
    cost_valid_from=None,
    cost_valid_until=None,
    is_active: bool = True,
    commercial_notes: str = "",
    actor=None,
    source: str = SupplierPriceHistory.Source.MANUAL,
    history_notes: str = "",
) -> tuple[ProductSupplier, bool]:
    """
    Crea o actualiza la relación producto-proveedor y registra SupplierPriceHistory
    append-only sin modificar jamás Product.price, Product.cost_price ni stock.
    """
    Money(unit_cost, currency)

    existing = (
        ProductSupplier.objects.select_for_update()
        .filter(supplier=supplier, product=product, variant=variant)
        .first()
    )

    if existing is None:
        link = ProductSupplier(
            supplier=supplier,
            product=product,
            variant=variant,
            supplier_sku=supplier_sku or "",
            unit_cost=unit_cost,
            currency=currency,
            tax_basis=tax_basis,
            moq=moq,
            lead_time_days=lead_time_days,
            reported_availability=reported_availability,
            reported_available_qty=reported_available_qty,
            availability_updated_at=timezone.now() if reported_availability != ProductSupplier.AvailabilityStatus.UNKNOWN or reported_available_qty is not None else None,
            cost_valid_from=cost_valid_from,
            cost_valid_until=cost_valid_until,
            is_active=is_active,
            commercial_notes=commercial_notes or "",
        )
        link.full_clean()
        link.save()

        SupplierPriceHistory.objects.create(
            product_supplier=link,
            supplier=supplier,
            product=product,
            variant=variant,
            previous_cost=None,
            new_cost=link.unit_cost,
            previous_currency="",
            new_currency=link.currency,
            tax_basis=link.tax_basis,
            valid_from=link.cost_valid_from,
            valid_until=link.cost_valid_until,
            changed_by=actor,
            source=SupplierPriceHistory.Source.INITIAL if source == SupplierPriceHistory.Source.MANUAL else source,
            notes=history_notes or "Alta de relación producto-proveedor",
        )

        record_audit_event(
            module=MODULE_PURCHASES,
            action="PRODUCT_SUPPLIER_LINKED",
            event_category=CATEGORY_CREATION,
            resource_type="ProductSupplier",
            resource_id=str(link.id),
            resource_repr=str(link),
            new_values={
                "supplier": supplier.internal_code,
                "sku": link.internal_sku,
                "unit_cost": str(link.unit_cost),
                "currency": link.currency,
                "tax_basis": link.tax_basis,
            },
            actor=actor,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
        return link, True

    before_state = {
        "supplier_sku": existing.supplier_sku,
        "unit_cost": str(existing.unit_cost),
        "currency": existing.currency,
        "tax_basis": existing.tax_basis,
        "moq": existing.moq,
        "lead_time_days": existing.lead_time_days,
        "reported_availability": existing.reported_availability,
        "reported_available_qty": existing.reported_available_qty,
        "cost_valid_from": existing.cost_valid_from.isoformat() if existing.cost_valid_from else None,
        "cost_valid_until": existing.cost_valid_until.isoformat() if existing.cost_valid_until else None,
        "is_active": existing.is_active,
        "is_preferred": existing.is_preferred,
        "has_commercial_notes": bool(existing.commercial_notes),
    }
    cost_changed = (
        existing.unit_cost != Decimal(str(unit_cost))
        or existing.currency != currency
        or existing.tax_basis != tax_basis
    )
    prev_cost = existing.unit_cost
    prev_currency = existing.currency

    existing.supplier_sku = supplier_sku if supplier_sku is not None else existing.supplier_sku
    existing.unit_cost = unit_cost
    existing.currency = currency
    existing.tax_basis = tax_basis
    existing.moq = moq
    existing.lead_time_days = lead_time_days
    if (
        reported_availability != existing.reported_availability
        or reported_available_qty != existing.reported_available_qty
    ):
        existing.availability_updated_at = timezone.now()
    existing.reported_availability = reported_availability
    existing.reported_available_qty = reported_available_qty
    existing.cost_valid_from = cost_valid_from
    existing.cost_valid_until = cost_valid_until
    existing.is_active = is_active
    if not is_active:
        existing.is_preferred = False
    existing.commercial_notes = commercial_notes if commercial_notes is not None else existing.commercial_notes

    existing.full_clean()
    existing.save()

    if cost_changed:
        SupplierPriceHistory.objects.create(
            product_supplier=existing,
            supplier=supplier,
            product=product,
            variant=variant,
            previous_cost=prev_cost,
            new_cost=existing.unit_cost,
            previous_currency=prev_currency,
            new_currency=existing.currency,
            tax_basis=existing.tax_basis,
            valid_from=existing.cost_valid_from,
            valid_until=existing.cost_valid_until,
            changed_by=actor,
            source=source,
            notes=history_notes or "Actualización de costo de proveedor",
        )

    after_state = {
        "supplier_sku": existing.supplier_sku,
        "unit_cost": str(existing.unit_cost),
        "currency": existing.currency,
        "tax_basis": existing.tax_basis,
        "moq": existing.moq,
        "lead_time_days": existing.lead_time_days,
        "reported_availability": existing.reported_availability,
        "reported_available_qty": existing.reported_available_qty,
        "cost_valid_from": existing.cost_valid_from.isoformat() if existing.cost_valid_from else None,
        "cost_valid_until": existing.cost_valid_until.isoformat() if existing.cost_valid_until else None,
        "is_active": existing.is_active,
        "is_preferred": existing.is_preferred,
        "has_commercial_notes": bool(existing.commercial_notes),
    }
    prev_vals, new_vals, changed = compute_state_diff(before_state, after_state)
    if changed:
        record_audit_event(
            module=MODULE_PURCHASES,
            action="SUPPLIER_COST_UPDATED" if cost_changed else "PRODUCT_SUPPLIER_UPDATED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="ProductSupplier",
            resource_id=str(existing.id),
            resource_repr=str(existing),
            previous_values=prev_vals,
            new_values=new_vals,
            changed_fields=changed,
            actor=actor,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
    return existing, False


@transaction.atomic
def select_preferred_supplier(link_id, actor) -> ProductSupplier:
    """
    Selección concurrent-safe y auditada del proveedor preferente para una unidad
    comercial (Product o ProductVariant). Bloquea todas las relaciones hermanas
    con select_for_update() en orden determinístico de PK.
    """
    target = ProductSupplier.objects.select_related("supplier", "product", "variant").get(pk=link_id)

    siblings = list(
        ProductSupplier.objects.select_for_update()
        .filter(product_id=target.product_id, variant_id=target.variant_id)
        .order_by("pk")
    )
    target = next((s for s in siblings if s.pk == target.pk), target)

    if not target.is_active or not target.supplier.is_active:
        raise ValidationError("Solo puede seleccionar como preferente un proveedor y relación activos.")

    previous_preferred = [s for s in siblings if s.is_preferred and s.pk != target.pk]
    for prev in previous_preferred:
        prev.is_preferred = False
        prev.save(update_fields=["is_preferred", "updated_at"])

    if not target.is_preferred:
        target.is_preferred = True
        target.save(update_fields=["is_preferred", "updated_at"])

    record_audit_event(
        module=MODULE_PURCHASES,
        action="PREFERRED_SUPPLIER_SELECTED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="ProductSupplier",
        resource_id=str(target.id),
        resource_repr=str(target),
        previous_values={
            "preferred_supplier": previous_preferred[0].supplier.internal_code if previous_preferred else None
        },
        new_values={
            "preferred_supplier": target.supplier.internal_code,
            "sku": target.internal_sku,
        },
        changed_fields=["is_preferred"],
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return target


def _convert_referential(amount: Decimal, from_curr: str, to_curr: str, usd_to_clp: Decimal, usd_to_ars: Decimal):
    """Convierte únicamente como referencia informativa con tasas explícitas de SiteSettings."""
    if from_curr == to_curr:
        return amount, Decimal("1")

    # Convertir a USD intermedio y luego a target
    if from_curr == "USD":
        usd_amt = amount
    elif from_curr == "CLP":
        usd_amt = amount / usd_to_clp
    elif from_curr == "ARS":
        usd_amt = amount / usd_to_ars
    else:
        return None, None

    if to_curr == "USD":
        converted = usd_amt.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        rate = (Decimal("1") / (usd_to_clp if from_curr == "CLP" else usd_to_ars)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    elif to_curr == "CLP":
        converted = (usd_amt * usd_to_clp).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        rate = usd_to_clp if from_curr == "USD" else (usd_to_clp / usd_to_ars).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    elif to_curr == "ARS":
        converted = (usd_amt * usd_to_ars).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        rate = usd_to_ars if from_curr == "USD" else (usd_to_ars / usd_to_clp).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        return None, None

    return converted, rate


def compare_suppliers_for_sku(
    product,
    variant=None,
    *,
    sort_by: str = "cost",
    include_referential: bool = False,
    target_currency: str = "CLP",
    include_costs: bool = True,
) -> dict:
    """
    Construye matriz comparativa inteligente por SKU comercial.
    - Destaca menor costo ÚNICAMENTE dentro de grupos comparables (misma moneda y base tributaria).
    - Conversión referencial opcional identificada explícitamente con fuente, tasa y fecha.
    """
    links_qs = (
        ProductSupplier.objects.select_related("supplier", "product", "variant")
        .filter(product=product, variant=variant, is_active=True, supplier__is_active=True)
    )
    if not include_costs:
        links_qs = links_qs.order_by("-is_preferred", "lead_time_days", "supplier__internal_code")
    links = list(links_qs)

    # Agrupar por (currency, tax_basis) para comparabilidad estricta
    comparable_groups = {}
    for lnk in links:
        key = (lnk.currency, lnk.tax_basis)
        comparable_groups.setdefault(key, []).append(lnk)

    lowest_by_group = {}
    for key, group_links in comparable_groups.items():
        if len(group_links) >= 2:
            min_cost = min(l.unit_cost for l in group_links)
            lowest_by_group[key] = min_cost

    referential_meta = None
    usd_to_clp = Decimal("950")
    usd_to_ars = Decimal("1000")
    if include_referential and target_currency in SUPPORTED_CURRENCIES:
        from apps.site_settings.models import SiteSettings
        ss = SiteSettings.objects.first()
        if ss:
            usd_to_clp = ss.usd_to_clp or Decimal("950")
            usd_to_ars = ss.usd_to_ars or Decimal("1000")
            rate_date = ss.updated_at.isoformat() if ss.updated_at else None
        else:
            rate_date = None
        referential_meta = {
            "target_currency": target_currency,
            "source": "SiteSettings",
            "usd_to_clp": str(usd_to_clp),
            "usd_to_ars": str(usd_to_ars),
            "rate_updated_at": rate_date,
        }

    rows = []
    for lnk in links:
        group_key = (lnk.currency, lnk.tax_basis)
        group_size = len(comparable_groups[group_key])
        is_best_comparable = (
            include_costs
            and group_key in lowest_by_group
            and lnk.unit_cost == lowest_by_group[group_key]
        )

        ref_conv = None
        if include_costs and referential_meta:
            conv_amt, eff_rate = _convert_referential(
                lnk.unit_cost, lnk.currency, target_currency, usd_to_clp, usd_to_ars
            )
            if conv_amt is not None:
                ref_conv = {
                    "target_currency": target_currency,
                    "converted_amount": str(conv_amt),
                    "effective_rate": str(eff_rate),
                    "source": "SiteSettings",
                    "rate_updated_at": referential_meta["rate_updated_at"],
                }

        row = {
            "id": str(lnk.id),
            "supplier_id": str(lnk.supplier_id),
            "supplier_code": lnk.supplier.internal_code,
            "supplier_name": lnk.supplier.trade_name or lnk.supplier.legal_name,
            "supplier_country": lnk.supplier.country,
            "supplier_type": lnk.supplier.supplier_type,
            "supplier_sku": lnk.supplier_sku,
            "moq": lnk.moq,
            "lead_time_days": lnk.lead_time_days,
            "reported_availability": lnk.reported_availability,
            "reported_available_qty": lnk.reported_available_qty,
            "availability_updated_at": lnk.availability_updated_at.isoformat() if lnk.availability_updated_at else None,
            "cost_valid_from": lnk.cost_valid_from.isoformat() if lnk.cost_valid_from else None,
            "cost_valid_until": lnk.cost_valid_until.isoformat() if lnk.cost_valid_until else None,
            "is_cost_expired": lnk.is_cost_expired,
            "is_preferred": lnk.is_preferred,
        }
        if include_costs:
            row.update({
                "payment_terms": lnk.supplier.payment_terms,
                "unit_cost": str(lnk.unit_cost),
                "currency": lnk.currency,
                "tax_basis": lnk.tax_basis,
                "is_best_comparable_cost": is_best_comparable,
                "referential_conversion": ref_conv,
                "comparable_group": f"{lnk.currency}:{lnk.tax_basis}",
                "comparable_group_size": group_size,
            })
        rows.append(row)

    if sort_by == "lead_time":
        rows.sort(key=lambda r: (r["lead_time_days"], not r["is_preferred"]))
    elif sort_by == "moq":
        rows.sort(key=lambda r: (r["moq"], r["lead_time_days"]))
    elif sort_by == "preferred":
        rows.sort(key=lambda r: (not r["is_preferred"], r["lead_time_days"]))
    elif include_costs:
        rows.sort(key=lambda r: (r["currency"], r["tax_basis"], Decimal(r["unit_cost"]), r["lead_time_days"]))
    else:
        rows.sort(key=lambda r: (not r["is_preferred"], r["lead_time_days"], r["supplier_code"]))

    return {
        "product_id": str(product.id),
        "variant_id": str(variant.id) if variant else None,
        "internal_sku": variant.sku if variant else (product.sku or ""),
        "comparable_groups_count": len(comparable_groups) if include_costs else None,
        "has_mixed_currencies": (len({k[0] for k in comparable_groups}) > 1) if include_costs else None,
        "has_mixed_tax_basis": (len({k[1] for k in comparable_groups}) > 1) if include_costs else None,
        "referential_meta": referential_meta if include_costs else None,
        "alternatives": rows,
    }

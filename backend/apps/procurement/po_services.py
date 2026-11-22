"""
LEVELPRO OS V4.0 — GATE 5: Servicios transaccionales de Órdenes de Compra (BF-03),
Recepciones de Mercadería (BF-04) y Documentación Aduanera (BF-42).
"""

import csv
import hashlib
import io
import os
import re
import xml.etree.ElementTree as ET
import zipfile
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from apps.inventory.models import InventoryMovement, Warehouse
from apps.inventory.services import InventoryServiceError, receive_stock_into_warehouse
from apps.procurement.models import (
    CustomsDocument,
    GoodsReceipt,
    GoodsReceiptItem,
    ProductSupplier,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
)
from apps.procurement.po_pdf_generator import generate_purchase_order_pdf
from apps.products.models import Product, ProductVariant, SkuRegistry, SpecialOrderRequest
from core.contracts.money import SUPPORTED_CURRENCIES


class ProcurementServiceError(Exception):
    """Error de negocio/validación transaccional en Órdenes de Compra, Recepciones y Aduanas."""
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_MODIFICATION,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)
from core.audit.services import record_audit_event

MODULE_PROCUREMENT = "purchases"

ALLOWED_DOC_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".csv", ".xml", ".docx"}
MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024
MAX_OOXML_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
MAX_OOXML_ENTRIES = 500
FORBIDDEN_FILENAME_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".bash", ".ps1", ".vbs", ".js", ".mjs",
    ".cjs", ".jar", ".msi", ".com", ".scr", ".pif", ".php", ".py", ".rb",
    ".pl", ".dll", ".so", ".dylib", ".html", ".htm", ".svg", ".hta",
}


def _next_po_number() -> str:
    year = timezone.now().year
    prefix = f"OC-{year}-"
    last = (
        PurchaseOrder.objects.filter(po_number__startswith=prefix)
        .order_by("-po_number")
        .values_list("po_number", flat=True)
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = PurchaseOrder.objects.count() + 1
    return f"{prefix}{seq:05d}"


def _next_receipt_number() -> str:
    year = timezone.now().year
    prefix = f"REC-{year}-"
    last = (
        GoodsReceipt.objects.filter(receipt_number__startswith=prefix)
        .order_by("-receipt_number")
        .values_list("receipt_number", flat=True)
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = GoodsReceipt.objects.count() + 1
    return f"{prefix}{seq:05d}"


def _build_po_items_and_totals(po: PurchaseOrder, items_payload: list[dict]) -> Decimal:
    """
    FIN-PF-01: Construye las líneas de una PurchaseOrder garantizando integridad y aislamiento monetario.
    - Valida moneda de la PO y de cada línea contra SUPPORTED_CURRENCIES (CLP, USD, ARS).
    - Valida moneda original de ProductSupplier cuando existe relación vinculada.
    - Prohíbe conversiones implícitas y sumas directas entre monedas distintas (CLP+USD, USD+ARS, etc.).
    - Conserva snapshot de moneda y costo original.
    - Acepta líneas en moneda distinta a la PO únicamente si proveen tasa de conversión explícita
      (Decimal > 0) y fuente contractual documentada.
    """
    if not items_payload:
        raise ProcurementServiceError("La orden de compra debe incluir al menos una línea.")

    po_curr = (po.currency or "").strip().upper()
    if po_curr not in SUPPORTED_CURRENCIES:
        raise ProcurementServiceError(f"Moneda de orden de compra no soportada: '{po.currency}'.")

    total = Decimal("0.00")
    for raw in items_payload:
        product = Product.objects.get(pk=raw["product_id"])
        variant_id = raw.get("variant_id") or None
        variant = ProductVariant.objects.get(pk=variant_id, product=product) if variant_id else None
        if variant is None and ProductVariant.objects.filter(product=product).exists():
            raise ProcurementServiceError(
                f"El producto '{product.name}' posee variantes; seleccione una variante específica."
            )

        ps = None
        if raw.get("product_supplier_id"):
            ps = ProductSupplier.objects.filter(pk=raw["product_supplier_id"], supplier=po.supplier).first()
            if ps is None:
                raise ProcurementServiceError("La relación ProductSupplier indicada no pertenece al proveedor de la PO.")
        if ps is None:
            ps = ProductSupplier.objects.filter(
                supplier=po.supplier, product=product, variant=variant, is_active=True
            ).first()

        sku_reg = SkuRegistry.objects.filter(product=product, variant=variant).first()
        internal_sku = variant.sku if variant else (product.sku or "")
        supplier_sku = (raw.get("supplier_sku") or (ps.supplier_sku if ps else "") or "").strip()
        desc = (
            raw.get("description")
            or (f"{product.name} — {variant.name}" if variant else product.name)
        ).strip()

        qty = int(raw["quantity_ordered"])
        if qty < 1:
            raise ProcurementServiceError("La cantidad solicitada debe ser al menos 1.")

        raw_unit_cost_val = raw.get("unit_cost")
        if isinstance(raw_unit_cost_val, float):
            raise ProcurementServiceError("Prohibido utilizar float para unit_cost. Utilice Decimal o string numérico.")

        if raw_unit_cost_val is not None:
            try:
                raw_unit_cost = Decimal(str(raw_unit_cost_val))
            except (InvalidOperation, ValueError) as exc:
                raise ProcurementServiceError(f"Costo unitario inválido para '{desc}'.") from exc
        elif ps is not None:
            raw_unit_cost = ps.unit_cost
        else:
            raise ProcurementServiceError(f"Debe especificar costo unitario para '{desc}'.")
        if raw_unit_cost < Decimal("0"):
            raise ProcurementServiceError("El costo unitario no puede ser negativo.")

        ps_curr = (ps.currency or "").strip().upper() if ps is not None else None
        explicit_line_curr = (str(raw["currency"]).strip().upper()) if raw.get("currency") is not None else None

        if explicit_line_curr is not None:
            if explicit_line_curr not in SUPPORTED_CURRENCIES:
                raise ProcurementServiceError(f"Moneda de línea '{explicit_line_curr}' no soportada.")
            orig_curr = explicit_line_curr
        elif ps_curr:
            orig_curr = ps_curr
        else:
            orig_curr = po_curr

        if orig_curr not in SUPPORTED_CURRENCIES:
            raise ProcurementServiceError(f"Moneda original '{orig_curr}' no soportada.")

        # Validar consistencia con ProductSupplier: si el catálogo del proveedor está en otra divisa,
        # no permitir asumir silenciosamente que el monto está en la moneda de la PO sin conversión o acuerdo explícito.
        if ps_curr and ps_curr != orig_curr and not raw.get("contract_currency_override"):
            raise ProcurementServiceError(
                f"Conflicto con moneda de catálogo ProductSupplier para '{desc}': "
                f"catálogo={ps_curr}, línea={orig_curr}. Prohibida la conversión implícita."
            )

        fx_rate_raw = raw.get("fx_rate") if raw.get("fx_rate") is not None else raw.get("fx_rate_snapshot")
        fx_source = (raw.get("fx_source") or raw.get("fx_rate_source") or "").strip()
        fx_date = raw.get("fx_effective_date") or None

        if orig_curr != po_curr:
            if fx_rate_raw is None or not fx_source:
                raise ProcurementServiceError(
                    f"Aislamiento monetario violado en '{desc}': no se puede sumar directamente "
                    f"moneda de línea '{orig_curr}' a una orden en '{po_curr}' sin tasa de conversión "
                    f"explícita ('fx_rate') y fuente documentada ('fx_source')."
                )
            if isinstance(fx_rate_raw, float):
                raise ProcurementServiceError("Prohibido utilizar float para fx_rate. Utilice Decimal o string numérico.")
            try:
                fx_rate = Decimal(str(fx_rate_raw))
            except (InvalidOperation, ValueError) as exc:
                raise ProcurementServiceError(f"Tasa de conversión inválida en '{desc}'.") from exc
            if fx_rate <= Decimal("0"):
                raise ProcurementServiceError("La tasa de conversión debe ser estrictamente positiva.")
            fx_rate = fx_rate.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
            effective_unit_cost = (raw_unit_cost * fx_rate).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            if fx_date is None:
                fx_date = timezone.localdate()
        else:
            if fx_rate_raw is not None:
                if isinstance(fx_rate_raw, float):
                    raise ProcurementServiceError("Prohibido utilizar float para fx_rate.")
                try:
                    provided_rate = Decimal(str(fx_rate_raw))
                except (InvalidOperation, ValueError) as exc:
                    raise ProcurementServiceError("Tasa de conversión inválida.") from exc
                if provided_rate != Decimal("1"):
                    raise ProcurementServiceError(
                        f"La moneda de la línea ('{orig_curr}') ya coincide con la PO ('{po_curr}'); "
                        f"no corresponde aplicar una tasa distinta de 1."
                    )
            fx_rate = Decimal("1.000000")
            fx_source = fx_source or "MONEDA_NATIVA_PO"
            effective_unit_cost = raw_unit_cost.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        tax_basis = (raw.get("tax_basis") or (ps.tax_basis if ps else po.tax_basis_snapshot) or "net").strip()
        line_subtotal = (effective_unit_cost * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total += line_subtotal

        PurchaseOrderItem.objects.create(
            purchase_order=po,
            product=product,
            variant=variant,
            sku_registry=sku_reg,
            product_supplier=ps,
            internal_sku_snapshot=internal_sku,
            supplier_sku_snapshot=supplier_sku,
            description_snapshot=desc[:350],
            quantity_ordered=qty,
            unit_cost_snapshot=effective_unit_cost,
            currency=po_curr,
            original_currency_snapshot=orig_curr,
            original_unit_cost_snapshot=raw_unit_cost.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP),
            fx_rate_snapshot=fx_rate,
            fx_rate_source=fx_source[:120],
            fx_effective_date=fx_date,
            tax_basis_snapshot=tax_basis[:30],
            line_subtotal=line_subtotal,
        )
    return total


def detect_ambiguous_purchase_orders() -> list[dict]:
    """
    FIN-PF-01: Inspecciona órdenes de compra existentes sin recalcular ni mutar órdenes históricas emitidas.
    Reporta cualquier orden con mezcla de divisas, discrepancia con ProductSupplier sin conversión documentada
    o descuadre aritmético de subtotales.
    """
    discrepancies = []
    pos = PurchaseOrder.objects.prefetch_related("items", "items__product_supplier").all()
    for po in pos:
        issues = []
        po_curr = (po.currency or "").strip().upper()
        calc_total = Decimal("0.00")
        for item in po.items.all():
            item_curr = (item.currency or "").strip().upper()
            orig_curr = (item.original_currency_snapshot or item_curr).strip().upper()
            calc_total += (item.line_subtotal or Decimal("0.00"))
            if item_curr != po_curr:
                issues.append(
                    f"Línea '{item.internal_sku_snapshot}' tiene moneda '{item_curr}' distinta a PO '{po_curr}'."
                )
            if orig_curr != po_curr and (not item.fx_rate_snapshot or item.fx_rate_snapshot == Decimal("1") or not item.fx_rate_source):
                issues.append(
                    f"Línea '{item.internal_sku_snapshot}' con moneda original '{orig_curr}' carece de conversión explícita hacia '{po_curr}'."
                )
            if item.product_supplier_id and item.product_supplier:
                ps_curr = (item.product_supplier.currency or "").strip().upper()
                if ps_curr and ps_curr != orig_curr and not item.fx_rate_source:
                    issues.append(
                        f"Línea '{item.internal_sku_snapshot}' difiere de moneda ProductSupplier ('{ps_curr}') sin respaldo."
                    )
        if calc_total != po.total_amount:
            issues.append(
                f"Suma de líneas ({calc_total}) no coincide con total_amount registrado ({po.total_amount})."
            )
        if issues:
            discrepancies.append({
                "po_id": str(po.id),
                "po_number": po.po_number,
                "status": po.status,
                "currency": po.currency,
                "issues": issues,
            })
    return discrepancies


@transaction.atomic
def create_purchase_order(
    *,
    supplier: Supplier,
    items: list[dict],
    destination_warehouse: Warehouse = None,
    po_number: str = "",
    currency: str = None,
    payment_terms: str = None,
    incoterm: str = "",
    tax_basis: str = "net",
    delivery_address: str = "",
    expected_delivery_date=None,
    internal_notes: str = "",
    external_notes: str = "",
    special_order_request_ids=None,
    actor=None,
) -> PurchaseOrder:
    if not supplier.is_active:
        raise ProcurementServiceError("No se puede crear una orden de compra para un proveedor inactivo.")

    po = PurchaseOrder.objects.create(
        po_number=(po_number or _next_po_number()).strip(),
        supplier=supplier,
        destination_warehouse=destination_warehouse,
        status=PurchaseOrder.Status.DRAFT,
        currency=(currency or supplier.currency or Supplier.Currency.USD).upper(),
        payment_terms_snapshot=(payment_terms if payment_terms is not None else supplier.payment_terms or ""),
        incoterm_snapshot=(incoterm or ""),
        tax_basis_snapshot=(tax_basis or "net"),
        delivery_address_snapshot=(
            delivery_address
            or (destination_warehouse.address if destination_warehouse and destination_warehouse.address else "")
        ),
        expected_delivery_date=expected_delivery_date,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
        internal_notes=internal_notes or "",
        external_notes=external_notes or "",
    )

    total = _build_po_items_and_totals(po, items)
    po.subtotal_amount = total
    po.total_amount = total
    po.save(update_fields=["subtotal_amount", "total_amount", "updated_at"])

    if special_order_request_ids:
        reqs = SpecialOrderRequest.objects.filter(pk__in=special_order_request_ids)
        po.special_order_requests.set(reqs)

    record_audit_event(
        module=MODULE_PROCUREMENT,
        action="PURCHASE_ORDER_CREATED",
        event_category=CATEGORY_CREATION,
        resource_type="PurchaseOrder",
        resource_id=str(po.id),
        resource_repr=str(po),
        new_values={"po_number": po.po_number, "supplier": supplier.internal_code, "currency": po.currency},
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return po


@transaction.atomic
def update_purchase_order(po: PurchaseOrder, *, payload: dict, actor=None) -> PurchaseOrder:
    locked = PurchaseOrder.objects.select_for_update().get(pk=po.pk)
    if locked.status not in (PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.APPROVED):
        raise ProcurementServiceError(
            f"La orden '{locked.po_number}' en estado '{locked.status}' no puede editarse directamente."
        )

    reverted_to_draft = locked.status == PurchaseOrder.Status.APPROVED
    previous_currency = locked.currency
    for field in (
        "destination_warehouse_id",
        "currency",
        "payment_terms_snapshot",
        "incoterm_snapshot",
        "tax_basis_snapshot",
        "delivery_address_snapshot",
        "expected_delivery_date",
        "internal_notes",
        "external_notes",
    ):
        if field in payload:
            setattr(locked, field, payload[field])

    if locked.currency:
        locked.currency = str(locked.currency).strip().upper()
    if locked.currency not in SUPPORTED_CURRENCIES:
        raise ProcurementServiceError(f"Moneda de PO no soportada: '{locked.currency}'.")

    if "items" in payload and payload["items"] is not None:
        locked.items.all().delete()
        total = _build_po_items_and_totals(locked, payload["items"])
        locked.subtotal_amount = total
        locked.total_amount = total
    elif locked.currency != previous_currency and locked.items.exclude(currency=locked.currency).exists():
        raise ProcurementServiceError(
            f"No se puede cambiar la moneda de la PO de '{previous_currency}' a '{locked.currency}' "
            f"sin actualizar o convertir explícitamente sus líneas."
        )

    if "special_order_request_ids" in payload and payload["special_order_request_ids"] is not None:
        reqs = SpecialOrderRequest.objects.filter(pk__in=payload["special_order_request_ids"])
        locked.special_order_requests.set(reqs)

    if reverted_to_draft:
        locked.status = PurchaseOrder.Status.DRAFT
        locked.approved_by = None
        locked.approved_at = None
        locked.revision_number += 1

    locked.save()
    record_audit_event(
        module=MODULE_PROCUREMENT,
        action="PURCHASE_ORDER_UPDATED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="PurchaseOrder",
        resource_id=str(locked.id),
        resource_repr=str(locked),
        new_values={"status": locked.status, "revision": locked.revision_number},
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked


@transaction.atomic
def approve_purchase_order(po: PurchaseOrder, *, actor=None) -> PurchaseOrder:
    locked = PurchaseOrder.objects.select_for_update().get(pk=po.pk)
    if locked.status != PurchaseOrder.Status.DRAFT:
        raise ProcurementServiceError(f"Solo órdenes en borrador pueden aprobarse (actual: {locked.status}).")
    if not locked.items.exists():
        raise ProcurementServiceError("No se puede aprobar una orden sin líneas.")

    locked.status = PurchaseOrder.Status.APPROVED
    locked.approved_by = actor if getattr(actor, "is_authenticated", False) else None
    locked.approved_at = timezone.now()
    locked.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    record_audit_event(
        module=MODULE_PROCUREMENT,
        action="PURCHASE_ORDER_APPROVED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="PurchaseOrder",
        resource_id=str(locked.id),
        resource_repr=str(locked),
        new_values={"status": locked.status},
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked


@transaction.atomic
def issue_purchase_order(po: PurchaseOrder, *, actor=None) -> PurchaseOrder:
    locked = PurchaseOrder.objects.select_for_update().get(pk=po.pk)
    if locked.status != PurchaseOrder.Status.APPROVED:
        raise ProcurementServiceError(
            f"Solo órdenes aprobadas pueden emitirse formalmente (actual: {locked.status})."
        )

    locked.status = PurchaseOrder.Status.ISSUED
    locked.issued_by = actor if getattr(actor, "is_authenticated", False) else None
    locked.issued_at = timezone.now()
    locked.issued_pdf_version += 1
    locked.issued_pdf_filename = f"{locked.po_number}-v{locked.issued_pdf_version}.pdf"
    locked.issued_pdf_bytes = generate_purchase_order_pdf(locked, include_costs=True)
    locked.save(
        update_fields=[
            "status",
            "issued_by",
            "issued_at",
            "issued_pdf_version",
            "issued_pdf_filename",
            "issued_pdf_bytes",
            "updated_at",
        ]
    )

    record_audit_event(
        module=MODULE_PROCUREMENT,
        action="PURCHASE_ORDER_ISSUED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="PurchaseOrder",
        resource_id=str(locked.id),
        resource_repr=str(locked),
        new_values={"status": locked.status, "pdf_version": locked.issued_pdf_version},
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked


@transaction.atomic
def cancel_purchase_order(po: PurchaseOrder, *, reason: str = "", actor=None) -> PurchaseOrder:
    locked = PurchaseOrder.objects.select_for_update().get(pk=po.pk)
    if locked.status not in (PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.APPROVED, PurchaseOrder.Status.ISSUED):
        raise ProcurementServiceError(f"No se puede cancelar una orden en estado '{locked.status}'.")
    if locked.goods_receipts.filter(status=GoodsReceipt.Status.CONFIRMED).exists():
        raise ProcurementServiceError("No se puede cancelar una orden con recepciones confirmadas; utilice cierre.")

    locked.status = PurchaseOrder.Status.CANCELLED
    if reason:
        locked.internal_notes = f"{locked.internal_notes}\n[Cancelación]: {reason}".strip()
    locked.save(update_fields=["status", "internal_notes", "updated_at"])
    record_audit_event(
        module=MODULE_PROCUREMENT,
        action="PURCHASE_ORDER_CANCELLED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="PurchaseOrder",
        resource_id=str(locked.id),
        resource_repr=str(locked),
        new_values={"status": locked.status, "reason": reason},
        actor=actor,
        severity=SEVERITY_WARNING,
        mandatory=True,
    )
    return locked


@transaction.atomic
def close_purchase_order(po: PurchaseOrder, *, reason: str = "", actor=None) -> PurchaseOrder:
    locked = PurchaseOrder.objects.select_for_update().get(pk=po.pk)
    if locked.status not in (PurchaseOrder.Status.PARTIALLY_RECEIVED, PurchaseOrder.Status.RECEIVED):
        raise ProcurementServiceError(f"Solo órdenes recibidas o parciales pueden cerrarse (actual: {locked.status}).")
    locked.status = PurchaseOrder.Status.CLOSED
    if reason:
        locked.internal_notes = f"{locked.internal_notes}\n[Cierre]: {reason}".strip()
    locked.save(update_fields=["status", "internal_notes", "updated_at"])
    record_audit_event(
        module=MODULE_PROCUREMENT,
        action="PURCHASE_ORDER_CLOSED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="PurchaseOrder",
        resource_id=str(locked.id),
        resource_repr=str(locked),
        new_values={"status": locked.status, "reason": reason},
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked


@transaction.atomic
def create_goods_receipt(
    *,
    purchase_order: PurchaseOrder,
    warehouse: Warehouse,
    items: list[dict],
    delivery_note_number: str = "",
    notes: str = "",
    discrepancy_notes: str = "",
    actor=None,
) -> GoodsReceipt:
    po = PurchaseOrder.objects.select_for_update().get(pk=purchase_order.pk)
    if po.status not in (PurchaseOrder.Status.ISSUED, PurchaseOrder.Status.PARTIALLY_RECEIVED):
        raise ProcurementServiceError(
            f"La orden '{po.po_number}' debe estar emitida o parcialmente recibida para recepcionar (actual: {po.status})."
        )
    if not warehouse.is_active or not warehouse.can_receive:
        raise ProcurementServiceError(f"La bodega '{warehouse.code}' no está habilitada para recepciones.")
    if not items:
        raise ProcurementServiceError("Debe incluir al menos una línea en la recepción.")

    gr = GoodsReceipt.objects.create(
        receipt_number=_next_receipt_number(),
        purchase_order=po,
        warehouse=warehouse,
        status=GoodsReceipt.Status.DRAFT,
        delivery_note_number=(delivery_note_number or "").strip(),
        notes=notes or "",
        discrepancy_notes=discrepancy_notes or "",
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )

    po_items = {str(p.id): p for p in po.items.all()}
    for raw in items:
        poi_id = str(raw["purchase_order_item_id"])
        poi = po_items.get(poi_id)
        if poi is None:
            raise ProcurementServiceError("La línea indicada no pertenece a la orden de compra.")

        accepted = int(raw.get("quantity_accepted") or 0)
        damaged = int(raw.get("quantity_damaged") or 0)
        rejected = int(raw.get("quantity_rejected") or 0)
        arrived = int(raw.get("quantity_arrived") if raw.get("quantity_arrived") is not None else (accepted + damaged + rejected))

        if accepted < 0 or damaged < 0 or rejected < 0:
            raise ProcurementServiceError("Las cantidades de recepción no pueden ser negativas.")
        if accepted + damaged + rejected != arrived:
            raise ProcurementServiceError("Aceptadas + dañadas + rechazadas debe igualar la cantidad llegada.")
        if arrived <= 0:
            raise ProcurementServiceError("Debe registrar al menos una unidad llegada por línea.")

        physical_in = accepted + damaged
        if physical_in > poi.quantity_pending:
            raise ProcurementServiceError(
                f"Sobre-recepción no permitida para '{poi.internal_sku_snapshot}': "
                f"pendiente={poi.quantity_pending}, físico a ingresar={physical_in}."
            )

        serials = [str(s).strip() for s in (raw.get("serial_numbers") or []) if str(s).strip()]
        dmg_serials = [str(s).strip() for s in (raw.get("damaged_serial_numbers") or []) if str(s).strip()]
        if dmg_serials and not set(dmg_serials).issubset(set(serials)):
            raise ProcurementServiceError("Los seriales dañados deben formar parte de los seriales recibidos.")

        gri = GoodsReceiptItem(
            goods_receipt=gr,
            purchase_order_item=poi,
            quantity_arrived=arrived,
            quantity_accepted=accepted,
            quantity_damaged=damaged,
            quantity_rejected=rejected,
            serial_numbers=serials,
            damaged_serial_numbers=dmg_serials,
            discrepancy_reason=(raw.get("discrepancy_reason") or "")[:255],
        )
        gri.full_clean()
        gri.save()

    record_audit_event(
        module=MODULE_PROCUREMENT,
        action="GOODS_RECEIPT_DRAFT_CREATED",
        event_category=CATEGORY_CREATION,
        resource_type="GoodsReceipt",
        resource_id=str(gr.id),
        resource_repr=str(gr),
        new_values={"receipt_number": gr.receipt_number, "po_number": po.po_number, "warehouse": warehouse.code},
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return gr


@transaction.atomic
def confirm_goods_receipt(
    gr: GoodsReceipt,
    *,
    idempotency_key: str = None,
    actor=None,
) -> GoodsReceipt:
    """
    Confirma atómicamente una GoodsReceipt:
    - Bloquea GoodsReceipt, PurchaseOrder y PurchaseOrderItem en orden determinístico.
    - Garantiza idempotencia fuerte (replay exacto vs conflicto con otra recepción).
    - Ejecuta entrada WMS via receive_stock_into_warehouse() (Kardex + seriales REQUIRED + dañadas no vendibles).
    - Actualiza cantidades recibidas y estado de PO (PARTIALLY_RECEIVED / RECEIVED).
    """
    if idempotency_key:
        other = GoodsReceipt.objects.filter(idempotency_key=idempotency_key).exclude(pk=gr.pk).first()
        if other is not None:
            raise ProcurementServiceError(
                f"Conflicto de idempotencia: la clave ya pertenece a la recepción '{other.receipt_number}'."
            )

    locked_gr = GoodsReceipt.objects.select_for_update().get(pk=gr.pk)
    locked_po = PurchaseOrder.objects.select_for_update().get(pk=locked_gr.purchase_order_id)

    if locked_gr.status == GoodsReceipt.Status.CONFIRMED:
        if idempotency_key and locked_gr.idempotency_key and locked_gr.idempotency_key != idempotency_key:
            raise ProcurementServiceError("Conflicto de idempotencia sobre recepción ya confirmada.")
        return locked_gr

    if locked_gr.status != GoodsReceipt.Status.DRAFT:
        raise ProcurementServiceError(f"Solo recepciones en borrador pueden confirmarse (actual: {locked_gr.status}).")
    if locked_po.status not in (PurchaseOrder.Status.ISSUED, PurchaseOrder.Status.PARTIALLY_RECEIVED):
        raise ProcurementServiceError(f"Estado de PO incompatible para confirmar recepción ('{locked_po.status}').")

    po_items_map = {
        p.id: p
        for p in PurchaseOrderItem.objects.select_for_update().filter(purchase_order=locked_po).order_by("pk")
    }
    gr_items = list(locked_gr.items.select_for_update().order_by("pk"))
    if not gr_items:
        raise ProcurementServiceError("La recepción no contiene líneas.")

    now = timezone.now()
    for item in gr_items:
        poi = po_items_map[item.purchase_order_item_id]
        physical_in = int(item.quantity_accepted) + int(item.quantity_damaged)
        if physical_in > poi.quantity_pending:
            raise ProcurementServiceError(
                f"Sobre-recepción bloqueada para '{poi.internal_sku_snapshot}': "
                f"pendiente={poi.quantity_pending}, solicitado={physical_in}."
            )
        if physical_in > 0:
            try:
                _, mov = receive_stock_into_warehouse(
                    warehouse=locked_gr.warehouse,
                    product=poi.product,
                    variant=poi.variant,
                    quantity=physical_in,
                    quantity_damaged=int(item.quantity_damaged),
                    serial_numbers=item.serial_numbers,
                    damaged_serial_numbers=item.damaged_serial_numbers,
                    movement_type=InventoryMovement.MovementType.MANUAL_IN,
                    reason=f"Recepción {locked_gr.receipt_number} (PO {locked_po.po_number})",
                    source_document_type="GOODS_RECEIPT",
                    source_document_id=str(locked_gr.id),
                    actor=actor,
                    idempotency_key=f"gr_confirm:{locked_gr.id}:item:{item.id}",
                )
            except InventoryServiceError as exc:
                raise ProcurementServiceError(str(exc)) from exc

            item.inventory_movement = mov
            item.save(update_fields=["inventory_movement", "updated_at"])
            poi.quantity_received += physical_in
            poi.save(update_fields=["quantity_received", "updated_at"])

    locked_gr.status = GoodsReceipt.Status.CONFIRMED
    locked_gr.received_at = locked_gr.received_at or now
    locked_gr.confirmed_at = now
    locked_gr.confirmed_by = actor if getattr(actor, "is_authenticated", False) else None
    if idempotency_key:
        locked_gr.idempotency_key = idempotency_key
    locked_gr.save(
        update_fields=["status", "received_at", "confirmed_at", "confirmed_by", "idempotency_key", "updated_at"]
    )

    all_items = list(po_items_map.values())
    if all(i.quantity_pending == 0 for i in all_items):
        locked_po.status = PurchaseOrder.Status.RECEIVED
    elif any(i.quantity_received > 0 for i in all_items):
        locked_po.status = PurchaseOrder.Status.PARTIALLY_RECEIVED
    locked_po.save(update_fields=["status", "updated_at"])

    # GATE 6 (BF-09): Generar atómicamente las capas de costo provisionales, SerialCostUnit y WAC
    from apps.procurement.costing_services import create_cost_layers_for_confirmed_receipt

    create_cost_layers_for_confirmed_receipt(locked_gr, actor=actor)

    record_audit_event(
        module=MODULE_PROCUREMENT,
        action="GOODS_RECEIPT_CONFIRMED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="GoodsReceipt",
        resource_id=str(locked_gr.id),
        resource_repr=str(locked_gr),
        new_values={
            "receipt_number": locked_gr.receipt_number,
            "po_number": locked_po.po_number,
            "po_status": locked_po.status,
        },
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked_gr


def validate_and_sanitize_customs_file(
    *,
    filename: str,
    content_type: str,
    file_bytes: bytes,
) -> tuple[str, str]:
    """
    FIN-PF-02: Validación profunda de documentos aduaneros/comerciales (BF-42).
    Valida extensión, nombre seguro, tamaño, tipo de contenido real, firma mágica/estructura
    y bloquea contenido activo o peligroso (PDF JS/Launch, XML XXE/DTD, CSV formula injection,
    Office macros/XXE/ZipBomb/External rels).
    """
    raw_name = (filename or "").strip()
    if not raw_name or "\x00" in raw_name:
        raise ProcurementServiceError("Nombre de archivo inválido o vacío.")
    if ".." in raw_name or "/" in raw_name or "\\" in raw_name:
        raise ProcurementServiceError("Nombre de archivo inseguro: contiene secuencias de ruta no permitidas.")

    base_name = os.path.basename(raw_name)
    parts = base_name.split(".")
    if len(parts) < 2:
        raise ProcurementServiceError("El archivo debe poseer una extensión válida.")

    ext = f".{parts[-1].lower()}"
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise ProcurementServiceError(f"Extensión '{ext}' no permitida para documentación aduanera.")

    for mid_part in parts[1:-1]:
        if f".{mid_part.lower()}" in FORBIDDEN_FILENAME_EXTENSIONS:
            raise ProcurementServiceError(
                f"Nombre de archivo rechazado por extensión intermedia peligrosa ('.{mid_part}')."
            )

    safe_stem = re.sub(r"[^A-Za-z0-9._-]", "_", ".".join(parts[:-1])).strip("._") or "document"
    safe_filename = f"{safe_stem[:200]}{ext}"

    if not file_bytes or len(file_bytes) > MAX_DOC_SIZE_BYTES:
        raise ProcurementServiceError("El archivo está vacío o excede el máximo permitido de 10 MB.")

    declared_ct = (content_type or "").split(";")[0].strip().lower()

    if ext == ".pdf":
        if declared_ct not in ("application/pdf", "application/octet-stream", ""):
            raise ProcurementServiceError(
                f"Tipo MIME anunciado ('{declared_ct}') incompatible con archivo PDF."
            )
        if not file_bytes.startswith(b"%PDF-"):
            raise ProcurementServiceError("El archivo PDF no posee una cabecera binaria válida (%PDF-).")
        lower_pdf = file_bytes.lower()
        for forbidden_token in (b"/javascript", b"/js", b"/launch", b"/submitform", b"/importdata", b"/richmedia"):
            if forbidden_token in lower_pdf:
                raise ProcurementServiceError(
                    "El archivo PDF contiene acciones ejecutables o scripts embebidos no permitidos."
                )
        return safe_filename, "application/pdf"

    if ext == ".png":
        if declared_ct not in ("image/png", "application/octet-stream", ""):
            raise ProcurementServiceError(
                f"Tipo MIME anunciado ('{declared_ct}') incompatible con imagen PNG."
            )
        if not file_bytes.startswith(b"\x89PNG\r\n\x1a\n") or b"IEND" not in file_bytes[-64:]:
            raise ProcurementServiceError("El archivo PNG no posee una firma o estructura binaria válida.")
        return safe_filename, "image/png"

    if ext in (".jpg", ".jpeg"):
        if declared_ct not in ("image/jpeg", "image/jpg", "application/octet-stream", ""):
            raise ProcurementServiceError(
                f"Tipo MIME anunciado ('{declared_ct}') incompatible con imagen JPEG."
            )
        if not file_bytes.startswith(b"\xff\xd8\xff") or not file_bytes.rstrip().endswith(b"\xff\xd9"):
            raise ProcurementServiceError("El archivo JPEG no posee marcadores binarios SOI/EOI válidos.")
        return safe_filename, "image/jpeg"

    if ext == ".xml":
        if declared_ct not in ("application/xml", "text/xml", "application/octet-stream", ""):
            raise ProcurementServiceError(
                f"Tipo MIME anunciado ('{declared_ct}') incompatible con documento XML."
            )
        if b"\x00" in file_bytes:
            raise ProcurementServiceError("El archivo XML contiene bytes nulos inválidos.")
        try:
            xml_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ProcurementServiceError("El archivo XML debe estar codificado en UTF-8 válido.") from exc
        if re.search(r"<!DOCTYPE|<!ENTITY|\bSYSTEM\b|\bPUBLIC\b|<\?xml-stylesheet|<\s*script\b", xml_text, re.IGNORECASE):
            raise ProcurementServiceError(
                "El archivo XML contiene declaraciones DTD, entidades externas (XXE) o scripts prohibidos."
            )
        try:
            ET.fromstring(xml_text)
        except ET.ParseError as exc:
            raise ProcurementServiceError("El archivo XML no posee una estructura bien formada.") from exc
        return safe_filename, "application/xml"

    if ext == ".csv":
        if declared_ct not in ("text/csv", "application/csv", "text/plain", "application/vnd.ms-excel", "application/octet-stream", ""):
            raise ProcurementServiceError(
                f"Tipo MIME anunciado ('{declared_ct}') incompatible con archivo CSV."
            )
        if b"\x00" in file_bytes or file_bytes.startswith((b"%PDF", b"PK\x03\x04", b"\x89PNG", b"\xff\xd8", b"MZ", b"\x7fELF")):
            raise ProcurementServiceError("El archivo CSV contiene contenido binario no válido.")
        try:
            csv_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ProcurementServiceError("El archivo CSV debe estar codificado en UTF-8 válido.") from exc
        if re.search(r"<\s*script\b|<!DOCTYPE|<!ENTITY", csv_text, re.IGNORECASE):
            raise ProcurementServiceError("El archivo CSV contiene etiquetas de script o markup peligroso.")
        reader = csv.reader(io.StringIO(csv_text))
        row_count = 0
        for row in reader:
            row_count += 1
            for cell in row:
                raw_cell = cell or ""
                if raw_cell.startswith(("\t", "\r")):
                    raise ProcurementServiceError("El archivo CSV contiene celdas con prefijos de inyección de fórmulas.")
                stripped = raw_cell.strip()
                if not stripped:
                    continue
                if stripped[0] in ("=", "@"):
                    raise ProcurementServiceError(
                        f"El archivo CSV contiene posibles fórmulas ejecutables ('{stripped[:20]}')."
                    )
                if stripped[0] in ("+", "-") and not re.match(r"^[+-]?\d+([.,]\d+)?$", stripped):
                    raise ProcurementServiceError(
                        f"El archivo CSV contiene expresión potencialmente peligrosa ('{stripped[:20]}')."
                    )
        if row_count == 0:
            raise ProcurementServiceError("El archivo CSV no contiene filas válidas.")
        return safe_filename, "text/csv; charset=utf-8"

    if ext in (".xlsx", ".docx"):
        expected_ct = (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            if ext == ".xlsx"
            else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        if declared_ct not in (expected_ct, "application/octet-stream", ""):
            raise ProcurementServiceError(
                f"Tipo MIME anunciado ('{declared_ct}') incompatible con documento Office '{ext}'."
            )
        if not file_bytes.startswith(b"PK\x03\x04"):
            raise ProcurementServiceError(f"El archivo '{ext}' no posee una cabecera contenedor OpenXML válida.")
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as zf:
                infos = zf.infolist()
                if not infos or len(infos) > MAX_OOXML_ENTRIES:
                    raise ProcurementServiceError("Estructura interna del documento Office excede límites de seguridad.")
                names = set()
                total_uncompressed = 0
                for info in infos:
                    entry_name = info.filename
                    if ".." in entry_name or entry_name.startswith(("/", "\\")):
                        raise ProcurementServiceError("El documento Office contiene rutas internas maliciosas.")
                    lower_entry = entry_name.lower()
                    if (
                        "vbaproject" in lower_entry
                        or "activex" in lower_entry
                        or "oleobject" in lower_entry
                        or lower_entry.endswith((".bin", ".exe", ".js", ".vbs", ".bat", ".cmd", ".ps1"))
                    ):
                        raise ProcurementServiceError(
                            "El documento Office contiene macros VBA, objetos OLE o binarios embebidos prohibidos."
                        )
                    total_uncompressed += info.file_size
                    if total_uncompressed > MAX_OOXML_UNCOMPRESSED_BYTES:
                        raise ProcurementServiceError("El documento Office excede el tamaño descomprimido máximo permitido.")
                    names.add(entry_name)
                    if lower_entry.endswith((".xml", ".rels")):
                        xml_bytes = zf.read(info)
                        if re.search(br"<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*[\"']External[\"']", xml_bytes, re.IGNORECASE):
                            raise ProcurementServiceError(
                                "El documento Office contiene entidades XML externas o relaciones remotas prohibidas."
                            )
                if "[Content_Types].xml" not in names:
                    raise ProcurementServiceError(f"El archivo '{ext}' carece de '[Content_Types].xml'.")
                required_part = "xl/workbook.xml" if ext == ".xlsx" else "word/document.xml"
                if required_part not in names:
                    raise ProcurementServiceError(
                        f"El archivo '{ext}' no contiene la estructura OpenXML requerida ('{required_part}')."
                    )
        except zipfile.BadZipFile as exc:
            raise ProcurementServiceError(f"El archivo '{ext}' está corrupto o no es un paquete OpenXML válido.") from exc
        return safe_filename, expected_ct

    raise ProcurementServiceError(f"Extensión '{ext}' no soportada.")


@transaction.atomic
def upload_customs_document(
    *,
    purchase_order: PurchaseOrder,
    document_type: str,
    document_identifier: str,
    filename: str,
    content_type: str,
    file_bytes: bytes,
    document_date=None,
    notes: str = "",
    sensitivity_level: str = None,
    actor=None,
) -> CustomsDocument:
    if document_type not in CustomsDocument.DocumentType.values:
        raise ProcurementServiceError("Tipo de documento aduanero/comercial inválido.")
    if not (document_identifier or "").strip():
        raise ProcurementServiceError("Debe indicar el identificador del documento aduanero/comercial.")

    safe_filename, canonical_ct = validate_and_sanitize_customs_file(
        filename=filename,
        content_type=content_type,
        file_bytes=file_bytes,
    )

    if document_type in CustomsDocument.FINANCIAL_DOCUMENT_TYPES:
        effective_sensitivity = CustomsDocument.SensitivityLevel.FINANCIAL
    elif sensitivity_level in CustomsDocument.SensitivityLevel.values:
        effective_sensitivity = sensitivity_level
    else:
        effective_sensitivity = CustomsDocument.SensitivityLevel.OPERATIONAL

    sha256 = hashlib.sha256(file_bytes).hexdigest()
    prev = (
        CustomsDocument.objects.select_for_update()
        .filter(
            purchase_order=purchase_order,
            document_type=document_type,
            document_identifier=document_identifier.strip(),
        )
        .order_by("-version")
        .first()
    )
    next_ver = (prev.version + 1) if prev else 1
    if prev and prev.status != CustomsDocument.Status.ARCHIVED:
        prev.status = CustomsDocument.Status.SUPERSEDED
        prev.save(update_fields=["status", "updated_at"])

    doc = CustomsDocument.objects.create(
        purchase_order=purchase_order,
        document_type=document_type,
        sensitivity_level=effective_sensitivity,
        document_identifier=document_identifier.strip(),
        document_date=document_date,
        filename=safe_filename[:255],
        content_type=canonical_ct[:100],
        file_size=len(file_bytes),
        file_sha256=sha256,
        file_bytes=file_bytes,
        version=next_ver,
        status=CustomsDocument.Status.UPLOADED,
        notes=notes or "",
        uploaded_by=actor if getattr(actor, "is_authenticated", False) else None,
    )

    record_audit_event(
        module=MODULE_PROCUREMENT,
        action="CUSTOMS_DOCUMENT_UPLOADED",
        event_category=CATEGORY_CREATION,
        resource_type="CustomsDocument",
        resource_id=str(doc.id),
        resource_repr=str(doc),
        new_values={
            "po_number": purchase_order.po_number,
            "document_type": document_type,
            "sensitivity_level": effective_sensitivity,
            "identifier": doc.document_identifier,
            "filename": safe_filename,
            "content_type": canonical_ct,
            "version": next_ver,
            "sha256": sha256,
        },
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return doc

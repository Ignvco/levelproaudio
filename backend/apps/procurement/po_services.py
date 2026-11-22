"""
LEVELPRO OS V4.0 — GATE 5: Servicios transaccionales de Órdenes de Compra (BF-03),
Recepciones de Mercadería (BF-04) y Documentación Aduanera (BF-42).
"""

import hashlib
import os
from decimal import Decimal

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
    if not items_payload:
        raise ProcurementServiceError("La orden de compra debe incluir al menos una línea.")

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

        if raw.get("unit_cost") is not None:
            unit_cost = Decimal(str(raw["unit_cost"]))
        elif ps is not None:
            unit_cost = ps.unit_cost
        else:
            raise ProcurementServiceError(f"Debe especificar costo unitario para '{desc}'.")
        if unit_cost < Decimal("0"):
            raise ProcurementServiceError("El costo unitario no puede ser negativo.")

        line_currency = (raw.get("currency") or po.currency).upper()
        tax_basis = (raw.get("tax_basis") or (ps.tax_basis if ps else po.tax_basis_snapshot) or "net").strip()
        line_subtotal = (unit_cost * qty).quantize(Decimal("0.01"))
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
            unit_cost_snapshot=unit_cost,
            currency=line_currency,
            tax_basis_snapshot=tax_basis[:30],
            line_subtotal=line_subtotal,
        )
    return total


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

    if "items" in payload and payload["items"] is not None:
        locked.items.all().delete()
        total = _build_po_items_and_totals(locked, payload["items"])
        locked.subtotal_amount = total
        locked.total_amount = total

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
    actor=None,
) -> CustomsDocument:
    if document_type not in CustomsDocument.DocumentType.values:
        raise ProcurementServiceError("Tipo de documento aduanero/comercial inválido.")
    if not file_bytes or len(file_bytes) > MAX_DOC_SIZE_BYTES:
        raise ProcurementServiceError("El archivo está vacío o excede el máximo permitido de 10 MB.")

    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise ProcurementServiceError(f"Extensión '{ext}' no permitida para documentación aduanera.")
    if ext == ".pdf" and not file_bytes.lstrip().startswith(b"%PDF-"):
        raise ProcurementServiceError("El archivo PDF no posee una cabecera válida (%PDF-).")

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
        document_identifier=document_identifier.strip(),
        document_date=document_date,
        filename=os.path.basename(filename)[:255],
        content_type=(content_type or "application/octet-stream")[:100],
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
            "identifier": doc.document_identifier,
            "version": next_ver,
            "sha256": sha256,
        },
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return doc

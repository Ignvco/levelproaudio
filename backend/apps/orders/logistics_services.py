# apps/orders/logistics_services.py
"""
LEVELPRO OS V4.0 — GATE 10: LOGISTICS & AFTER-SALES SERVICES
- BF-25: Shipments, Packages, Quotes, Labels, Manifests, Tracking, Incidents, Notifications
- BF-22: Warranty Validation & Claims (vinculado a SerialNumberTrack y RMA Gate 7)
- BF-43: RepairWorkOrder, Diagnosis, Budget, WMS Parts Consumption, Testing & Delivery
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import secrets
from typing import Optional

from django.db import transaction
from django.utils import timezone

from apps.inventory.models import InventoryMovement, SerialNumberTrack, StockReservation, Warehouse
from apps.inventory.services import InventoryServiceError, adjust_stock, get_default_warehouse
from apps.orders.courier_adapters import ensure_default_carriers_seeded, get_courier_adapter
from apps.orders.logistics_models import (
    Carrier,
    CarrierService,
    DeliveryIncident,
    LogisticsNotificationOutbox,
    RepairDelivery,
    RepairDiagnosis,
    RepairPartUsage,
    RepairTestResult,
    RepairWorkOrder,
    Shipment,
    ShipmentLabel,
    ShipmentPackage,
    ShippingManifest,
    ShippingManifestItem,
    ShippingQuoteSnapshot,
    TrackingEvent,
    WarrantyClaim,
    WarrantyPolicySnapshot,
)
from apps.orders.logistics_pdf import render_shipping_label_pdf, render_shipping_manifest_pdf
from apps.orders.logistics_preflight import (
    confirm_physical_dispatch_once,
    resolve_serial_warranty_evidence,
    validate_rma_warranty_link,
)
from apps.orders.models import Order, OrderItem, ReturnMerchandiseAuthorization
from apps.products.models import Product, ProductVariant
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_MODIFICATION,
    SEVERITY_INFO,
)
from core.audit.services import record_audit_event
from core.contracts.states import FulfillmentStatus


class LogisticsServiceError(ValueError):
    """Error de regla operativa en Logística o Posventa Gate 10."""


def _next_log_code(model_cls, field_name: str, prefix: str) -> str:
    today_str = timezone.now().strftime("%Y%m%d")
    base = f"{prefix}-{today_str}-"
    count = model_cls.objects.filter(**{f"{field_name}__startswith": base}).count()
    return f"{base}{count + 1:04d}"


# ═══════════════════════════════════════════════════════════════════════════
# 1. BF-25: SHIPMENTS, BULTOS, COTIZACIONES Y ETIQUETAS
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def create_shipment_for_order(
    order: Order,
    *,
    warehouse: Optional[Warehouse] = None,
    carrier: Optional[Carrier] = None,
    carrier_service: Optional[CarrierService] = None,
    is_partial: bool = False,
    idempotency_key: Optional[str] = None,
    actor=None,
) -> Shipment:
    if idempotency_key:
        existing = Shipment.objects.filter(idempotency_key=idempotency_key).first()
        if existing is not None:
            return existing

    locked_order = Order.objects.select_for_update().get(pk=order.pk)
    if locked_order.status == "cancelled" or locked_order.commercial_status == "cancelled":
        raise LogisticsServiceError("No se puede crear un envío para una orden cancelada.")

    if not is_partial:
        active_existing = Shipment.objects.filter(order=locked_order).exclude(
            status=Shipment.Status.CANCELLED
        ).first()
        if active_existing is not None:
            raise LogisticsServiceError(
                f"La orden ya posee un envío activo ({active_existing.shipment_number}). Utilice despacho parcial si corresponde."
            )

    wh = warehouse or get_default_warehouse()
    shp = Shipment.objects.create(
        shipment_number=_next_log_code(Shipment, "shipment_number", "SHP"),
        order=locked_order,
        warehouse=wh,
        carrier=carrier,
        carrier_service=carrier_service,
        destination_address=locked_order.shipping_address or "Por confirmar",
        destination_city=(getattr(locked_order, "shipping_city", "") or "Santiago")[:120],
        destination_country=(getattr(locked_order, "shipping_country", "") or "CL")[:10],
        status=Shipment.Status.RESERVED,
        is_partial=is_partial,
        idempotency_key=idempotency_key,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
    record_audit_event(
        module="orders",
        action="SHIPMENT_CREATED",
        event_category=CATEGORY_CREATION,
        resource_type="Shipment",
        resource_id=str(shp.id),
        resource_repr=str(shp),
        actor=actor,
        new_values={"order_id": str(locked_order.id), "warehouse": wh.code, "is_partial": is_partial},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return shp


@transaction.atomic
def add_package_to_shipment(
    shipment: Shipment,
    *,
    gross_weight_kg: Decimal,
    length_cm: Decimal,
    width_cm: Decimal,
    height_cm: Decimal,
    is_fragile: bool = False,
    declared_value: Decimal = Decimal("0.00"),
    currency: str = "CLP",
    commercial_content: str = "",
    items_snapshot: Optional[list] = None,
) -> ShipmentPackage:
    shp = Shipment.objects.select_for_update().get(pk=shipment.pk)
    if shp.status in (Shipment.Status.HANDED_OVER, Shipment.Status.IN_TRANSIT, Shipment.Status.DELIVERED, Shipment.Status.CANCELLED):
        raise LogisticsServiceError(f"No se pueden agregar bultos a un envío en estado '{shp.status}'.")

    gw = Decimal(str(gross_weight_kg or "0"))
    ln = Decimal(str(length_cm or "0"))
    wd = Decimal(str(width_cm or "0"))
    hg = Decimal(str(height_cm or "0"))
    if gw <= Decimal("0") or ln <= Decimal("0") or wd <= Decimal("0") or hg <= Decimal("0"):
        raise LogisticsServiceError("Peso bruto y dimensiones (largo, ancho, alto) deben ser mayores que cero.")

    divisor = shp.carrier.volumetric_divisor if shp.carrier_id else Decimal("4000.00")
    vol_weight = ((ln * wd * hg) / divisor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    billable = max(gw.quantize(Decimal("0.01")), vol_weight).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    existing_count = shp.packages.count()
    pkg_num = existing_count + 1
    pkg = ShipmentPackage.objects.create(
        shipment=shp,
        package_number=pkg_num,
        total_packages=pkg_num,
        gross_weight_kg=gw.quantize(Decimal("0.01")),
        length_cm=ln.quantize(Decimal("0.01")),
        width_cm=wd.quantize(Decimal("0.01")),
        height_cm=hg.quantize(Decimal("0.01")),
        volumetric_weight_kg=vol_weight,
        billable_weight_kg=billable,
        is_fragile=is_fragile,
        declared_value=Decimal(str(declared_value or "0.00")).quantize(Decimal("0.01")),
        currency=currency.strip().upper(),
        commercial_content=commercial_content[:255],
        items_snapshot=items_snapshot or [],
    )
    shp.packages.update(total_packages=pkg_num)
    return pkg


@transaction.atomic
def quote_and_assign_carrier(
    shipment: Shipment,
    *,
    carrier: Carrier,
    carrier_service: CarrierService,
) -> ShippingQuoteSnapshot:
    shp = Shipment.objects.select_for_update().get(pk=shipment.pk)
    pkgs = list(shp.packages.all())
    if not pkgs:
        raise LogisticsServiceError("Registre al menos un bulto con peso y dimensiones antes de cotizar transporte.")

    total_phys = sum(p.gross_weight_kg for p in pkgs)
    total_vol = sum(p.volumetric_weight_kg for p in pkgs)
    total_bill = sum(p.billable_weight_kg for p in pkgs)

    adapter = get_courier_adapter(carrier)
    res = adapter.get_rates(
        country=shp.destination_country or carrier.country,
        destination=shp.destination_city or "Santiago",
        currency=carrier_service.currency,
        weight_kg=total_phys,
        length_cm=pkgs[0].length_cm,
        width_cm=pkgs[0].width_cm,
        height_cm=pkgs[0].height_cm,
    )
    matched = next((r for r in res["rates"] if r["service_code"] == carrier_service.service_code), None)
    amount = Decimal(str(matched["price"])) if matched else (carrier_service.base_fee + total_bill * carrier_service.per_kg_fee).quantize(Decimal("0.01"))

    snap = ShippingQuoteSnapshot.objects.create(
        order=shp.order,
        carrier=carrier,
        carrier_service=carrier_service,
        origin=f"{shp.warehouse.name}",
        destination=f"{shp.destination_city}, {shp.destination_country}",
        currency=carrier_service.currency,
        physical_weight_kg=total_phys,
        volumetric_weight_kg=total_vol,
        billable_weight_kg=total_bill,
        amount=amount,
        quote_source=matched["quote_source"] if matched else "qa_simulation",
        verification_status=matched["verification_status"] if matched else "simulated_qa_only",
        is_commercial_valid=matched["is_commercial_valid"] if matched else False,
        payload_snapshot=res,
    )
    shp.carrier = carrier
    shp.carrier_service = carrier_service
    shp.quote_snapshot = snap
    shp.save(update_fields=["carrier", "carrier_service", "quote_snapshot", "updated_at"])
    return snap


@transaction.atomic
def advance_shipment_preparation(shipment: Shipment, *, target_status: str, actor=None) -> Shipment:
    shp = Shipment.objects.select_for_update().get(pk=shipment.pk)
    allowed = {
        Shipment.Status.RESERVED: {Shipment.Status.PREPARING},
        Shipment.Status.PREPARING: {Shipment.Status.PACKED},
        Shipment.Status.PACKED: {Shipment.Status.READY_FOR_PICKUP},
    }
    if target_status not in allowed.get(shp.status, set()):
        raise LogisticsServiceError(f"Transición operativa inválida: '{shp.status}' -> '{target_status}'.")
    if target_status in (Shipment.Status.PACKED, Shipment.Status.READY_FOR_PICKUP) and not shp.packages.exists():
        raise LogisticsServiceError("Debe registrar al menos un bulto antes de completar empaque.")
    shp.status = target_status
    shp.save(update_fields=["status", "updated_at"])
    if target_status == Shipment.Status.PREPARING:
        enqueue_logistics_notification(shp.order, event_type="order_preparing")
    return shp


@transaction.atomic
def generate_shipment_labels(
    shipment: Shipment,
    *,
    label_type: str = ShipmentLabel.LabelType.INTERNAL_LOGISTIC,
    actor=None,
) -> list[ShipmentLabel]:
    """
    Genera etiquetas imprimibles PDF (idempotentes por bulto).
    NUNCA descuenta inventario WMS ni equivale a DTE oficial.
    """
    shp = Shipment.objects.select_for_update().get(pk=shipment.pk)
    pkgs = list(shp.packages.all())
    if not pkgs:
        raise LogisticsServiceError("Debe registrar al menos un bulto antes de generar etiquetas.")

    if not shp.tracking_number:
        if shp.carrier_id:
            adapter = get_courier_adapter(shp.carrier)
            ext = adapter.create_shipment(
                shipment_number=shp.shipment_number,
                destination=shp.destination_city,
                currency=shp.order.currency,
            )
            shp.tracking_number = ext["tracking_number"]
            shp.external_reference = ext["external_id"]
        else:
            shp.tracking_number = f"INT-{shp.shipment_number}"
        shp.save(update_fields=["tracking_number", "external_reference", "updated_at"])

    labels = []
    for pkg in pkgs:
        idem = f"LBL-{shp.id}-{pkg.id}-{label_type}"
        existing = ShipmentLabel.objects.filter(idempotency_key=idem).first()
        if existing is not None:
            labels.append(existing)
            continue
        barcode_val = f"{shp.tracking_number}-P{pkg.package_number:02d}"
        lbl = ShipmentLabel.objects.create(
            shipment=shp,
            package=pkg,
            label_type=label_type,
            barcode_value=barcode_val,
            tracking_number=shp.tracking_number,
            is_official_dte=False,
            generated_by=actor if getattr(actor, "is_authenticated", False) else None,
            idempotency_key=idem,
        )
        _, sha = render_shipping_label_pdf(lbl)
        lbl.pdf_sha256 = sha
        lbl.save(update_fields=["pdf_sha256", "updated_at"])
        labels.append(lbl)

    record_tracking_event(
        shp,
        original_code="LABEL_CREATED",
        source="simulated_qa",
        verification_status="simulated",
        location=shp.warehouse.name,
        external_event_id=f"LBL-{shp.shipment_number}",
    )
    return labels


# ═══════════════════════════════════════════════════════════════════════════
# 2. BF-25: MANIFIESTOS DE DESPACHO & CONFIRMACIÓN FÍSICA
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def create_shipping_manifest(
    *,
    warehouse: Warehouse,
    carrier: Carrier,
    operational_date: Optional[date] = None,
    actor=None,
) -> ShippingManifest:
    return ShippingManifest.objects.create(
        manifest_number=_next_log_code(ShippingManifest, "manifest_number", "MAN"),
        operational_date=operational_date or timezone.now().date(),
        warehouse=warehouse,
        carrier=carrier,
        responsible=actor if getattr(actor, "is_authenticated", False) else None,
        status=ShippingManifest.Status.DRAFT,
    )


@transaction.atomic
def add_shipment_to_manifest(manifest: ShippingManifest, shipment: Shipment) -> ShippingManifestItem:
    man = ShippingManifest.objects.select_for_update().get(pk=manifest.pk)
    if man.status in (ShippingManifest.Status.CLOSED, ShippingManifest.Status.HANDED_OVER, ShippingManifest.Status.CANCELLED):
        raise LogisticsServiceError("No se pueden añadir envíos a un manifiesto cerrado, entregado o cancelado.")
    shp = Shipment.objects.select_for_update().get(pk=shipment.pk)
    if shp.warehouse_id != man.warehouse_id or shp.carrier_id != man.carrier_id:
        raise LogisticsServiceError("El envío debe coincidir en bodega y transportista con el manifiesto.")
    if hasattr(shp, "manifest_item"):
        raise LogisticsServiceError("El envío ya pertenece a un manifiesto.")

    item = ShippingManifestItem.objects.create(manifest=man, shipment=shp)
    man.total_shipments = man.items.count()
    man.total_packages = sum(i.shipment.packages.count() for i in man.items.select_related("shipment"))
    man.status = ShippingManifest.Status.READY
    man.save(update_fields=["total_shipments", "total_packages", "status", "updated_at"])
    return item


@transaction.atomic
def close_shipping_manifest(manifest: ShippingManifest, *, actor=None) -> ShippingManifest:
    man = ShippingManifest.objects.select_for_update().get(pk=manifest.pk)
    if man.status == ShippingManifest.Status.CLOSED:
        return man
    if man.status not in (ShippingManifest.Status.DRAFT, ShippingManifest.Status.READY):
        raise LogisticsServiceError(f"No se puede cerrar manifiesto en estado '{man.status}'.")
    if not man.items.exists():
        raise LogisticsServiceError("El manifiesto debe contener al menos un envío para cerrarse.")

    items_snap = []
    total_pkgs = 0
    for it in man.items.select_related("shipment").all():
        shp = it.shipment
        p_count = shp.packages.count()
        total_pkgs += p_count
        items_snap.append({
            "shipment_id": str(shp.id),
            "shipment_number": shp.shipment_number,
            "order_ref": str(shp.order_id)[:8].upper(),
            "tracking_number": shp.tracking_number or shp.shipment_number,
            "packages_count": p_count,
            "destination": f"{shp.destination_city}, {shp.destination_country}",
            "status": shp.status,
        })

    man.total_shipments = len(items_snap)
    man.total_packages = total_pkgs
    man.status = ShippingManifest.Status.CLOSED
    man.closed_at = timezone.now()
    man.closed_snapshot = {"items": items_snap, "closed_at": man.closed_at.isoformat()}
    man.save()
    _, sha = render_shipping_manifest_pdf(man)
    man.pdf_sha256 = sha
    man.save(update_fields=["pdf_sha256", "updated_at"])

    record_audit_event(
        module="orders",
        action="MANIFEST_CLOSED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="ShippingManifest",
        resource_id=str(man.id),
        resource_repr=str(man),
        actor=actor,
        new_values={"total_shipments": man.total_shipments, "total_packages": man.total_packages, "pdf_sha256": sha},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return man


@transaction.atomic
def handover_shipping_manifest(
    manifest: ShippingManifest,
    *,
    handover_evidence: str,
    serial_assignments_by_order: Optional[dict] = None,
    actor=None,
) -> ShippingManifest:
    """
    Confirma entrega física al transportista:
    - Ejecuta confirm_physical_dispatch_once() exactamente una vez por envío.
    - Descuenta WMS y congela COGS vía OMS/WMS sin duplicaciones.
    """
    man = ShippingManifest.objects.select_for_update().get(pk=manifest.pk)
    if man.status == ShippingManifest.Status.HANDED_OVER:
        return man
    if man.status != ShippingManifest.Status.CLOSED:
        raise LogisticsServiceError("El manifiesto debe estar cerrado antes de confirmar retiro del transportista.")

    for it in man.items.select_related("shipment", "shipment__order").all():
        shp = it.shipment
        if shp.status != Shipment.Status.HANDED_OVER:
            serial_map = (serial_assignments_by_order or {}).get(str(shp.order_id))
            confirm_physical_dispatch_once(
                shp.order,
                shipping_carrier=man.carrier.name,
                tracking_number=shp.tracking_number or shp.shipment_number,
                serial_assignments=serial_map,
                reason=f"Despacho físico Manifiesto {man.manifest_number}",
                actor=actor,
            )
            shp.status = Shipment.Status.HANDED_OVER
            shp.dispatched_by = actor if getattr(actor, "is_authenticated", False) else None
            shp.dispatched_at = timezone.now()
            shp.save(update_fields=["status", "dispatched_by", "dispatched_at", "updated_at"])
            record_tracking_event(
                shp,
                original_code="PICKED_UP",
                source="simulated_qa",
                verification_status="simulated",
                location=man.warehouse.name,
                external_event_id=f"PICKUP-{man.manifest_number}-{shp.shipment_number}",
            )
            enqueue_logistics_notification(shp.order, event_type="order_dispatched")

    man.status = ShippingManifest.Status.HANDED_OVER
    man.handed_over_at = timezone.now()
    man.handover_evidence = (handover_evidence or "Retiro confirmado en bodega")[:255]
    man.save(update_fields=["status", "handed_over_at", "handover_evidence", "updated_at"])
    return man


# ═══════════════════════════════════════════════════════════════════════════
# 3. BF-25: TRACKING, INCIDENCIAS Y NOTIFICACIONES
# ═══════════════════════════════════════════════════════════════════════════

TERMINAL_SHIPMENT_STATUSES = {Shipment.Status.DELIVERED, Shipment.Status.CANCELLED}


@transaction.atomic
def record_tracking_event(
    shipment: Shipment,
    *,
    original_code: str,
    source: str = "simulated_qa",
    verification_status: str = "simulated",
    location: str = "",
    external_event_id: str = "",
    occurred_at=None,
    raw_payload: Optional[dict] = None,
    actor=None,
) -> TrackingEvent:
    shp = Shipment.objects.select_for_update().get(pk=shipment.pk)
    if external_event_id:
        existing = TrackingEvent.objects.filter(shipment=shp, external_event_id=external_event_id).first()
        if existing is not None:
            return existing

    adapter = get_courier_adapter(shp.carrier) if shp.carrier_id else None
    norm = adapter.normalize_tracking_event(original_code) if adapter else TrackingEvent.NormalizedStatus.IN_TRANSIT

    ev = TrackingEvent.objects.create(
        shipment=shp,
        external_event_id=external_event_id,
        original_code=original_code[:80],
        normalized_status=norm,
        source=source,
        verification_status=verification_status,
        location=location[:160],
        occurred_at=occurred_at or timezone.now(),
        raw_payload=raw_payload or {},
    )

    # No retroceder estado terminal por eventos fuera de orden
    if shp.status not in TERMINAL_SHIPMENT_STATUSES:
        if norm in (TrackingEvent.NormalizedStatus.IN_TRANSIT, TrackingEvent.NormalizedStatus.OUT_FOR_DELIVERY):
            if shp.status == Shipment.Status.HANDED_OVER:
                shp.status = Shipment.Status.IN_TRANSIT
                shp.save(update_fields=["status", "updated_at"])
        elif norm == TrackingEvent.NormalizedStatus.DELIVERED and verification_status in ("verified", "simulated"):
            shp.status = Shipment.Status.DELIVERED
            shp.delivered_at = timezone.now()
            shp.save(update_fields=["status", "delivered_at", "updated_at"])
            # Integrar con OMS sin tocar estado financiero ni volver a descontar WMS/COGS
            if shp.order.fulfillment_status == FulfillmentStatus.SHIPPED.value:
                locked_order = Order.objects.select_for_update().get(pk=shp.order_id)
                locked_order.fulfillment_status = FulfillmentStatus.DELIVERED.value
                locked_order.save(update_fields=["fulfillment_status", "updated_at"])
            enqueue_logistics_notification(shp.order, event_type="order_delivered")
        elif norm in (TrackingEvent.NormalizedStatus.EXCEPTION, TrackingEvent.NormalizedStatus.DELIVERY_ATTEMPT_FAILED):
            shp.status = Shipment.Status.INCIDENT
            shp.save(update_fields=["status", "updated_at"])
            enqueue_logistics_notification(shp.order, event_type="delivery_incident")

    return ev


@transaction.atomic
def report_delivery_incident(
    shipment: Shipment,
    *,
    incident_type: str,
    description: str,
    actor=None,
) -> DeliveryIncident:
    inc = DeliveryIncident.objects.create(
        shipment=shipment,
        incident_type=incident_type[:60],
        description=description,
        reported_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
    if shipment.status not in TERMINAL_SHIPMENT_STATUSES:
        shipment.status = Shipment.Status.INCIDENT
        shipment.save(update_fields=["status", "updated_at"])
    enqueue_logistics_notification(shipment.order, event_type="delivery_incident")
    return inc


def enqueue_logistics_notification(
    order: Order,
    *,
    event_type: str,
    channel: str = "email",
    extra_payload: Optional[dict] = None,
) -> LogisticsNotificationOutbox:
    idem = f"LOG-NTF-{order.id}-{event_type}-{channel}"
    existing = LogisticsNotificationOutbox.objects.filter(idempotency_key=idem).first()
    if existing is not None:
        return existing
    email = order.email or ""
    masked = f"{email[:2]}***@{email.split('@')[1]}" if "@" in email else "***"
    return LogisticsNotificationOutbox.objects.create(
        order=order,
        event_type=event_type,
        channel=channel,
        recipient_masked=masked,
        status="skipped_qa",
        idempotency_key=idem,
        payload=extra_payload or {"order_id": str(order.id)},
    )


# ═══════════════════════════════════════════════════════════════════════════
# 4. BF-22: GARANTÍAS POR SERIAL Y RECLAMOS
# ═══════════════════════════════════════════════════════════════════════════

def validate_serial_warranty(
    *,
    serial_number: str = "",
    order_id: Optional[str] = None,
    sku: str = "",
) -> dict:
    order_obj = Order.objects.filter(pk=order_id).first() if order_id else None
    track = SerialNumberTrack.objects.filter(serial_number=(serial_number or "").strip()).first() if serial_number else None
    policy = None
    if track is not None:
        policy = WarrantyPolicySnapshot.objects.filter(product=track.product).order_by("-created_at").first()

    res = resolve_serial_warranty_evidence(
        serial_number=serial_number,
        order=order_obj,
        sku=sku,
        manufacturer_warranty_days=policy.manufacturer_days if policy else None,
        legal_warranty_days=policy.legal_days if policy else None,
        commercial_warranty_days=policy.commercial_days if policy else None,
    )
    if track is not None:
        res["previous_claims_count"] = WarrantyClaim.objects.filter(serial_track=track).count()
        res["in_active_repair"] = RepairWorkOrder.objects.filter(
            serial_number=track.serial_number
        ).exclude(status__in=[RepairWorkOrder.Status.CLOSED, RepairWorkOrder.Status.CANCELLED]).exists()
    return res


@transaction.atomic
def create_warranty_claim(
    *,
    order: Order,
    order_item: OrderItem,
    reason: str,
    serial_number: str = "",
    rma: Optional[ReturnMerchandiseAuthorization] = None,
    evidence_notes: str = "",
    idempotency_key: Optional[str] = None,
    actor=None,
) -> WarrantyClaim:
    if idempotency_key:
        existing = WarrantyClaim.objects.filter(idempotency_key=idempotency_key).first()
        if existing is not None:
            return existing

    track = SerialNumberTrack.objects.filter(serial_number=serial_number.strip()).first() if serial_number else None
    if rma is not None:
        validate_rma_warranty_link(rma)

    policy = WarrantyPolicySnapshot.objects.filter(product=order_item.product).order_by("-created_at").first()
    ev = resolve_serial_warranty_evidence(
        serial_number=serial_number,
        order=order,
        manufacturer_warranty_days=policy.manufacturer_days if policy else None,
        legal_warranty_days=policy.legal_days if policy else None,
        commercial_warranty_days=policy.commercial_days if policy else None,
    )
    init_status = (
        WarrantyClaim.Status.COVERAGE_CONFIRMED
        if ev["status"] == "covered"
        else WarrantyClaim.Status.PENDING_VERIFICATION
    )

    claim = WarrantyClaim.objects.create(
        claim_number=_next_log_code(WarrantyClaim, "claim_number", "WRN"),
        customer=order.user,
        order=order,
        order_item=order_item,
        product=order_item.product,
        variant=order_item.variant,
        serial_track=track,
        rma=rma,
        warranty_type=ev["warranty_type"],
        coverage_status=ev["status"],
        status=init_status,
        reason=reason,
        evidence_notes=evidence_notes,
        assigned_to=actor if getattr(actor, "is_authenticated", False) else None,
        idempotency_key=idempotency_key,
    )
    enqueue_logistics_notification(order, event_type="warranty_claim_received", extra_payload={"claim_number": claim.claim_number})
    return claim


# ═══════════════════════════════════════════════════════════════════════════
# 5. BF-43: SERVICIO TÉCNICO DE TALLER
# ═══════════════════════════════════════════════════════════════════════════

REPAIR_TRANSITIONS = {
    RepairWorkOrder.Status.RECEIVED: {RepairWorkOrder.Status.AWAITING_DIAGNOSIS, RepairWorkOrder.Status.CANCELLED},
    RepairWorkOrder.Status.AWAITING_DIAGNOSIS: {RepairWorkOrder.Status.DIAGNOSIS_IN_PROGRESS, RepairWorkOrder.Status.CANCELLED},
    RepairWorkOrder.Status.DIAGNOSIS_IN_PROGRESS: {
        RepairWorkOrder.Status.AWAITING_PARTS,
        RepairWorkOrder.Status.AWAITING_APPROVAL,
        RepairWorkOrder.Status.APPROVED,
        RepairWorkOrder.Status.REPAIR_IN_PROGRESS,
        RepairWorkOrder.Status.CANCELLED,
    },
    RepairWorkOrder.Status.AWAITING_PARTS: {RepairWorkOrder.Status.REPAIR_IN_PROGRESS, RepairWorkOrder.Status.AWAITING_APPROVAL, RepairWorkOrder.Status.CANCELLED},
    RepairWorkOrder.Status.AWAITING_APPROVAL: {RepairWorkOrder.Status.APPROVED, RepairWorkOrder.Status.CANCELLED},
    RepairWorkOrder.Status.APPROVED: {RepairWorkOrder.Status.REPAIR_IN_PROGRESS, RepairWorkOrder.Status.AWAITING_PARTS, RepairWorkOrder.Status.CANCELLED},
    RepairWorkOrder.Status.REPAIR_IN_PROGRESS: {RepairWorkOrder.Status.TESTING, RepairWorkOrder.Status.AWAITING_PARTS},
    RepairWorkOrder.Status.TESTING: {RepairWorkOrder.Status.READY_FOR_DELIVERY, RepairWorkOrder.Status.REPAIR_IN_PROGRESS},
    RepairWorkOrder.Status.READY_FOR_DELIVERY: {RepairWorkOrder.Status.DELIVERED},
    RepairWorkOrder.Status.DELIVERED: {RepairWorkOrder.Status.CLOSED},
    RepairWorkOrder.Status.CLOSED: set(),
    RepairWorkOrder.Status.CANCELLED: set(),
}


@transaction.atomic
def create_repair_work_order(
    *,
    equipment_model: str,
    reported_symptoms: str,
    equipment_brand: str = "",
    serial_number: str = "",
    service_mode: str = RepairWorkOrder.ServiceMode.OUT_OF_WARRANTY,
    customer=None,
    warranty_claim: Optional[WarrantyClaim] = None,
    rma: Optional[ReturnMerchandiseAuthorization] = None,
    product: Optional[Product] = None,
    variant: Optional[ProductVariant] = None,
    received_accessories: str = "",
    initial_physical_condition: str = "",
    reincidence_of: Optional[RepairWorkOrder] = None,
    actor=None,
) -> RepairWorkOrder:
    return RepairWorkOrder.objects.create(
        work_order_number=_next_log_code(RepairWorkOrder, "work_order_number", "RWO"),
        customer=customer or (warranty_claim.customer if warranty_claim else None),
        warranty_claim=warranty_claim,
        rma=rma,
        product=product or (warranty_claim.product if warranty_claim else None),
        variant=variant or (warranty_claim.variant if warranty_claim else None),
        equipment_brand=equipment_brand,
        equipment_model=equipment_model,
        serial_number=serial_number.strip(),
        service_mode=service_mode,
        status=RepairWorkOrder.Status.RECEIVED,
        received_accessories=received_accessories,
        initial_physical_condition=initial_physical_condition,
        reported_symptoms=reported_symptoms,
        assigned_technician=actor if getattr(actor, "is_authenticated", False) else None,
        reincidence_of=reincidence_of,
    )


@transaction.atomic
def transition_repair_work_order(work_order: RepairWorkOrder, *, target_status: str, actor=None) -> RepairWorkOrder:
    rwo = RepairWorkOrder.objects.select_for_update().get(pk=work_order.pk)
    if target_status not in REPAIR_TRANSITIONS.get(rwo.status, set()):
        raise LogisticsServiceError(f"Transición de taller inválida: '{rwo.status}' -> '{target_status}'.")
    rwo.status = target_status
    if target_status == RepairWorkOrder.Status.CLOSED:
        rwo.closed_at = timezone.now()
    rwo.save(update_fields=["status", "closed_at", "updated_at"])
    return rwo


@transaction.atomic
def record_repair_diagnosis(
    work_order: RepairWorkOrder,
    *,
    technical_findings: str,
    proposed_work: str,
    internal_notes: str = "",
    customer_notes: str = "",
    actor=None,
) -> RepairDiagnosis:
    return RepairDiagnosis.objects.create(
        work_order=work_order,
        technician=actor if getattr(actor, "is_authenticated", False) else None,
        technical_findings=technical_findings,
        proposed_work=proposed_work,
        internal_notes=internal_notes,
        customer_notes=customer_notes,
    )


@transaction.atomic
def set_repair_budget(
    work_order: RepairWorkOrder,
    *,
    diagnostic_fee: Decimal = Decimal("0.00"),
    labor_fee: Decimal = Decimal("0.00"),
    parts_fee: Decimal = Decimal("0.00"),
    tax_fee: Decimal = Decimal("0.00"),
    currency: str = "CLP",
) -> RepairWorkOrder:
    rwo = RepairWorkOrder.objects.select_for_update().get(pk=work_order.pk)
    rwo.budget_diagnostic_fee = Decimal(str(diagnostic_fee)).quantize(Decimal("0.01"))
    rwo.budget_labor_fee = Decimal(str(labor_fee)).quantize(Decimal("0.01"))
    rwo.budget_parts_fee = Decimal(str(parts_fee)).quantize(Decimal("0.01"))
    rwo.budget_tax_fee = Decimal(str(tax_fee)).quantize(Decimal("0.01"))
    rwo.budget_total = (
        rwo.budget_diagnostic_fee + rwo.budget_labor_fee + rwo.budget_parts_fee + rwo.budget_tax_fee
    ).quantize(Decimal("0.01"))
    rwo.budget_currency = currency.strip().upper()
    rwo.save()
    return rwo


@transaction.atomic
def consume_repair_part(
    work_order: RepairWorkOrder,
    *,
    product: Product,
    warehouse: Warehouse,
    quantity: int = 1,
    variant: Optional[ProductVariant] = None,
    idempotency_key: Optional[str] = None,
    actor=None,
) -> RepairPartUsage:
    if idempotency_key:
        existing = RepairPartUsage.objects.filter(idempotency_key=idempotency_key).first()
        if existing is not None:
            return existing

    if quantity <= 0:
        raise LogisticsServiceError("La cantidad de repuesto debe ser mayor que cero.")

    try:
        _, mv = adjust_stock(
            product=product,
            variant=variant,
            warehouse=warehouse,
            delta_physical=-int(quantity),
            movement_type=InventoryMovement.MovementType.ADJUST_NEG,
            source_document_type="repair_work_order",
            source_document_id=str(work_order.id),
            reason=f"Consumo de repuesto en taller {work_order.work_order_number}",
            idempotency_key=idempotency_key,
            actor=actor,
        )
    except InventoryServiceError as exc:
        raise LogisticsServiceError(str(exc)) from exc

    return RepairPartUsage.objects.create(
        work_order=work_order,
        product=product,
        variant=variant,
        warehouse=warehouse,
        quantity=int(quantity),
        status=RepairPartUsage.Status.CONSUMED,
        kardex_movement=mv,
        idempotency_key=idempotency_key,
    )


@transaction.atomic
def record_repair_test_result(
    work_order: RepairWorkOrder,
    *,
    test_category: str,
    procedure: str,
    result: str = "pass",
    instrument_used: str = "",
    measurements: str = "",
    actor=None,
) -> RepairTestResult:
    return RepairTestResult.objects.create(
        work_order=work_order,
        test_category=test_category,
        procedure=procedure,
        result=result,
        instrument_used=instrument_used,
        measurements=measurements,
        technician=actor if getattr(actor, "is_authenticated", False) else None,
    )


@transaction.atomic
def deliver_and_close_repair(
    work_order: RepairWorkOrder,
    *,
    delivered_to_name: str,
    delivered_to_id: str = "",
    delivery_notes: str = "",
    evidence_reference: str = "",
    actor=None,
) -> RepairWorkOrder:
    rwo = RepairWorkOrder.objects.select_for_update().get(pk=work_order.pk)
    if not rwo.diagnoses.exists():
        raise LogisticsServiceError("El cierre de taller exige al menos un diagnóstico registrado.")
    if not rwo.test_results.filter(result="pass").exists():
        raise LogisticsServiceError("El cierre de taller exige al menos una prueba técnica aprobada.")
    if not (delivered_to_name or "").strip():
        raise LogisticsServiceError("Debe registrar el nombre de la persona autorizada que retira el equipo.")

    RepairDelivery.objects.get_or_create(
        work_order=rwo,
        defaults={
            "delivered_to_name": delivered_to_name.strip(),
            "delivered_to_id": delivered_to_id.strip(),
            "delivery_notes": delivery_notes,
            "evidence_reference": evidence_reference,
            "delivered_by": actor if getattr(actor, "is_authenticated", False) else None,
        },
    )
    rwo.status = RepairWorkOrder.Status.CLOSED
    rwo.closed_at = timezone.now()
    rwo.save(update_fields=["status", "closed_at", "updated_at"])
    return rwo

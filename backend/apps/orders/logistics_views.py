# apps/orders/logistics_views.py
"""
LEVELPRO OS V4.0 — GATE 10: LOGISTICS & AFTER-SALES REST API VIEWS
Rutas rectoras:
- /api/v1/admin/logistics/manifests/
- /api/v1/admin/logistics/labels/
- Shipments, Packages, Quotes, Carriers, Tracking, Incidents, Warranties & Workshop Repairs.
"""

from decimal import Decimal
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.inventory.models import Warehouse
from apps.inventory.services import get_default_warehouse
from apps.orders.courier_adapters import ensure_default_carriers_seeded
from apps.orders.logistics_models import (
    Carrier,
    CarrierService,
    DeliveryIncident,
    RepairWorkOrder,
    Shipment,
    ShipmentLabel,
    ShippingManifest,
    TrackingEvent,
    WarrantyClaim,
)
from apps.orders.logistics_pdf import render_shipping_label_pdf, render_shipping_manifest_pdf
from apps.orders.logistics_services import (
    LogisticsServiceError,
    add_package_to_shipment,
    add_shipment_to_manifest,
    advance_shipment_preparation,
    close_shipping_manifest,
    consume_repair_part,
    create_repair_work_order,
    create_shipment_for_order,
    create_shipping_manifest,
    create_warranty_claim,
    deliver_and_close_repair,
    generate_shipment_labels,
    handover_shipping_manifest,
    quote_and_assign_carrier,
    record_repair_diagnosis,
    record_repair_test_result,
    record_tracking_event,
    report_delivery_incident,
    set_repair_budget,
    transition_repair_work_order,
    validate_serial_warranty,
)
from apps.orders.models import Order, OrderItem, ReturnMerchandiseAuthorization
from apps.products.models import Product, ProductVariant
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    MODULE_INVENTORY,
    MODULE_ORDERS,
    PERM_ADJUST_INVENTORY,
    ROLE_LOGISTICS,
    ROLE_MANAGEMENT,
    ROLE_SUPER_ADMIN,
    ROLE_SUPPORT,
    ROLE_WAREHOUSE,
)


LOGISTICS_ROLES = [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_LOGISTICS, ROLE_WAREHOUSE, ROLE_SUPPORT]


def _serialize_shipment(shp: Shipment) -> dict:
    return {
        "id": str(shp.id),
        "shipment_number": shp.shipment_number,
        "order_id": str(shp.order_id),
        "order_short": str(shp.order_id)[:8].upper(),
        "warehouse_id": str(shp.warehouse_id),
        "warehouse_name": shp.warehouse.name,
        "carrier_id": str(shp.carrier_id) if shp.carrier_id else None,
        "carrier_code": shp.carrier.code if shp.carrier_id else None,
        "carrier_name": shp.carrier.name if shp.carrier_id else None,
        "service_name": shp.carrier_service.name if shp.carrier_service_id else None,
        "destination_city": shp.destination_city,
        "destination_country": shp.destination_country,
        "status": shp.status,
        "tracking_number": shp.tracking_number,
        "is_partial": shp.is_partial,
        "packages_count": shp.packages.count(),
        "packages": [
            {
                "id": str(p.id),
                "package_number": p.package_number,
                "total_packages": p.total_packages,
                "gross_weight_kg": str(p.gross_weight_kg),
                "volumetric_weight_kg": str(p.volumetric_weight_kg),
                "billable_weight_kg": str(p.billable_weight_kg),
                "dimensions_cm": f"{p.length_cm}x{p.width_cm}x{p.height_cm}",
                "is_fragile": p.is_fragile,
                "commercial_content": p.commercial_content,
            }
            for p in shp.packages.all()
        ],
        "labels_count": shp.labels.count(),
        "dispatched_at": shp.dispatched_at.isoformat() if shp.dispatched_at else None,
        "delivered_at": shp.delivered_at.isoformat() if shp.delivered_at else None,
        "created_at": shp.created_at.isoformat(),
    }


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_overview_view(request):
    ensure_default_carriers_seeded()
    ready_orders = (
        Order.objects.filter(fulfillment_status__in=["allocated", "partially_shipped"])
        .exclude(commercial_status="cancelled")
        .order_by("-created_at")[:50]
    )
    return Response({
        "kpis": {
            "ready_orders_count": ready_orders.count(),
            "active_shipments_count": Shipment.objects.exclude(status__in=[Shipment.Status.DELIVERED, Shipment.Status.CANCELLED]).count(),
            "open_manifests_count": ShippingManifest.objects.filter(status__in=[ShippingManifest.Status.DRAFT, ShippingManifest.Status.READY, ShippingManifest.Status.CLOSED]).count(),
            "open_warranties_count": WarrantyClaim.objects.exclude(status=WarrantyClaim.Status.CLOSED).count(),
            "active_repairs_count": RepairWorkOrder.objects.exclude(status__in=[RepairWorkOrder.Status.CLOSED, RepairWorkOrder.Status.CANCELLED]).count(),
        },
        "ready_orders": [
            {
                "id": str(o.id),
                "order_short": str(o.id)[:8].upper(),
                "customer_email": o.email,
                "fulfillment_status": o.fulfillment_status,
                "currency": o.currency,
                "total": str(o.total),
                "shipping_address": o.shipping_address,
            }
            for o in ready_orders
        ],
    })


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_carriers_view(request):
    carriers = ensure_default_carriers_seeded()
    return Response({
        "results": [
            {
                "id": str(c.id),
                "code": c.code,
                "name": c.name,
                "country": c.country,
                "integration_status": c.integration_status,
                "docs_url": c.docs_url,
                "volumetric_divisor": str(c.volumetric_divisor),
                "services": [
                    {
                        "id": str(s.id),
                        "service_code": s.service_code,
                        "name": s.name,
                        "delivery_window": s.delivery_window,
                        "currency": s.currency,
                        "base_fee": str(s.base_fee),
                        "per_kg_fee": str(s.per_kg_fee),
                    }
                    for s in c.services.filter(is_active=True)
                ],
            }
            for c in carriers
        ]
    })


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_shipments_view(request):
    if request.method == "GET":
        qs = Shipment.objects.select_related("order", "warehouse", "carrier", "carrier_service").prefetch_related("packages", "labels").all()[:100]
        return Response({"results": [_serialize_shipment(s) for s in qs]})

    data = request.data or {}
    order = Order.objects.filter(pk=data.get("order_id")).first()
    if order is None:
        return Response({"error": "Orden no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    wh = Warehouse.objects.filter(pk=data["warehouse_id"]).first() if data.get("warehouse_id") else get_default_warehouse()
    carrier = Carrier.objects.filter(pk=data["carrier_id"]).first() if data.get("carrier_id") else None
    svc = CarrierService.objects.filter(pk=data["carrier_service_id"]).first() if data.get("carrier_service_id") else None
    try:
        shp = create_shipment_for_order(
            order,
            warehouse=wh,
            carrier=carrier,
            carrier_service=svc,
            is_partial=bool(data.get("is_partial", False)),
            idempotency_key=data.get("idempotency_key"),
            actor=request.user,
        )
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(_serialize_shipment(shp), status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_shipment_packages_view(request, shipment_id):
    shp = Shipment.objects.filter(pk=shipment_id).first()
    if shp is None:
        return Response({"error": "Envío no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    try:
        pkg = add_package_to_shipment(
            shp,
            gross_weight_kg=Decimal(str(data.get("gross_weight_kg") or "0")),
            length_cm=Decimal(str(data.get("length_cm") or "0")),
            width_cm=Decimal(str(data.get("width_cm") or "0")),
            height_cm=Decimal(str(data.get("height_cm") or "0")),
            is_fragile=bool(data.get("is_fragile", False)),
            declared_value=Decimal(str(data.get("declared_value") or "0")),
            currency=data.get("currency", shp.order.currency),
            commercial_content=data.get("commercial_content", ""),
            items_snapshot=data.get("items_snapshot") or [],
        )
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"package_id": str(pkg.id), "billable_weight_kg": str(pkg.billable_weight_kg)}, status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_shipment_advance_view(request, shipment_id):
    shp = Shipment.objects.filter(pk=shipment_id).first()
    if shp is None:
        return Response({"error": "Envío no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    try:
        updated = advance_shipment_preparation(shp, target_status=(request.data or {}).get("target_status", ""), actor=request.user)
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(_serialize_shipment(updated))


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_shipment_quote_view(request, shipment_id):
    shp = Shipment.objects.filter(pk=shipment_id).first()
    if shp is None:
        return Response({"error": "Envío no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    carrier = Carrier.objects.filter(pk=data.get("carrier_id")).first()
    svc = CarrierService.objects.filter(pk=data.get("carrier_service_id")).first()
    if carrier is None or svc is None:
        return Response({"error": "Transportista y servicio obligatorios."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        snap = quote_and_assign_carrier(shp, carrier=carrier, carrier_service=svc)
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
        "quote_id": str(snap.id),
        "amount": str(snap.amount),
        "currency": snap.currency,
        "quote_source": snap.quote_source,
        "verification_status": snap.verification_status,
        "is_commercial_valid": snap.is_commercial_valid,
        "billable_weight_kg": str(snap.billable_weight_kg),
    })


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_labels_view(request):
    if request.method == "GET":
        qs = ShipmentLabel.objects.select_related("shipment", "package").all()[:100]
        return Response({
            "results": [
                {
                    "id": str(l.id),
                    "shipment_id": str(l.shipment_id),
                    "shipment_number": l.shipment.shipment_number,
                    "label_type": l.label_type,
                    "barcode_value": l.barcode_value,
                    "tracking_number": l.tracking_number,
                    "pdf_sha256": l.pdf_sha256,
                    "is_official_dte": l.is_official_dte,
                    "created_at": l.created_at.isoformat(),
                }
                for l in qs
            ]
        })

    data = request.data or {}
    shp = Shipment.objects.filter(pk=data.get("shipment_id")).first()
    if shp is None:
        return Response({"error": "Envío no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    try:
        labels = generate_shipment_labels(
            shp,
            label_type=data.get("label_type") or ShipmentLabel.LabelType.INTERNAL_LOGISTIC,
            actor=request.user,
        )
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
        "labels": [
            {"id": str(l.id), "barcode_value": l.barcode_value, "tracking_number": l.tracking_number, "pdf_sha256": l.pdf_sha256}
            for l in labels
        ]
    }, status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_label_pdf_view(request, label_id):
    lbl = ShipmentLabel.objects.select_related("shipment", "shipment__carrier", "package").filter(pk=label_id).first()
    if lbl is None:
        return Response({"error": "Etiqueta no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    pdf_bytes, _ = render_shipping_label_pdf(lbl)
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="etiqueta_{lbl.barcode_value}.pdf"'
    return resp


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_manifests_view(request):
    if request.method == "GET":
        qs = ShippingManifest.objects.select_related("warehouse", "carrier", "responsible").all()[:100]
        return Response({
            "results": [
                {
                    "id": str(m.id),
                    "manifest_number": m.manifest_number,
                    "operational_date": m.operational_date.isoformat(),
                    "warehouse_name": m.warehouse.name,
                    "carrier_name": m.carrier.name,
                    "status": m.status,
                    "total_shipments": m.total_shipments,
                    "total_packages": m.total_packages,
                    "pdf_sha256": m.pdf_sha256,
                    "closed_at": m.closed_at.isoformat() if m.closed_at else None,
                    "handed_over_at": m.handed_over_at.isoformat() if m.handed_over_at else None,
                }
                for m in qs
            ]
        })

    data = request.data or {}
    wh = Warehouse.objects.filter(pk=data["warehouse_id"]).first() if data.get("warehouse_id") else get_default_warehouse()
    carrier = Carrier.objects.filter(pk=data.get("carrier_id")).first()
    if carrier is None:
        return Response({"error": "Transportista obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
    man = create_shipping_manifest(warehouse=wh, carrier=carrier, actor=request.user)
    return Response({"id": str(man.id), "manifest_number": man.manifest_number, "status": man.status}, status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_manifest_add_shipment_view(request, manifest_id):
    man = ShippingManifest.objects.filter(pk=manifest_id).first()
    shp = Shipment.objects.filter(pk=(request.data or {}).get("shipment_id")).first()
    if man is None or shp is None:
        return Response({"error": "Manifiesto o envío no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    try:
        add_shipment_to_manifest(man, shp)
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    man.refresh_from_db()
    return Response({"id": str(man.id), "total_shipments": man.total_shipments, "total_packages": man.total_packages})


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_manifest_close_view(request, manifest_id):
    man = ShippingManifest.objects.filter(pk=manifest_id).first()
    if man is None:
        return Response({"error": "Manifiesto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    try:
        closed = close_shipping_manifest(man, actor=request.user)
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(closed.id), "status": closed.status, "pdf_sha256": closed.pdf_sha256})


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_manifest_handover_view(request, manifest_id):
    man = ShippingManifest.objects.filter(pk=manifest_id).first()
    if man is None:
        return Response({"error": "Manifiesto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    try:
        handed = handover_shipping_manifest(
            man,
            handover_evidence=data.get("handover_evidence", "Retiro confirmado en bodega"),
            serial_assignments_by_order=data.get("serial_assignments_by_order"),
            actor=request.user,
        )
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(handed.id), "status": handed.status, "handed_over_at": handed.handed_over_at.isoformat()})


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_manifest_pdf_view(request, manifest_id):
    man = ShippingManifest.objects.select_related("warehouse", "carrier").filter(pk=manifest_id).first()
    if man is None:
        return Response({"error": "Manifiesto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    pdf_bytes, _ = render_shipping_manifest_pdf(man)
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="manifiesto_{man.manifest_number}.pdf"'
    return resp


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_tracking_view(request):
    if request.method == "GET":
        qs = TrackingEvent.objects.select_related("shipment").all()[:100]
        return Response({
            "results": [
                {
                    "id": str(e.id),
                    "shipment_id": str(e.shipment_id),
                    "shipment_number": e.shipment.shipment_number,
                    "original_code": e.original_code,
                    "normalized_status": e.normalized_status,
                    "source": e.source,
                    "verification_status": e.verification_status,
                    "location": e.location,
                    "occurred_at": e.occurred_at.isoformat(),
                }
                for e in qs
            ]
        })

    data = request.data or {}
    shp = Shipment.objects.filter(pk=data.get("shipment_id")).first()
    if shp is None:
        return Response({"error": "Envío no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    ev = record_tracking_event(
        shp,
        original_code=data.get("original_code", "IN_TRANSIT"),
        source=data.get("source", "simulated_qa"),
        verification_status=data.get("verification_status", "simulated"),
        location=data.get("location", ""),
        external_event_id=data.get("external_event_id", ""),
        actor=request.user,
    )
    return Response({"id": str(ev.id), "normalized_status": ev.normalized_status}, status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_incidents_view(request):
    if request.method == "GET":
        qs = DeliveryIncident.objects.select_related("shipment").all()[:100]
        return Response({
            "results": [
                {
                    "id": str(i.id),
                    "shipment_number": i.shipment.shipment_number,
                    "incident_type": i.incident_type,
                    "description": i.description,
                    "status": i.status,
                    "created_at": i.created_at.isoformat(),
                }
                for i in qs
            ]
        })
    data = request.data or {}
    shp = Shipment.objects.filter(pk=data.get("shipment_id")).first()
    if shp is None:
        return Response({"error": "Envío no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    inc = report_delivery_incident(
        shp,
        incident_type=data.get("incident_type", "delivery_issue"),
        description=data.get("description", ""),
        actor=request.user,
    )
    return Response({"id": str(inc.id), "status": inc.status}, status=status.HTTP_201_CREATED)


# ── BF-22: GARANTÍAS ──────────────────────────────────────────────────────
@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_warranties_view(request):
    if request.method == "GET":
        qs = WarrantyClaim.objects.select_related("order", "product", "serial_track", "rma").all()[:100]
        return Response({
            "results": [
                {
                    "id": str(w.id),
                    "claim_number": w.claim_number,
                    "order_id": str(w.order_id),
                    "product_name": w.product.name,
                    "serial_number": w.serial_track.serial_number if w.serial_track_id else "",
                    "rma_number": w.rma.rma_number if w.rma_id else None,
                    "warranty_type": w.warranty_type,
                    "coverage_status": w.coverage_status,
                    "status": w.status,
                    "reason": w.reason,
                    "created_at": w.created_at.isoformat(),
                }
                for w in qs
            ]
        })

    data = request.data or {}
    order = Order.objects.filter(pk=data.get("order_id")).first()
    item = OrderItem.objects.filter(pk=data.get("order_item_id")).first()
    if order is None or item is None:
        return Response({"error": "Orden o ítem no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    rma = ReturnMerchandiseAuthorization.objects.filter(pk=data["rma_id"]).first() if data.get("rma_id") else None
    claim = create_warranty_claim(
        order=order,
        order_item=item,
        reason=data.get("reason", ""),
        serial_number=data.get("serial_number", ""),
        rma=rma,
        evidence_notes=data.get("evidence_notes", ""),
        idempotency_key=data.get("idempotency_key"),
        actor=request.user,
    )
    return Response({"id": str(claim.id), "claim_number": claim.claim_number, "status": claim.status}, status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_warranty_validate_view(request):
    data = request.data or {}
    res = validate_serial_warranty(
        serial_number=data.get("serial_number", ""),
        order_id=data.get("order_id"),
        sku=data.get("sku", ""),
    )
    return Response(res)


# ── BF-43: SERVICIO TÉCNICO DE TALLER ─────────────────────────────────────
@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_repairs_view(request):
    if request.method == "GET":
        qs = RepairWorkOrder.objects.select_related("warranty_claim", "rma", "product").prefetch_related("diagnoses", "parts_used", "test_results").all()[:100]
        return Response({
            "results": [
                {
                    "id": str(r.id),
                    "work_order_number": r.work_order_number,
                    "equipment_brand": r.equipment_brand,
                    "equipment_model": r.equipment_model,
                    "serial_number": r.serial_number,
                    "service_mode": r.service_mode,
                    "status": r.status,
                    "budget_total": str(r.budget_total),
                    "budget_currency": r.budget_currency,
                    "diagnoses_count": r.diagnoses.count(),
                    "parts_count": r.parts_used.count(),
                    "tests_count": r.test_results.count(),
                    "created_at": r.created_at.isoformat(),
                }
                for r in qs
            ]
        })

    data = request.data or {}
    claim = WarrantyClaim.objects.filter(pk=data["warranty_claim_id"]).first() if data.get("warranty_claim_id") else None
    rma = ReturnMerchandiseAuthorization.objects.filter(pk=data["rma_id"]).first() if data.get("rma_id") else None
    prod = Product.objects.filter(pk=data["product_id"]).first() if data.get("product_id") else None
    rwo = create_repair_work_order(
        equipment_model=data.get("equipment_model", "Equipo Audio"),
        reported_symptoms=data.get("reported_symptoms", ""),
        equipment_brand=data.get("equipment_brand", ""),
        serial_number=data.get("serial_number", ""),
        service_mode=data.get("service_mode", RepairWorkOrder.ServiceMode.OUT_OF_WARRANTY),
        warranty_claim=claim,
        rma=rma,
        product=prod,
        received_accessories=data.get("received_accessories", ""),
        initial_physical_condition=data.get("initial_physical_condition", ""),
        actor=request.user,
    )
    return Response({"id": str(rwo.id), "work_order_number": rwo.work_order_number, "status": rwo.status}, status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_repair_transition_view(request, rwo_id):
    rwo = RepairWorkOrder.objects.filter(pk=rwo_id).first()
    if rwo is None:
        return Response({"error": "Orden de taller no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    try:
        updated = transition_repair_work_order(rwo, target_status=(request.data or {}).get("target_status", ""), actor=request.user)
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(updated.id), "status": updated.status})


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_repair_diagnosis_view(request, rwo_id):
    rwo = RepairWorkOrder.objects.filter(pk=rwo_id).first()
    if rwo is None:
        return Response({"error": "Orden de taller no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    diag = record_repair_diagnosis(
        rwo,
        technical_findings=data.get("technical_findings", ""),
        proposed_work=data.get("proposed_work", ""),
        internal_notes=data.get("internal_notes", ""),
        customer_notes=data.get("customer_notes", ""),
        actor=request.user,
    )
    return Response({"id": str(diag.id)}, status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_repair_budget_view(request, rwo_id):
    rwo = RepairWorkOrder.objects.filter(pk=rwo_id).first()
    if rwo is None:
        return Response({"error": "Orden de taller no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    updated = set_repair_budget(
        rwo,
        diagnostic_fee=Decimal(str(data.get("diagnostic_fee") or "0")),
        labor_fee=Decimal(str(data.get("labor_fee") or "0")),
        parts_fee=Decimal(str(data.get("parts_fee") or "0")),
        tax_fee=Decimal(str(data.get("tax_fee") or "0")),
        currency=data.get("currency", "CLP"),
    )
    return Response({"id": str(updated.id), "budget_total": str(updated.budget_total), "budget_currency": updated.budget_currency})


@rbac_endpoint(module=MODULE_INVENTORY, capability=PERM_ADJUST_INVENTORY, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_repair_parts_view(request, rwo_id):
    rwo = RepairWorkOrder.objects.filter(pk=rwo_id).first()
    if rwo is None:
        return Response({"error": "Orden de taller no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    prod = Product.objects.filter(pk=data.get("product_id")).first()
    if prod is None:
        return Response({"error": "Repuesto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    wh = Warehouse.objects.filter(pk=data["warehouse_id"]).first() if data.get("warehouse_id") else get_default_warehouse()
    try:
        usage = consume_repair_part(
            rwo,
            product=prod,
            warehouse=wh,
            quantity=int(data.get("quantity") or 1),
            idempotency_key=data.get("idempotency_key"),
            actor=request.user,
        )
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(usage.id), "status": usage.status}, status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_repair_tests_view(request, rwo_id):
    rwo = RepairWorkOrder.objects.filter(pk=rwo_id).first()
    if rwo is None:
        return Response({"error": "Orden de taller no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    res = record_repair_test_result(
        rwo,
        test_category=data.get("test_category", "functional"),
        procedure=data.get("procedure", "Verificación funcional"),
        result=data.get("result", "pass"),
        instrument_used=data.get("instrument_used", ""),
        measurements=data.get("measurements", ""),
        actor=request.user,
    )
    return Response({"id": str(res.id), "result": res.result}, status=status.HTTP_201_CREATED)


@rbac_endpoint(module=MODULE_ORDERS, allowed_roles=LOGISTICS_ROLES)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_logistics_repair_deliver_view(request, rwo_id):
    rwo = RepairWorkOrder.objects.filter(pk=rwo_id).first()
    if rwo is None:
        return Response({"error": "Orden de taller no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    try:
        closed = deliver_and_close_repair(
            rwo,
            delivered_to_name=data.get("delivered_to_name", ""),
            delivered_to_id=data.get("delivered_to_id", ""),
            delivery_notes=data.get("delivery_notes", ""),
            evidence_reference=data.get("evidence_reference", ""),
            actor=request.user,
        )
    except LogisticsServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(closed.id), "status": closed.status})

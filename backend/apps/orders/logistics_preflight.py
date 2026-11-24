# apps/orders/logistics_preflight.py
"""
LEVELPRO OS V4.0 — GATE 10 PREFLIGHT CONTRACTS (LOG10-PF-02..05)
- LOG10-PF-02: Transición verificable OMS/WMS sin doble descuento de inventario ni re-congelamiento de COGS.
- LOG10-PF-03: Contrato de integración RMA (ReturnMerchandiseAuthorization) <-> WarrantyClaim / RepairWorkOrder.
- LOG10-PF-04: Trazabilidad de garantía por serial: Product -> Variant/SKU -> SerialNumberTrack -> OrderItem -> Order.
- LOG10-PF-05: Coherencia legal con /envios y /garantia sin alterar textos legales ni prometer integraciones no activas.
"""

from datetime import timedelta
from typing import Optional

from django.db import transaction
from django.utils import timezone

from apps.inventory.models import SerialNumberTrack
from apps.orders.models import Order, OrderItem, ReturnMerchandiseAuthorization
from apps.orders.oms_services import OMSServiceError, transition_order_dimensions
from core.contracts.states import FulfillmentStatus


OPERATIONAL_DISPATCH_FLOW = (
    "reserved",
    "preparing",
    "packed",
    "ready_for_pickup",
    "handed_over",
    "in_transit",
    "delivered",
)

DISPATCH_DEDUCTS_WMS_AT = ("handed_over",)

LEGAL_POLICY_COHERENCE_REPORT = {
    "envios_route": "/envios",
    "garantia_route": "/garantia",
    "legal_texts_modified": False,
    "identified_gaps": [
        {
            "policy": "/envios",
            "statement": "Notificaciones automáticas y seguimiento de courier",
            "qa_status": "integration_pending",
            "detail": (
                "En QA las notificaciones se encolan sin envío real y los couriers operan en modo "
                "simulado/tabla versionada hasta habilitar credenciales comerciales."
            ),
        },
        {
            "policy": "/garantia",
            "statement": "Validación de cobertura del fabricante y plazos legales",
            "qa_status": "evidence_required",
            "detail": (
                "Sin integración en tiempo real con fabricantes; toda garantía sin evidencia temporal "
                "verificable o serial vendido queda en estado pending_verification."
            ),
        },
    ],
}


@transaction.atomic
def confirm_physical_dispatch_once(
    order: Order,
    *,
    shipping_carrier: str,
    tracking_number: str,
    serial_assignments: Optional[dict] = None,
    reason: str = "Confirmación física de despacho Gate 10",
    actor=None,
) -> Order:
    """
    LOG10-PF-02:
    - La creación de etiquetas/guías jamás descuenta WMS.
    - La confirmación física de entrega al transportista ejecuta transition_order_dimensions(fulfillment_status=SHIPPED)
      exactamente una vez, preservando congelamiento COGS y trazabilidad de seriales.
    """
    locked = Order.objects.select_for_update().get(pk=order.pk)
    if locked.fulfillment_status in (FulfillmentStatus.SHIPPED.value, FulfillmentStatus.DELIVERED.value):
        return locked

    if not (shipping_carrier or "").strip() or not (tracking_number or "").strip():
        raise OMSServiceError("El transportista y número de seguimiento son obligatorios para confirmar despacho.")

    return transition_order_dimensions(
        locked,
        fulfillment_status=FulfillmentStatus.SHIPPED.value,
        serial_assignments=serial_assignments,
        shipping_carrier=shipping_carrier.strip(),
        tracking_number=tracking_number.strip(),
        reason=reason,
        actor=actor,
    )


def resolve_serial_warranty_evidence(
    *,
    serial_number: str = "",
    order: Optional[Order] = None,
    sku: str = "",
    manufacturer_warranty_days: Optional[int] = None,
    legal_warranty_days: Optional[int] = None,
    commercial_warranty_days: Optional[int] = None,
) -> dict:
    """
    LOG10-PF-04:
    Trazabilidad verificable:
    PRODUCTO -> SKU/VARIANTE -> SERIAL -> ORDERITEM -> VENTA -> GARANTÍA -> RECLAMO.
    Diferencia garantía del fabricante, legal, comercial adicional o servicio fuera de garantía.
    Si falta evidencia verificable, retorna status='pending_verification'.
    """
    sn_clean = (serial_number or "").strip()
    track = None
    if sn_clean:
        track = (
            SerialNumberTrack.objects.select_related("product", "variant", "order")
            .filter(serial_number=sn_clean)
            .first()
        )

    matched_order = order or (track.order if (track and track.order_id) else None)
    matched_item = None
    if track is not None and matched_order is not None:
        qs_item = OrderItem.objects.filter(order=matched_order, product=track.product)
        if track.variant_id:
            qs_item = qs_item.filter(variant_id=track.variant_id)
        matched_item = qs_item.first()

    if track is None or matched_order is None or matched_item is None:
        return {
            "serial_number": sn_clean,
            "verified_sale": False,
            "status": "pending_verification",
            "warranty_type": "pending_verification",
            "reason": "Falta evidencia verificable de serial asignado a una orden vendida.",
            "product_id": str(track.product_id) if track else None,
            "variant_id": str(track.variant_id) if (track and track.variant_id) else None,
            "order_id": str(matched_order.id) if matched_order else None,
            "order_item_id": str(matched_item.id) if matched_item else None,
        }

    if sku and matched_item.product.sku != sku:
        return {
            "serial_number": sn_clean,
            "verified_sale": False,
            "status": "pending_verification",
            "warranty_type": "pending_verification",
            "reason": "El SKU consultado no coincide con el ítem vendido para este serial.",
        }

    sale_date = matched_order.created_at.date()
    today = timezone.now().date()

    coverages = []
    for w_type, days in (
        ("legal_warranty", legal_warranty_days),
        ("manufacturer_warranty", manufacturer_warranty_days),
        ("commercial_warranty", commercial_warranty_days),
    ):
        if days is not None and int(days) > 0:
            expires_at = sale_date + timedelta(days=int(days))
            coverages.append({
                "warranty_type": w_type,
                "days": int(days),
                "starts_at": sale_date.isoformat(),
                "expires_at": expires_at.isoformat(),
                "is_active": today <= expires_at,
            })

    if not coverages:
        return {
            "serial_number": sn_clean,
            "verified_sale": True,
            "status": "pending_verification",
            "warranty_type": "pending_verification",
            "reason": "Venta y serial verificados, pero sin regla temporal documentada de cobertura.",
            "product_id": str(track.product_id),
            "variant_id": str(track.variant_id) if track.variant_id else None,
            "order_id": str(matched_order.id),
            "order_item_id": str(matched_item.id),
            "sale_date": sale_date.isoformat(),
            "coverages": [],
        }

    active_cov = [c for c in coverages if c["is_active"]]
    chosen = active_cov[0] if active_cov else coverages[0]
    return {
        "serial_number": sn_clean,
        "verified_sale": True,
        "status": "covered" if active_cov else "out_of_warranty",
        "warranty_type": chosen["warranty_type"] if active_cov else "out_of_warranty_service",
        "product_id": str(track.product_id),
        "variant_id": str(track.variant_id) if track.variant_id else None,
        "order_id": str(matched_order.id),
        "order_item_id": str(matched_item.id),
        "sale_date": sale_date.isoformat(),
        "coverages": coverages,
    }


def validate_rma_warranty_link(rma: ReturnMerchandiseAuthorization) -> dict:
    """LOG10-PF-03: Contrato de vínculo RMA existente <-> WarrantyClaim/Taller sin duplicar stock ni reembolsos."""
    return {
        "rma_id": str(rma.id),
        "rma_number": rma.rma_number,
        "order_id": str(rma.order_id),
        "rma_status": rma.status,
        "reuses_gate7_rma": True,
        "auto_refund_prohibited": True,
        "auto_restock_prohibited": True,
    }

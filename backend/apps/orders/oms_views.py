# apps/orders/oms_views.py
"""
LEVELPRO OS V4.0 — GATE 7: ORDER MANAGEMENT SYSTEM (OMS) API VIEWS
Rutas rectoras y auxiliares (Sección 15):
- /api/v1/admin/orders/manual/
- /api/v1/admin/orders/manual/<uuid:draft_id>/
- /api/v1/admin/orders/manual/<uuid:draft_id>/convert/
- /api/v1/admin/orders/manual/<uuid:draft_id>/whatsapp-link/
- /api/v1/admin/orders/manual/<uuid:draft_id>/cancel/
- /api/v1/orders/whatsapp/<str:token>/
- /api/v1/orders/whatsapp/<str:token>/checkout/
- /api/v1/admin/orders/<uuid:order_id>/states/
- /api/v1/admin/orders/<uuid:order_id>/dispatch/
- /api/v1/admin/orders/<uuid:order_id>/payment-attempt/
- /api/v1/admin/orders/fulfillment-queue/
- /api/v1/admin/orders/<uuid:order_id>/rma/
- /api/v1/admin/orders/rmas/
- /api/v1/admin/orders/rmas/<uuid:rma_id>/authorize/
- /api/v1/admin/orders/rmas/<uuid:rma_id>/inspect/
- /api/v1/admin/orders/rmas/<uuid:rma_id>/refund/
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.inventory.models import InventoryMovement, SerialNumberTrack, StockReservation, Warehouse
from apps.orders.models import DraftOrder, Order, ReturnMerchandiseAuthorization
from apps.orders.oms_serializers import DraftOrderSerializer, RMASerializer
from apps.orders.oms_services import (
    LEGACY_TO_3D_EQUIVALENCE_TABLE,
    OMSPermissionError,
    OMSServiceError,
    authorize_or_reject_rma,
    cancel_or_expire_draft_order,
    convert_draft_order_to_order,
    create_manual_draft_order,
    create_rma_request,
    generate_whatsapp_checkout_link,
    receive_and_inspect_rma,
    record_order_payment_attempt,
    resolve_rma_refund,
    resolve_whatsapp_checkout_token,
    serialize_public_whatsapp_proposal,
    transition_order_dimensions,
    update_manual_draft_order,
)
from apps.orders.serializers import OrderSerializer
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    MODULE_FINANCES,
    MODULE_INVENTORY,
    MODULE_LOGISTICS,
    MODULE_ORDERS,
    PERM_APPROVE_PAYMENTS,
    PERM_VIEW_COSTS,
    ROLE_FINANCE,
    ROLE_LOGISTICS,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_SUPER_ADMIN,
    ROLE_SUPPORT,
    ROLE_WAREHOUSE,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability

User = get_user_model()


# ═══════════════════════════════════════════════════════════════════════════
# 1. BF-11: VENTAS MANUALES (DRAFT ORDERS)
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_FINANCE, ROLE_SUPPORT],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_manual_orders_view(request):
    """
    GET  /api/v1/admin/orders/manual/ -> Lista borradores de ventas manuales con filtros.
    POST /api/v1/admin/orders/manual/ -> Crea un nuevo DraftOrder con reserva temporal opcional.
    """
    if request.method == "GET":
        qs = DraftOrder.objects.select_related("customer", "sales_rep", "warehouse", "converted_order").prefetch_related(
            "items__product", "items__variant"
        ).all()

        status_f = request.query_params.get("status")
        if status_f:
            qs = qs.filter(status=status_f)
        curr_f = request.query_params.get("currency")
        if curr_f:
            qs = qs.filter(currency=curr_f.upper())
        channel_f = request.query_params.get("channel")
        if channel_f:
            qs = qs.filter(channel=channel_f)
        rep_f = request.query_params.get("sales_rep")
        if rep_f:
            qs = qs.filter(sales_rep_id=rep_f)
        search_q = (request.query_params.get("search") or "").strip()
        if search_q:
            qs = qs.filter(customer_email__icontains=search_q) | qs.filter(draft_number__icontains=search_q) | qs.filter(customer_name__icontains=search_q)

        data = DraftOrderSerializer(qs[:100], many=True, context={"request": request}).data
        return Response({"count": len(data), "results": data})

    # POST
    payload = request.data or {}
    customer_obj = None
    if payload.get("customer_id"):
        customer_obj = User.objects.filter(pk=payload["customer_id"]).first()

    wh_obj = None
    if payload.get("warehouse_id"):
        wh_obj = Warehouse.objects.filter(pk=payload["warehouse_id"], is_active=True).first()

    try:
        draft = create_manual_draft_order(
            customer_name=payload.get("customer_name", ""),
            customer_email=payload.get("customer_email", ""),
            customer_phone=payload.get("customer_phone", ""),
            customer_tax_id=payload.get("customer_tax_id", ""),
            shipping_address=payload.get("shipping_address", ""),
            customer=customer_obj,
            items=payload.get("items") or [],
            currency=payload.get("currency", "CLP"),
            channel=payload.get("channel", DraftOrder.Channel.MANUAL),
            discount_percent=payload.get("discount_percent", "0.00"),
            valid_hours=payload.get("valid_hours", 48),
            reserve_inventory=bool(payload.get("reserve_inventory", True)),
            reservation_ttl_minutes=payload.get("reservation_ttl_minutes", 120),
            warehouse=wh_obj,
            notes=payload.get("notes", ""),
            internal_notes=payload.get("internal_notes", ""),
            terms_snapshot=payload.get("terms_snapshot", ""),
            actor=request.user,
        )
    except OMSPermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        DraftOrderSerializer(draft, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_FINANCE, ROLE_SUPPORT],
        "PATCH": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
    },
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAdminOrStaff])
def admin_manual_order_detail_view(request, draft_id):
    """
    GET/PATCH /api/v1/admin/orders/manual/<uuid:draft_id>/
    """
    draft = DraftOrder.objects.select_related("customer", "sales_rep", "warehouse").prefetch_related(
        "items__product", "items__variant"
    ).filter(pk=draft_id).first()
    if draft is None:
        return Response({"error": "Borrador de venta manual no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(DraftOrderSerializer(draft, context={"request": request}).data)

    try:
        updated = update_manual_draft_order(draft, payload=request.data or {}, actor=request.user)
    except OMSPermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(DraftOrderSerializer(updated, context={"request": request}).data)


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_manual_order_convert_view(request, draft_id):
    """
    POST /api/v1/admin/orders/manual/<uuid:draft_id>/convert/
    Convierte de manera idempotente un DraftOrder en una Order comercial.
    """
    draft = DraftOrder.objects.filter(pk=draft_id).first()
    if draft is None:
        return Response({"error": "Borrador de venta manual no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data or {}
    idem_key = payload.get("idempotency_key") or request.headers.get("Idempotency-Key")
    was_already_converted = draft.status == DraftOrder.Status.CONVERTED and draft.converted_order_id is not None

    try:
        order = convert_draft_order_to_order(
            draft,
            idempotency_key=idem_key,
            shipping_address_override=payload.get("shipping_address"),
            actor=request.user,
        )
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    draft.refresh_from_db()
    return Response(
        {
            "order": OrderSerializer(order, context={"request": request}).data,
            "draft": DraftOrderSerializer(draft, context={"request": request}).data,
            "idempotent_replay": was_already_converted,
        },
        status=status.HTTP_200_OK if was_already_converted else status.HTTP_201_CREATED,
    )


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_manual_order_cancel_view(request, draft_id):
    """
    POST /api/v1/admin/orders/manual/<uuid:draft_id>/cancel/
    Cancela un DraftOrder y libera sus reservas temporales elegibles.
    """
    draft = DraftOrder.objects.filter(pk=draft_id).first()
    if draft is None:
        return Response({"error": "Borrador de venta manual no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data or {}
    try:
        cancelled = cancel_or_expire_draft_order(
            draft,
            mark_expired=bool(payload.get("mark_expired", False)),
            reason=payload.get("reason") or "Cancelación de borrador de venta manual",
            actor=request.user,
        )
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(DraftOrderSerializer(cancelled, context={"request": request}).data)


# ═══════════════════════════════════════════════════════════════════════════
# 2. BF-12: WHATSAPP CHECKOUT LINKS & PUBLIC RECOVERY
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_manual_order_whatsapp_link_view(request, draft_id):
    """
    POST /api/v1/admin/orders/manual/<uuid:draft_id>/whatsapp-link/
    Genera un enlace HTTPS seguro con token firmado y URL wa.me de compartición.
    """
    draft = DraftOrder.objects.filter(pk=draft_id).first()
    if draft is None:
        return Response({"error": "Borrador de venta manual no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data or {}
    try:
        result = generate_whatsapp_checkout_link(
            draft,
            expires_in_hours=payload.get("expires_in_hours", 48),
            base_frontend_url=payload.get("base_frontend_url"),
            actor=request.user,
        )
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(result, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_whatsapp_proposal_view(request, token: str):
    """
    GET /api/v1/orders/whatsapp/<str:token>/
    Recupera de forma controlada y sanitizada el resumen de la propuesta comercial sin exponer PII ni costos.
    """
    try:
        draft = resolve_whatsapp_checkout_token(token)
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(serialize_public_whatsapp_proposal(draft))


@api_view(["POST"])
@permission_classes([AllowAny])
def public_whatsapp_checkout_continue_view(request, token: str):
    """
    POST /api/v1/orders/whatsapp/<str:token>/checkout/
    Valida nuevamente disponibilidad y precios autorizados en el servidor y convierte de forma idempotente
    la propuesta comercial en una Order lista para continuar al pago (sin marcar como pagada).
    """
    try:
        draft = resolve_whatsapp_checkout_token(token)
        payload = request.data or {}
        idem_key = payload.get("idempotency_key") or f"wa_checkout:{draft.id}"
        order = convert_draft_order_to_order(
            draft,
            idempotency_key=idem_key,
            shipping_address_override=payload.get("shipping_address"),
            origin_override=Order.OrderOriginChoices.WHATSAPP,
            actor=request.user if getattr(request.user, "is_authenticated", False) else None,
        )
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "order_id": str(order.id),
            "draft_number": draft.draft_number,
            "status": order.status,
            "commercial_status": order.commercial_status,
            "financial_status": order.financial_status,
            "fulfillment_status": order.fulfillment_status,
            "currency": order.currency,
            "total": str(order.total),
        },
        status=status.HTTP_200_OK,
    )


# ═══════════════════════════════════════════════════════════════════════════
# 3. BF-13: ESTADOS MULTIDIMENSIONALES, COLA DE PREPARACIÓN Y DESPACHO
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_modules=[MODULE_ORDERS, MODULE_LOGISTICS, MODULE_FINANCES],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_LOGISTICS, ROLE_FINANCE, ROLE_WAREHOUSE],
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_order_states_view(request, order_id):
    """
    GET  /api/v1/admin/orders/<uuid:order_id>/states/ -> Consulta estado 3D y tabla de equivalencias.
    POST /api/v1/admin/orders/<uuid:order_id>/states/ -> Ejecuta transición verificada en ejes comercial/financiero/logístico.
    """
    order = Order.objects.filter(pk=order_id).first()
    if order is None:
        return Response({"error": "Orden no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response({
            "order_id": str(order.id),
            "legacy_status": order.status,
            "commercial_status": order.commercial_status,
            "financial_status": order.financial_status,
            "fulfillment_status": order.fulfillment_status,
            "state_contract": order.state_contract.to_dict(),
            "equivalence_table": LEGACY_TO_3D_EQUIVALENCE_TABLE,
        })

    payload = request.data or {}
    try:
        updated = transition_order_dimensions(
            order,
            commercial_status=payload.get("commercial_status"),
            financial_status=payload.get("financial_status"),
            fulfillment_status=payload.get("fulfillment_status"),
            serial_assignments=payload.get("serial_assignments"),
            shipping_carrier=payload.get("shipping_carrier"),
            tracking_number=payload.get("tracking_number"),
            reason=payload.get("reason", ""),
            actor=request.user,
        )
    except OMSPermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(OrderSerializer(updated, context={"request": request}).data)


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_modules=[MODULE_ORDERS, MODULE_LOGISTICS, MODULE_INVENTORY],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_LOGISTICS, ROLE_WAREHOUSE, ROLE_SALES],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_fulfillment_queue_view(request):
    """
    GET /api/v1/admin/orders/fulfillment-queue/
    Sección 9: Cola de pedidos pendientes de preparación y despacho con bodega asignada,
    unidades reservadas, seriales disponibles cuando sean obligatorios e historial de movimientos.
    """
    orders_qs = (
        Order.objects.select_related("user", "assigned_warehouse", "sales_rep")
        .prefetch_related("items__product", "items__variant", "stock_reservations__warehouse")
        .exclude(commercial_status=Order.CommercialStatusChoices.CANCELLED)
        .order_by("-created_at")[:100]
    )

    can_see_costs = is_effective_super_admin(request.user) or user_has_capability(request.user, PERM_VIEW_COSTS)
    queue = []
    for o in orders_qs:
        reservations_data = []
        for res in o.stock_reservations.all():
            avail_serials = []
            if res.product_id and res.product.serialization_mode != "none":
                avail_serials = list(
                    SerialNumberTrack.objects.filter(
                        warehouse=res.warehouse,
                        product=res.product,
                        variant=res.variant,
                        status__in=[SerialNumberTrack.Status.IN_STOCK, SerialNumberTrack.Status.RESERVED],
                    ).values_list("serial_number", flat=True)[:50]
                )
            reservations_data.append({
                "id": str(res.id),
                "warehouse_id": str(res.warehouse_id),
                "warehouse_code": res.warehouse.code,
                "product_id": str(res.product_id) if res.product_id else None,
                "variant_id": str(res.variant_id) if res.variant_id else None,
                "product_name": res.product.name if res.product_id else "",
                "serialization_mode": res.product.serialization_mode if res.product_id else "none",
                "quantity": res.quantity,
                "status": res.status,
                "expires_at": res.expires_at.isoformat() if res.expires_at else None,
                "available_serials": avail_serials,
            })

        movements = list(
            InventoryMovement.objects.filter(
                source_document_type="ORDER",
                source_document_id=str(o.id),
            )
            .select_related("warehouse")
            .order_by("-recorded_at")[:20]
        )
        movements_data = [
            {
                "id": str(m.id),
                "movement_type": m.movement_type,
                "warehouse_code": m.warehouse.code,
                "sku": m.sku_snapshot,
                "quantity": m.quantity,
                "serial_numbers": m.serial_numbers,
                "recorded_at": m.recorded_at.isoformat(),
                "reason": m.reason,
            }
            for m in movements
        ]

        items_data = []
        for it in o.items.all():
            row = {
                "id": str(it.id),
                "product_id": str(it.product_id) if it.product_id else None,
                "variant_id": str(it.variant_id) if it.variant_id else None,
                "product_name": it.product_name,
                "variant_name": it.variant_name,
                "variant_sku": it.variant_sku,
                "quantity": it.quantity,
                "price": str(it.price),
                "serialization_mode": it.product.serialization_mode if it.product_id and it.product else "none",
                "allocated_serial_numbers": it.allocated_serial_numbers,
            }
            if can_see_costs:
                row["unit_cost_snapshot"] = str(it.unit_cost_snapshot) if it.unit_cost_snapshot is not None else None
                row["total_cost_snapshot"] = str(it.total_cost_snapshot) if it.total_cost_snapshot is not None else None
                row["cost_currency"] = it.cost_currency
                row["costing_method_snapshot"] = it.costing_method_snapshot
            items_data.append(row)

        queue.append({
            "id": str(o.id),
            "email": o.email,
            "customer_name": o.customer_name,
            "shipping_address": o.shipping_address,
            "shipping_carrier": o.shipping_carrier,
            "tracking_number": o.tracking_number,
            "status": o.status,
            "commercial_status": o.commercial_status,
            "financial_status": o.financial_status,
            "fulfillment_status": o.fulfillment_status,
            "order_origin": o.order_origin,
            "currency": o.currency,
            "total": str(o.total),
            "assigned_warehouse_code": o.assigned_warehouse.code if o.assigned_warehouse_id else None,
            "sales_rep_email": o.sales_rep.email if o.sales_rep_id else None,
            "created_at": o.created_at.isoformat(),
            "items": items_data,
            "reservations": reservations_data,
            "movements": movements_data,
        })

    return Response({"count": len(queue), "results": queue})


@rbac_endpoint(
    module=MODULE_LOGISTICS,
    allowed_modules=[MODULE_LOGISTICS, MODULE_ORDERS, MODULE_INVENTORY],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_LOGISTICS, ROLE_WAREHOUSE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_order_dispatch_view(request, order_id):
    """
    POST /api/v1/admin/orders/<uuid:order_id>/dispatch/
    Sección 9: Confirmación de despacho físico idempotente con asignación de seriales y congelamiento de COGS.
    """
    order = Order.objects.filter(pk=order_id).first()
    if order is None:
        return Response({"error": "Orden no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data or {}
    was_already_shipped = order.fulfillment_status in (
        Order.FulfillmentStatusChoices.SHIPPED,
        Order.FulfillmentStatusChoices.DELIVERED,
    )

    try:
        if was_already_shipped:
            # Verificar idempotencia en dispatch_order_reservations (no descuenta dos veces, pero rechaza si envían otros seriales)
            from apps.inventory.services import InventoryServiceError, dispatch_order_reservations
            try:
                dispatch_order_reservations(
                    order,
                    serial_assignments=payload.get("serial_assignments"),
                    actor=request.user,
                )
            except InventoryServiceError as exc:
                return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            updated = order
        else:
            updated = transition_order_dimensions(
                order,
                fulfillment_status=Order.FulfillmentStatusChoices.SHIPPED,
                serial_assignments=payload.get("serial_assignments"),
                shipping_carrier=payload.get("shipping_carrier"),
                tracking_number=payload.get("tracking_number"),
                reason=payload.get("reason") or "Confirmación de despacho físico OMS",
                actor=request.user,
            )
    except (OMSPermissionError, OMSServiceError) as exc:
        code = status.HTTP_403_FORBIDDEN if isinstance(exc, OMSPermissionError) else status.HTTP_400_BAD_REQUEST
        return Response({"error": str(exc)}, status=code)

    return Response({
        "order": OrderSerializer(updated, context={"request": request}).data,
        "idempotent_replay": was_already_shipped,
    })


@rbac_endpoint(
    module=MODULE_FINANCES,
    allowed_modules=[MODULE_FINANCES, MODULE_ORDERS],
    capability=PERM_APPROVE_PAYMENTS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_order_payment_attempt_view(request, order_id):
    """
    POST /api/v1/admin/orders/<uuid:order_id>/payment-attempt/
    Sección 8: Registro y conciliación idempotente de pagos (parciales, totales, duplicados o tardíos en IN_REVIEW).
    """
    order = Order.objects.filter(pk=order_id).first()
    if order is None:
        return Response({"error": "Orden no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data or {}
    try:
        res = record_order_payment_attempt(
            order,
            provider=payload.get("provider", "transfer"),
            amount=payload.get("amount"),
            currency=payload.get("currency"),
            external_id=payload.get("external_id", ""),
            approve_immediately=bool(payload.get("approve_immediately", True)),
            actor=request.user,
        )
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "payment_id": str(res["payment"].id),
        "payment_status": res["payment_status"],
        "financial_status": res["financial_status"],
        "is_duplicate": res["is_duplicate"],
        "order": OrderSerializer(res["order"], context={"request": request}).data,
    })


# ═══════════════════════════════════════════════════════════════════════════
# 4. BF-23: DEVOLUCIONES Y REEMBOLSOS (RMA)
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_modules=[MODULE_ORDERS, MODULE_INVENTORY, MODULE_LOGISTICS, MODULE_FINANCES],
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_SUPPORT, ROLE_WAREHOUSE, ROLE_LOGISTICS, ROLE_FINANCE],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_SUPPORT],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_order_rma_view(request, order_id):
    """
    Ruta rectora Sección 15:
    GET  /api/v1/admin/orders/<uuid:order_id>/rma/ -> Lista RMAs de la orden.
    POST /api/v1/admin/orders/<uuid:order_id>/rma/ -> Crea una solicitud RMA para la orden.
    """
    order = Order.objects.filter(pk=order_id).first()
    if order is None:
        return Response({"error": "Orden no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        qs = ReturnMerchandiseAuthorization.objects.filter(order=order).prefetch_related(
            "items__order_item", "items__product", "items__variant"
        )
        return Response({
            "count": qs.count(),
            "results": RMASerializer(qs, many=True, context={"request": request}).data,
        })

    payload = request.data or {}
    wh_obj = None
    if payload.get("warehouse_id"):
        wh_obj = Warehouse.objects.filter(pk=payload["warehouse_id"], is_active=True).first()

    try:
        rma = create_rma_request(
            order=order,
            items=payload.get("items") or [],
            reason_code=payload.get("reason_code", ReturnMerchandiseAuthorization.ReasonCode.DEFECTIVE),
            reason_details=payload.get("reason_details", ""),
            warehouse=wh_obj,
            notes=payload.get("notes", ""),
            actor=request.user,
        )
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        RMASerializer(rma, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_modules=[MODULE_ORDERS, MODULE_INVENTORY, MODULE_LOGISTICS, MODULE_FINANCES],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_SUPPORT, ROLE_WAREHOUSE, ROLE_LOGISTICS, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_rma_list_view(request):
    """
    GET /api/v1/admin/orders/rmas/
    Lista general de solicitudes RMA con filtros por estado, reembolso y orden.
    """
    qs = ReturnMerchandiseAuthorization.objects.select_related("order", "warehouse").prefetch_related(
        "items__order_item", "items__product", "items__variant"
    ).all()
    status_f = request.query_params.get("status")
    if status_f:
        qs = qs.filter(status=status_f)
    refund_f = request.query_params.get("refund_status")
    if refund_f:
        qs = qs.filter(refund_status=refund_f)

    data = RMASerializer(qs[:100], many=True, context={"request": request}).data
    return Response({"count": len(data), "results": data})


@rbac_endpoint(
    module=MODULE_ORDERS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_SUPPORT],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_rma_authorize_view(request, rma_id):
    """
    POST /api/v1/admin/orders/rmas/<uuid:rma_id>/authorize/
    Autoriza o rechaza comercialmente el retorno RMA.
    """
    rma = ReturnMerchandiseAuthorization.objects.filter(pk=rma_id).first()
    if rma is None:
        return Response({"error": "Solicitud RMA no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data or {}
    try:
        updated = authorize_or_reject_rma(
            rma,
            approve=bool(payload.get("approve", True)),
            notes=payload.get("notes", ""),
            actor=request.user,
        )
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(RMASerializer(updated, context={"request": request}).data)


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_modules=[MODULE_INVENTORY, MODULE_LOGISTICS],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE, ROLE_LOGISTICS],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_rma_inspect_view(request, rma_id):
    """
    POST /api/v1/admin/orders/rmas/<uuid:rma_id>/inspect/
    Recepción física en bodega, inspección técnica y reingreso controlado a inventario con compensación de Kardex y Costos.
    """
    rma = ReturnMerchandiseAuthorization.objects.filter(pk=rma_id).first()
    if rma is None:
        return Response({"error": "Solicitud RMA no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data or {}
    wh_obj = None
    if payload.get("warehouse_id"):
        wh_obj = Warehouse.objects.filter(pk=payload["warehouse_id"], is_active=True).first()

    idem_key = payload.get("idempotency_key") or request.headers.get("Idempotency-Key")
    try:
        updated = receive_and_inspect_rma(
            rma,
            inspections=payload.get("inspections") or [],
            warehouse=wh_obj,
            notes=payload.get("notes", ""),
            idempotency_key=idem_key,
            actor=request.user,
        )
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(RMASerializer(updated, context={"request": request}).data)


@rbac_endpoint(
    module=MODULE_FINANCES,
    allowed_modules=[MODULE_FINANCES, MODULE_ORDERS],
    capability=PERM_APPROVE_PAYMENTS,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_rma_refund_view(request, rma_id):
    """
    POST /api/v1/admin/orders/rmas/<uuid:rma_id>/refund/
    Resolución y registro idempotente de reembolso financiero (sin alterar existencias físicas).
    """
    rma = ReturnMerchandiseAuthorization.objects.filter(pk=rma_id).first()
    if rma is None:
        return Response({"error": "Solicitud RMA no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data or {}
    idem_key = payload.get("idempotency_key") or request.headers.get("Idempotency-Key")
    try:
        updated = resolve_rma_refund(
            rma,
            refund_amount=payload.get("refund_amount"),
            execute_now=bool(payload.get("execute_now", False)),
            provider=payload.get("provider", ""),
            reference=payload.get("reference", ""),
            idempotency_key=idem_key,
            notes=payload.get("notes", ""),
            actor=request.user,
        )
    except OMSPermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except OMSServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(RMASerializer(updated, context={"request": request}).data)

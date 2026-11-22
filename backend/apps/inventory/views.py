# apps/inventory/views.py
import csv
import io
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied, ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, F, Q, Sum
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from apps.inventory.models import (
    InventoryMovement,
    SerialNumberTrack,
    StockReservation,
    Warehouse,
    WarehouseStock,
    WarehouseTransfer,
)
from apps.inventory.serializers import (
    InventoryMovementSerializer,
    SerialNumberTrackSerializer,
    StockReservationSerializer,
    WarehouseSerializer,
    WarehouseStockSerializer,
    WarehouseTransferSerializer,
)
from apps.inventory.services import (
    InventoryServiceError,
    adjust_stock,
    create_and_dispatch_transfer,
    dispatch_order_reservations,
    expire_stale_reservations,
    receive_transfer,
    register_serials,
    set_product_serialization_mode,
)
from apps.orders.models import Order
from apps.products.models import Product, ProductVariant
from core.audit.constants import CATEGORY_CREATION, CATEGORY_MODIFICATION, SEVERITY_INFO
from core.audit.sanitizer import compute_state_diff
from core.audit.services import record_audit_event
from core.rbac.constants import (
    MODULE_INVENTORY,
    PERM_ADJUST_INVENTORY,
    PERM_EXPORT_DATA,
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
    ROLE_PURCHASING,
    ROLE_SUPER_ADMIN,
    ROLE_WAREHOUSE,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability


def _sanitize_cell(val):
    s = "" if val is None else str(val)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s}"
    return s


def _require_adjust_permission(user):
    if is_effective_super_admin(user):
        return
    if not user_has_capability(user, PERM_ADJUST_INVENTORY):
        raise DjangoPermissionDenied("No posee autorización ('adjust_inventory') para modificar existencias o seriales.")


def _require_export_permission(user):
    if is_effective_super_admin(user):
        return
    if not user_has_capability(user, PERM_EXPORT_DATA):
        raise DjangoPermissionDenied("No posee autorización ('export_data') para exportar datos de inventario.")


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE, ROLE_PURCHASING, ROLE_FINANCE],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_warehouses_list(request):
    """GET/POST /api/v1/admin/inventory/warehouses/"""
    if request.method == "GET":
        qs = Warehouse.objects.all()
        if request.query_params.get("active_only") == "true":
            qs = qs.filter(is_active=True)
        ser = WarehouseSerializer(qs, many=True)
        return Response({"results": ser.data, "count": len(ser.data)})

    ser = WarehouseSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    wh = Warehouse(**ser.validated_data)
    try:
        wh.full_clean()
        if wh.is_default:
            Warehouse.objects.filter(is_default=True).update(is_default=False)
        wh.save()
    except (DjangoValidationError, IntegrityError) as exc:
        transaction.set_rollback(True)
        return Response({"error": getattr(exc, "message_dict", str(exc))}, status=status.HTTP_400_BAD_REQUEST)

    record_audit_event(
        module=MODULE_INVENTORY,
        action="WAREHOUSE_CREATED",
        event_category=CATEGORY_CREATION,
        resource_type="Warehouse",
        resource_id=str(wh.id),
        resource_repr=str(wh),
        new_values={"code": wh.code, "type": wh.warehouse_type, "sellable": wh.is_sellable_online},
        actor=request.user,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return Response(WarehouseSerializer(wh).data, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE, ROLE_PURCHASING, ROLE_FINANCE],
        "PATCH": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT],
    },
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_warehouse_detail(request, warehouse_id):
    """GET/PATCH /api/v1/admin/inventory/warehouses/<warehouse_id>/"""
    try:
        wh = Warehouse.objects.select_for_update().get(pk=warehouse_id)
    except Warehouse.DoesNotExist:
        return Response({"error": "Bodega no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(WarehouseSerializer(wh).data)

    before = {
        "name": wh.name,
        "warehouse_type": wh.warehouse_type,
        "is_active": wh.is_active,
        "is_sellable_online": wh.is_sellable_online,
        "fulfillment_priority": wh.fulfillment_priority,
    }
    ser = WarehouseSerializer(wh, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    for k, v in ser.validated_data.items():
        setattr(wh, k, v)
    try:
        wh.full_clean()
        if wh.is_default:
            Warehouse.objects.exclude(pk=wh.pk).filter(is_default=True).update(is_default=False)
        wh.save()
    except (DjangoValidationError, IntegrityError) as exc:
        transaction.set_rollback(True)
        return Response({"error": getattr(exc, "message_dict", str(exc))}, status=status.HTTP_400_BAD_REQUEST)

    if wh.is_active != before["is_active"] or wh.is_sellable_online != before["is_sellable_online"]:
        from .services import sync_legacy_stock_projection

        for ws in WarehouseStock.objects.filter(warehouse=wh).select_related("product", "variant"):
            sync_legacy_stock_projection(ws.product, ws.variant)

    after = {
        "name": wh.name,
        "warehouse_type": wh.warehouse_type,
        "is_active": wh.is_active,
        "is_sellable_online": wh.is_sellable_online,
        "fulfillment_priority": wh.fulfillment_priority,
    }
    prev_v, new_v, changed = compute_state_diff(before, after)
    if changed:
        record_audit_event(
            module=MODULE_INVENTORY,
            action="WAREHOUSE_UPDATED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="Warehouse",
            resource_id=str(wh.id),
            resource_repr=str(wh),
            previous_values=prev_v,
            new_values=new_v,
            changed_fields=changed,
            actor=request.user,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
    return Response(WarehouseSerializer(wh).data)


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE, ROLE_PURCHASING, ROLE_FINANCE]},
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_wms_stocks(request):
    """GET /api/v1/admin/inventory/stocks/ — Existencias dimensionales por bodega y SKU."""
    qs = WarehouseStock.objects.select_related("warehouse", "product", "variant").all()

    wh_id = request.query_params.get("warehouse")
    if wh_id:
        qs = qs.filter(warehouse_id=wh_id)

    search = (request.query_params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(product__name__icontains=search)
            | Q(product__sku__icontains=search)
            | Q(variant__sku__icontains=search)
            | Q(variant__barcode__icontains=search)
            | Q(variant__name__icontains=search)
        )

    low_only = request.query_params.get("low_stock") == "true"
    rows = list(qs[:500])
    if low_only:
        rows = [
            r for r in rows
            if r.available_quantity <= (r.variant.stock_min if r.variant_id else r.product.stock_min)
        ]

    # Contar seriales activos por (warehouse, product, variant) en una sola query
    ser_counts = {}
    for row in (
        SerialNumberTrack.objects.filter(
            status__in=[SerialNumberTrack.Status.IN_STOCK, SerialNumberTrack.Status.RESERVED, SerialNumberTrack.Status.DAMAGED]
        )
        .values("warehouse_id", "product_id", "variant_id")
        .annotate(c=Count("id"))
    ):
        ser_counts[(row["warehouse_id"], row["product_id"], row["variant_id"])] = row["c"]

    for r in rows:
        r.serialized_count = ser_counts.get((r.warehouse_id, r.product_id, r.variant_id), 0)

    totals = {
        "total_physical": sum(r.physical_quantity for r in rows),
        "total_reserved": sum(r.reserved_quantity for r in rows),
        "total_non_sellable": sum(r.non_sellable_quantity for r in rows),
        "total_available": sum(r.available_quantity for r in rows),
    }

    ser = WarehouseStockSerializer(rows, many=True)
    return Response({"results": ser.data, "count": len(ser.data), "totals": totals})


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_wms_adjust(request):
    """POST /api/v1/admin/inventory/adjust/ — Ajuste atómico con registro en Kardex."""
    try:
        _require_adjust_permission(request.user)
        wh = Warehouse.objects.get(pk=request.data.get("warehouse_id"))
        product = Product.objects.get(pk=request.data.get("product_id"))
        variant_id = request.data.get("variant_id") or None
        variant = ProductVariant.objects.get(pk=variant_id, product=product) if variant_id else None
        delta_phys = int(request.data.get("delta_physical") or 0)
        delta_non_sell = int(request.data.get("delta_non_sellable") or 0)
        reason = (request.data.get("reason") or "Ajuste operativo de inventario").strip()
        mov_type = request.data.get("movement_type") or None
        idem = request.headers.get("Idempotency-Key") or request.data.get("idempotency_key") or None

        ws, mov = adjust_stock(
            warehouse=wh,
            product=product,
            variant=variant,
            delta_physical=delta_phys,
            delta_non_sellable=delta_non_sell,
            movement_type=mov_type,
            reason=reason,
            source_document_type="ADMIN_ADJUSTMENT",
            actor=request.user,
            idempotency_key=idem,
        )
        return Response({
            "stock": WarehouseStockSerializer(ws).data,
            "movement": InventoryMovementSerializer(mov).data if mov else None,
        })
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (Warehouse.DoesNotExist, Product.DoesNotExist, ProductVariant.DoesNotExist):
        return Response({"error": "Bodega, producto o variante no encontrados."}, status=status.HTTP_404_NOT_FOUND)
    except (InventoryServiceError, ValueError, TypeError) as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE, ROLE_PURCHASING, ROLE_FINANCE]},
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_wms_kardex(request):
    """GET /api/v1/admin/inventory/kardex/ — Diario inmutable de movimientos."""
    qs = InventoryMovement.objects.select_related("warehouse", "product", "variant", "actor").all()

    wh_id = request.query_params.get("warehouse")
    if wh_id:
        qs = qs.filter(warehouse_id=wh_id)
    mov_type = request.query_params.get("movement_type")
    if mov_type:
        qs = qs.filter(movement_type=mov_type)
    search = (request.query_params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(sku_snapshot__icontains=search)
            | Q(product__name__icontains=search)
            | Q(reason__icontains=search)
            | Q(source_document_id__icontains=search)
        )

    export_fmt = request.query_params.get("export")
    if export_fmt == "csv":
        try:
            _require_export_permission(request.user)
        except DjangoPermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "Fecha", "Bodega", "SKU", "Producto", "Tipo", "Cantidad",
            "Fisico Antes", "Fisico Despues", "Reservado Antes", "Reservado Despues",
            "Disponible Antes", "Disponible Despues", "Motivo", "Documento", "Usuario", "Seriales",
        ])
        for m in qs[:2000]:
            writer.writerow([
                m.recorded_at.isoformat(),
                _sanitize_cell(m.warehouse.code),
                _sanitize_cell(m.sku_snapshot),
                _sanitize_cell(m.product.name),
                _sanitize_cell(m.movement_type),
                m.quantity,
                m.physical_before,
                m.physical_after,
                m.reserved_before,
                m.reserved_after,
                m.available_before,
                m.available_after,
                _sanitize_cell(m.reason),
                _sanitize_cell(f"{m.source_document_type}:{m.source_document_id}"),
                _sanitize_cell(m.actor.email if m.actor_id else "Sistema"),
                _sanitize_cell(",".join(m.serial_numbers or [])),
            ])
        resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="kardex_levelpro.csv"'
        return resp

    rows = list(qs[:250])
    ser = InventoryMovementSerializer(rows, many=True)
    return Response({"results": ser.data, "count": len(ser.data)})


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE, ROLE_PURCHASING, ROLE_FINANCE]},
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_wms_reservations(request):
    """GET /api/v1/admin/inventory/reservations/"""
    qs = StockReservation.objects.select_related("warehouse", "product", "variant", "order").all()
    st = request.query_params.get("status")
    if st:
        qs = qs.filter(status=st)
    rows = list(qs[:200])
    return Response({"results": StockReservationSerializer(rows, many=True).data, "count": len(rows)})


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_wms_expire_reservations(request):
    """POST /api/v1/admin/inventory/reservations/expire/"""
    released = expire_stale_reservations()
    return Response({"expired_released_count": released})


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE, ROLE_PURCHASING],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_wms_transfers(request):
    """GET/POST /api/v1/admin/inventory/transfers/"""
    if request.method == "GET":
        qs = WarehouseTransfer.objects.select_related("source_warehouse", "destination_warehouse").prefetch_related(
            "items__product", "items__variant"
        )[:100]
        return Response({"results": WarehouseTransferSerializer(qs, many=True).data})

    try:
        _require_adjust_permission(request.user)
        src = Warehouse.objects.get(pk=request.data.get("source_warehouse_id"))
        dst = Warehouse.objects.get(pk=request.data.get("destination_warehouse_id"))
        items = request.data.get("items") or []
        notes = request.data.get("notes") or ""
        auto_receive = bool(request.data.get("auto_receive", False))
        trf = create_and_dispatch_transfer(
            source_warehouse=src,
            destination_warehouse=dst,
            items=items,
            notes=notes,
            actor=request.user,
            auto_receive=auto_receive,
        )
        return Response(WarehouseTransferSerializer(trf).data, status=status.HTTP_201_CREATED)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (Warehouse.DoesNotExist, Product.DoesNotExist, ProductVariant.DoesNotExist):
        return Response({"error": "Bodega, producto o variante no encontrados."}, status=status.HTTP_404_NOT_FOUND)
    except (InventoryServiceError, ValueError, TypeError) as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_wms_transfer_receive(request, transfer_id):
    """POST /api/v1/admin/inventory/transfers/<transfer_id>/receive/"""
    try:
        _require_adjust_permission(request.user)
        trf = WarehouseTransfer.objects.get(pk=transfer_id)
        received = receive_transfer(trf, actor=request.user)
        return Response(WarehouseTransferSerializer(received).data)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except WarehouseTransfer.DoesNotExist:
        return Response({"error": "Transferencia no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except InventoryServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE, ROLE_PURCHASING],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_serials_list(request):
    """GET/POST /api/v1/admin/serials/"""
    if request.method == "GET":
        qs = SerialNumberTrack.objects.select_related("warehouse", "product", "variant", "customer").all()
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(serial_number__icontains=search)
                | Q(product__sku__icontains=search)
                | Q(variant__sku__icontains=search)
                | Q(product__name__icontains=search)
            )
        wh_id = request.query_params.get("warehouse")
        if wh_id:
            qs = qs.filter(warehouse_id=wh_id)
        st = request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        pid = request.query_params.get("product")
        if pid:
            qs = qs.filter(product_id=pid)

        rows = list(qs[:250])
        return Response({
            "results": SerialNumberTrackSerializer(rows, many=True, context={"request": request}).data,
            "count": len(rows),
        })

    try:
        _require_adjust_permission(request.user)
        wh = Warehouse.objects.get(pk=request.data.get("warehouse_id"))
        product = Product.objects.get(pk=request.data.get("product_id"))
        variant_id = request.data.get("variant_id") or None
        variant = ProductVariant.objects.get(pk=variant_id, product=product) if variant_id else None
        serials = request.data.get("serial_numbers") or []
        notes = request.data.get("notes") or ""
        created = register_serials(
            warehouse=wh,
            product=product,
            variant=variant,
            serial_numbers=serials,
            actor=request.user,
            notes=notes,
        )
        return Response(
            {
                "registered": SerialNumberTrackSerializer(created, many=True, context={"request": request}).data,
                "count": len(created),
            },
            status=status.HTTP_201_CREATED,
        )
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (Warehouse.DoesNotExist, Product.DoesNotExist, ProductVariant.DoesNotExist):
        return Response({"error": "Bodega, producto o variante no encontrados."}, status=status.HTTP_404_NOT_FOUND)
    except (InventoryServiceError, DjangoValidationError, ValueError) as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_serials_regularize(request):
    """
    POST /api/v1/admin/serials/regularize/
    BF-46: Registra seriales faltantes sobre stock físico preexistente sin crear stock,
    y opcionalmente cambia el producto a serialization_mode='required' si cumple integridad.
    """
    try:
        _require_adjust_permission(request.user)
        wh = Warehouse.objects.get(pk=request.data.get("warehouse_id"))
        product = Product.objects.get(pk=request.data.get("product_id"))
        variant_id = request.data.get("variant_id") or None
        variant = ProductVariant.objects.get(pk=variant_id, product=product) if variant_id else None
        serials = request.data.get("serial_numbers") or []
        set_required = bool(request.data.get("set_required", False))

        created = []
        if serials:
            created = register_serials(
                warehouse=wh,
                product=product,
                variant=variant,
                serial_numbers=serials,
                actor=request.user,
                notes="Regularización BF-46",
            )
        if set_required:
            set_product_serialization_mode(product, Product.SerializationMode.REQUIRED, actor=request.user)

        product.refresh_from_db()
        return Response({
            "registered_count": len(created),
            "serialization_mode": product.serialization_mode,
        })
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (Warehouse.DoesNotExist, Product.DoesNotExist, ProductVariant.DoesNotExist):
        return Response({"error": "Bodega, producto o variante no encontrados."}, status=status.HTTP_404_NOT_FOUND)
    except (InventoryServiceError, DjangoValidationError, ValueError) as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_serials_set_mode(request):
    """POST /api/v1/admin/serials/mode/"""
    try:
        product = Product.objects.get(pk=request.data.get("product_id"))
        mode = request.data.get("serialization_mode")
        updated = set_product_serialization_mode(product, mode, actor=request.user)
        return Response({"product_id": str(updated.id), "serialization_mode": updated.serialization_mode})
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    except InventoryServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_INVENTORY,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_wms_dispatch_order(request, order_id):
    """POST /api/v1/admin/inventory/orders/<order_id>/dispatch/"""
    try:
        _require_adjust_permission(request.user)
        order = Order.objects.select_for_update().get(pk=order_id)
        serial_assignments = request.data.get("serial_assignments") or {}
        movements = dispatch_order_reservations(
            order,
            serial_assignments=serial_assignments,
            actor=request.user,
        )
        return Response({
            "order_id": str(order.id),
            "dispatched_movements": InventoryMovementSerializer(movements, many=True).data,
        })
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except Order.DoesNotExist:
        return Response({"error": "Orden no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except InventoryServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

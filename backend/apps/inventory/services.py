# apps/inventory/services.py
"""
LEVELPRO OS V4.0 — GATE 4: Motor Transaccional de Inventario Dimensional, Kardex, Reservas y Seriales.
Fuente única de verdad del inventario de LevelPro Audio.
"""

import uuid
from collections import Counter
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import connection, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone

from apps.inventory.models import (
    InventoryMovement,
    SerialNumberTrack,
    StockReservation,
    Warehouse,
    WarehouseStock,
    WarehouseTransfer,
    WarehouseTransferItem,
)
from apps.products.models import Product, ProductVariant
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_MODIFICATION,
    CATEGORY_STOCK_ADJUSTMENT,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)
from core.audit.services import record_audit_event
from core.rbac.constants import MODULE_INVENTORY


class InventoryServiceError(ValueError):
    """Error de dominio controlado del motor WMS."""


def _lock_warehouse_stocks(qset):
    options = {"no_key": True} if connection.vendor == "postgresql" else {}
    return list(qset.order_by("warehouse__fulfillment_priority", "pk").select_for_update(**options))


def get_default_warehouse() -> Warehouse:
    wh = Warehouse.objects.filter(is_active=True, is_default=True).first()
    if wh is None:
        wh = Warehouse.objects.filter(is_active=True, is_sellable_online=True).order_by("fulfillment_priority", "code").first()
    if wh is None:
        wh, _ = Warehouse.objects.get_or_create(
            code="BOD-CENTRAL",
            defaults={
                "name": "Bodega Central",
                "warehouse_type": Warehouse.WarehouseType.CENTRAL,
                "is_active": True,
                "is_sellable_online": True,
                "fulfillment_priority": 10,
                "is_default": True,
            },
        )
    return wh


def sync_legacy_stock_projection(product: Product, variant: ProductVariant = None) -> int:
    """
    Proyecta la disponibilidad online elegible desde WarehouseStock hacia los campos legacy
    Product.stock / ProductVariant.stock para compatibilidad de lectura sin motores divergentes.
    """
    if variant is not None:
        ProductVariant.objects.select_for_update().filter(pk=variant.pk).exists()
    else:
        Product.objects.select_for_update().filter(pk=product.pk).exists()

    rows = WarehouseStock.objects.filter(
        product=product,
        variant=variant,
        warehouse__is_active=True,
        warehouse__is_sellable_online=True,
    )
    total_available = sum(max(0, r.available_quantity) for r in rows)

    if variant is not None:
        ProductVariant.objects.filter(pk=variant.pk).update(stock=total_available)
        variant.stock = total_available
    else:
        # Solo proyectar a Product.stock si el producto NO tiene variantes
        if not ProductVariant.objects.filter(product_id=product.pk).exists():
            Product.objects.filter(pk=product.pk).update(stock=total_available)
            product.stock = total_available
    return total_available


def _record_movement(
    *,
    warehouse: Warehouse,
    product: Product,
    variant: ProductVariant,
    movement_type: str,
    quantity: int,
    phys_before: int,
    phys_after: int,
    res_before: int,
    res_after: int,
    avail_before: int,
    avail_after: int,
    reason: str,
    source_document_type: str = "",
    source_document_id: str = "",
    actor=None,
    correlation_id=None,
    idempotency_key: str = None,
    serial_numbers=None,
) -> InventoryMovement:
    sku_snap = variant.sku if variant is not None else (product.sku or "")
    affected = {
        "physical": phys_after - phys_before,
        "reserved": res_after - res_before,
        "available": avail_after - avail_before,
    }
    return InventoryMovement.objects.create(
        warehouse=warehouse,
        product=product,
        variant=variant,
        sku_snapshot=sku_snap,
        movement_type=movement_type,
        quantity=quantity,
        affected_dimensions=affected,
        physical_before=phys_before,
        physical_after=phys_after,
        reserved_before=res_before,
        reserved_after=res_after,
        available_before=avail_before,
        available_after=avail_after,
        reason=reason[:255],
        source_document_type=source_document_type[:60],
        source_document_id=str(source_document_id or "")[:80],
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        correlation_id=correlation_id or uuid.uuid4(),
        idempotency_key=idempotency_key or None,
        serial_numbers=list(serial_numbers or []),
    )


@transaction.atomic
def adjust_stock(
    *,
    warehouse: Warehouse,
    product: Product,
    variant: ProductVariant = None,
    delta_physical: int = 0,
    delta_non_sellable: int = 0,
    movement_type: str = None,
    reason: str = "Ajuste manual de inventario",
    source_document_type: str = "ADJUSTMENT",
    source_document_id: str = "",
    actor=None,
    correlation_id=None,
    idempotency_key: str = None,
    serial_numbers=None,
) -> tuple[WarehouseStock, InventoryMovement | None]:
    """
    Mutación controlada y atómica de stock físico/no elegible con registro simultáneo en Kardex.
    """
    if idempotency_key:
        existing_mov = InventoryMovement.objects.filter(idempotency_key=idempotency_key).first()
        if existing_mov:
            expected_variant_id = variant.id if variant else None
            expected_serials = [str(s).strip() for s in (serial_numbers or []) if str(s).strip()]
            actual_phys_delta = (existing_mov.affected_dimensions or {}).get("physical")
            if (
                existing_mov.warehouse_id != warehouse.id
                or existing_mov.product_id != product.id
                or existing_mov.variant_id != expected_variant_id
                or actual_phys_delta != int(delta_physical)
                or list(existing_mov.serial_numbers or []) != expected_serials
            ):
                raise InventoryServiceError(
                    "Conflicto de idempotencia: la clave ya fue utilizada con un payload diferente."
                )
            ws = WarehouseStock.objects.get(warehouse=warehouse, product=product, variant=variant)
            return ws, existing_mov

    if variant is None and ProductVariant.objects.filter(product_id=product.pk).exists():
        raise InventoryServiceError(
            f"El producto '{product.name}' posee variantes; el ajuste debe aplicarse a una variante específica."
        )
    if variant is not None and variant.product_id != product.pk:
        raise InventoryServiceError("La variante no pertenece al producto indicado.")

    ws, _ = WarehouseStock.objects.get_or_create(
        warehouse=warehouse,
        product=product,
        variant=variant,
        defaults={"physical_quantity": 0, "reserved_quantity": 0, "non_sellable_quantity": 0},
    )
    ws = WarehouseStock.objects.select_for_update().get(pk=ws.pk)

    phys_before = ws.physical_quantity
    res_before = ws.reserved_quantity
    avail_before = ws.available_quantity

    new_phys = phys_before + int(delta_physical)
    new_non_sell = ws.non_sellable_quantity + int(delta_non_sellable)

    if new_phys < 0 or new_non_sell < 0:
        raise InventoryServiceError("Las dimensiones de stock no pueden ser negativas.")
    if new_non_sell > new_phys:
        raise InventoryServiceError("El stock no elegible no puede superar al stock físico.")
    if res_before > (new_phys - new_non_sell):
        raise InventoryServiceError("No se puede reducir el stock físico por debajo del stock reservado vigente.")

    if delta_physical == 0 and delta_non_sellable == 0:
        return ws, None

    cleaned_sns = [str(s).strip() for s in (serial_numbers or []) if str(s).strip()]
    db_serialization_mode = Product.objects.values_list("serialization_mode", flat=True).get(pk=product.pk)
    if db_serialization_mode == Product.SerializationMode.REQUIRED and int(delta_physical) != 0:
        expected_count = abs(int(delta_physical))
        if len(cleaned_sns) != expected_count or len(set(cleaned_sns)) != expected_count:
            raise InventoryServiceError(
                f"El producto '{product.name}' requiere exactamente {expected_count} serial(es) únicos para este ajuste."
            )
        if int(delta_physical) > 0:
            for sn in cleaned_sns:
                existing_sn = SerialNumberTrack.objects.select_for_update().filter(
                    product=product, variant=variant, serial_number=sn
                ).first()
                if existing_sn is not None:
                    if (
                        movement_type == InventoryMovement.MovementType.RETURN_IN
                        and existing_sn.status == SerialNumberTrack.Status.DISPATCHED
                    ):
                        existing_sn.status = SerialNumberTrack.Status.IN_STOCK
                        existing_sn.warehouse = warehouse
                        existing_sn.order = None
                        existing_sn.reservation = None
                        existing_sn.save(update_fields=["status", "warehouse", "order", "reservation", "updated_at"])
                    else:
                        raise InventoryServiceError(f"El número de serie '{sn}' ya existe para este SKU.")
                else:
                    sn_obj = SerialNumberTrack(
                        serial_number=sn,
                        product=product,
                        variant=variant,
                        warehouse=warehouse,
                        status=SerialNumberTrack.Status.IN_STOCK,
                        notes=reason[:255],
                    )
                    sn_obj.full_clean()
                    sn_obj.save()
        else:
            for sn in cleaned_sns:
                sn_obj = SerialNumberTrack.objects.select_for_update().filter(
                    warehouse=warehouse,
                    product=product,
                    variant=variant,
                    serial_number=sn,
                    status=SerialNumberTrack.Status.IN_STOCK,
                ).first()
                if sn_obj is None:
                    raise InventoryServiceError(
                        f"El serial '{sn}' no está disponible en bodega '{warehouse.code}' para ajuste negativo."
                    )
                sn_obj.status = SerialNumberTrack.Status.DECOMMISSIONED
                sn_obj.warehouse = None
                sn_obj.save(update_fields=["status", "warehouse", "updated_at"])

    ws.physical_quantity = new_phys
    ws.non_sellable_quantity = new_non_sell
    ws.save(update_fields=["physical_quantity", "non_sellable_quantity", "updated_at"])

    if db_serialization_mode == Product.SerializationMode.REQUIRED:
        tracked_count = SerialNumberTrack.objects.filter(
            warehouse=warehouse,
            product=product,
            variant=variant,
            status__in=[
                SerialNumberTrack.Status.IN_STOCK,
                SerialNumberTrack.Status.RESERVED,
                SerialNumberTrack.Status.DAMAGED,
            ],
        ).count()
        if tracked_count != new_phys:
            raise InventoryServiceError(
                f"Inconsistencia de paridad serial en '{warehouse.code}': físico={new_phys}, seriales={tracked_count}."
            )

    avail_after = ws.available_quantity
    if not movement_type:
        movement_type = (
            InventoryMovement.MovementType.ADJUST_POS
            if delta_physical >= 0
            else InventoryMovement.MovementType.ADJUST_NEG
        )

    mov = _record_movement(
        warehouse=warehouse,
        product=product,
        variant=variant,
        movement_type=movement_type,
        quantity=abs(int(delta_physical)) or abs(int(delta_non_sellable)),
        phys_before=phys_before,
        phys_after=new_phys,
        res_before=res_before,
        res_after=res_before,
        avail_before=avail_before,
        avail_after=avail_after,
        reason=reason,
        source_document_type=source_document_type,
        source_document_id=source_document_id,
        actor=actor,
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
        serial_numbers=serial_numbers,
    )
    sync_legacy_stock_projection(product, variant)

    record_audit_event(
        module=MODULE_INVENTORY,
        action="STOCK_ADJUSTED",
        event_category=CATEGORY_STOCK_ADJUSTMENT,
        resource_type="WarehouseStock",
        resource_id=str(ws.id),
        resource_repr=str(ws),
        previous_values={"physical": phys_before, "available": avail_before},
        new_values={"physical": new_phys, "available": avail_after, "movement_type": movement_type},
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=False,
    )
    return ws, mov


@transaction.atomic
def receive_stock_into_warehouse(
    *,
    warehouse: Warehouse,
    product: Product,
    variant: ProductVariant = None,
    quantity: int,
    serial_numbers=None,
    movement_type: str = InventoryMovement.MovementType.MANUAL_IN,
    reason: str = "Recepción de inventario en bodega",
    source_document_type: str = "RECEIPT",
    source_document_id: str = "",
    actor=None,
    correlation_id=None,
    idempotency_key: str = None,
) -> tuple[WarehouseStock, InventoryMovement | None]:
    """
    Contrato reutilizable de recepción física de inventario (preparado para Gate 5),
    con validación atómica de seriales REQUIRED, Kardex e idempotencia.
    """
    qty = int(quantity)
    if qty <= 0:
        raise InventoryServiceError("La cantidad a recepcionar debe ser mayor a cero.")
    return adjust_stock(
        warehouse=warehouse,
        product=product,
        variant=variant,
        delta_physical=qty,
        movement_type=movement_type,
        reason=reason,
        source_document_type=source_document_type,
        source_document_id=source_document_id,
        actor=actor,
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
        serial_numbers=serial_numbers,
    )


@transaction.atomic
def reserve_stock_for_order(
    order,
    demand: dict,
    *,
    actor=None,
    ttl_minutes: int = 120,
    session_key: str = "",
) -> list[StockReservation]:
    """
    Reserva existencias elegibles en bodegas sellable-online ordenadas por prioridad de preparación.
    Garantiza no sobreventa bajo concurrencia real mediante select_for_update().
    """
    if not demand:
        return []

    created_reservations = []
    expires_at = timezone.now() + timedelta(minutes=ttl_minutes)
    corr_id = uuid.uuid4()

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

        # Bloquear todas las filas sellable-online de esta unidad en orden determinístico
        stock_rows = _lock_warehouse_stocks(
            WarehouseStock.objects.select_related("warehouse").filter(
                product=product,
                variant=variant,
                warehouse__is_active=True,
                warehouse__is_sellable_online=True,
            )
        )

        # Fallback: si no hay WarehouseStock aún pero hay stock legacy en tests/fixtures antiguos
        if not stock_rows:
            legacy_qty = variant.stock if variant is not None else product.stock
            if legacy_qty >= qty_needed:
                default_wh = get_default_warehouse()
                ws, _ = adjust_stock(
                    warehouse=default_wh,
                    product=product,
                    variant=variant,
                    delta_physical=legacy_qty,
                    movement_type=InventoryMovement.MovementType.OPENING,
                    reason="Sincronización automática de apertura desde stock legacy",
                    source_document_type="ORDER",
                    source_document_id=str(order.id),
                    actor=actor,
                )
                stock_rows = [WarehouseStock.objects.select_for_update().get(pk=ws.pk)]

        total_avail = sum(r.available_quantity for r in stock_rows)
        if total_avail < qty_needed:
            label = f"{product.name} ({variant.name})" if variant else product.name
            raise InventoryServiceError(f"Stock insuficiente para {label}.")

        remaining = qty_needed
        for ws in stock_rows:
            if remaining <= 0:
                break
            avail = ws.available_quantity
            if avail <= 0:
                continue
            take = min(avail, remaining)
            idem_res = f"order_res:{order.id}:{ws.warehouse_id}:{target_key}"
            existing_res = StockReservation.objects.filter(idempotency_key=idem_res).first()
            if existing_res:
                created_reservations.append(existing_res)
                remaining -= existing_res.quantity
                continue

            phys_before = ws.physical_quantity
            res_before = ws.reserved_quantity
            avail_before = ws.available_quantity

            ws.reserved_quantity = res_before + take
            ws.save(update_fields=["reserved_quantity", "updated_at"])

            res_obj = StockReservation.objects.create(
                order=order,
                session_key=session_key or "",
                warehouse=ws.warehouse,
                product=product,
                variant=variant,
                quantity=take,
                status=StockReservation.Status.TEMPORARY,
                expires_at=expires_at,
                idempotency_key=idem_res,
                created_by=actor if getattr(actor, "is_authenticated", False) else None,
            )
            created_reservations.append(res_obj)

            _record_movement(
                warehouse=ws.warehouse,
                product=product,
                variant=variant,
                movement_type=InventoryMovement.MovementType.RESERVE,
                quantity=take,
                phys_before=phys_before,
                phys_after=phys_before,
                res_before=res_before,
                res_after=ws.reserved_quantity,
                avail_before=avail_before,
                avail_after=ws.available_quantity,
                reason=f"Reserva temporal por orden #{order.id}",
                source_document_type="ORDER",
                source_document_id=str(order.id),
                actor=actor,
                correlation_id=corr_id,
                idempotency_key=f"kardex_res:{order.id}:{ws.warehouse_id}:{target_key}",
            )
            remaining -= take

        sync_legacy_stock_projection(product, variant)

    return created_reservations


@transaction.atomic
def consolidate_order_reservations(order, *, actor=None) -> int:
    """
    Consolida las reservas temporales cuando la orden pasa a PAID.
    Una reserva consolidada NUNCA expira por TTL.
    """
    reservations = list(
        StockReservation.objects.select_for_update()
        .filter(order=order, status=StockReservation.Status.TEMPORARY)
    )
    for res in reservations:
        res.status = StockReservation.Status.CONSOLIDATED
        res.expires_at = None
        res.save(update_fields=["status", "expires_at", "updated_at"])
    return len(reservations)


@transaction.atomic
def release_order_reservations(
    order,
    *,
    reason: str = "Liberación por cancelación de orden",
    mark_expired: bool = False,
    actor=None,
) -> int:
    """
    Libera reservas activas (TEMPORARY o CONSOLIDATED antes del despacho) de manera idempotente.
    """
    target_status = StockReservation.Status.EXPIRED if mark_expired else StockReservation.Status.RELEASED
    reservations = list(
        StockReservation.objects.select_for_update(of=("self",))
        .select_related("warehouse", "product", "variant")
        .filter(order=order, status__in=[StockReservation.Status.TEMPORARY, StockReservation.Status.CONSOLIDATED])
        .order_by("warehouse_id", "pk")
    )
    if not reservations:
        return 0

    corr_id = uuid.uuid4()
    released_count = 0

    for res in reservations:
        if res.product_id is None:
            res.status = target_status
            res.save(update_fields=["status", "updated_at"])
            released_count += 1
            continue
        ws = WarehouseStock.objects.select_for_update().get(
            warehouse=res.warehouse,
            product=res.product,
            variant=res.variant,
        )
        phys_before = ws.physical_quantity
        res_before = ws.reserved_quantity
        avail_before = ws.available_quantity

        release_qty = min(res.quantity, res_before)
        if release_qty > 0:
            ws.reserved_quantity = res_before - release_qty
            ws.save(update_fields=["reserved_quantity", "updated_at"])

        # Liberar seriales asignados a esta reserva si los hubiera
        assigned_serials = list(
            SerialNumberTrack.objects.select_for_update().filter(
                reservation=res, status=SerialNumberTrack.Status.RESERVED
            )
        )
        released_sn_list = []
        for sn in assigned_serials:
            sn.status = SerialNumberTrack.Status.IN_STOCK
            sn.reservation = None
            sn.save(update_fields=["status", "reservation", "updated_at"])
            released_sn_list.append(sn.serial_number)

        res.status = target_status
        res.save(update_fields=["status", "updated_at"])

        _record_movement(
            warehouse=res.warehouse,
            product=res.product,
            variant=res.variant,
            movement_type=InventoryMovement.MovementType.RELEASE,
            quantity=res.quantity,
            phys_before=phys_before,
            phys_after=phys_before,
            res_before=res_before,
            res_after=ws.reserved_quantity,
            avail_before=avail_before,
            avail_after=ws.available_quantity,
            reason=reason,
            source_document_type="ORDER",
            source_document_id=str(order.id),
            actor=actor,
            correlation_id=corr_id,
            idempotency_key=f"kardex_rel:{res.id}",
            serial_numbers=released_sn_list,
        )
        sync_legacy_stock_projection(res.product, res.variant)
        released_count += 1

    return released_count


@transaction.atomic
def sync_target_stock_to_wms(
    *,
    product: Product,
    variant: ProductVariant = None,
    target_stock: int = None,
    delta_stock: int = None,
    warehouse: Warehouse = None,
    previous_legacy_stock: int = 0,
    reason: str = "Ajuste de stock PIM",
    source_document_type: str = "PIM",
    source_document_id: str = "",
    actor=None,
    serial_numbers=None,
) -> None:
    """
    Enruta mutaciones de stock (bulk edit, importador PIM, etc.) por el motor WMS
    respetando consistencia dimensional multi-bodega sin sumar existencias entre bodegas.
    """
    all_ws = list(
        WarehouseStock.objects.select_for_update(of=("self",))
        .select_related("warehouse")
        .filter(product=product, variant=variant)
        .order_by("warehouse_id", "pk")
    )

    if warehouse is not None:
        ws_wh = next((r for r in all_ws if r.warehouse_id == warehouse.id), None)
        if delta_stock is not None:
            delta = int(delta_stock)
        else:
            current_avail = int(ws_wh.available_quantity) if ws_wh else 0
            delta = int(target_stock) - current_avail
        if delta != 0:
            m_type = (
                InventoryMovement.MovementType.OPENING
                if ws_wh is None and delta > 0
                else (InventoryMovement.MovementType.ADJUST_POS if delta > 0 else InventoryMovement.MovementType.ADJUST_NEG)
            )
            adjust_stock(
                warehouse=warehouse,
                product=product,
                variant=variant,
                delta_physical=delta,
                movement_type=m_type,
                reason=reason,
                source_document_type=source_document_type,
                source_document_id=source_document_id,
                actor=actor,
                serial_numbers=serial_numbers,
            )
        else:
            sync_legacy_stock_projection(product, variant)
        return

    global_sellable_avail = sum(
        max(0, int(r.available_quantity))
        for r in all_ws
        if r.warehouse.is_active and r.warehouse.is_sellable_online
    )

    if not all_ws and int(previous_legacy_stock or 0) > 0:
        default_wh = get_default_warehouse()
        adjust_stock(
            warehouse=default_wh,
            product=product,
            variant=variant,
            delta_physical=int(previous_legacy_stock),
            movement_type=InventoryMovement.MovementType.OPENING,
            reason="Apertura automática previa a ajuste PIM",
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            actor=actor,
            serial_numbers=serial_numbers,
        )
        global_sellable_avail = int(previous_legacy_stock)
        all_ws = list(
            WarehouseStock.objects.select_for_update(of=("self",))
            .select_related("warehouse")
            .filter(product=product, variant=variant)
            .order_by("warehouse_id", "pk")
        )

    if delta_stock is not None:
        delta = int(delta_stock)
    else:
        delta = int(target_stock) - global_sellable_avail

    if delta == 0:
        sync_legacy_stock_projection(product, variant)
        return

    active_sellable_with_stock = [
        r for r in all_ws if r.warehouse.is_active and r.warehouse.is_sellable_online and r.physical_quantity > 0
    ]
    if len(active_sellable_with_stock) > 1:
        raise InventoryServiceError(
            "El SKU tiene existencias distribuidas en múltiples bodegas; seleccione una bodega explícita para ajustar."
        )

    target_wh = (
        active_sellable_with_stock[0].warehouse
        if len(active_sellable_with_stock) == 1
        else get_default_warehouse()
    )
    is_new_row = not any(r.warehouse_id == target_wh.id for r in all_ws)
    if is_new_row and delta > 0:
        m_type = InventoryMovement.MovementType.OPENING
    elif delta > 0:
        m_type = InventoryMovement.MovementType.ADJUST_POS
    else:
        m_type = InventoryMovement.MovementType.ADJUST_NEG

    adjust_stock(
        warehouse=target_wh,
        product=product,
        variant=variant,
        delta_physical=delta,
        movement_type=m_type,
        reason=reason,
        source_document_type=source_document_type,
        source_document_id=source_document_id,
        actor=actor,
        serial_numbers=serial_numbers,
    )


@transaction.atomic
def expire_stale_reservations(*, now=None) -> int:
    """
    Libera exclusivamente reservas TEMPORARY vencidas cuyo pedido asociado NO esté pagado
    (ni consolidado). Nunca toca pedidos PAID ni reservas CONSOLIDATED.
    Adquiere bloqueos en orden canónico (Order -> StockReservation) para evitar deadlocks.
    """
    from apps.orders.models import Order

    ref_now = now or timezone.now()
    candidates = list(
        StockReservation.objects.filter(
            status=StockReservation.Status.TEMPORARY, expires_at__lte=ref_now
        ).values_list("id", "order_id")
    )
    released_total = 0
    order_ids = sorted({oid for _, oid in candidates if oid is not None})
    session_res_ids = [rid for rid, oid in candidates if oid is None]

    for order_id in order_ids:
        locked_order = Order.objects.select_for_update().filter(pk=order_id).first()
        if not locked_order:
            continue
        if locked_order.status != "pending":
            # Salvaguarda: si la orden ya no está pending (e.g. paid), consolidar en lugar de expirar
            if locked_order.status in ("paid", "shipped", "completed"):
                StockReservation.objects.filter(
                    order=locked_order,
                    status=StockReservation.Status.TEMPORARY,
                ).update(status=StockReservation.Status.CONSOLIDATED, expires_at=None)
            continue
        released_total += release_order_reservations(
            locked_order,
            reason="Expiración automática de reserva temporal (TTL)",
            mark_expired=True,
        )

    if session_res_ids:
        stale_session = list(
            StockReservation.objects.select_for_update(skip_locked=True)
            .filter(
                pk__in=session_res_ids,
                status=StockReservation.Status.TEMPORARY,
                expires_at__lte=ref_now,
            )
        )
        for res in stale_session:
            ws = WarehouseStock.objects.select_for_update().get(
                warehouse=res.warehouse, product=res.product, variant=res.variant
            )
            phys_b, res_b, avail_b = ws.physical_quantity, ws.reserved_quantity, ws.available_quantity
            ws.reserved_quantity = max(0, res_b - res.quantity)
            ws.save(update_fields=["reserved_quantity", "updated_at"])
            res.status = StockReservation.Status.EXPIRED
            res.save(update_fields=["status", "updated_at"])
            _record_movement(
                warehouse=res.warehouse,
                product=res.product,
                variant=res.variant,
                movement_type=InventoryMovement.MovementType.RELEASE,
                quantity=res.quantity,
                phys_before=phys_b,
                phys_after=phys_b,
                res_before=res_b,
                res_after=ws.reserved_quantity,
                avail_before=avail_b,
                avail_after=ws.available_quantity,
                reason="Expiración de reserva de sesión (TTL)",
                source_document_type="SESSION_TTL",
                source_document_id=res.session_key,
                idempotency_key=f"kardex_exp:{res.id}",
            )
            sync_legacy_stock_projection(res.product, res.variant)
            released_total += 1
    return released_total


@transaction.atomic
def dispatch_order_reservations(
    order,
    *,
    serial_assignments: dict = None,
    actor=None,
    allow_from_order_save: bool = False,
) -> list[InventoryMovement]:
    """
    Consume reservas (CONSOLIDATED o TEMPORARY) al despachar físicamente el pedido.
    - Descuenta physical_quantity y reserved_quantity simultáneamente (sin doble descuento).
    - Valida estado comercial, demanda física sin reserva, seriales únicos/obligatorios y despachos multi-bodega.
    - Vincula cada SerialNumberTrack despachado al pedido y cliente.
    """
    if order.status == "cancelled":
        raise InventoryServiceError(
            f"Estado comercial incompatible para despacho ('{order.status}')."
        )

    serial_assignments = serial_assignments or {}
    reservations = list(
        StockReservation.objects.select_for_update(of=("self",))
        .select_related("warehouse", "product", "variant")
        .filter(order=order, status__in=[StockReservation.Status.CONSOLIDATED, StockReservation.Status.TEMPORARY])
        .order_by("warehouse_id", "pk")
    )
    if not reservations:
        if StockReservation.objects.filter(order=order, status=StockReservation.Status.CONSUMED).exists():
            existing_dispatches = list(
                InventoryMovement.objects.filter(
                    source_document_type="ORDER",
                    source_document_id=str(order.id),
                    movement_type=InventoryMovement.MovementType.DISPATCH,
                ).order_by("recorded_at")
            )
            if serial_assignments:
                already_dispatched = sorted(
                    sn for m in existing_dispatches for sn in (m.serial_numbers or [])
                )
                requested = sorted(
                    str(s).strip()
                    for vals in serial_assignments.values()
                    for s in (vals or [])
                    if str(s).strip()
                )
                if requested != already_dispatched:
                    raise InventoryServiceError(
                        "La orden ya fue despachada con otra asignación de seriales."
                    )
            return existing_dispatches

        has_physical_demand = False
        for item in order.items.select_related("product").all():
            p = item.product
            if p is None:
                continue
            if p.product_type == Product.ProductType.STOCK:
                has_physical_demand = True
                break
            if p.product_type == Product.ProductType.BUNDLE:
                if p.bundle_components.filter(component__product_type=Product.ProductType.STOCK).exists():
                    has_physical_demand = True
                    break
        if has_physical_demand and (
            order.stock_deductions is not None or StockReservation.objects.filter(order=order).exists()
        ):
            raise InventoryServiceError(
                "La orden posee demanda física pero no tiene reservas activas asignadas para despacho."
            )
        return []

    from collections import Counter

    unit_key_counts = Counter(
        f"variant:{r.variant_id}" if r.variant_id else str(r.product_id) for r in reservations
    )
    corr_id = uuid.uuid4()
    movements = []
    used_serials_in_dispatch = set()
    now = timezone.now()

    for res in reservations:
        unit_key = f"variant:{res.variant_id}" if res.variant_id else str(res.product_id)
        if str(res.id) in serial_assignments:
            provided_serials = [str(s).strip() for s in (serial_assignments.get(str(res.id)) or []) if str(s).strip()]
        else:
            if unit_key_counts[unit_key] > 1 and unit_key in serial_assignments:
                raise InventoryServiceError(
                    "Despacho distribuido en múltiples bodegas requiere asignar seriales por ID de reserva."
                )
            provided_serials = [str(s).strip() for s in (serial_assignments.get(unit_key) or []) if str(s).strip()]

        if len(set(provided_serials)) != len(provided_serials):
            raise InventoryServiceError("No se permiten números de serie duplicados en la solicitud de despacho.")

        ser_mode = res.product.serialization_mode

        if ser_mode == Product.SerializationMode.REQUIRED:
            if len(provided_serials) != res.quantity:
                raise InventoryServiceError(
                    f"'{res.product.name}' requiere exactamente {res.quantity} número(s) de serie para despacho."
                )

        if len(provided_serials) > res.quantity:
            raise InventoryServiceError("La cantidad de seriales supera la cantidad de la reserva.")

        dispatched_sn_objs = []
        for sn_clean in provided_serials:
            if sn_clean in used_serials_in_dispatch:
                raise InventoryServiceError(
                    f"El serial '{sn_clean}' está duplicado entre reservas del mismo despacho."
                )
            used_serials_in_dispatch.add(sn_clean)
            sn_obj = SerialNumberTrack.objects.select_for_update().filter(
                product=res.product,
                variant=res.variant,
                serial_number=sn_clean,
            ).first()
            if sn_obj is None:
                raise InventoryServiceError(f"El número de serie '{sn_clean}' no existe para este SKU.")
            if sn_obj.warehouse_id != res.warehouse_id:
                raise InventoryServiceError(
                    f"El serial '{sn_clean}' no se encuentra en la bodega '{res.warehouse.code}'."
                )
            if sn_obj.status not in (SerialNumberTrack.Status.IN_STOCK, SerialNumberTrack.Status.RESERVED):
                raise InventoryServiceError(
                    f"El serial '{sn_clean}' no está disponible para despacho (estado: {sn_obj.status})."
                )
            if sn_obj.status == SerialNumberTrack.Status.RESERVED and sn_obj.reservation_id not in (None, res.id):
                raise InventoryServiceError(f"El serial '{sn_clean}' está asignado a otra reserva.")
            dispatched_sn_objs.append(sn_obj)

        ws = WarehouseStock.objects.select_for_update().get(
            warehouse=res.warehouse, product=res.product, variant=res.variant
        )
        phys_before = ws.physical_quantity
        res_before = ws.reserved_quantity
        avail_before = ws.available_quantity

        if phys_before < res.quantity or res_before < res.quantity:
            raise InventoryServiceError("Inconsistencia dimensional en bodega al intentar despachar.")

        ws.physical_quantity = phys_before - res.quantity
        ws.reserved_quantity = res_before - res.quantity
        ws.save(update_fields=["physical_quantity", "reserved_quantity", "updated_at"])

        for sn_obj in dispatched_sn_objs:
            sn_obj.status = SerialNumberTrack.Status.DISPATCHED
            sn_obj.warehouse = None
            sn_obj.reservation = res
            sn_obj.order = order
            sn_obj.customer = order.user
            sn_obj.dispatched_at = now
            sn_obj.save(
                update_fields=[
                    "status", "warehouse", "reservation", "order", "customer", "dispatched_at", "updated_at"
                ]
            )

        res.status = StockReservation.Status.CONSUMED
        res.expires_at = None
        res.save(update_fields=["status", "expires_at", "updated_at"])

        mov = _record_movement(
            warehouse=res.warehouse,
            product=res.product,
            variant=res.variant,
            movement_type=InventoryMovement.MovementType.DISPATCH,
            quantity=res.quantity,
            phys_before=phys_before,
            phys_after=ws.physical_quantity,
            res_before=res_before,
            res_after=ws.reserved_quantity,
            avail_before=avail_before,
            avail_after=ws.available_quantity,
            reason=f"Despacho físico orden #{order.id}",
            source_document_type="ORDER",
            source_document_id=str(order.id),
            actor=actor,
            correlation_id=corr_id,
            idempotency_key=f"kardex_disp:{res.id}",
            serial_numbers=[s.serial_number for s in dispatched_sn_objs],
        )
        movements.append(mov)
        sync_legacy_stock_projection(res.product, res.variant)

    return movements


@transaction.atomic
def register_serials(
    *,
    warehouse: Warehouse,
    product: Product,
    variant: ProductVariant = None,
    serial_numbers: list[str],
    actor=None,
    notes: str = "",
) -> list[SerialNumberTrack]:
    """Registra seriales reales en bodega sin alterar existencias físicas (regularización o carga)."""
    if variant is None and ProductVariant.objects.filter(product_id=product.pk).exists():
        raise InventoryServiceError("Debe especificar la variante para registrar números de serie.")

    ws = WarehouseStock.objects.select_for_update().filter(
        warehouse=warehouse, product=product, variant=variant
    ).first()
    physical_in_wh = ws.physical_quantity if ws else 0
    existing_in_wh = SerialNumberTrack.objects.filter(
        warehouse=warehouse,
        product=product,
        variant=variant,
        status__in=[SerialNumberTrack.Status.IN_STOCK, SerialNumberTrack.Status.RESERVED, SerialNumberTrack.Status.DAMAGED],
    ).count()

    cleaned = []
    seen = set()
    for raw in serial_numbers:
        sn = str(raw).strip()
        if not sn:
            raise InventoryServiceError("No se permiten números de serie vacíos.")
        if sn in seen:
            raise InventoryServiceError(f"Número de serie duplicado en el lote: '{sn}'.")
        seen.add(sn)
        cleaned.append(sn)

    if existing_in_wh + len(cleaned) > physical_in_wh:
        raise InventoryServiceError(
            f"No puede registrar {len(cleaned)} serial(es): la bodega '{warehouse.code}' solo posee "
            f"{physical_in_wh} unidad(es) físicas y {existing_in_wh} ya están serializadas."
        )

    created = []
    for sn in cleaned:
        if SerialNumberTrack.objects.filter(product=product, variant=variant, serial_number=sn).exists():
            raise InventoryServiceError(f"El número de serie '{sn}' ya se encuentra registrado para este SKU.")
        obj = SerialNumberTrack(
            serial_number=sn,
            product=product,
            variant=variant,
            warehouse=warehouse,
            status=SerialNumberTrack.Status.IN_STOCK,
            notes=notes[:255],
        )
        obj.full_clean()
        obj.save()
        created.append(obj)

    if created and ws:
        _record_movement(
            warehouse=warehouse,
            product=product,
            variant=variant,
            movement_type=InventoryMovement.MovementType.REGULARIZATION,
            quantity=len(created),
            phys_before=ws.physical_quantity,
            phys_after=ws.physical_quantity,
            res_before=ws.reserved_quantity,
            res_after=ws.reserved_quantity,
            avail_before=ws.available_quantity,
            avail_after=ws.available_quantity,
            reason=f"Registro/regularización de {len(created)} serial(es) sin alteración de stock",
            source_document_type="REGULARIZATION",
            source_document_id=str(product.id),
            actor=actor,
            serial_numbers=cleaned,
        )
        record_audit_event(
            module=MODULE_INVENTORY,
            action="SERIALS_REGULARIZED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="Product",
            resource_id=str(product.id),
            resource_repr=product.name,
            new_values={"warehouse": warehouse.code, "registered_count": len(created), "serials": cleaned},
            actor=actor,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
    return created


@transaction.atomic
def set_product_serialization_mode(product: Product, mode: str, *, actor=None) -> Product:
    """
    BF-46: Cambia el modo de serialización de un producto.
    Solo permite cambiar a REQUIRED si TODAS las unidades físicas existentes en bodegas
    poseen su SerialNumberTrack correspondiente registrado.
    """
    if mode not in Product.SerializationMode.values:
        raise InventoryServiceError("Modo de serialización inválido.")

    locked = Product.objects.select_for_update().get(pk=product.pk)
    prev_mode = locked.serialization_mode

    if mode == Product.SerializationMode.REQUIRED:
        total_physical = (
            WarehouseStock.objects.filter(product=locked).aggregate(t=Sum("physical_quantity"))["t"] or 0
        )
        total_serialized = SerialNumberTrack.objects.filter(
            product=locked,
            status__in=[
                SerialNumberTrack.Status.IN_STOCK,
                SerialNumberTrack.Status.RESERVED,
                SerialNumberTrack.Status.IN_TRANSIT,
                SerialNumberTrack.Status.DAMAGED,
            ],
        ).count()
        if total_serialized < total_physical:
            raise InventoryServiceError(
                f"No se puede activar serialización obligatoria: existen {total_physical} unidades físicas "
                f"y solo {total_serialized} tienen número de serie regularizado."
            )

    locked.serialization_mode = mode
    locked.save(update_fields=["serialization_mode", "updated_at"])

    record_audit_event(
        module=MODULE_INVENTORY,
        action="PRODUCT_SERIALIZATION_MODE_CHANGED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="Product",
        resource_id=str(locked.id),
        resource_repr=locked.name,
        previous_values={"serialization_mode": prev_mode},
        new_values={"serialization_mode": mode},
        changed_fields=["serialization_mode"],
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked


def _generate_transfer_code() -> str:
    existing = WarehouseTransfer.objects.filter(code__startswith="TRF-").values_list("code", flat=True)
    max_n = 0
    for c in existing:
        p = c.replace("TRF-", "", 1)
        if p.isdigit():
            max_n = max(max_n, int(p))
    return f"TRF-{max_n + 1:04d}"


@transaction.atomic
def create_and_dispatch_transfer(
    *,
    source_warehouse: Warehouse,
    destination_warehouse: Warehouse,
    items: list[dict],
    notes: str = "",
    actor=None,
    auto_receive: bool = False,
) -> WarehouseTransfer:
    """
    Crea y despacha una transferencia interna entre bodegas sin duplicar existencias
    en origen y destino simultáneamente.
    """
    if source_warehouse.pk == destination_warehouse.pk:
        raise InventoryServiceError("La bodega de origen y destino deben ser distintas.")
    if not source_warehouse.is_active or not source_warehouse.can_transfer:
        raise InventoryServiceError(f"La bodega origen '{source_warehouse.code}' no está habilitada para transferir.")
    if not destination_warehouse.is_active or not destination_warehouse.can_receive:
        raise InventoryServiceError(f"La bodega destino '{destination_warehouse.code}' no está habilitada para recibir.")
    if not items:
        raise InventoryServiceError("La transferencia debe incluir al menos un ítem.")

    transfer = WarehouseTransfer.objects.create(
        code=_generate_transfer_code(),
        source_warehouse=source_warehouse,
        destination_warehouse=destination_warehouse,
        status=WarehouseTransfer.Status.IN_TRANSIT,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
        dispatched_by=actor if getattr(actor, "is_authenticated", False) else None,
        dispatched_at=timezone.now(),
        notes=notes[:255],
    )

    for idx, it in enumerate(items):
        product = Product.objects.get(pk=it["product_id"])
        variant = ProductVariant.objects.get(pk=it["variant_id"]) if it.get("variant_id") else None
        qty = int(it["quantity"])
        if qty <= 0:
            raise InventoryServiceError("La cantidad a transferir debe ser positiva.")

        sn_list = [str(s).strip() for s in (it.get("serial_numbers") or []) if str(s).strip()]
        if len(sn_list) > qty:
            raise InventoryServiceError("La cantidad de seriales supera la cantidad a transferir.")

        ws_src = WarehouseStock.objects.select_for_update().filter(
            warehouse=source_warehouse, product=product, variant=variant
        ).first()
        if not ws_src or ws_src.available_quantity < qty:
            raise InventoryServiceError(
                f"Stock disponible transferible insuficiente en '{source_warehouse.code}' para '{product.name}'."
            )

        for sn in sn_list:
            sn_obj = SerialNumberTrack.objects.select_for_update().filter(
                product=product, variant=variant, serial_number=sn
            ).first()
            if not sn_obj or sn_obj.warehouse_id != source_warehouse.pk or sn_obj.status != SerialNumberTrack.Status.IN_STOCK:
                raise InventoryServiceError(
                    f"El serial '{sn}' no está disponible en bodega origen '{source_warehouse.code}'."
                )
            sn_obj.status = SerialNumberTrack.Status.IN_TRANSIT
            sn_obj.warehouse = None
            sn_obj.save(update_fields=["status", "warehouse", "updated_at"])

        phys_b, res_b, avail_b = ws_src.physical_quantity, ws_src.reserved_quantity, ws_src.available_quantity
        ws_src.physical_quantity = phys_b - qty
        ws_src.save(update_fields=["physical_quantity", "updated_at"])

        WarehouseTransferItem.objects.create(
            transfer=transfer,
            product=product,
            variant=variant,
            quantity=qty,
            serial_numbers=sn_list,
        )

        _record_movement(
            warehouse=source_warehouse,
            product=product,
            variant=variant,
            movement_type=InventoryMovement.MovementType.TRANSFER_OUT,
            quantity=qty,
            phys_before=phys_b,
            phys_after=ws_src.physical_quantity,
            res_before=res_b,
            res_after=res_b,
            avail_before=avail_b,
            avail_after=ws_src.available_quantity,
            reason=f"Salida por transferencia {transfer.code} → {destination_warehouse.code}",
            source_document_type="TRANSFER",
            source_document_id=str(transfer.id),
            actor=actor,
            correlation_id=transfer.correlation_id,
            idempotency_key=f"trf_out:{transfer.id}:{idx}",
            serial_numbers=sn_list,
        )
        sync_legacy_stock_projection(product, variant)

    if auto_receive:
        return receive_transfer(transfer, actor=actor)
    return transfer


@transaction.atomic
def receive_transfer(transfer: WarehouseTransfer, *, actor=None) -> WarehouseTransfer:
    """Confirma la recepción física en la bodega destino con el mismo correlation_id."""
    locked = WarehouseTransfer.objects.select_for_update().select_related(
        "source_warehouse", "destination_warehouse"
    ).get(pk=transfer.pk)
    if locked.status == WarehouseTransfer.Status.RECEIVED:
        return locked
    if locked.status != WarehouseTransfer.Status.IN_TRANSIT:
        raise InventoryServiceError("Solo se pueden recibir transferencias en tránsito.")

    dest = locked.destination_warehouse
    for idx, item in enumerate(locked.items.select_related("product", "variant").all()):
        ws_dst, _ = WarehouseStock.objects.get_or_create(
            warehouse=dest,
            product=item.product,
            variant=item.variant,
            defaults={"physical_quantity": 0, "reserved_quantity": 0, "non_sellable_quantity": 0},
        )
        ws_dst = WarehouseStock.objects.select_for_update().get(pk=ws_dst.pk)
        phys_b, res_b, avail_b = ws_dst.physical_quantity, ws_dst.reserved_quantity, ws_dst.available_quantity

        ws_dst.physical_quantity = phys_b + item.quantity
        ws_dst.save(update_fields=["physical_quantity", "updated_at"])

        for sn in item.serial_numbers or []:
            sn_obj = SerialNumberTrack.objects.select_for_update().filter(
                product=item.product, variant=item.variant, serial_number=sn
            ).first()
            if sn_obj:
                sn_obj.status = SerialNumberTrack.Status.IN_STOCK
                sn_obj.warehouse = dest
                sn_obj.save(update_fields=["status", "warehouse", "updated_at"])

        _record_movement(
            warehouse=dest,
            product=item.product,
            variant=item.variant,
            movement_type=InventoryMovement.MovementType.TRANSFER_IN,
            quantity=item.quantity,
            phys_before=phys_b,
            phys_after=ws_dst.physical_quantity,
            res_before=res_b,
            res_after=res_b,
            avail_before=avail_b,
            avail_after=ws_dst.available_quantity,
            reason=f"Recepción por transferencia {locked.code} ← {locked.source_warehouse.code}",
            source_document_type="TRANSFER",
            source_document_id=str(locked.id),
            actor=actor,
            correlation_id=locked.correlation_id,
            idempotency_key=f"trf_in:{locked.id}:{idx}",
            serial_numbers=item.serial_numbers,
        )
        sync_legacy_stock_projection(item.product, item.variant)

    locked.status = WarehouseTransfer.Status.RECEIVED
    locked.received_by = actor if getattr(actor, "is_authenticated", False) else None
    locked.received_at = timezone.now()
    locked.save(update_fields=["status", "received_by", "received_at", "updated_at"])

    record_audit_event(
        module=MODULE_INVENTORY,
        action="WAREHOUSE_TRANSFER_RECEIVED",
        event_category=CATEGORY_MODIFICATION,
        resource_type="WarehouseTransfer",
        resource_id=str(locked.id),
        resource_repr=locked.code,
        new_values={"from": locked.source_warehouse.code, "to": dest.code},
        actor=actor,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return locked

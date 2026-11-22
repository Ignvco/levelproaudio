"""Reservas de inventario dentro de la transacción que crea/cancela el pedido."""

from collections import Counter
from collections.abc import Mapping
from uuid import UUID

from django.db import connection
from django.db.models import F

from apps.products.models import BundleItem, Product, ProductVariant


class InventoryError(ValueError):
    pass


def _lock_products(ids):
    # Todas las rutas toman los productos en el mismo orden. NO KEY UPDATE
    # permite referencias FK (items/componentes) sin bloquearlas innecesariamente.
    if not ids:
        return {}
    queryset = Product.objects.filter(pk__in=ids).order_by("pk")
    options = {"no_key": True} if connection.vendor == "postgresql" else {}
    return {product.pk: product for product in queryset.select_for_update(**options)}


def _lock_variants(ids):
    if not ids:
        return {}
    queryset = ProductVariant.objects.filter(pk__in=ids).order_by("pk")
    options = {"no_key": True} if connection.vendor == "postgresql" else {}
    return {variant.pk: variant for variant in queryset.select_for_update(**options)}


def prepare_inventory(items_data):
    """
    Valida/agrega líneas (producto simple, bundle o producto con variante),
    bloquea filas en orden determinístico y calcula la demanda total.
    """
    if not isinstance(items_data, list) or not items_data:
        raise InventoryError("La orden debe tener al menos un producto.")

    quantities = Counter()
    variant_ids = set()
    product_ids = set()

    for item in items_data:
        if not isinstance(item, Mapping):
            raise InventoryError("Cada producto debe indicar su ID y cantidad.")
        try:
            product_id = UUID(str(item.get("product", "")))
        except (ValueError, TypeError, AttributeError):
            raise InventoryError("ID de producto inválido.") from None

        raw_variant = item.get("variant") or item.get("variant_id")
        variant_id = None
        if raw_variant not in (None, ""):
            try:
                variant_id = UUID(str(raw_variant))
            except (ValueError, TypeError, AttributeError):
                raise InventoryError("ID de variante inválido.") from None

        value = item.get("quantity")
        # Acepta enteros y strings decimales usados por formularios, no bool/float.
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise InventoryError("La cantidad debe ser un entero positivo.")
        if isinstance(value, str) and (not value.isascii() or not value.isdecimal()):
            raise InventoryError("La cantidad debe ser un entero positivo.")
        try:
            quantity = int(value)
        except (ValueError, TypeError):
            raise InventoryError("La cantidad debe ser un entero positivo.") from None

        key = (product_id, variant_id)
        quantities[key] += quantity
        product_ids.add(product_id)
        if variant_id is not None:
            variant_ids.add(variant_id)
        if quantity < 1 or quantities[key] > 2147483647:
            raise InventoryError("Cantidad de producto fuera de rango.")

    # Descubrir IDs antes de bloquear evita tomar primero un kit y luego sus
    # componentes/variantes en un orden diferente al de otra compra.
    bundle_items_list = list(
        BundleItem.objects.filter(bundle_id__in=product_ids).order_by("pk")
    )
    component_ids = {item.component_id for item in bundle_items_list}
    bundle_variant_ids = {item.variant_id for item in bundle_items_list if item.variant_id is not None}

    products = _lock_products(product_ids | component_ids)
    variants = _lock_variants(variant_ids | bundle_variant_ids)

    components = {}
    for item in bundle_items_list:
        if item.component_id not in products:
            raise InventoryError("El kit cambió durante la compra. Actualiza e intenta nuevamente.")
        components.setdefault(item.bundle_id, []).append(item)

    # Detectar qué productos (directos o componentes de bundle) poseen variantes registradas
    all_checked_product_ids = product_ids | component_ids
    products_with_variants = set(
        ProductVariant.objects.filter(product_id__in=all_checked_product_ids)
        .values_list("product_id", flat=True)
    )

    demand = Counter()
    lines = []
    for (product_id, variant_id), quantity in quantities.items():
        product = products.get(product_id)
        if product is None or not product.is_active:
            raise InventoryError("Uno de los productos ya no está disponible.")

        variant = None
        if variant_id is not None:
            variant = variants.get(variant_id)
            if variant is None or not variant.is_active or variant.product_id != product.pk:
                raise InventoryError(f"La variante seleccionada para {product.name} no está disponible.")
            if product.product_type == Product.ProductType.BUNDLE:
                raise InventoryError("Un kit/combo no admite selección directa de variante.")
        elif product.pk in products_with_variants:
            raise InventoryError(f"Debes seleccionar una variante para {product.name}.")

        if product.product_type == Product.ProductType.BUNDLE:
            parts = components.get(product_id, [])
            if not parts:
                raise InventoryError(f"El kit {product.name} no tiene componentes configurados.")
            for part in parts:
                component = products[part.component_id]
                if not component.is_active:
                    raise InventoryError(f"El componente {component.name} del kit {product.name} ya no está disponible.")
                if component.product_type == Product.ProductType.BUNDLE:
                    raise InventoryError("Los kits no pueden contener otros kits.")
                if part.quantity < 1:
                    raise InventoryError("El kit tiene una cantidad de componentes inválida.")
                if part.variant_id is not None:
                    comp_variant = variants.get(part.variant_id)
                    if comp_variant is None or not comp_variant.is_active or comp_variant.product_id != component.pk:
                        raise InventoryError(
                            f"La variante configurada para {component.name} en el kit {product.name} no está disponible."
                        )
                    if component.product_type == Product.ProductType.STOCK:
                        demand[f"variant:{comp_variant.pk}"] += part.quantity * quantity
                    elif component.product_type not in (Product.ProductType.PREORDER, Product.ProductType.ON_DEMAND):
                        raise InventoryError("El kit tiene un tipo de componente inválido.")
                else:
                    if component.pk in products_with_variants:
                        raise InventoryError(
                            f"El kit {product.name} requiere una variante explícita para {component.name}."
                        )
                    if component.product_type == Product.ProductType.STOCK:
                        demand[component.pk] += part.quantity * quantity
                    elif component.product_type not in (Product.ProductType.PREORDER, Product.ProductType.ON_DEMAND):
                        raise InventoryError("El kit tiene un tipo de componente inválido.")
        elif product.product_type == Product.ProductType.STOCK:
            if variant is not None:
                demand[f"variant:{variant.pk}"] += quantity
            else:
                demand[product_id] += quantity
        elif product.product_type not in (Product.ProductType.PREORDER, Product.ProductType.ON_DEMAND):
            raise InventoryError("Tipo de producto inválido.")

        lines.append({"product": product, "variant": variant, "quantity": quantity})

    for target_key, quantity in demand.items():
        if isinstance(target_key, str) and target_key.startswith("variant:"):
            vid = UUID(target_key.split(":", 1)[1])
            v = variants[vid]
            avail = _get_sellable_available(v.product, v, legacy_stock=v.stock)
            if avail < quantity:
                raise InventoryError(f"Stock insuficiente para {v.product.name} ({v.name}).")
        else:
            p = products[target_key]
            avail = _get_sellable_available(p, None, legacy_stock=p.stock)
            if avail < quantity:
                raise InventoryError(f"Stock insuficiente para {p.name}.")

    return lines, demand


def _get_sellable_available(product, variant, legacy_stock: int) -> int:
    """
    Fuente única de verdad: suma available_quantity en bodegas activas y elegibles para venta online.
    Si el producto/variante aún no tiene filas WarehouseStock (ej. fixture unitario aislado),
    retorna legacy_stock para compatibilidad controlada.
    """
    from apps.inventory.models import WarehouseStock

    qs = WarehouseStock.objects.filter(product=product, variant=variant)
    if not qs.exists():
        return int(legacy_stock or 0)
    sellable_rows = qs.filter(warehouse__is_active=True, warehouse__is_sellable_online=True)
    return sum(max(0, r.available_quantity) for r in sellable_rows)


def deduct_inventory(demand, order=None, actor=None):
    """
    Reserva existencias desde WarehouseStock (fuente única de verdad) y sincroniza
    la proyección legacy Product.stock / ProductVariant.stock.
    """
    from apps.inventory.services import (
        InventoryServiceError,
        adjust_stock,
        get_default_warehouse,
        reserve_stock_for_order,
    )
    from apps.inventory.models import InventoryMovement, WarehouseStock

    if order is not None:
        try:
            reserve_stock_for_order(order, demand, actor=actor)
            return
        except InventoryServiceError as exc:
            raise InventoryError(str(exc)) from exc

    # Fallback para llamadas directas sin objeto Order (ej. pruebas unitarias de concurrencia/kits)
    default_wh = get_default_warehouse()
    for target_key in sorted(demand, key=str):
        quantity = demand[target_key]
        if isinstance(target_key, str) and target_key.startswith("variant:"):
            vid = UUID(target_key.split(":", 1)[1])
            variant = ProductVariant.objects.select_related("product").get(pk=vid)
            product = variant.product
        else:
            product = Product.objects.get(pk=target_key)
            variant = None

        ws = WarehouseStock.objects.select_for_update().filter(
            warehouse=default_wh, product=product, variant=variant
        ).first()
        if ws is None:
            legacy_val = variant.stock if variant is not None else product.stock
            if legacy_val < quantity:
                raise InventoryError("El stock cambió durante la compra. Intenta nuevamente.")
            ws, _ = adjust_stock(
                warehouse=default_wh,
                product=product,
                variant=variant,
                delta_physical=legacy_val,
                movement_type=InventoryMovement.MovementType.OPENING,
                reason="Apertura automática en bodega por defecto",
                source_document_type="SYSTEM",
            )
        try:
            adjust_stock(
                warehouse=ws.warehouse,
                product=product,
                variant=variant,
                delta_physical=-quantity,
                movement_type=InventoryMovement.MovementType.ADJUST_NEG,
                reason="Deducción directa de inventario",
                source_document_type="DIRECT_DEDUCT",
                actor=actor,
            )
        except InventoryServiceError as exc:
            raise InventoryError("El stock cambió durante la compra. Intenta nuevamente.") from exc


def restore_inventory(order, reason="Liberación por cancelación de orden", actor=None):
    """Reponer la reserva; el llamador debe bloquear la orden y cambiar su estado."""
    from apps.inventory.models import InventoryMovement, StockReservation, WarehouseStock
    from apps.inventory.services import adjust_stock, get_default_warehouse, release_order_reservations

    if StockReservation.objects.filter(
        order=order,
        status__in=[StockReservation.Status.TEMPORARY, StockReservation.Status.CONSOLIDATED],
    ).exists():
        release_order_reservations(order, reason=reason, actor=actor)
        return

    product_demand = Counter()
    variant_demand = Counter()

    if order.stock_deductions is not None:
        for raw_key, quantity in order.stock_deductions.items():
            if isinstance(raw_key, str) and raw_key.startswith("variant:"):
                variant_demand[UUID(raw_key.split(":", 1)[1])] += quantity
            else:
                product_demand[UUID(str(raw_key))] += quantity
    else:
        for item in order.items.select_related("product", "variant").all():
            if item.variant_id:
                if item.product and item.product.product_type == Product.ProductType.STOCK:
                    variant_demand[item.variant_id] += item.quantity
                continue
            product = item.product
            if product is None:
                continue
            if product.product_type == Product.ProductType.BUNDLE:
                for part in product.bundle_components.select_related("component", "variant").all():
                    if part.component.product_type == Product.ProductType.STOCK:
                        if part.variant_id:
                            variant_demand[part.variant_id] += part.quantity * item.quantity
                        else:
                            product_demand[part.component_id] += part.quantity * item.quantity
            elif product.product_type == Product.ProductType.STOCK:
                product_demand[product.pk] += item.quantity

    products = _lock_products(product_demand.keys())
    variants = _lock_variants(variant_demand.keys())
    default_wh = get_default_warehouse()

    for product_id in sorted(products):
        qty = product_demand[product_id]
        if qty > 0:
            p = products[product_id]
            legacy_idem = f"kardex_legacy_rel:{order.id}:p:{p.id}" if order.stock_deductions is None else None
            if legacy_idem and InventoryMovement.objects.filter(idempotency_key=legacy_idem).exists():
                continue
            if not WarehouseStock.objects.filter(warehouse=default_wh, product=p, variant=None).exists():
                legacy_val = int(p.stock or 0)
                if legacy_val > 0:
                    adjust_stock(
                        warehouse=default_wh,
                        product=p,
                        variant=None,
                        delta_physical=legacy_val,
                        movement_type=InventoryMovement.MovementType.OPENING,
                        reason="Apertura automática previa a restitución legacy",
                        source_document_type="ORDER",
                        source_document_id=str(order.id),
                        actor=actor,
                    )
            adjust_stock(
                warehouse=default_wh,
                product=p,
                variant=None,
                delta_physical=qty,
                movement_type=InventoryMovement.MovementType.RELEASE,
                reason=reason,
                source_document_type="ORDER",
                source_document_id=str(order.id),
                actor=actor,
                idempotency_key=legacy_idem,
            )
    for variant_id in sorted(variants):
        qty = variant_demand[variant_id]
        if qty > 0:
            v = variants[variant_id]
            legacy_idem = f"kardex_legacy_rel:{order.id}:v:{v.id}" if order.stock_deductions is None else None
            if legacy_idem and InventoryMovement.objects.filter(idempotency_key=legacy_idem).exists():
                continue
            if not WarehouseStock.objects.filter(warehouse=default_wh, product=v.product, variant=v).exists():
                legacy_val = int(v.stock or 0)
                if legacy_val > 0:
                    adjust_stock(
                        warehouse=default_wh,
                        product=v.product,
                        variant=v,
                        delta_physical=legacy_val,
                        movement_type=InventoryMovement.MovementType.OPENING,
                        reason="Apertura automática previa a restitución legacy",
                        source_document_type="ORDER",
                        source_document_id=str(order.id),
                        actor=actor,
                    )
            adjust_stock(
                warehouse=default_wh,
                product=v.product,
                variant=v,
                delta_physical=qty,
                movement_type=InventoryMovement.MovementType.RELEASE,
                reason=reason,
                source_document_type="ORDER",
                source_document_id=str(order.id),
                actor=actor,
                idempotency_key=legacy_idem,
            )

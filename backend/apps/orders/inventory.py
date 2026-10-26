"""Reservas de inventario dentro de la transacción que crea/cancela el pedido."""

from collections import Counter
from collections.abc import Mapping
from uuid import UUID

from django.db import connection
from django.db.models import F

from apps.products.models import BundleItem, Product


class InventoryError(ValueError):
    pass


def _lock_products(ids):
    # Todas las rutas toman los productos en el mismo orden. NO KEY UPDATE
    # permite referencias FK (items/componentes) sin bloquearlas innecesariamente.
    queryset = Product.objects.filter(pk__in=ids).order_by("pk")
    options = {"no_key": True} if connection.vendor == "postgresql" else {}
    return {product.pk: product for product in queryset.select_for_update(**options)}


def prepare_inventory(items_data):
    """Valida/agrega líneas, bloquea productos y calcula la demanda total."""
    if not isinstance(items_data, list) or not items_data:
        raise InventoryError("La orden debe tener al menos un producto.")
    quantities = Counter()
    for item in items_data:
        if not isinstance(item, Mapping):
            raise InventoryError("Cada producto debe indicar su ID y cantidad.")
        try:
            product_id = UUID(str(item.get("product", "")))
        except (ValueError, TypeError, AttributeError):
            raise InventoryError("ID de producto inválido.") from None
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
        quantities[product_id] += quantity
        if quantity < 1 or quantities[product_id] > 2147483647:
            raise InventoryError("Cantidad de producto fuera de rango.")

    # Descubrir IDs antes de bloquear evita tomar primero un kit y luego sus
    # componentes en un orden diferente al de otra compra.
    component_ids = set(BundleItem.objects.filter(bundle_id__in=quantities)
                        .values_list("component_id", flat=True))
    products = _lock_products(set(quantities) | component_ids)
    components = {}
    for item in BundleItem.objects.filter(bundle_id__in=quantities).order_by("pk"):
        if item.component_id not in products:
            raise InventoryError("El kit cambió durante la compra. Actualiza e intenta nuevamente.")
        components.setdefault(item.bundle_id, []).append(item)

    demand = Counter()
    lines = []
    for product_id, quantity in quantities.items():
        product = products.get(product_id)
        if product is None or not product.is_active:
            raise InventoryError("Uno de los productos ya no está disponible.")
        if product.product_type == Product.ProductType.BUNDLE:
            parts = components.get(product_id, [])
            if not parts:
                raise InventoryError(f"El kit {product.name} no tiene componentes configurados.")
            for part in parts:
                component = products[part.component_id]
                if component.product_type == Product.ProductType.BUNDLE:
                    raise InventoryError("Los kits no pueden contener otros kits.")
                if part.quantity < 1:
                    raise InventoryError("El kit tiene una cantidad de componentes inválida.")
                if component.product_type == Product.ProductType.STOCK:
                    demand[component.pk] += part.quantity * quantity
                elif component.product_type not in (Product.ProductType.PREORDER, Product.ProductType.ON_DEMAND):
                    raise InventoryError("El kit tiene un tipo de componente inválido.")
        elif product.product_type == Product.ProductType.STOCK:
            demand[product_id] += quantity
        elif product.product_type not in (Product.ProductType.PREORDER, Product.ProductType.ON_DEMAND):
            raise InventoryError("Tipo de producto inválido.")
        lines.append({"product": product, "quantity": quantity})

    for product_id, quantity in demand.items():
        if products[product_id].stock < quantity:
            raise InventoryError(f"Stock insuficiente para {products[product_id].name}.")
    return lines, demand


def deduct_inventory(demand):
    """Los productos siguen bloqueados por prepare_inventory hasta el commit."""
    for product_id in sorted(demand):
        quantity = demand[product_id]
        updated = Product.objects.filter(pk=product_id, stock__gte=quantity).update(stock=F("stock") - quantity)
        if updated != 1:
            raise InventoryError("El stock cambió durante la compra. Intenta nuevamente.")


def restore_inventory(order):
    """Reponer la reserva; el llamador debe bloquear la orden y cambiar su estado."""
    if order.stock_deductions is not None:
        demand = {UUID(product_id): quantity for product_id, quantity in order.stock_deductions.items()}
    else:
        # Pedidos anteriores al patch no guardaban el desglose. Mantener el
        # criterio histórico, con agregación y bloqueo, sin inventar un snapshot.
        demand = Counter()
        for item in order.items.select_related("product").all():
            product = item.product
            if product is None:
                continue
            if product.product_type == Product.ProductType.BUNDLE:
                for part in product.bundle_components.select_related("component").all():
                    if part.component.product_type == Product.ProductType.STOCK:
                        demand[part.component_id] += part.quantity * item.quantity
            elif product.product_type == Product.ProductType.STOCK:
                demand[product.pk] += item.quantity
    products = _lock_products(demand)
    for product_id in sorted(products):
        Product.objects.filter(pk=product_id).update(stock=F("stock") + demand[product_id])

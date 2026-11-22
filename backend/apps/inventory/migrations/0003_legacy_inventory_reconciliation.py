# Generated for LevelPro OS v4.0 Gate 4 (Safe Legacy Inventory Reconciliation)
import uuid
from collections import Counter
from django.db import migrations
from django.utils import timezone


def reconcile_legacy_inventory(apps, schema_editor):
    """
    Migración aditiva y conciliación segura del inventario legacy hacia WarehouseStock.
    - Crea la bodega por defecto BOD-CENTRAL (sin inventar direcciones).
    - Reconstruye reservas vigentes únicamente desde órdenes PENDING/PAID con snapshot real
      (Order.stock_deductions), sin inventar reservas para pedidos históricos sin snapshot.
    - Calcula physical_quantity = legacy_available + active_reserved para preservar exactamente
      la disponibilidad pública sin dobles descuentos.
    - Nunca migra stock residual de maestros que posean variantes.
    """
    Warehouse = apps.get_model("inventory", "Warehouse")
    WarehouseStock = apps.get_model("inventory", "WarehouseStock")
    InventoryMovement = apps.get_model("inventory", "InventoryMovement")
    StockReservation = apps.get_model("inventory", "StockReservation")
    Product = apps.get_model("products", "Product")
    ProductVariant = apps.get_model("products", "ProductVariant")
    SkuRegistry = apps.get_model("products", "SkuRegistry")
    Order = apps.get_model("orders", "Order")

    central, _ = Warehouse.objects.get_or_create(
        code="BOD-CENTRAL",
        defaults={
            "name": "Bodega Central",
            "warehouse_type": "central",
            "address": "",
            "is_active": True,
            "is_sellable_online": True,
            "fulfillment_priority": 10,
            "can_receive": True,
            "can_store": True,
            "can_transfer": True,
            "can_dispatch": True,
            "is_default": True,
        },
    )

    # Reconstruir reservas vigentes desde órdenes activas (pending/paid) con snapshot real
    reserved_by_product = Counter()
    reserved_by_variant = Counter()

    active_orders = Order.objects.filter(
        status__in=["pending", "paid"],
        stock_deductions__isnull=False,
    ).order_by("created_at")

    for order in active_orders:
        res_status = "consolidated" if order.status == "paid" else "temporary"
        expires_at = None if res_status == "consolidated" else (order.created_at + timezone.timedelta(hours=2))
        for raw_key, qty in (order.stock_deductions or {}).items():
            qty_int = int(qty or 0)
            if qty_int <= 0:
                continue
            if isinstance(raw_key, str) and raw_key.startswith("variant:"):
                vid = raw_key.split(":", 1)[1]
                variant = ProductVariant.objects.filter(pk=vid).select_related("product").first()
                if not variant:
                    continue
                idem = f"legacy_res:{order.id}:v:{variant.id}"
                if not StockReservation.objects.filter(idempotency_key=idem).exists():
                    StockReservation.objects.create(
                        order=order,
                        warehouse=central,
                        product=variant.product,
                        variant=variant,
                        quantity=qty_int,
                        status=res_status,
                        expires_at=expires_at,
                        idempotency_key=idem,
                    )
                reserved_by_variant[str(variant.id)] += qty_int
            else:
                pid = str(raw_key)
                product = Product.objects.filter(pk=pid).first()
                if not product:
                    continue
                idem = f"legacy_res:{order.id}:p:{product.id}"
                if not StockReservation.objects.filter(idempotency_key=idem).exists():
                    StockReservation.objects.create(
                        order=order,
                        warehouse=central,
                        product=product,
                        variant=None,
                        quantity=qty_int,
                        status=res_status,
                        expires_at=expires_at,
                        idempotency_key=idem,
                    )
                reserved_by_product[str(product.id)] += qty_int

    products_with_variants = set(
        str(pid) for pid in ProductVariant.objects.values_list("product_id", flat=True).distinct()
    )

    # Productos simples legacy (sin variantes)
    for prod in Product.objects.filter(product_type="stock").order_by("created_at"):
        if str(prod.id) in products_with_variants:
            continue
        if WarehouseStock.objects.filter(warehouse=central, product=prod, variant__isnull=True).exists():
            continue
        avail = int(prod.stock or 0)
        res = int(reserved_by_product.get(str(prod.id), 0))
        phys = avail + res
        reg = SkuRegistry.objects.filter(product_id=prod.id).first()
        WarehouseStock.objects.create(
            warehouse=central,
            product=prod,
            variant=None,
            sku_registry=reg,
            physical_quantity=phys,
            reserved_quantity=res,
            non_sellable_quantity=0,
        )
        if phys > 0:
            idem = f"opening:legacy:p:{prod.id}"
            if not InventoryMovement.objects.filter(idempotency_key=idem).exists():
                InventoryMovement.objects.create(
                    warehouse=central,
                    product=prod,
                    variant=None,
                    sku_registry=reg,
                    sku_snapshot=prod.sku or "",
                    movement_type="opening",
                    quantity=phys,
                    affected_dimensions={"physical": phys, "reserved": res, "available": avail},
                    physical_before=0,
                    physical_after=phys,
                    reserved_before=0,
                    reserved_after=res,
                    available_before=0,
                    available_after=avail,
                    reason="Apertura y conciliación de inventario legacy (Gate 4)",
                    source_document_type="MIGRATION",
                    source_document_id="inventory.0003",
                    correlation_id=uuid.uuid4(),
                    idempotency_key=idem,
                )

    # Variantes de productos
    for var in ProductVariant.objects.select_related("product").order_by("created_at"):
        if WarehouseStock.objects.filter(warehouse=central, product=var.product, variant=var).exists():
            continue
        avail = int(var.stock or 0)
        res = int(reserved_by_variant.get(str(var.id), 0))
        phys = avail + res
        reg = SkuRegistry.objects.filter(variant_id=var.id).first()
        WarehouseStock.objects.create(
            warehouse=central,
            product=var.product,
            variant=var,
            sku_registry=reg,
            physical_quantity=phys,
            reserved_quantity=res,
            non_sellable_quantity=0,
        )
        if phys > 0:
            idem = f"opening:legacy:v:{var.id}"
            if not InventoryMovement.objects.filter(idempotency_key=idem).exists():
                InventoryMovement.objects.create(
                    warehouse=central,
                    product=var.product,
                    variant=var,
                    sku_registry=reg,
                    sku_snapshot=var.sku or "",
                    movement_type="opening",
                    quantity=phys,
                    affected_dimensions={"physical": phys, "reserved": res, "available": avail},
                    physical_before=0,
                    physical_after=phys,
                    reserved_before=0,
                    reserved_after=res,
                    available_before=0,
                    available_after=avail,
                    reason="Apertura y conciliación de variante legacy (Gate 4)",
                    source_document_type="MIGRATION",
                    source_document_id="inventory.0003",
                    correlation_id=uuid.uuid4(),
                    idempotency_key=idem,
                )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0002_kardex_immutability_triggers"),
        ("products", "0020_product_serialization_mode"),
        ("orders", "0009_alter_cartitem_unique_together_b2bquoteitem_variant_and_more"),
    ]

    operations = [
        migrations.RunPython(reconcile_legacy_inventory, noop_reverse),
    ]

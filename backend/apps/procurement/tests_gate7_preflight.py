# apps/procurement/tests_gate7_preflight.py
"""
LEVELPRO OS V4.0 — GATE 7 PREFLIGHT (OMS-PF-01, OMS-PF-02, OMS-PF-03)
Pruebas dirigidas en PostgreSQL 16 QA para:
- OMS-PF-01: Paridad estricta WAC/FIFO en freeze_order_cogs_on_dispatch() y reversión atómica ante discrepancia.
- OMS-PF-02: Coherencia monetaria de COGS (sin fallback silencioso a otra moneda; conversión explícita o pending_reconciliation).
- OMS-PF-03: No congelamiento prematuro de costos WAC en IncomeRecord antes del despacho físico.
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.analytics.models import DistributionCategory, IncomeDistribution, IncomeRecord
from apps.inventory.models import InventoryMovement, StockReservation, Warehouse, WarehouseStock
from apps.inventory.services import (
    InventoryServiceError,
    consolidate_order_reservations,
    dispatch_order_reservations,
    reserve_stock_for_order,
)
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.procurement.costing_services import (
    create_or_simulate_landed_cost_allocation,
    finalize_landed_cost_allocation,
    freeze_order_cogs_on_dispatch,
)
from apps.procurement.models import (
    CostConsumptionRecord,
    CostLayer,
    ExchangeRateSnapshot,
    Supplier,
    WeightedAverageCostState,
)
from apps.procurement.po_services import (
    approve_purchase_order,
    confirm_goods_receipt,
    create_goods_receipt,
    create_purchase_order,
    issue_purchase_order,
)
from apps.products.models import Brand, Category, Product

User = get_user_model()


class Gate7PreflightTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            email="admin_g7pf@levelpro.cl",
            username="admin_g7pf",
            password="Password123!",
        )
        self.cat = Category.objects.create(name="Interfaces G7PF", slug="interfaces-g7pf")
        self.brand = Brand.objects.create(name="RME G7PF", slug="rme-g7pf")
        Warehouse.objects.filter(is_default=True).update(is_default=False)
        self.wh, _ = Warehouse.objects.update_or_create(
            code="BOD-G7PF",
            defaults={
                "name": "Bodega Central G7PF",
                "warehouse_type": Warehouse.WarehouseType.CENTRAL,
                "is_default": True,
                "is_active": True,
                "is_sellable_online": True,
            },
        )
        self.sup_clp = Supplier.objects.create(
            internal_code="SUP-G7PF-CLP",
            legal_name="Importadora Pro Audio Chile SpA",
            country="Chile",
            currency="CLP",
            is_active=True,
        )
        self.sup_usd = Supplier.objects.create(
            internal_code="SUP-G7PF-USD",
            legal_name="RME Global Distribution GmbH",
            country="Alemania",
            currency="USD",
            is_active=True,
        )

    def _receive_product(self, product, supplier, currency, qty, unit_cost):
        po = create_purchase_order(
            supplier=supplier,
            destination_warehouse=self.wh,
            currency=currency,
            items=[{"product_id": product.id, "quantity_ordered": qty, "unit_cost": Decimal(str(unit_cost))}],
            actor=self.admin_user,
        )
        po = approve_purchase_order(po, actor=self.admin_user)
        po = issue_purchase_order(po, actor=self.admin_user)
        poi = po.items.first()
        gr = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh,
            items=[{"purchase_order_item_id": poi.id, "quantity_accepted": qty}],
            actor=self.admin_user,
        )
        gr = confirm_goods_receipt(gr, actor=self.admin_user)
        return po, gr

    def test_oms_pf_01_wac_fifo_parity_blocks_and_reverts_atomically_on_discrepancy(self):
        """
        OMS-PF-01: Si existe discrepancia deliberada entre WeightedAverageCostState.sellable_quantity
        y la disponibilidad en CostLayer (consumo FIFO incompleto), dispatch_order_reservations()
        debe fallar y revertir atómicamente WMS, Kardex, CostLayer, WAC y OrderItem.
        """
        prod = Product.objects.create(
            name="Cable Digital AES/EBU G7PF",
            slug="cable-aes-ebu-g7pf",
            sku="G7PF-AES-01",
            category=self.cat,
            brand=self.brand,
            price=Decimal("50000"),
            cost_price=Decimal("25000"),
            serialization_mode=Product.SerializationMode.NONE,
            stock=0,
        )
        self._receive_product(prod, self.sup_clp, "CLP", 5, "25000.00")

        # Inducir discrepancia deliberada en CostLayer: dejar solo 1 disponible en CostLayer mientras WAC tiene 5
        layer = CostLayer.objects.get(product=prod)
        CostLayer.objects.filter(pk=layer.pk).update(quantity_available=1, quantity_consumed=4)

        order = Order.objects.create(
            status=OrderStatus.PENDING,
            total=Decimal("150000.00"),
            currency="CLP",
            email="pf01@levelpro.cl",
            shipping_address="Santiago",
        )
        oi = OrderItem.objects.create(
            order=order,
            product=prod,
            product_name=prod.name,
            price=Decimal("50000.00"),
            quantity=3,
        )
        reserve_stock_for_order(order, {str(prod.id): 3}, actor=self.admin_user)
        consolidate_order_reservations(order, actor=self.admin_user)

        ws_before = WarehouseStock.objects.get(warehouse=self.wh, product=prod)
        wac_before = WeightedAverageCostState.objects.get(product=prod, currency="CLP")
        self.assertEqual(ws_before.physical_quantity, 5)
        self.assertEqual(ws_before.reserved_quantity, 3)
        self.assertEqual(wac_before.sellable_quantity, 5)

        # Intentar despachar 3 unidades cuando CostLayer solo tiene 1 disponible -> debe bloquear y revertir todo
        with self.assertRaises(InventoryServiceError) as ctx:
            dispatch_order_reservations(order, actor=self.admin_user)

        self.assertIn("Discrepancia de paridad WAC/FIFO", str(ctx.exception))

        # Verificar reversión atómica completa: WMS, Kardex, CostLayer, WAC y OrderItem intactos
        ws_after = WarehouseStock.objects.get(warehouse=self.wh, product=prod)
        self.assertEqual(ws_after.physical_quantity, 5)
        self.assertEqual(ws_after.reserved_quantity, 3)

        res = StockReservation.objects.get(order=order)
        self.assertEqual(res.status, StockReservation.Status.CONSOLIDATED)

        self.assertFalse(
            InventoryMovement.objects.filter(
                source_document_type="ORDER",
                source_document_id=str(order.id),
                movement_type=InventoryMovement.MovementType.DISPATCH,
            ).exists()
        )
        wac_after = WeightedAverageCostState.objects.get(product=prod, currency="CLP")
        self.assertEqual(wac_after.sellable_quantity, 5)
        self.assertEqual(wac_after.total_value, wac_before.total_value)

        layer.refresh_from_db()
        self.assertEqual(layer.quantity_available, 1)

        oi.refresh_from_db()
        self.assertIsNone(oi.unit_cost_snapshot)
        self.assertIsNone(oi.cost_frozen_at)
        self.assertFalse(CostConsumptionRecord.objects.filter(order=order).exists())

        # Restaurar la paridad (5 disponibles en CostLayer) -> ahora el despacho tiene éxito y consume exactamente 3 en ambos
        CostLayer.objects.filter(pk=layer.pk).update(quantity_available=5, quantity_consumed=0)
        dispatch_order_reservations(order, actor=self.admin_user)

        wac_after.refresh_from_db()
        layer.refresh_from_db()
        oi.refresh_from_db()
        self.assertEqual(wac_after.sellable_quantity, 2)
        self.assertEqual(layer.quantity_available, 2)
        self.assertEqual(layer.quantity_consumed, 3)
        self.assertEqual(oi.unit_cost_snapshot, Decimal("25000.0000"))
        self.assertIsNotNone(oi.cost_frozen_at)

    def test_oms_pf_02_cogs_monetary_coherence_no_implicit_cross_currency_fallback(self):
        """
        OMS-PF-02: Si el pool WAC está en USD y la orden de venta está en CLP,
        freeze_order_cogs_on_dispatch() NO debe usar el costo en USD como si fuera comparable sin conversión.
        - Sin conversión explícita -> marca costing_method_snapshot = 'pending_reconciliation' sin inventar snapshot.
        - Con conversión explícita persistida (ExchangeRateSnapshot) -> convierte y congela en la moneda de la orden.
        """
        prod = Product.objects.create(
            name="Preamp Studio G7PF",
            slug="preamp-studio-g7pf",
            sku="G7PF-PRE-01",
            category=self.cat,
            brand=self.brand,
            price=Decimal("950000"),
            price_usd=Decimal("1000.00"),
            cost_price=Decimal("600000"),
            serialization_mode=Product.SerializationMode.NONE,
            stock=0,
        )
        # Recepción valorada en USD (500.00 USD/unidad)
        self._receive_product(prod, self.sup_usd, "USD", 4, "500.00")

        # Caso 1: Orden en CLP despachada SIN conversión explícita
        order1 = Order.objects.create(
            status=OrderStatus.PENDING,
            total=Decimal("950000.00"),
            currency="CLP",
            email="pf02_a@levelpro.cl",
            shipping_address="Santiago",
        )
        oi1 = OrderItem.objects.create(
            order=order1,
            product=prod,
            product_name=prod.name,
            price=Decimal("950000.00"),
            quantity=1,
        )
        reserve_stock_for_order(order1, {str(prod.id): 1}, actor=self.admin_user)
        consolidate_order_reservations(order1, actor=self.admin_user)
        dispatch_order_reservations(order1, actor=self.admin_user)

        oi1.refresh_from_db()
        self.assertEqual(oi1.costing_method_snapshot, "pending_reconciliation")
        self.assertIsNone(oi1.unit_cost_snapshot)
        self.assertIsNone(oi1.total_cost_snapshot)
        self.assertIsNone(oi1.cost_frozen_at)

        # Posteriormente se reconcilia con tipo de cambio explícito y verificable (USD -> CLP @ 960.00)
        freeze_order_cogs_on_dispatch(
            order1,
            explicit_fx_payload={
                "source_currency": "USD",
                "target_currency": "CLP",
                "rate": Decimal("960.000000"),
                "rate_source": "Banco Central Chile Dólar Observado",
            },
            actor=self.admin_user,
        )
        oi1.refresh_from_db()
        self.assertEqual(oi1.costing_method_snapshot, CostLayer.CostingMethod.WEIGHTED_AVERAGE)
        self.assertEqual(oi1.cost_currency, "CLP")
        self.assertEqual(oi1.unit_cost_snapshot, Decimal("480000.0000"))
        self.assertEqual(oi1.total_cost_snapshot, Decimal("480000.00"))
        self.assertIsNotNone(oi1.cost_frozen_at)
        self.assertTrue(
            ExchangeRateSnapshot.objects.filter(
                source_currency="USD", target_currency="CLP", rate=Decimal("960.000000")
            ).exists()
        )

    def test_oms_pf_03_income_record_does_not_prematurely_freeze_wac_before_dispatch(self):
        """
        OMS-PF-03: Cuando una orden se paga ANTES del despacho físico:
        1. IncomeRecord.create_distributions() NO debe congelar el WAC vigente en el momento del pago.
        2. Si antes del despacho entra una nueva recepción o Landed Cost que cambia el WAC del pool,
           el costo real de venta se congela recién en el despacho (DISPATCH) al WAC efectivo del despacho,
           y en ese momento se concilian las distribuciones de los ingresos previos (incluyendo pagos parciales).
        """
        DistributionCategory.objects.create(name="Costo Capital", cat_type="fixed", order=1)
        DistributionCategory.objects.create(name="Utilidad Neta", cat_type="remainder", order=2)

        prod = Product.objects.create(
            name="Monitor Activo G7PF",
            slug="monitor-activo-g7pf",
            sku="G7PF-MON-01",
            category=self.cat,
            brand=self.brand,
            price=Decimal("400000"),
            cost_price=Decimal("200000"),
            serialization_mode=Product.SerializationMode.NONE,
            stock=0,
        )
        # Recepción 1: 2 unidades @ 200,000 CLP (WAC inicial = 200,000 CLP)
        po1, gr1 = self._receive_product(prod, self.sup_clp, "CLP", 2, "200000.00")

        # Crear orden por 1 unidad @ 400,000 CLP y reservar stock (aún NO despachada)
        order = Order.objects.create(
            status=OrderStatus.PENDING,
            total=Decimal("400000.00"),
            currency="CLP",
            email="pf03@levelpro.cl",
            shipping_address="Concepción",
        )
        oi = OrderItem.objects.create(
            order=order,
            product=prod,
            product_name=prod.name,
            price=Decimal("400000.00"),
            quantity=1,
        )
        reserve_stock_for_order(order, {str(prod.id): 1}, actor=self.admin_user)

        # Pago parcial 1 (50% = 200,000 CLP) y Pago parcial 2 (50% = 200,000 CLP) ANTES del despacho
        inc1 = IncomeRecord.objects.create(order=order, amount=Decimal("200000.00"), currency="CLP", source="payment")
        inc1.create_distributions()
        inc2 = IncomeRecord.objects.create(order=order, amount=Decimal("200000.00"), currency="CLP", source="payment")
        inc2.create_distributions()

        # Verificar que ni OrderItem ni IncomeDistribution congelaron prematuramente el WAC de 200,000
        oi.refresh_from_db()
        self.assertIsNone(oi.unit_cost_snapshot)
        self.assertIsNone(oi.cost_frozen_at)
        self.assertFalse(IncomeDistribution.objects.filter(income_record=inc1).exists())
        self.assertFalse(IncomeDistribution.objects.filter(income_record=inc2).exists())

        # Antes del despacho se finaliza el Landed Cost de GR1 (+40,000 CLP de flete para las 2 unidades -> +20,000/u)
        # Nuevo WAC efectivo antes del despacho = 220,000.0000 CLP/u
        alloc = create_or_simulate_landed_cost_allocation(
            purchase_order=po1,
            goods_receipt=gr1,
            valuation_currency="CLP",
            expenses=[{"category": "domestic_freight", "proration_method": "by_cif_value", "amount": Decimal("40000.00"), "currency": "CLP"}],
            actor=self.admin_user,
        )
        finalize_landed_cost_allocation(alloc, actor=self.admin_user)

        # Ahora ocurre el despacho físico -> se congela COGS a 220,000 CLP y se concilian inc1 e inc2 (110,000 + 110,000 = 220,000)
        consolidate_order_reservations(order, actor=self.admin_user)
        dispatch_order_reservations(order, actor=self.admin_user)

        oi.refresh_from_db()
        self.assertEqual(oi.unit_cost_snapshot, Decimal("220000.0000"))
        self.assertEqual(oi.total_cost_snapshot, Decimal("220000.00"))
        self.assertIsNotNone(oi.cost_frozen_at)

        cap1 = IncomeDistribution.objects.get(income_record=inc1, category__cat_type="fixed")
        cap2 = IncomeDistribution.objects.get(income_record=inc2, category__cat_type="fixed")
        self.assertEqual(cap1.amount, Decimal("110000.00"))
        self.assertEqual(cap2.amount, Decimal("110000.00"))
        self.assertEqual(cap1.amount + cap2.amount, Decimal("220000.00"))

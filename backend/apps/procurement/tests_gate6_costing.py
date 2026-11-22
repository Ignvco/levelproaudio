"""
LEVELPRO OS V4.0 — GATE 6: Suite Integral de Certificación Cost & Pricing Intelligence
(BF-09 Cost Layers & BF-18 Landed Cost) ejecutada sobre PostgreSQL 16 real.
"""

import threading
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.db import connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.analytics.models import DistributionCategory, IncomeDistribution, IncomeRecord
from apps.inventory.models import Warehouse, WarehouseStock
from apps.inventory.services import (
    consolidate_order_reservations,
    create_and_dispatch_transfer,
    dispatch_order_reservations,
    get_default_warehouse,
    reserve_stock_for_order,
)
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.procurement.costing_services import (
    CostingServiceError,
    calculate_profitability_metrics,
    compute_landed_cost_distribution,
    create_or_simulate_landed_cost_allocation,
    finalize_landed_cost_allocation,
    record_wac_damage_reclassification,
    record_wac_internal_transfer,
    record_wac_physical_return,
)
from apps.procurement.models import (
    CostAdjustmentEntry,
    CostConsumptionRecord,
    CostLayer,
    ExchangeRateSnapshot,
    LandedCostAllocation,
    LandedCostExpense,
    PricingSimulationProposal,
    ProductSupplier,
    SerialCostUnit,
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
from core.rbac.constants import ROLE_FINANCE, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE

User = get_user_model()


class Gate6CostingAndPricingSuiteTest(TransactionTestCase):
    """Suite de pruebas transaccionales Gate 6 sobre PostgreSQL 16."""

    def setUp(self):
        call_command("setup_rbac")
        self.wh_user = User.objects.create_user(
            username="g6_wh",
            email="g6_wh@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.wh_user.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))

        self.purch_user = User.objects.create_user(
            username="g6_purch",
            email="g6_purch@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.purch_user.groups.add(Group.objects.get(name=ROLE_PURCHASING))

        self.fin_user = User.objects.create_user(
            username="g6_fin",
            email="g6_fin@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.fin_user.groups.add(Group.objects.get(name=ROLE_FINANCE))

        self.mgmt_user = User.objects.create_user(
            username="g6_mgmt",
            email="g6_mgmt@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.mgmt_user.groups.add(Group.objects.get(name=ROLE_MANAGEMENT))

        self.wh_central = get_default_warehouse()
        self.wh_showroom, _ = Warehouse.objects.get_or_create(
            code="SHOW-G6",
            defaults={
                "name": "Showroom Gate 6",
                "warehouse_type": Warehouse.WarehouseType.SHOWROOM,
                "is_active": True,
                "is_sellable_online": True,
                "fulfillment_priority": 20,
            },
        )

        self.cat = Category.objects.create(name="Microfonía Gate 6", slug="microfonia-g6")
        self.brand = Brand.objects.create(name="NeumannG6", slug="neumann-g6")
        self.sup_usd = Supplier.objects.create(
            internal_code="SUP-G6-NEU",
            legal_name="Neumann Berlin GmbH",
            country="Alemania",
            currency="USD",
            is_active=True,
        )
        self.sup_clp = Supplier.objects.create(
            internal_code="SUP-G6-CLP",
            legal_name="Distribuidora Nacional Audio SpA",
            country="Chile",
            currency="CLP",
            is_active=True,
        )

    def test_01_mandatory_mathematical_proof_landed_cost_by_weight_and_cif(self):
        """
        Sección 7 — PRUEBA MATEMÁTICA OBLIGATORIA:
        Partida A: valor CIF 100, peso 2.
        Partida B: valor CIF 300, peso 1.
        Gastos:
        - Flete 90, prorrateado por peso.
        - Seguro 40, prorrateado por CIF.
        - Aranceles 80, prorrateados por CIF.
        Resultado esperado:
        - Partida A: 100 + 60 + 10 + 20 = 190.
        - Partida B: 300 + 30 + 30 + 60 = 420.
        - Total final: 610.
        """
        dist = compute_landed_cost_distribution(
            lines=[
                {"line_id": "A", "sku": "PARTIDA-A", "quantity": 1, "cif_total": Decimal("100.00"), "total_weight": Decimal("2.00")},
                {"line_id": "B", "sku": "PARTIDA-B", "quantity": 1, "cif_total": Decimal("300.00"), "total_weight": Decimal("1.00")},
            ],
            expenses=[
                {"id": "flete", "category": "international_freight", "proration_method": "by_weight", "amount": Decimal("90.00")},
                {"id": "seguro", "category": "insurance", "proration_method": "by_cif_value", "amount": Decimal("40.00")},
                {"id": "aranceles", "category": "customs_duty", "proration_method": "by_cif_value", "amount": Decimal("80.00")},
            ],
        )

        line_a = dist["lines"][0]
        line_b = dist["lines"][1]

        self.assertEqual(line_a["expense_breakdown"]["flete"]["allocated_amount"], "60.00")
        self.assertEqual(line_a["expense_breakdown"]["seguro"]["allocated_amount"], "10.00")
        self.assertEqual(line_a["expense_breakdown"]["aranceles"]["allocated_amount"], "20.00")
        self.assertEqual(line_a["allocated_expenses_total"], Decimal("90.00"))
        self.assertEqual(line_a["landed_total_cost"], Decimal("190.00"))

        self.assertEqual(line_b["expense_breakdown"]["flete"]["allocated_amount"], "30.00")
        self.assertEqual(line_b["expense_breakdown"]["seguro"]["allocated_amount"], "30.00")
        self.assertEqual(line_b["expense_breakdown"]["aranceles"]["allocated_amount"], "60.00")
        self.assertEqual(line_b["allocated_expenses_total"], Decimal("120.00"))
        self.assertEqual(line_b["landed_total_cost"], Decimal("420.00"))

        self.assertEqual(dist["total_cif_base"], Decimal("400.00"))
        self.assertEqual(dist["total_capitalizable_expenses"], Decimal("210.00"))
        self.assertEqual(dist["total_landed_cost"], Decimal("610.00"))
        self.assertEqual(
            line_a["landed_total_cost"] + line_b["landed_total_cost"],
            dist["total_cif_base"] + dist["total_capitalizable_expenses"],
        )

        # Redondeo determinista (100.00 entre 3 partidas iguales de CIF 100 -> 33.34 en la primera, 33.33 y 33.33)
        dist_round = compute_landed_cost_distribution(
            lines=[
                {"line_id": "L1", "sku": "S1", "quantity": 1, "cif_total": Decimal("100.00")},
                {"line_id": "L2", "sku": "S2", "quantity": 1, "cif_total": Decimal("100.00")},
                {"line_id": "L3", "sku": "S3", "quantity": 1, "cif_total": Decimal("100.00")},
            ],
            expenses=[
                {"id": "e1", "category": "handling", "proration_method": "by_cif_value", "amount": Decimal("100.00")},
                {"id": "iva_rec", "category": "recoverable_tax", "proration_method": "by_cif_value", "amount": Decimal("57.00")},
            ],
        )
        self.assertEqual(dist_round["total_capitalizable_expenses"], Decimal("100.00"))
        self.assertEqual(dist_round["total_non_capitalizable_taxes"], Decimal("57.00"))
        self.assertEqual(dist_round["total_landed_cost"], Decimal("400.00"))
        self.assertEqual(dist_round["lines"][0]["allocated_expenses_total"], Decimal("33.34"))
        self.assertEqual(dist_round["lines"][1]["allocated_expenses_total"], Decimal("33.33"))
        self.assertEqual(dist_round["lines"][2]["allocated_expenses_total"], Decimal("33.33"))

        # Bloqueo cuando falta peso en gasto prorrateado por peso
        with self.assertRaises(CostingServiceError):
            compute_landed_cost_distribution(
                lines=[{"line_id": "NO-W", "sku": "NW", "quantity": 1, "cif_total": Decimal("100.00")}],
                expenses=[{"id": "f1", "category": "international_freight", "proration_method": "by_weight", "amount": Decimal("50.00")}],
            )

    def test_02_serial_costing_transfer_dispatch_and_immutable_historical_sale_cost(self):
        """
        Sección 9 y 12: Costeo específico por número de serie (REQUIRED), transferencia entre bodegas
        sin utilidad ficticia, congelamiento de costo de venta al despachar y bloqueo de consumo duplicado.
        """
        mic = Product.objects.create(
            name="Neumann U87 Ai",
            slug="neumann-u87-ai-g6",
            sku="G6-U87-AI",
            category=self.cat,
            brand=self.brand,
            price=Decimal("3200000"),
            price_usd=Decimal("3400.00"),
            cost_price=Decimal("2000000"),
            weight=Decimal("2.50"),
            serialization_mode=Product.SerializationMode.REQUIRED,
            stock=0,
        )
        po = create_purchase_order(
            supplier=self.sup_usd,
            destination_warehouse=self.wh_central,
            currency="USD",
            items=[{"product_id": mic.id, "quantity_ordered": 2, "unit_cost": Decimal("2000.00")}],
            actor=self.purch_user,
        )
        po = approve_purchase_order(po, actor=self.mgmt_user)
        po = issue_purchase_order(po, actor=self.purch_user)
        poi = po.items.first()

        gr = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh_central,
            items=[{
                "purchase_order_item_id": poi.id,
                "quantity_accepted": 2,
                "serial_numbers": ["SN-U87-001", "SN-U87-002"],
            }],
            actor=self.wh_user,
        )
        gr = confirm_goods_receipt(gr, actor=self.wh_user)

        # Asignar y finalizar Landed Cost en USD: Flete 200 USD (por peso) + Arancel 120 USD (por CIF) = +160 USD por unidad
        alloc = create_or_simulate_landed_cost_allocation(
            purchase_order=po,
            goods_receipt=gr,
            valuation_currency="USD",
            expenses=[
                {"category": "international_freight", "proration_method": "by_weight", "amount": Decimal("200.00"), "currency": "USD"},
                {"category": "customs_duty", "proration_method": "by_cif_value", "amount": Decimal("120.00"), "currency": "USD"},
            ],
            actor=self.fin_user,
        )
        alloc = finalize_landed_cost_allocation(alloc, idempotency_key="lc-u87-fin", actor=self.fin_user)
        self.assertEqual(alloc.status, LandedCostAllocation.Status.FINALIZED)

        scu1 = SerialCostUnit.objects.get(serial_number_snapshot="SN-U87-001")
        scu2 = SerialCostUnit.objects.get(serial_number_snapshot="SN-U87-002")
        self.assertEqual(scu1.landed_unit_cost, Decimal("2160.0000"))
        self.assertEqual(scu2.landed_unit_cost, Decimal("2160.0000"))
        self.assertTrue(scu1.is_finalized)

        # Transferir SN-U87-002 a Showroom: conserva costo histórico sin generar utilidad ficticia
        create_and_dispatch_transfer(
            source_warehouse=self.wh_central,
            destination_warehouse=self.wh_showroom,
            items=[{"product_id": mic.id, "quantity": 1, "serial_numbers": ["SN-U87-002"]}],
            auto_receive=True,
            actor=self.wh_user,
        )
        trf_meta = record_wac_internal_transfer(
            product=mic,
            currency="USD",
            quantity=1,
            source_warehouse=self.wh_central,
            destination_warehouse=self.wh_showroom,
        )
        self.assertEqual(trf_meta["unit_cost_preserved"], Decimal("2160.0000"))
        self.assertEqual(trf_meta["fictitious_profit"], Decimal("0.00"))
        scu2.refresh_from_db()
        self.assertEqual(scu2.landed_unit_cost, Decimal("2160.0000"))

        # Venta y despacho físico de SN-U87-001 desde BOD-CENTRAL
        order = Order.objects.create(
            status=OrderStatus.PENDING,
            total=Decimal("3400.00"),
            currency="USD",
            email="cliente@estudio.cl",
            shipping_address="Providencia 100",
        )
        oi = OrderItem.objects.create(
            order=order,
            product=mic,
            product_name=mic.name,
            price=Decimal("3400.00"),
            quantity=1,
        )
        reserve_stock_for_order(
            order=order,
            demand={str(mic.id): 1},
        )
        consolidate_order_reservations(order)
        dispatch_order_reservations(
            order,
            serial_assignments={str(mic.id): ["SN-U87-001"]},
            actor=self.wh_user,
        )

        oi.refresh_from_db()
        scu1.refresh_from_db()
        self.assertTrue(scu1.is_consumed)
        self.assertEqual(scu1.consumed_by_order_item_id, oi.id)
        self.assertEqual(oi.unit_cost_snapshot, Decimal("2160.0000"))
        self.assertEqual(oi.total_cost_snapshot, Decimal("2160.00"))
        self.assertEqual(oi.cost_currency, "USD")
        self.assertEqual(oi.costing_method_snapshot, CostLayer.CostingMethod.SPECIFIC_SERIAL)
        self.assertEqual(oi.allocated_serial_numbers, ["SN-U87-001"])

        # Modificar posteriormente Product.cost_price NO altera el costo congelado de la venta
        mic.cost_price = Decimal("9999999")
        mic.save()
        oi.refresh_from_db()
        self.assertEqual(oi.unit_cost_snapshot, Decimal("2160.0000"))

    def test_03_weighted_average_fungible_partial_receipts_and_late_expenses(self):
        """
        Sección 10 y 11: Promedio ponderado móvil (WAC) en recepciones parciales (4 de 10 y luego 6 de 10),
        despacho y ajuste versionado por gasto tardío sin alterar ventas cerradas.
        """
        cable = Product.objects.create(
            name="Cable Mogami XLR 5m",
            slug="cable-mogami-xlr-g6",
            sku="G6-MOG-XLR5",
            category=self.cat,
            brand=self.brand,
            price=Decimal("180000"),
            cost_price=Decimal("90000"),
            weight=Decimal("0.50"),
            serialization_mode=Product.SerializationMode.NONE,
            stock=0,
        )
        po = create_purchase_order(
            supplier=self.sup_clp,
            destination_warehouse=self.wh_central,
            currency="CLP",
            items=[{"product_id": cable.id, "quantity_ordered": 10, "unit_cost": Decimal("100.00")}],
            actor=self.purch_user,
        )
        po = approve_purchase_order(po, actor=self.mgmt_user)
        po = issue_purchase_order(po, actor=self.purch_user)
        poi = po.items.first()

        # 1. Recepción parcial 1: 4 unidades de 10 -> Gasto landed de esa recepción = 20.00 (5.00 c/u -> costo unitario = 105.00)
        gr1 = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh_central,
            items=[{"purchase_order_item_id": poi.id, "quantity_accepted": 4}],
            actor=self.wh_user,
        )
        gr1 = confirm_goods_receipt(gr1, actor=self.wh_user)
        alloc1 = create_or_simulate_landed_cost_allocation(
            purchase_order=po,
            goods_receipt=gr1,
            valuation_currency="CLP",
            expenses=[{"category": "domestic_freight", "proration_method": "by_cif_value", "amount": Decimal("20.00"), "currency": "CLP"}],
            actor=self.fin_user,
        )
        # Verificar que alloc1 solo asignó sobre las 4 unidades recibidas (CIF base = 400.00, no 1000.00)
        self.assertEqual(alloc1.total_cif_base, Decimal("400.00"))
        self.assertEqual(alloc1.total_landed_cost, Decimal("420.00"))
        finalize_landed_cost_allocation(alloc1, actor=self.fin_user)

        wac = WeightedAverageCostState.objects.get(product=cable, currency="CLP")
        self.assertEqual(wac.total_quantity, 4)
        self.assertEqual(wac.total_value, Decimal("420.0000"))
        self.assertEqual(wac.average_unit_cost, Decimal("105.0000"))

        # 2. Recepción parcial 2: 6 unidades restantes @ 100.00 + flete 90.00 (15.00 c/u -> 115.00 c/u, total = 690.00)
        gr2 = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh_central,
            items=[{"purchase_order_item_id": poi.id, "quantity_accepted": 6}],
            actor=self.wh_user,
        )
        gr2 = confirm_goods_receipt(gr2, actor=self.wh_user)
        alloc2 = create_or_simulate_landed_cost_allocation(
            purchase_order=po,
            goods_receipt=gr2,
            valuation_currency="CLP",
            expenses=[{"category": "domestic_freight", "proration_method": "by_cif_value", "amount": Decimal("90.00"), "currency": "CLP"}],
            actor=self.fin_user,
        )
        finalize_landed_cost_allocation(alloc2, actor=self.fin_user)

        # Promedio ponderado móvil: (420 + 690) / (4 + 6) = 1110 / 10 = 111.0000
        wac.refresh_from_db()
        self.assertEqual(wac.total_quantity, 10)
        self.assertEqual(wac.total_value, Decimal("1110.0000"))
        self.assertEqual(wac.average_unit_cost, Decimal("111.0000"))

        # 3. Venta y despacho de 2 unidades -> se congelan a WAC = 111.0000 (total_cost = 222.00)
        order = Order.objects.create(
            status=OrderStatus.PENDING,
            total=Decimal("360.00"),
            currency="CLP",
            email="compra@test.cl",
            shipping_address="Santiago",
        )
        oi = OrderItem.objects.create(
            order=order,
            product=cable,
            product_name=cable.name,
            price=Decimal("180.00"),
            quantity=2,
        )
        reserve_stock_for_order(
            order=order,
            demand={str(cable.id): 2},
        )
        consolidate_order_reservations(order)
        dispatch_order_reservations(order, actor=self.wh_user)

        oi.refresh_from_db()
        self.assertEqual(oi.unit_cost_snapshot, Decimal("111.0000"))
        self.assertEqual(oi.total_cost_snapshot, Decimal("222.00"))
        wac.refresh_from_db()
        self.assertEqual(wac.sellable_quantity, 8)
        self.assertEqual(wac.total_value, Decimal("888.0000"))
        self.assertEqual(wac.average_unit_cost, Decimal("111.0000"))

        # 4. Gasto tardío sobre gr1 (4 unidades originales, de las cuales 2 ya fueron consumidas y 2 siguen disponibles):
        # Gasto tardío = 40.00 CLP (10.00 por unidad original).
        # 20.00 se capitalizan al inventario disponible (las 2 unidades restantes de la capa 1)
        # y 20.00 se registran como variación sobre unidades ya consumidas, SIN tocar el OrderItem ya vendido!
        alloc_late = create_or_simulate_landed_cost_allocation(
            purchase_order=po,
            goods_receipt=gr1,
            valuation_currency="CLP",
            is_late_adjustment=True,
            expenses=[{"category": "warehousing", "proration_method": "by_cif_value", "amount": Decimal("40.00"), "currency": "CLP"}],
            notes="Factura tardía almacenaje portuario",
            actor=self.fin_user,
        )
        finalize_landed_cost_allocation(alloc_late, actor=self.fin_user)

        adj = CostAdjustmentEntry.objects.get(allocation=alloc_late)
        self.assertEqual(adj.total_adjustment_amount, Decimal("40.00"))
        self.assertEqual(adj.quantity_on_hand_at_adjustment, 2)
        self.assertEqual(adj.quantity_already_consumed, 2)
        self.assertEqual(adj.capitalized_to_inventory_amount, Decimal("20.00"))
        self.assertEqual(adj.variance_on_consumed_amount, Decimal("20.00"))

        # El OrderItem histórico permanece intacto en 111.0000 / 222.00
        oi.refresh_from_db()
        self.assertEqual(oi.unit_cost_snapshot, Decimal("111.0000"))
        self.assertEqual(oi.total_cost_snapshot, Decimal("222.00"))

        # El WAC de las 8 unidades restantes absorbió únicamente los 20.00 capitalizables: (888 + 20) / 8 = 908 / 8 = 113.5000
        wac.refresh_from_db()
        self.assertEqual(wac.total_value, Decimal("908.0000"))
        self.assertEqual(wac.average_unit_cost, Decimal("113.5000"))

        # 5. Reclasificación por daño y devolución física en WAC
        wac = record_wac_damage_reclassification(product=cable, currency="CLP", quantity_damaged=1)
        self.assertEqual(wac.sellable_quantity, 7)
        self.assertEqual(wac.damaged_quantity, 1)
        self.assertEqual(wac.average_unit_cost, Decimal("113.5000"))

        wac = record_wac_physical_return(
            product=cable,
            currency="CLP",
            quantity=1,
            returned_unit_cost=oi.unit_cost_snapshot,
        )
        self.assertEqual(wac.sellable_quantity, 8)
        self.assertEqual(wac.total_quantity, 9)

    def test_04_multicurrency_fx_snapshots_and_concurrent_finalization_safety(self):
        """
        Sección 8 y 18: Conversión multimoneda con ExchangeRateSnapshot congelado (PO en USD, gastos en USD y CLP,
        valuación en CLP) y seguridad bajo concurrencia ante doble confirmación simultánea.
        """
        interface = Product.objects.create(
            name="Interfaz Audio FX",
            slug="interfaz-audio-fx-g6",
            sku="G6-FX-INT",
            category=self.cat,
            brand=self.brand,
            price=Decimal("600000"),
            weight=Decimal("1.50"),
            stock=0,
        )
        po = create_purchase_order(
            supplier=self.sup_usd,
            destination_warehouse=self.wh_central,
            currency="USD",
            items=[{"product_id": interface.id, "quantity_ordered": 2, "unit_cost": Decimal("200.00")}],
            actor=self.purch_user,
        )
        po = approve_purchase_order(po, actor=self.mgmt_user)
        po = issue_purchase_order(po, actor=self.purch_user)
        gr = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh_central,
            items=[{"purchase_order_item_id": po.items.first().id, "quantity_accepted": 2}],
            actor=self.wh_user,
        )
        gr = confirm_goods_receipt(gr, actor=self.wh_user)

        alloc = create_or_simulate_landed_cost_allocation(
            purchase_order=po,
            goods_receipt=gr,
            valuation_currency="CLP",
            po_fx_payload={"rate": Decimal("950.00"), "rate_source": "DUS Aduana Chile #2026-88"},
            expenses=[
                {
                    "category": "international_freight",
                    "proration_method": "by_weight",
                    "amount": Decimal("50.00"),
                    "currency": "USD",
                    "fx_rate": Decimal("950.00"),
                    "fx_source": "Factura DHL TC Aduana",
                },
                {
                    "category": "customs_broker",
                    "proration_method": "by_cif_value",
                    "amount": Decimal("47500.00"),
                    "currency": "CLP",
                },
            ],
            actor=self.fin_user,
        )
        # Base CIF: 2 * 200 * 950 = 380,000 CLP
        # Gastos: (50 * 950 = 47,500) + 47,500 = 95,000 CLP
        # Total Landed: 475,000 CLP -> 237,500 CLP por unidad
        self.assertEqual(alloc.total_cif_base, Decimal("380000.00"))
        self.assertEqual(alloc.total_capitalizable_expenses, Decimal("95000.00"))
        self.assertEqual(alloc.total_landed_cost, Decimal("475000.00"))

        # Ejecutar 2 hilos concurrentes intentando finalizar la misma LandedCostAllocation
        results = []
        errors = []

        def _worker():
            try:
                res = finalize_landed_cost_allocation(alloc, idempotency_key="conc-fin-1", actor=self.fin_user)
                results.append(res.id)
            except Exception as exc:
                errors.append(str(exc))
            finally:
                connections.close_all()

        t1 = threading.Thread(target=_worker)
        t2 = threading.Thread(target=_worker)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        self.assertEqual(len(errors), 0, f"Errores inesperados en concurrencia: {errors}")
        self.assertEqual(len(results), 2)

        layer = CostLayer.objects.get(goods_receipt=gr)
        self.assertEqual(layer.valuation_currency, "CLP")
        self.assertEqual(layer.landed_unit_cost, Decimal("237500.0000"))
        self.assertEqual(layer.total_layer_cost, Decimal("475000.00"))
        self.assertTrue(ExchangeRateSnapshot.objects.filter(rate_source="DUS Aduana Chile #2026-88").exists())

    def test_05_income_record_integration_partial_payments_and_historical_preservation(self):
        """
        Sección 13: Integración con IncomeRecord e IncomeDistribution preservando historial,
        aprovechando snapshots reales de costo, soportando pagos parciales sin duplicar capital
        y aislando monedas.
        """
        DistributionCategory.objects.create(name="Capital Producto", cat_type="fixed", order=1)
        DistributionCategory.objects.create(name="Comisión Pasarela", cat_type="percent", percentage=Decimal("5.00"), order=2)
        DistributionCategory.objects.create(name="Utilidad Neta", cat_type="remainder", order=3)

        synth = Product.objects.create(
            name="Sintetizador Analógico G6",
            slug="sintetizador-analogico-g6",
            sku="G6-SYNTH-01",
            category=self.cat,
            brand=self.brand,
            price=Decimal("1000000"),
            cost_price=Decimal("700000"),
            stock=5,
        )
        # Crear orden con snapshot de costo landed real (550,000 CLP, distinto al cost_price=700,000 del catálogo)
        order = Order.objects.create(
            status=OrderStatus.PENDING,
            total=Decimal("1000000.00"),
            currency="CLP",
            email="synth@test.cl",
            shipping_address="Valparaíso",
        )
        OrderItem.objects.create(
            order=order,
            product=synth,
            product_name=synth.name,
            price=Decimal("1000000.00"),
            quantity=1,
            unit_cost_snapshot=Decimal("550000.0000"),
            total_cost_snapshot=Decimal("550000.00"),
            cost_currency="CLP",
            costing_method_snapshot="specific_serial",
        )

        # Pago parcial 1 (40% = 400,000 CLP) -> debe asignar 40% del costo capital (220,000 CLP)
        inc1 = IncomeRecord.objects.create(order=order, amount=Decimal("400000.00"), currency="CLP", source="payment")
        inc1.create_distributions()
        cap1 = IncomeDistribution.objects.get(income_record=inc1, category__cat_type="fixed")
        self.assertEqual(cap1.amount, Decimal("220000.00"))

        # Modificar el catálogo Product.cost_price a 900,000 CLP antes del segundo pago -> NO debe afectar el snapshot de la orden
        synth.cost_price = Decimal("900000")
        synth.save()

        # Pago parcial 2 (60% = 600,000 CLP) -> debe asignar exactamente el remanente de capital (330,000 CLP)
        inc2 = IncomeRecord.objects.create(order=order, amount=Decimal("600000.00"), currency="CLP", source="payment")
        inc2.create_distributions()
        cap2 = IncomeDistribution.objects.get(income_record=inc2, category__cat_type="fixed")
        self.assertEqual(cap2.amount, Decimal("330000.00"))
        self.assertEqual(cap1.amount + cap2.amount, Decimal("550000.00"))

        # Llamar nuevamente a create_distributions() sobre inc1 NO recalcula ni duplica
        inc1.create_distributions()
        self.assertEqual(IncomeDistribution.objects.filter(income_record=inc1).count(), 3)

    def test_06_profitability_metrics_simulator_and_rbac_security(self):
        """
        Sección 12, 14, 16 y 17: Diferencia margen sobre ventas (10%) vs markup sobre costo (11.11%),
        bloquea cálculo cuando faltan datos tributarios/FX verificables, verifica simulador sin mutación
        automática del catálogo y valida protección RBAC en endpoints.
        """
        # 1. Precio neto = 100, Costo = 90 -> Margen sobre ventas = 10.00%, Markup sobre costo = 11.11%
        m = calculate_profitability_metrics(
            sale_price=Decimal("100.00"),
            sale_currency="USD",
            unit_cost=Decimal("90.00"),
            cost_currency="USD",
            price_tax_basis="net",
        )
        self.assertEqual(m["status"], "calculated")
        self.assertEqual(m["gross_margin_unit"], Decimal("10.0000"))
        self.assertEqual(m["margin_on_sales_percent"], Decimal("10.00"))
        self.assertEqual(m["markup_on_cost_percent"], Decimal("11.11"))
        self.assertNotEqual(m["margin_on_sales_percent"], m["markup_on_cost_percent"])

        # 2. Precio con impuesto incluido ('gross') sin tasa tributaria verificada -> pending_calculation
        m_unverified_tax = calculate_profitability_metrics(
            sale_price=Decimal("119000"),
            sale_currency="CLP",
            unit_cost=Decimal("80000"),
            cost_currency="CLP",
            price_tax_basis="gross",
            verified_tax_rate_percent=None,
        )
        self.assertEqual(m_unverified_tax["status"], "pending_calculation")
        self.assertIsNone(m_unverified_tax["margin_on_sales_percent"])

        # 3. Monedas distintas sin tasa FX explícita -> pending_calculation
        m_unverified_fx = calculate_profitability_metrics(
            sale_price=Decimal("100000"),
            sale_currency="CLP",
            unit_cost=Decimal("80.00"),
            cost_currency="USD",
            explicit_fx_rate=None,
        )
        self.assertEqual(m_unverified_fx["status"], "pending_calculation")

        # 4. Endpoints API y RBAC
        prod = Product.objects.create(
            name="Compresor Bus G6",
            slug="compresor-bus-g6",
            sku="G6-COMP-BUS",
            category=self.cat,
            brand=self.brand,
            price=Decimal("1000000"),
            cost_price=Decimal("650000"),
            stock=2,
        )

        # Rol WAREHOUSE no puede consultar landed-cost, layers, margins ni simulator (403)
        c_wh = APIClient()
        c_wh.force_authenticate(user=self.wh_user)
        self.assertEqual(c_wh.get("/api/v1/admin/costing/landed-cost/").status_code, 403)
        self.assertEqual(c_wh.get("/api/v1/admin/costing/layers/").status_code, 403)
        self.assertEqual(c_wh.get("/api/v1/admin/pricing/margins/").status_code, 403)
        self.assertEqual(c_wh.get("/api/v1/admin/pricing/simulator/").status_code, 403)

        # Rol FINANCE puede simular propuesta pero NO muta automáticamente Product.price
        c_fin = APIClient()
        c_fin.force_authenticate(user=self.fin_user)
        r_sim = c_fin.post(
            "/api/v1/admin/pricing/simulator/",
            {
                "product_id": str(prod.id),
                "currency": "CLP",
                "base_landed_cost": "650000",
                "proposed_net_price": "1200000",
                "save_proposal": True,
                "notes": "Ajuste margen objetivo 45.83%",
            },
            format="json",
        )
        self.assertEqual(r_sim.status_code, 201)
        self.assertFalse(r_sim.data["catalog_mutated"])
        prod.refresh_from_db()
        self.assertEqual(prod.price, Decimal("1000000"))

        # Rol MANAGEMENT (con edit_prices) aprueba y aplica la propuesta -> actualiza Product.price
        c_mgmt = APIClient()
        c_mgmt.force_authenticate(user=self.mgmt_user)
        prop_id = r_sim.data["proposal_id"]
        r_app = c_mgmt.post(f"/api/v1/admin/pricing/proposals/{prop_id}/approve/", {}, format="json")
        self.assertEqual(r_app.status_code, 200)
        self.assertEqual(r_app.data["status"], PricingSimulationProposal.Status.APPROVED_APPLIED)
        prod.refresh_from_db()
        self.assertEqual(prod.price, Decimal("1200000.00"))

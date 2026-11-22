import threading
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import connection
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.inventory.models import (
    InventoryMovement,
    SerialNumberTrack,
    Warehouse,
    WarehouseStock,
)
from apps.inventory.services import InventoryServiceError, adjust_stock, get_default_warehouse
from apps.procurement.models import (
    CustomsDocument,
    GoodsReceipt,
    ProductSupplier,
    PurchaseOrder,
    Supplier,
)
from apps.procurement.po_services import (
    ProcurementServiceError,
    approve_purchase_order,
    confirm_goods_receipt,
    create_goods_receipt,
    create_purchase_order,
    issue_purchase_order,
    update_purchase_order,
)
from apps.products.models import Brand, Category, Product, ProductVariant, SpecialOrderRequest
from core.rbac.constants import ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE

User = get_user_model()


class Gate5ProcurementSuiteTest(TransactionTestCase):
    """
    Suite integral de certificación Gate 5 (BF-03, BF-04, BF-42 y PROC-PF-01..03) sobre PostgreSQL 16.
    """

    def setUp(self):
        call_command("setup_rbac")
        self.admin = User.objects.create_user(
            username="proc5_admin",
            email="proc5_admin@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
            is_superuser=True,
        )
        self.wh_user = User.objects.create_user(
            username="proc5_wh",
            email="proc5_wh@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.wh_user.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))

        self.purch_user = User.objects.create_user(
            username="proc5_purch",
            email="proc5_purch@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.purch_user.groups.add(Group.objects.get(name=ROLE_PURCHASING))

        self.mgmt_user = User.objects.create_user(
            username="proc5_mgmt",
            email="proc5_mgmt@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.mgmt_user.groups.add(Group.objects.get(name=ROLE_MANAGEMENT))

        self.wh = get_default_warehouse()
        self.cat = Category.objects.create(name="Interfaces Gate 5", slug="interfaces-gate5")
        self.brand = Brand.objects.create(name="RMEGate5", slug="rme-gate5")
        self.sup = Supplier.objects.create(
            internal_code="SUP-G5-01",
            legal_name="Audio Distro SpA",
            trade_name="Audio Distro",
            tax_id="76.111.222-3",
            country="Chile",
            currency="USD",
            payment_terms="30 días",
            is_active=True,
        )
        self.prod = Product.objects.create(
            name="Interfaz Pro 8",
            slug="interfaz-pro-8-g5",
            sku="G5-INT-01",
            category=self.cat,
            brand=self.brand,
            price=Decimal("890000"),
            stock=0,
            serialization_mode=Product.SerializationMode.NONE,
            is_active=True,
        )
        self.ps = ProductSupplier.objects.create(
            supplier=self.sup,
            product=self.prod,
            supplier_sku="DIST-RME-01",
            unit_cost=Decimal("450.00"),
            currency="USD",
            tax_basis="net",
            is_preferred=True,
        )

    def test_proc_pf01_full_idempotency_conflict_matrix(self):
        adjust_stock(
            warehouse=self.wh,
            product=self.prod,
            delta_physical=5,
            delta_non_sellable=1,
            movement_type=InventoryMovement.MovementType.MANUAL_IN,
            source_document_type="GOODS_RECEIPT",
            source_document_id="doc-1",
            reason="Ingreso idempotente",
            idempotency_key="pf01-key-1",
            actor=self.admin,
        )
        # Replay idéntico -> OK
        ws, mov = adjust_stock(
            warehouse=self.wh,
            product=self.prod,
            delta_physical=5,
            delta_non_sellable=1,
            movement_type=InventoryMovement.MovementType.MANUAL_IN,
            source_document_type="GOODS_RECEIPT",
            source_document_id="doc-1",
            reason="Ingreso idempotente",
            idempotency_key="pf01-key-1",
            actor=self.admin,
        )
        self.assertEqual(ws.physical_quantity, 5)
        self.assertIsNotNone(mov)

        # Conflictos por cambio en non_sellable, movement_type o source_document_id
        with self.assertRaises(InventoryServiceError):
            adjust_stock(
                warehouse=self.wh,
                product=self.prod,
                delta_physical=5,
                delta_non_sellable=2,
                movement_type=InventoryMovement.MovementType.MANUAL_IN,
                source_document_type="GOODS_RECEIPT",
                source_document_id="doc-1",
                idempotency_key="pf01-key-1",
            )
        with self.assertRaises(InventoryServiceError):
            adjust_stock(
                warehouse=self.wh,
                product=self.prod,
                delta_physical=5,
                delta_non_sellable=1,
                movement_type=InventoryMovement.MovementType.OPENING,
                source_document_type="GOODS_RECEIPT",
                source_document_id="doc-1",
                idempotency_key="pf01-key-1",
            )
        with self.assertRaises(InventoryServiceError):
            adjust_stock(
                warehouse=self.wh,
                product=self.prod,
                delta_physical=5,
                delta_non_sellable=1,
                movement_type=InventoryMovement.MovementType.MANUAL_IN,
                source_document_type="GOODS_RECEIPT",
                source_document_id="doc-2",
                idempotency_key="pf01-key-1",
            )

    def test_bf03_po_lifecycle_pdf_snapshot_and_zero_stock_mutation(self):
        kardex_before = InventoryMovement.objects.count()
        po = create_purchase_order(
            supplier=self.sup,
            destination_warehouse=self.wh,
            items=[{"product_id": self.prod.id, "quantity_ordered": 10}],
            incoterm="CIF",
            external_notes="Embalaje reforzado",
            actor=self.purch_user,
        )
        self.assertEqual(po.status, PurchaseOrder.Status.DRAFT)
        self.assertEqual(po.total_amount, Decimal("4500.00"))

        # Aprobar -> editar -> revierte a DRAFT con revision_number=2
        po = approve_purchase_order(po, actor=self.mgmt_user)
        self.assertEqual(po.status, PurchaseOrder.Status.APPROVED)
        po = update_purchase_order(po, payload={"external_notes": "Embalaje doble"}, actor=self.purch_user)
        self.assertEqual(po.status, PurchaseOrder.Status.DRAFT)
        self.assertEqual(po.revision_number, 2)

        po = approve_purchase_order(po, actor=self.mgmt_user)
        po = issue_purchase_order(po, actor=self.purch_user)
        self.assertEqual(po.status, PurchaseOrder.Status.ISSUED)
        self.assertEqual(po.issued_pdf_version, 1)
        self.assertTrue(bytes(po.issued_pdf_bytes).startswith(b"%PDF-"))

        # Invariante: emitir PO no altera stock ni Kardex
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock, 0)
        self.assertFalse(WarehouseStock.objects.filter(warehouse=self.wh, product=self.prod, physical_quantity__gt=0).exists())
        self.assertEqual(InventoryMovement.objects.count(), kardex_before)

        # Modificar costo en ProductSupplier no altera retroactivamente la PO emitida
        self.ps.unit_cost = Decimal("999.00")
        self.ps.save()
        po_item = po.items.first()
        po_item.refresh_from_db()
        self.assertEqual(po_item.unit_cost_snapshot, Decimal("450.00"))

        # PO emitida no puede editarse directamente
        with self.assertRaises(ProcurementServiceError):
            update_purchase_order(po, payload={"external_notes": "Cambio ilegal"}, actor=self.purch_user)

    def test_bf04_partial_receipt_4_of_10_then_6_idempotency_and_damaged_rejected(self):
        po = create_purchase_order(
            supplier=self.sup,
            destination_warehouse=self.wh,
            items=[{"product_id": self.prod.id, "quantity_ordered": 10}],
            actor=self.purch_user,
        )
        po = approve_purchase_order(po, actor=self.mgmt_user)
        po = issue_purchase_order(po, actor=self.purch_user)
        poi = po.items.first()

        # Borrador de recepción NO modifica inventario
        gr1 = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh,
            items=[{"purchase_order_item_id": poi.id, "quantity_accepted": 4, "quantity_damaged": 0, "quantity_rejected": 0}],
            actor=self.wh_user,
        )
        self.assertEqual(gr1.status, GoodsReceipt.Status.DRAFT)
        self.assertFalse(WarehouseStock.objects.filter(warehouse=self.wh, product=self.prod, physical_quantity__gt=0).exists())

        # Confirmar 4/10 -> PO PARTIALLY_RECEIVED, recibidas=4, pendientes=6, WMS=+4, Kardex=+4
        gr1 = confirm_goods_receipt(gr1, idempotency_key="gr1-confirm", actor=self.wh_user)
        self.assertEqual(gr1.status, GoodsReceipt.Status.CONFIRMED)
        po.refresh_from_db()
        poi.refresh_from_db()
        self.assertEqual(po.status, PurchaseOrder.Status.PARTIALLY_RECEIVED)
        self.assertEqual(poi.quantity_received, 4)
        self.assertEqual(poi.quantity_pending, 6)
        ws = WarehouseStock.objects.get(warehouse=self.wh, product=self.prod, variant=None)
        self.assertEqual(ws.physical_quantity, 4)
        self.assertEqual(ws.available_quantity, 4)

        # Replay idempotente no duplica
        gr1_replay = confirm_goods_receipt(gr1, idempotency_key="gr1-confirm", actor=self.wh_user)
        self.assertEqual(gr1_replay.id, gr1.id)
        ws.refresh_from_db()
        self.assertEqual(ws.physical_quantity, 4)

        # Segunda recepción con 4 llegadas: 2 aceptadas, 1 dañada (en custodia no vendible), 1 rechazada (no ingresa)
        gr2 = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh,
            items=[{
                "purchase_order_item_id": poi.id,
                "quantity_arrived": 4,
                "quantity_accepted": 2,
                "quantity_damaged": 1,
                "quantity_rejected": 1,
                "discrepancy_reason": "1 golpeada, 1 rechazada en anden",
            }],
            actor=self.wh_user,
        )
        # Conflicto de idempotencia con clave de gr1 debe fallar
        with self.assertRaises(ProcurementServiceError):
            confirm_goods_receipt(gr2, idempotency_key="gr1-confirm", actor=self.wh_user)

        gr2 = confirm_goods_receipt(gr2, idempotency_key="gr2-confirm", actor=self.wh_user)
        ws.refresh_from_db()
        # Antes 4 + (2 aceptadas + 1 dañada) = 7 físico; non_sellable = 1; disponible = 6
        self.assertEqual(ws.physical_quantity, 7)
        self.assertEqual(ws.non_sellable_quantity, 1)
        self.assertEqual(ws.available_quantity, 6)
        poi.refresh_from_db()
        self.assertEqual(poi.quantity_received, 7)
        self.assertEqual(poi.quantity_pending, 3)

        # Tercera recepción cierra las 3 restantes -> RECEIVED
        gr3 = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh,
            items=[{"purchase_order_item_id": poi.id, "quantity_accepted": 3}],
            actor=self.wh_user,
        )
        confirm_goods_receipt(gr3, idempotency_key="gr3-confirm", actor=self.wh_user)
        po.refresh_from_db()
        poi.refresh_from_db()
        self.assertEqual(po.status, PurchaseOrder.Status.RECEIVED)
        self.assertEqual(poi.quantity_pending, 0)

    def test_bf04_concurrent_receipts_and_forced_rollback(self):
        po = create_purchase_order(
            supplier=self.sup,
            destination_warehouse=self.wh,
            items=[{"product_id": self.prod.id, "quantity_ordered": 5}],
            actor=self.purch_user,
        )
        po = approve_purchase_order(po, actor=self.mgmt_user)
        po = issue_purchase_order(po, actor=self.purch_user)
        poi = po.items.first()

        # Rollback forzado en confirm_goods_receipt
        gr_fail = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh,
            items=[{"purchase_order_item_id": poi.id, "quantity_accepted": 5}],
            actor=self.wh_user,
        )
        with patch("apps.procurement.po_services.receive_stock_into_warehouse", side_effect=RuntimeError("Fallo WMS")):
            with self.assertRaises(RuntimeError):
                confirm_goods_receipt(gr_fail, actor=self.wh_user)
        gr_fail.refresh_from_db()
        poi.refresh_from_db()
        self.assertEqual(gr_fail.status, GoodsReceipt.Status.DRAFT)
        self.assertEqual(poi.quantity_received, 0)

        # Concurrencia real: 2 recepciones por 5 unidades compiten sobre la misma línea (pendiente=5)
        gr_b = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh,
            items=[{"purchase_order_item_id": poi.id, "quantity_accepted": 5}],
            actor=self.wh_user,
        )
        barrier = threading.Barrier(2)
        outcomes = []

        def _confirm(gr_obj):
            try:
                barrier.wait(timeout=5)
                confirm_goods_receipt(gr_obj, actor=self.wh_user)
                outcomes.append("OK")
            except ProcurementServiceError:
                outcomes.append("REJECTED")
            finally:
                connection.close()

        t1 = threading.Thread(target=_confirm, args=(gr_fail,))
        t2 = threading.Thread(target=_confirm, args=(gr_b,))
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)
        self.assertEqual(sorted(outcomes), ["OK", "REJECTED"])
        poi.refresh_from_db()
        self.assertEqual(poi.quantity_received, 5)

    def test_bf04_serialization_required_variants_and_rollback(self):
        p_req = Product.objects.create(
            name="Synth Serializado",
            slug="synth-ser-g5",
            sku="G5-SER-MAST",
            category=self.cat,
            brand=self.brand,
            price=Decimal("1200000"),
            stock=0,
            serialization_mode=Product.SerializationMode.REQUIRED,
            is_active=True,
        )
        v1 = ProductVariant.objects.create(
            product=p_req, sku="G5-SER-V1", name="61 Teclas", price=Decimal("1200000"), stock=0
        )
        po = create_purchase_order(
            supplier=self.sup,
            destination_warehouse=self.wh,
            items=[{"product_id": p_req.id, "variant_id": v1.id, "quantity_ordered": 3, "unit_cost": Decimal("600.00")}],
            actor=self.purch_user,
        )
        po = approve_purchase_order(po, actor=self.mgmt_user)
        po = issue_purchase_order(po, actor=self.purch_user)
        poi = po.items.first()

        # REQUIRED sin seriales -> falla confirmación y hace rollback total
        gr_nosn = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh,
            items=[{"purchase_order_item_id": poi.id, "quantity_accepted": 2}],
            actor=self.wh_user,
        )
        with self.assertRaises(ProcurementServiceError):
            confirm_goods_receipt(gr_nosn, actor=self.wh_user)
        self.assertFalse(WarehouseStock.objects.filter(warehouse=self.wh, product=p_req, variant=v1, physical_quantity__gt=0).exists())

        # REQUIRED con 3 seriales (2 buenos + 1 dañado) -> atómico
        gr_ok = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh,
            items=[{
                "purchase_order_item_id": poi.id,
                "quantity_accepted": 2,
                "quantity_damaged": 1,
                "serial_numbers": ["SN-G5-01", "SN-G5-02", "SN-G5-03"],
                "damaged_serial_numbers": ["SN-G5-03"],
            }],
            actor=self.wh_user,
        )
        confirm_goods_receipt(gr_ok, actor=self.wh_user)
        ws = WarehouseStock.objects.get(warehouse=self.wh, product=p_req, variant=v1)
        self.assertEqual(ws.physical_quantity, 3)
        self.assertEqual(ws.non_sellable_quantity, 1)
        self.assertEqual(ws.available_quantity, 2)
        self.assertEqual(SerialNumberTrack.objects.get(serial_number="SN-G5-01").status, SerialNumberTrack.Status.IN_STOCK)
        self.assertEqual(SerialNumberTrack.objects.get(serial_number="SN-G5-03").status, SerialNumberTrack.Status.DAMAGED)

    def test_bf42_customs_docs_rbac_cost_masking_and_special_order_link(self):
        sor = SpecialOrderRequest.objects.create(
            name="Estudio Sur",
            email="estudio@test.cl",
            equipment="RME UFX III",
            quantity=1,
        )
        client_purch = APIClient()
        client_purch.force_authenticate(user=self.purch_user)

        # Crear PO vinculando SpecialOrderRequest
        resp = client_purch.post(
            "/api/v1/admin/purchase-orders/",
            {
                "supplier_id": str(self.sup.id),
                "destination_warehouse_id": str(self.wh.id),
                "items": [{"product_id": str(self.prod.id), "quantity_ordered": 2}],
                "special_order_request_ids": [str(sor.id)],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        po_id = resp.data["id"]
        self.assertEqual(resp.data["special_order_request_ids"], [str(sor.id)])

        # Warehouse NO ve costos ni descarga PDF con costos, pero SÍ ve cantidades pendientes
        client_wh = APIClient()
        client_wh.force_authenticate(user=self.wh_user)
        r_wh = client_wh.get(f"/api/v1/admin/purchase-orders/{po_id}/")
        self.assertEqual(r_wh.status_code, 200)
        self.assertIsNone(r_wh.data["total_amount"])
        self.assertIsNone(r_wh.data["items"][0]["unit_cost_snapshot"])
        self.assertEqual(r_wh.data["items"][0]["quantity_pending"], 2)
        self.assertEqual(client_wh.get(f"/api/v1/admin/purchase-orders/{po_id}/pdf/").status_code, 403)

        # Subir documento aduanero PDF válido (versión 1 y versión 2)
        pdf_file = SimpleUploadedFile("bl_001.pdf", b"%PDF-1.4\n%test\n", content_type="application/pdf")
        r_doc1 = client_purch.post(
            f"/api/v1/admin/purchase-orders/{po_id}/documents/",
            {"document_type": "bill_of_lading", "document_identifier": "BL-2026-01", "file": pdf_file},
            format="multipart",
        )
        self.assertEqual(r_doc1.status_code, 201)
        self.assertEqual(r_doc1.data["version"], 1)

        # Archivo malicioso (.exe o PDF falso) rechazado
        bad_file = SimpleUploadedFile("fake.pdf", b"NOT_A_PDF", content_type="application/pdf")
        r_bad = client_purch.post(
            f"/api/v1/admin/purchase-orders/{po_id}/documents/",
            {"document_type": "commercial_invoice", "document_identifier": "INV-1", "file": bad_file},
            format="multipart",
        )
        self.assertEqual(r_bad.status_code, 400)

        # Descarga protegida
        doc_id = r_doc1.data["id"]
        r_dl = client_purch.get(f"/api/v1/admin/purchase-orders/{po_id}/documents/{doc_id}/download/")
        self.assertEqual(r_dl.status_code, 200)
        self.assertTrue(r_dl.content.startswith(b"%PDF-1.4"))
        self.assertEqual(CustomsDocument.objects.filter(purchase_order_id=po_id).count(), 1)

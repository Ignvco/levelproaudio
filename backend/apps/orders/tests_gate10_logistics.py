# apps/orders/tests_gate10_logistics.py
"""
LEVELPRO OS V4.0 — GATE 10: LOGISTICS & AFTER-SALES COMPREHENSIVE TESTS
Cubre BF-25 (Couriers, Shipments, Packages, Labels, Manifests, Tracking, Incidents, Notifications),
BF-22 (Garantías por Serial + RMA) y BF-43 (Servicio Técnico de Taller + Repuestos WMS).
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.inventory.models import InventoryMovement, SerialNumberTrack, StockReservation, WarehouseStock
from apps.inventory.services import (
    consolidate_order_reservations,
    get_default_warehouse,
    receive_stock_into_warehouse,
    reserve_stock_for_order,
)
from apps.orders.courier_adapters import ensure_default_carriers_seeded
from apps.orders.logistics_models import (
    Carrier,
    LogisticsNotificationOutbox,
    RepairWorkOrder,
    Shipment,
    ShipmentLabel,
    ShippingManifest,
    TrackingEvent,
    WarrantyClaim,
    WarrantyPolicySnapshot,
)
from apps.orders.logistics_pdf import classify_label_document, render_shipping_label_pdf, render_shipping_manifest_pdf
from apps.orders.logistics_services import (
    LogisticsServiceError,
    add_package_to_shipment,
    add_shipment_to_manifest,
    advance_shipment_preparation,
    close_shipping_manifest,
    consume_repair_part,
    create_repair_work_order,
    create_shipment_for_order,
    create_shipping_manifest,
    create_warranty_claim,
    deliver_and_close_repair,
    generate_shipment_labels,
    handover_shipping_manifest,
    quote_and_assign_carrier,
    record_repair_diagnosis,
    record_repair_test_result,
    record_tracking_event,
    report_delivery_incident,
    set_repair_budget,
    transition_repair_work_order,
    validate_serial_warranty,
)
from apps.orders.models import Order, OrderItem, OrderStatus, ReturnMerchandiseAuthorization
from apps.products.models import Category, Product
from core.contracts.states import CommercialStatus, FinancialStatus, FulfillmentStatus

User = get_user_model()


class Gate10LogisticsAndAfterSalesTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="g10_admin", email="g10_admin@levelpro.cl", password="pw")
        self.buyer = User.objects.create_user(username="g10_buyer", email="g10_buyer@levelpro.cl", password="pw")
        self.wh = get_default_warehouse()
        self.cat = Category.objects.create(name="Audio Pro G10", slug="audio-pro-g10")
        self.product = Product.objects.create(
            name="Interfaz Audio G10",
            slug="interfaz-audio-g10",
            sku="INT-G10-001",
            category=self.cat,
            price=Decimal("300000.00"),
            stock=10,
        )
        self.spare_part = Product.objects.create(
            name="Potenciómetro Repuesto G10",
            slug="pot-repuesto-g10",
            sku="REP-G10-001",
            category=self.cat,
            price=Decimal("15000.00"),
            stock=8,
        )
        receive_stock_into_warehouse(
            product=self.product, warehouse=self.wh, quantity=10, actor=self.admin
        )
        receive_stock_into_warehouse(
            product=self.spare_part, warehouse=self.wh, quantity=8, actor=self.admin
        )
        ensure_default_carriers_seeded()
        self.chilexpress = Carrier.objects.get(code="chilexpress")
        self.svc_clx = self.chilexpress.services.first()

    def _create_paid_reserved_order(self):
        order = Order.objects.create(
            user=self.buyer,
            email=self.buyer.email,
            status=OrderStatus.PAID,
            commercial_status=CommercialStatus.CONFIRMED.value,
            financial_status=FinancialStatus.PAID.value,
            fulfillment_status=FulfillmentStatus.ALLOCATED.value,
            total=Decimal("300000.00"),
            currency="CLP",
            shipping_address="Av. Providencia 1000",
        )
        item = OrderItem.objects.create(
            order=order, product=self.product, product_name=self.product.name, quantity=1, price=Decimal("300000.00")
        )
        reserve_stock_for_order(order, demand={self.product.id: 1}, actor=self.admin)
        consolidate_order_reservations(order, actor=self.admin)
        return order, item

    def test_bf25_full_shipment_manifest_pdf_handover_tracking_and_idempotency(self):
        """BF-25: Bultos, cálculo volumétrico, etiquetas sin descontar WMS, manifiesto inmutable, handover idempotente y tracking."""
        order, _ = self._create_paid_reserved_order()

        # Crear envío idempotente y bloquear duplicado sin is_partial
        shp = create_shipment_for_order(order, warehouse=self.wh, idempotency_key="SHP-IDEM-1", actor=self.admin)
        shp_replay = create_shipment_for_order(order, warehouse=self.wh, idempotency_key="SHP-IDEM-1", actor=self.admin)
        self.assertEqual(shp.id, shp_replay.id)
        with self.assertRaises(LogisticsServiceError):
            create_shipment_for_order(order, warehouse=self.wh, is_partial=False, actor=self.admin)

        # Validación de dimensiones obligatorias
        with self.assertRaises(LogisticsServiceError):
            add_package_to_shipment(shp, gross_weight_kg=Decimal("0"), length_cm=Decimal("10"), width_cm=Decimal("10"), height_cm=Decimal("10"))

        # 2 bultos con peso volumétrico mayor al físico
        pkg1 = add_package_to_shipment(
            shp, gross_weight_kg=Decimal("1.5"), length_cm=Decimal("40"), width_cm=Decimal("30"), height_cm=Decimal("30"),
            is_fragile=True, declared_value=Decimal("300000.00"), commercial_content="Interfaz Audio"
        )
        pkg2 = add_package_to_shipment(
            shp, gross_weight_kg=Decimal("1.0"), length_cm=Decimal("20"), width_cm=Decimal("20"), height_cm=Decimal("20"),
            commercial_content="Cables"
        )
        self.assertEqual(pkg1.volumetric_weight_kg, Decimal("9.00"))
        self.assertEqual(pkg1.billable_weight_kg, Decimal("9.00"))
        pkg1.refresh_from_db()
        self.assertEqual(pkg1.total_packages, 2)

        # Cotización simulada QA y preparación
        snap = quote_and_assign_carrier(shp, carrier=self.chilexpress, carrier_service=self.svc_clx)
        self.assertFalse(snap.is_commercial_valid)
        self.assertEqual(snap.verification_status, "simulated_qa_only")

        advance_shipment_preparation(shp, target_status=Shipment.Status.PREPARING, actor=self.admin)
        advance_shipment_preparation(shp, target_status=Shipment.Status.PACKED, actor=self.admin)
        advance_shipment_preparation(shp, target_status=Shipment.Status.READY_FOR_PICKUP, actor=self.admin)

        # Etiquetas: NO descuentan WMS
        stock_before = WarehouseStock.objects.get(warehouse=self.wh, product=self.product).physical_quantity
        labels = generate_shipment_labels(shp, actor=self.admin)
        self.assertEqual(len(labels), 2)
        self.assertFalse(labels[0].is_official_dte)
        lbl_pdf, _ = render_shipping_label_pdf(labels[0])
        self.assertTrue(lbl_pdf.startswith(b"%PDF"))
        stock_after_label = WarehouseStock.objects.get(warehouse=self.wh, product=self.product).physical_quantity
        self.assertEqual(stock_before, stock_after_label)

        # Manifiesto -> agregar -> cerrar inmutable -> PDF -> handover idempotente
        man = create_shipping_manifest(warehouse=self.wh, carrier=self.chilexpress, actor=self.admin)
        add_shipment_to_manifest(man, shp)
        man = close_shipping_manifest(man, actor=self.admin)
        self.assertEqual(man.status, ShippingManifest.Status.CLOSED)
        self.assertTrue(bool(man.pdf_sha256))
        man_pdf, _ = render_shipping_manifest_pdf(man)
        self.assertTrue(man_pdf.startswith(b"%PDF"))

        # Bloqueo de mutación tras cierre
        order2, _ = self._create_paid_reserved_order()
        shp2 = create_shipment_for_order(order2, warehouse=self.wh, carrier=self.chilexpress, actor=self.admin)
        with self.assertRaises(LogisticsServiceError):
            add_shipment_to_manifest(man, shp2)

        # Handover: descuenta WMS exactamente 1 vez
        handover_shipping_manifest(man, handover_evidence="Retiro Chilexpress #99", actor=self.admin)
        handover_shipping_manifest(man, handover_evidence="Retiro Chilexpress #99", actor=self.admin)
        stock_after_handover = WarehouseStock.objects.get(warehouse=self.wh, product=self.product).physical_quantity
        self.assertEqual(stock_after_handover, stock_before - 1)
        order.refresh_from_db()
        self.assertEqual(order.fulfillment_status, FulfillmentStatus.SHIPPED.value)

        # Tracking normalizado, deduplicado, confirmación entrega sin cambiar estado financiero, no retroceso
        ev1 = record_tracking_event(shp, original_code="ENTREGADO", external_event_id="EVT-DEL-1", location="Santiago")
        ev1_dup = record_tracking_event(shp, original_code="ENTREGADO", external_event_id="EVT-DEL-1", location="Santiago")
        self.assertEqual(ev1.id, ev1_dup.id)
        shp.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(shp.status, Shipment.Status.DELIVERED)
        self.assertEqual(order.fulfillment_status, FulfillmentStatus.DELIVERED.value)
        self.assertEqual(order.financial_status, FinancialStatus.PAID.value)

        # Evento tardío fuera de orden no retrocede DELIVERED
        record_tracking_event(shp, original_code="IN_TRANSIT", external_event_id="EVT-LATE-2")
        shp.refresh_from_db()
        self.assertEqual(shp.status, Shipment.Status.DELIVERED)
        self.assertTrue(LogisticsNotificationOutbox.objects.filter(order=order, status="skipped_qa").exists())

    def test_bf22_bf43_warranty_rma_and_workshop_repair_with_wms_parts(self):
        """BF-22 & BF-43: Garantía por serial + RMA + Taller (diagnóstico, presupuesto, repuesto WMS Kardex, pruebas, entrega)."""
        order, item = self._create_paid_reserved_order()
        SerialNumberTrack.objects.create(
            product=self.product,
            warehouse=self.wh,
            serial_number="SN-G10-WAR-001",
            status=SerialNumberTrack.Status.DISPATCHED,
            order=order,
            customer=self.buyer,
        )
        WarrantyPolicySnapshot.objects.create(
            product=self.product, manufacturer_days=365, legal_days=180, source_reference="Política Oficial"
        )

        # Validador por serial
        val = validate_serial_warranty(serial_number="SN-G10-WAR-001")
        self.assertEqual(val["status"], "covered")

        # Vincular RMA existente Gate 7 + WarrantyClaim
        rma = ReturnMerchandiseAuthorization.objects.create(
            rma_number="RMA-G10-001",
            order=order,
            requested_by=self.buyer,
            reason_code=ReturnMerchandiseAuthorization.ReasonCode.DEFECTIVE,
            reason_details="Falla salida balanceada",
        )
        claim = create_warranty_claim(
            order=order,
            order_item=item,
            reason="Sin señal canal L",
            serial_number="SN-G10-WAR-001",
            rma=rma,
            idempotency_key="WRN-IDEM-1",
            actor=self.admin,
        )
        self.assertEqual(claim.status, WarrantyClaim.Status.COVERAGE_CONFIRMED)
        self.assertEqual(claim.rma_id, rma.id)

        # Taller: flujo completo
        rwo = create_repair_work_order(
            equipment_model=self.product.name,
            reported_symptoms="Sin señal canal L",
            equipment_brand="LevelPro",
            serial_number="SN-G10-WAR-001",
            service_mode=RepairWorkOrder.ServiceMode.IN_WARRANTY,
            warranty_claim=claim,
            rma=rma,
            product=self.product,
            actor=self.admin,
        )
        transition_repair_work_order(rwo, target_status=RepairWorkOrder.Status.AWAITING_DIAGNOSIS, actor=self.admin)
        transition_repair_work_order(rwo, target_status=RepairWorkOrder.Status.DIAGNOSIS_IN_PROGRESS, actor=self.admin)
        record_repair_diagnosis(
            rwo,
            technical_findings="Potenciómetro master dañado",
            proposed_work="Reemplazo potenciómetro y calibración",
            internal_notes="Nota interna técnico",
            customer_notes="Cubierto por garantía",
            actor=self.admin,
        )
        set_repair_budget(rwo, diagnostic_fee=Decimal("0"), labor_fee=Decimal("0"), parts_fee=Decimal("15000"))

        transition_repair_work_order(rwo, target_status=RepairWorkOrder.Status.REPAIR_IN_PROGRESS, actor=self.admin)

        # Consumo de repuesto idempotente vía WMS Kardex
        part_stock_before = WarehouseStock.objects.get(warehouse=self.wh, product=self.spare_part).physical_quantity
        consume_repair_part(rwo, product=self.spare_part, warehouse=self.wh, quantity=1, idempotency_key="PART-1", actor=self.admin)
        consume_repair_part(rwo, product=self.spare_part, warehouse=self.wh, quantity=1, idempotency_key="PART-1", actor=self.admin)
        part_stock_after = WarehouseStock.objects.get(warehouse=self.wh, product=self.spare_part).physical_quantity
        self.assertEqual(part_stock_after, part_stock_before - 1)
        self.assertEqual(
            InventoryMovement.objects.filter(source_document_type="repair_work_order", source_document_id=str(rwo.id)).count(), 1
        )

        # Pruebas técnicas y entrega
        transition_repair_work_order(rwo, target_status=RepairWorkOrder.Status.TESTING, actor=self.admin)
        record_repair_test_result(
            rwo, test_category="audio_io", procedure="Medición THD+N y ganancia", result="pass", instrument_used="Audio Precision", actor=self.admin
        )
        transition_repair_work_order(rwo, target_status=RepairWorkOrder.Status.READY_FOR_DELIVERY, actor=self.admin)
        transition_repair_work_order(rwo, target_status=RepairWorkOrder.Status.DELIVERED, actor=self.admin)
        closed = deliver_and_close_repair(rwo, delivered_to_name="Juan Pérez", delivered_to_id="12345678-9", actor=self.admin)
        self.assertEqual(closed.status, RepairWorkOrder.Status.CLOSED)

    def test_gate10_api_endpoints_smoke(self):
        """HTTP API smoke tests para todos los endpoints Gate 10 bajo /api/v1/admin/logistics/."""
        client = APIClient()
        client.force_authenticate(user=self.admin)
        for path in [
            "/api/v1/admin/logistics/overview/",
            "/api/v1/admin/logistics/carriers/",
            "/api/v1/admin/logistics/shipments/",
            "/api/v1/admin/logistics/labels/",
            "/api/v1/admin/logistics/manifests/",
            "/api/v1/admin/logistics/tracking/",
            "/api/v1/admin/logistics/incidents/",
            "/api/v1/admin/logistics/warranties/",
            "/api/v1/admin/logistics/repairs/",
        ]:
            resp = client.get(path)
            self.assertEqual(resp.status_code, 200, f"GET {path} failed: {resp.status_code}")

    def test_log10_accept_01_02_label_manifest_classification_and_determinism(self):
        """LOG10-ACCEPT-01 & 02: Clasificación de etiquetas sin depender solo del prefijo y manifiesto determinista."""
        order, _ = self._create_paid_reserved_order()
        shp = create_shipment_for_order(order, warehouse=self.wh, carrier=self.chilexpress, actor=self.admin)
        add_package_to_shipment(
            shp, gross_weight_kg=Decimal("2.0"), length_cm=Decimal("30"), width_cm=Decimal("20"), height_cm=Decimal("20"),
            commercial_content="Audio Pro"
        )
        labels = generate_shipment_labels(shp, label_type=ShipmentLabel.LabelType.COURIER_LABEL, actor=self.admin)
        lbl = labels[0]

        # Incluso si el tracking no tuviera prefijo SIM-, carrier integration_pending jamás se clasifica real_carrier_api
        lbl.tracking_number = "CLX-TEST-999999"
        lbl.save(update_fields=["tracking_number"])
        cls = classify_label_document(lbl)
        self.assertEqual(cls["document_class"], "qa_simulation")
        self.assertTrue(cls["is_qa_simulation"])
        self.assertFalse(cls["is_official_courier_label"])
        self.assertFalse(cls["deducts_wms_inventory"])
        self.assertFalse(cls["is_official_dte"])

        # Manifiesto cerrado -> reimpresión determinista byte-a-byte e inmutable ante cambios posteriores
        man = create_shipping_manifest(warehouse=self.wh, carrier=self.chilexpress, actor=self.admin)
        add_shipment_to_manifest(man, shp)
        man = close_shipping_manifest(man, actor=self.admin)
        _, sha1 = render_shipping_manifest_pdf(man)
        _, sha2 = render_shipping_manifest_pdf(man)
        self.assertEqual(sha1, sha2)

        # Mutar envío posterior al cierre no altera closed_snapshot ni SHA del manifiesto
        shp.tracking_number = "MODIFIED-AFTER-CLOSE"
        shp.save(update_fields=["tracking_number"])
        _, sha3 = render_shipping_manifest_pdf(man)
        self.assertEqual(sha1, sha3)

    def test_log10_accept_03_04_oms_wms_rollback_partial_and_workshop_isolation(self):
        """LOG10-ACCEPT-03 & 04: Rollback en despacho, cancelación post-despacho sin restitución, RBAC y taller aislado."""
        from unittest.mock import patch
        from apps.orders.oms_services import OMSServiceError, transition_order_dimensions

        order, _ = self._create_paid_reserved_order()
        shp = create_shipment_for_order(order, warehouse=self.wh, carrier=self.chilexpress, actor=self.admin)
        add_package_to_shipment(shp, gross_weight_kg=Decimal("1.5"), length_cm=Decimal("20"), width_cm=Decimal("20"), height_cm=Decimal("20"))
        man = create_shipping_manifest(warehouse=self.wh, carrier=self.chilexpress, actor=self.admin)
        add_shipment_to_manifest(man, shp)
        man = close_shipping_manifest(man, actor=self.admin)

        stock_before = WarehouseStock.objects.get(warehouse=self.wh, product=self.product).physical_quantity

        # Fallo intermedio en handover -> rollback íntegro
        with patch("apps.orders.logistics_services.confirm_physical_dispatch_once", side_effect=RuntimeError("Fallo simulado")):
            with self.assertRaises(RuntimeError):
                handover_shipping_manifest(man, handover_evidence="Retiro fallido", actor=self.admin)
        man.refresh_from_db()
        self.assertEqual(man.status, ShippingManifest.Status.CLOSED)
        self.assertEqual(WarehouseStock.objects.get(warehouse=self.wh, product=self.product).physical_quantity, stock_before)

        # Handover exitoso descuenta 1 vez; cancelación posterior bloqueada sin RMA y NO restituye stock
        handover_shipping_manifest(man, handover_evidence="Retiro OK", actor=self.admin)
        stock_after_dispatch = WarehouseStock.objects.get(warehouse=self.wh, product=self.product).physical_quantity
        self.assertEqual(stock_after_dispatch, stock_before - 1)
        with self.assertRaises(OMSServiceError):
            transition_order_dimensions(order, commercial_status=CommercialStatus.CANCELLED.value, reason="Cancelación post despacho", actor=self.admin)
        self.assertEqual(WarehouseStock.objects.get(warehouse=self.wh, product=self.product).physical_quantity, stock_after_dispatch)

        # LOG10-ACCEPT-04: Serial no vendido -> pending_verification; RBAC bloquea buyer; taller no suma stock vendible
        unsold = validate_serial_warranty(serial_number="SN-NO-VENDIDO-999")
        self.assertEqual(unsold["status"], "pending_verification")

        buyer_client = APIClient()
        buyer_client.force_authenticate(user=self.buyer)
        self.assertEqual(buyer_client.get("/api/v1/admin/logistics/warranties/").status_code, 403)
        self.assertEqual(buyer_client.post("/api/v1/admin/logistics/warranties/validate/", {"serial_number": "SN-NO-VENDIDO-999"}, format="json").status_code, 403)

        stock_before_rwo = WarehouseStock.objects.get(warehouse=self.wh, product=self.product).physical_quantity
        rwo = create_repair_work_order(
            equipment_model=self.product.name,
            reported_symptoms="Ruido en entrada",
            serial_number="SN-CLIENTE-EXT-1",
            product=self.product,
            actor=self.admin,
        )
        self.assertEqual(WarehouseStock.objects.get(warehouse=self.wh, product=self.product).physical_quantity, stock_before_rwo)
        self.assertIsNone(rwo.rma_id)

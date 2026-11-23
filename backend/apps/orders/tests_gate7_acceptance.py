# apps/orders/tests_gate7_acceptance.py
"""
LEVELPRO OS V4.0 — GATE 7 FINAL ACCEPTANCE TESTS
Cobertura dirigida para:
- OMS-ACCEPT-01: Coherencia de Estados 3D vs Legacy y Señales/Webhooks de Pago.
- OMS-ACCEPT-02: Seguridad, Integridad Criptográfica, Expiración, Revocación e Idempotencia WhatsApp.
- OMS-ACCEPT-03: RMA Parcial, Repetición Idempotente, Rechazo Sin Reingreso y Evidencia de Reembolso.
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.analytics.models import IncomeRecord
from apps.inventory.models import InventoryMovement, StockReservation, Warehouse, WarehouseStock
from apps.orders.models import (
    DraftOrder,
    Order,
    OrderItem,
    OrderStatus,
    ReturnMerchandiseAuthorization,
    RMAItem,
)
from apps.orders.oms_services import (
    OMSServiceError,
    authorize_or_reject_rma,
    cancel_or_expire_draft_order,
    convert_draft_order_to_order,
    create_manual_draft_order,
    create_rma_request,
    generate_whatsapp_checkout_link,
    receive_and_inspect_rma,
    resolve_rma_refund,
    resolve_whatsapp_checkout_token,
    transition_order_dimensions,
)
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.procurement.models import CostConsumptionRecord, CostLayer, WeightedAverageCostState
from apps.products.models import Brand, Category, Product
from core.contracts.states import (
    CommercialStatus,
    FinancialStatus,
    FulfillmentStatus,
    OrderStateContract,
)
from core.rbac.constants import (
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_WAREHOUSE,
)

User = get_user_model()


class Gate7AcceptanceTests(TransactionTestCase):
    def setUp(self):
        call_command("setup_rbac")
        self.cat = Category.objects.create(name="Consolas", slug="consolas-accept")
        self.brand = Brand.objects.create(name="Allen & Heath", slug="ah-accept")

        Warehouse.objects.filter(is_default=True).update(is_default=False)
        self.wh = Warehouse.objects.create(
            code="WH-ACC-01",
            name="Bodega Central QA",
            is_default=True,
            is_active=True,
        )

        self.sales_user = User.objects.create_user(
            username="sales_acc", email="sales.acc@levelpro.cl", password="pw", is_staff=True
        )
        self.fin_user = User.objects.create_user(
            username="fin_acc", email="fin.acc@levelpro.cl", password="pw", is_staff=True
        )
        self.wh_user = User.objects.create_user(
            username="wh_acc", email="wh.acc@levelpro.cl", password="pw", is_staff=True
        )
        self.mgmt_user = User.objects.create_user(
            username="mgmt_acc", email="mgmt.acc@levelpro.cl", password="pw", is_staff=True
        )
        self.customer = User.objects.create_user(
            username="cliente_acc", email="cliente.acc@levelpro.cl", password="pw", is_staff=False
        )

        for usr, role_code in [
            (self.sales_user, ROLE_SALES),
            (self.fin_user, ROLE_FINANCE),
            (self.wh_user, ROLE_WAREHOUSE),
            (self.mgmt_user, ROLE_MANAGEMENT),
        ]:
            usr.groups.add(Group.objects.get(name=role_code))

        self.prod = Product.objects.create(
            name="SQ-5 Mixer",
            slug="sq-5-mixer-accept",
            sku="AH-SQ5-ACC",
            category=self.cat,
            brand=self.brand,
            price=Decimal("2500000.00"),
            cost_price=Decimal("1600000.00"),
            stock=5,
            product_type=Product.ProductType.STOCK,
            is_active=True,
        )
        self.ws = WarehouseStock.objects.create(
            warehouse=self.wh,
            product=self.prod,
            physical_quantity=5,
            reserved_quantity=0,
            non_sellable_quantity=0,
        )
        CostLayer.objects.create(
            layer_code="CL-ACC-01",
            costing_method=CostLayer.CostingMethod.WEIGHTED_AVERAGE,
            status=CostLayer.Status.FINALIZED,
            product=self.prod,
            sku_snapshot=self.prod.sku,
            warehouse=self.wh,
            source_document_type="INITIAL",
            source_document_id="INIT-ACC-1",
            acquisition_currency="CLP",
            valuation_currency="CLP",
            quantity_received=5,
            quantity_available=5,
            original_unit_cost=Decimal("1600000.0000"),
            base_unit_cost=Decimal("1600000.0000"),
            landed_unit_cost=Decimal("1600000.0000"),
            total_layer_cost=Decimal("8000000.00"),
            remaining_layer_value=Decimal("8000000.00"),
            is_finalized=True,
        )
        WeightedAverageCostState.objects.create(
            product=self.prod,
            currency="CLP",
            sellable_quantity=5,
            total_quantity=5,
            sellable_value=Decimal("8000000.00"),
            total_value=Decimal("8000000.00"),
            average_unit_cost=Decimal("1600000.0000"),
        )

    def test_oms_accept_01_3d_state_coherence_and_legacy_signals(self):
        """
        OMS-ACCEPT-01: Verifica paridad exacta entre core/contracts/states.py, Order 3D,
        Order.save() legacy y señales de Payment (pagos tardíos en orden cancelada -> IN_REVIEW).
        """
        # 1. Paridad exacta de enums vs Order model choices
        self.assertEqual(
            {c.value for c in CommercialStatus},
            set(Order.CommercialStatusChoices.values),
        )
        self.assertEqual(
            {f.value for f in FinancialStatus},
            set(Order.FinancialStatusChoices.values),
        )
        self.assertEqual(
            {l.value for l in FulfillmentStatus},
            set(Order.FulfillmentStatusChoices.values),
        )

        # 2. Sincronización legacy -> 3D en Order.save()
        order = Order.objects.create(
            user=self.customer,
            email=self.customer.email,
            shipping_address="Av. Providencia 1234",
            total=Decimal("2500000.00"),
            currency="CLP",
            status=OrderStatus.PENDING,
        )
        self.assertEqual(order.commercial_status, CommercialStatus.CONFIRMED.value)
        self.assertEqual(order.financial_status, FinancialStatus.PENDING.value)
        self.assertEqual(order.fulfillment_status, FulfillmentStatus.ALLOCATED.value)

        # Cancelación de orden pagada preserva financial_status=paid y marca commercial_status=cancelled
        order.status = OrderStatus.PAID
        order.save()
        order.refresh_from_db()
        self.assertEqual(order.financial_status, FinancialStatus.PAID.value)

        order.status = OrderStatus.CANCELLED
        order.save()
        order.refresh_from_db()
        self.assertEqual(order.commercial_status, CommercialStatus.CANCELLED.value)
        self.assertEqual(order.financial_status, FinancialStatus.PAID.value)

        # 3. Señal legacy de pago aprobado sobre orden cancelada -> deriva a IN_REVIEW y no reabre orden
        cancelled_order = Order.objects.create(
            user=self.customer,
            email=self.customer.email,
            shipping_address="Av. Apoquindo 4500",
            total=Decimal("2500000.00"),
            currency="CLP",
            status=OrderStatus.CANCELLED,
        )
        late_payment = Payment.objects.create(
            order=cancelled_order,
            provider=PaymentProvider.MERCADOPAGO_CL,
            status=PaymentStatus.APPROVED,
            amount=Decimal("2500000.00"),
            currency="CLP",
            external_id="mp-late-acc-001",
        )
        late_payment.refresh_from_db()
        cancelled_order.refresh_from_db()
        self.assertEqual(late_payment.status, PaymentStatus.IN_REVIEW)
        self.assertEqual(cancelled_order.status, OrderStatus.CANCELLED)
        self.assertEqual(cancelled_order.commercial_status, CommercialStatus.CANCELLED.value)

    def test_oms_accept_02_whatsapp_security_expiration_revocation_and_idempotency(self):
        """
        OMS-ACCEPT-02: Verifica integridad HMAC-SHA256, expiración efectiva, revocación,
        rechazo de borrador cancelado, inmutabilidad de precios/moneda, revalidación de stock,
        ausencia de PII en URL/respuesta pública y conversión idempotente sin reutilización indebida.
        """
        draft = create_manual_draft_order(
            customer_name="Cliente Privado SA",
            customer_email="privado@cliente.cl",
            customer_phone="+56987654321",
            customer_tax_id="76.123.456-7",
            shipping_address="Calle Secreta 999, Santiago",
            currency="CLP",
            items=[{"product_id": self.prod.id, "quantity": 1}],
            reserve_inventory=False,
            internal_notes="Margen confidencial 35%",
            actor=self.sales_user,
        )
        link_data = generate_whatsapp_checkout_link(draft, expires_in_hours=24, actor=self.sales_user)
        token = link_data["checkout_token"]
        checkout_url = link_data["checkout_url"]

        # 1. Ausencia de PII en URL
        for sensitive in ["privado@cliente.cl", "+56987654321", "76.123.456-7", "Calle Secreta 999", "2500000"]:
            self.assertNotIn(sensitive, checkout_url)

        # 2. Ausencia de PII y costos en endpoint público
        anon = APIClient()
        res_pub = anon.get(f"/api/v1/orders/whatsapp/{token}/")
        self.assertEqual(res_pub.status_code, 200)
        pub_json = res_pub.json()
        for forbidden_key in ["customer_email", "customer_phone", "customer_tax_id", "shipping_address", "internal_notes"]:
            self.assertNotIn(forbidden_key, pub_json)
        self.assertEqual(pub_json["total"], "2500000.00")

        # 3. Rechazo de token manipulado
        tampered = token[:-4] + "XXXX"
        res_tampered = anon.get(f"/api/v1/orders/whatsapp/{tampered}/")
        self.assertEqual(res_tampered.status_code, 400)

        # 4. Rechazo de enlace revocado (regenerado o limpiado)
        draft.refresh_from_db()
        link_data_2 = generate_whatsapp_checkout_link(draft, expires_in_hours=24, actor=self.sales_user)
        res_revoked = anon.get(f"/api/v1/orders/whatsapp/{token}/")
        self.assertEqual(res_revoked.status_code, 400)
        token = link_data_2["checkout_token"]

        # 5. Expiración efectiva en backend
        DraftOrder.objects.filter(pk=draft.pk).update(
            checkout_token_expires_at=timezone.now() - timedelta(minutes=1)
        )
        res_expired = anon.get(f"/api/v1/orders/whatsapp/{token}/")
        self.assertEqual(res_expired.status_code, 400)

        # Restaurar vigencia y probar cancelación
        DraftOrder.objects.filter(pk=draft.pk).update(
            checkout_token_expires_at=timezone.now() + timedelta(hours=24)
        )
        cancel_or_expire_draft_order(draft, reason="Cancelado por prueba", actor=self.sales_user)
        res_cancelled = anon.get(f"/api/v1/orders/whatsapp/{token}/")
        self.assertEqual(res_cancelled.status_code, 400)

        # 6. Nuevo borrador: inmutabilidad de precios/cantidades/moneda desde payload y revalidación de stock
        draft2 = create_manual_draft_order(
            customer_name="Cliente Dos",
            customer_email="dos@cliente.cl",
            currency="CLP",
            items=[{"product_id": self.prod.id, "quantity": 1}],
            reserve_inventory=False,
            actor=self.sales_user,
        )
        token2 = generate_whatsapp_checkout_link(draft2, expires_in_hours=24, actor=self.sales_user)["checkout_token"]

        # Dejar stock en 0 para verificar revalidación al convertir
        self.ws.physical_quantity = 0
        self.ws.save(update_fields=["physical_quantity"])
        res_no_stock = anon.post(
            f"/api/v1/orders/whatsapp/{token2}/checkout/",
            {"shipping_address": "Nueva Dir 100"},
            format="json",
        )
        self.assertEqual(res_no_stock.status_code, 400)

        # Restaurar stock y enviar payload malicioso intentando cambiar precio/moneda/cantidad
        self.ws.physical_quantity = 5
        self.ws.save(update_fields=["physical_quantity"])
        res_conv1 = anon.post(
            f"/api/v1/orders/whatsapp/{token2}/checkout/",
            {
                "shipping_address": "Av. Nueva 200",
                "total": "1.00",
                "currency": "USD",
                "items": [{"product_id": str(self.prod.id), "quantity": 99, "unit_price": "1.00"}],
            },
            format="json",
        )
        self.assertEqual(res_conv1.status_code, 200)
        order_id = res_conv1.json()["order_id"]
        created_order = Order.objects.get(pk=order_id)
        self.assertEqual(created_order.total, Decimal("2500000.00"))
        self.assertEqual(created_order.currency, "CLP")
        self.assertEqual(created_order.items.first().quantity, 1)

        # 7. Idempotencia en reintento con misma clave vs rechazo con distinta clave tras conversión
        res_conv_dup = anon.post(
            f"/api/v1/orders/whatsapp/{token2}/checkout/",
            {"shipping_address": "Av. Nueva 200"},
            format="json",
        )
        self.assertEqual(res_conv_dup.status_code, 200)
        self.assertEqual(res_conv_dup.json()["order_id"], order_id)

        with self.assertRaises(OMSServiceError):
            convert_draft_order_to_order(
                DraftOrder.objects.get(pk=draft2.pk),
                idempotency_key="different-key-after-conversion",
            )

    def test_oms_accept_03_partial_rma_idempotent_inspection_non_restock_and_refund_evidence(self):
        """
        OMS-ACCEPT-03: Verifica devolución parcial de orden multi-unidad, bloqueo de exceso,
        repetición idempotente de inspección con idempotency_key, no-reingreso (do_not_restock),
        conservación de CostConsumptionRecord y prohibición de reembolso ejecutado sin evidencia.
        """
        draft = create_manual_draft_order(
            customer_name="Comprador Multi",
            customer_email="multi@cliente.cl",
            shipping_address="Av. Italia 500",
            currency="CLP",
            items=[{"product_id": self.prod.id, "quantity": 3}],
            reserve_inventory=True,
            actor=self.sales_user,
        )
        order = convert_draft_order_to_order(draft, idempotency_key="acc-multi-01", actor=self.sales_user)
        transition_order_dimensions(
            order,
            financial_status=FinancialStatus.PAID.value,
            actor=self.fin_user,
        )
        order.refresh_from_db()
        transition_order_dimensions(
            order,
            fulfillment_status=FulfillmentStatus.SHIPPED.value,
            shipping_carrier="Starken",
            tracking_number="STK-ACC-999",
            actor=self.wh_user,
        )
        order.refresh_from_db()
        oi = order.items.first()
        ccr_count_before = CostConsumptionRecord.objects.filter(order_item=oi).count()
        self.assertGreaterEqual(ccr_count_before, 1)

        # 1. Prohibido devolver cantidad mayor a la comprada/despachada
        with self.assertRaises(OMSServiceError):
            create_rma_request(
                order=order,
                items=[{"order_item_id": oi.id, "quantity_requested": 4}],
                actor=self.sales_user,
            )

        # 2. Devolución parcial (1 de 3 unidades) -> orden sigue SHIPPED (no RETURNED)
        rma1 = create_rma_request(
            order=order,
            items=[{"order_item_id": oi.id, "quantity_requested": 1}],
            reason_code=ReturnMerchandiseAuthorization.ReasonCode.COMMERCIAL_CHANGE,
            actor=self.sales_user,
        )
        authorize_or_reject_rma(rma1, approve=True, actor=self.mgmt_user)
        rma1_item = rma1.items.first()

        # Exceso acumulado (1 en rma1 + 3 nuevos > 3) -> bloqueado
        with self.assertRaises(OMSServiceError):
            create_rma_request(
                order=order,
                items=[{"order_item_id": oi.id, "quantity_requested": 3}],
                actor=self.sales_user,
            )

        # Inspección y reingreso idempotente (primera vez y repetición con idempotency_key)
        inspect_payload = [
            {
                "rma_item_id": str(rma1_item.id),
                "quantity_received": 1,
                "condition_status": RMAItem.ConditionStatus.SELLABLE_GOOD,
                "restock_decision": RMAItem.RestockDecision.RESTOCK_SELLABLE,
            }
        ]
        receive_and_inspect_rma(
            rma1,
            inspections=inspect_payload,
            idempotency_key="idem-insp-rma1",
            actor=self.wh_user,
        )
        self.ws.refresh_from_db()
        self.assertEqual(self.ws.physical_quantity, 3)  # 5 - 3 despachados + 1 devuelto = 3

        # Repetición idempotente con misma clave no duplica movimiento ni stock
        receive_and_inspect_rma(
            rma1,
            inspections=inspect_payload,
            idempotency_key="idem-insp-rma1",
            actor=self.wh_user,
        )
        self.ws.refresh_from_db()
        self.assertEqual(self.ws.physical_quantity, 3)
        self.assertEqual(
            InventoryMovement.objects.filter(
                source_document_type="RMA",
                source_document_id=str(rma1.id),
                movement_type=InventoryMovement.MovementType.RETURN_IN,
            ).count(),
            1,
        )
        order.refresh_from_db()
        self.assertEqual(order.fulfillment_status, FulfillmentStatus.SHIPPED.value)
        self.assertEqual(CostConsumptionRecord.objects.filter(order_item=oi).count(), ccr_count_before)

        # 3. Unidad rechazada / do_not_restock -> NO incrementa stock ni crea capa compensatoria
        rma2 = create_rma_request(
            order=order,
            items=[{"order_item_id": oi.id, "quantity_requested": 1}],
            reason_code=ReturnMerchandiseAuthorization.ReasonCode.DEFECTIVE,
            actor=self.sales_user,
        )
        authorize_or_reject_rma(rma2, approve=True, actor=self.mgmt_user)
        rma2_item = rma2.items.first()
        receive_and_inspect_rma(
            rma2,
            inspections=[
                {
                    "rma_item_id": str(rma2_item.id),
                    "quantity_received": 1,
                    "condition_status": RMAItem.ConditionStatus.DAMAGED_NON_SELLABLE,
                    "restock_decision": RMAItem.RestockDecision.DO_NOT_RESTOCK,
                }
            ],
            actor=self.wh_user,
        )
        self.ws.refresh_from_db()
        self.assertEqual(self.ws.physical_quantity, 3)
        rma2_item.refresh_from_db()
        self.assertFalse(rma2_item.is_restocked)
        self.assertIsNone(rma2_item.compensatory_cost_layer_id)

        # 4. Prohibición de marcar reembolso como ejecutado sin evidencia (reference vacío)
        with self.assertRaises(OMSServiceError):
            resolve_rma_refund(
                rma1,
                refund_amount=Decimal("2500000.00"),
                execute_now=True,
                provider="transfer",
                reference="",
                actor=self.fin_user,
            )

        # Aprobación pendiente de ejecución (execute_now=False) sí procede sin reference
        resolve_rma_refund(
            rma1,
            refund_amount=Decimal("2500000.00"),
            execute_now=False,
            provider="transfer",
            reference="",
            actor=self.fin_user,
        )
        rma1.refresh_from_db()
        self.assertEqual(
            rma1.refund_status,
            ReturnMerchandiseAuthorization.RefundStatus.APPROVED_PENDING_EXECUTION,
        )

        # Con evidencia explícita (provider + reference), sí ejecuta
        resolve_rma_refund(
            rma1,
            refund_amount=Decimal("2500000.00"),
            execute_now=True,
            provider="transfer",
            reference="TRF-BCH-884411",
            idempotency_key="idem-ref-rma1-acc",
            actor=self.fin_user,
        )
        rma1.refresh_from_db()
        self.assertEqual(rma1.refund_status, ReturnMerchandiseAuthorization.RefundStatus.EXECUTED)
        self.assertEqual(rma1.refund_reference, "TRF-BCH-884411")

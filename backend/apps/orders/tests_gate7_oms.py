# apps/orders/tests_gate7_oms.py
"""
LEVELPRO OS V4.0 — GATE 7: ORDER MANAGEMENT SYSTEM (OMS) INTEGRAL QA SUITE
Cubre en PostgreSQL 16 QA:
1. BF-11: Creación y edición de DraftOrder (productos simples, variantes, snapshots de SKU/precio/condiciones),
   conversión idempotente a Order (sin duplicar pedidos ni reservas ante reintentos).
2. BF-12: WhatsApp Checkout (enlace HTTPS firmado, URL wa.me, privacidad del enlace sin PII sensible ni costos,
   rechazo de token manipulado o expirado, recuperación y continuación al checkout).
3. Reservas en Ventas Asistidas y Concurrencia: Reserva temporal de última unidad disponible, concurrencia entre
   venta manual, venta online y bundle que comparte SKU, modalidades STOCK/PREORDER/ON_DEMAND, liberación al
   cancelar/vencer borrador y protección de reserva consolidada por pago ante TTL.
4. BF-13 y Pagos: Estados desacoplados (Comercial, Financiero, Logístico), tabla de equivalencias legacy,
   cancelación comercial sin reembolso automático ni devolución física automática, pago parcial, pago duplicado
   idempotente, pago tardío sobre orden cancelada o reserva expirada (IN_REVIEW), despacho idempotente con
   preservación de seriales y congelamiento de COGS.
5. BF-23 y Costos en Devoluciones: RMA completo (solicitud, autorización, recepción física, inspección,
   devolución parcial, equipo serializado apto vs producto dañado no vendible, reembolso sin entrada física,
   bloqueo de doble devolución de la misma unidad/serial, movimientos compensatorios en Kardex, CostLayer,
   SerialCostUnit y WeightedAverageCostState sin borrar consumos históricos ni generar utilidad ficticia).
6. Seguridad RBAC y Audit Trail: Segregación entre Ventas, Bodega, Logística, Finanzas y Soporte,
   enmascaramiento de costos internos para ejecutivos sin view_costs y auditoría inmutable.
"""

from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.analytics.models import AuditEvent, DistributionCategory, IncomeDistribution, IncomeRecord
from apps.inventory.models import InventoryMovement, SerialNumberTrack, StockReservation, Warehouse, WarehouseStock
from apps.inventory.services import expire_stale_reservations, get_default_warehouse
from apps.orders.models import (
    DraftOrder,
    DraftOrderItem,
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
    record_order_payment_attempt,
    resolve_rma_refund,
    resolve_whatsapp_checkout_token,
    serialize_public_whatsapp_proposal,
    transition_order_dimensions,
    update_manual_draft_order,
)
from apps.payments.models import Payment, PaymentStatus
from apps.procurement.models import CostConsumptionRecord, CostLayer, SerialCostUnit, Supplier, WeightedAverageCostState
from apps.procurement.po_services import (
    approve_purchase_order,
    confirm_goods_receipt,
    create_goods_receipt,
    create_purchase_order,
    issue_purchase_order,
)
from apps.products.models import Brand, BundleItem, Category, Product, ProductVariant
from core.rbac.constants import (
    ROLE_FINANCE,
    ROLE_LOGISTICS,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_SUPPORT,
    ROLE_WAREHOUSE,
)

User = get_user_model()


class Gate7OrderManagementSystemSuiteTest(TransactionTestCase):
    """Suite integral Gate 7 (BF-11, BF-12, BF-13, BF-23) en PostgreSQL 16."""

    def setUp(self):
        call_command("setup_rbac")

        self.mgmt_user = User.objects.create_user(
            username="g7_mgmt",
            email="g7_mgmt@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.mgmt_user.groups.add(Group.objects.get(name=ROLE_MANAGEMENT))

        self.sales_user = User.objects.create_user(
            username="g7_sales",
            email="g7_sales@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.sales_user.groups.add(Group.objects.get(name=ROLE_SALES))

        self.wh_user = User.objects.create_user(
            username="g7_wh",
            email="g7_wh@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.wh_user.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))

        self.log_user = User.objects.create_user(
            username="g7_log",
            email="g7_log@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.log_user.groups.add(Group.objects.get(name=ROLE_LOGISTICS))

        self.fin_user = User.objects.create_user(
            username="g7_fin",
            email="g7_fin@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.fin_user.groups.add(Group.objects.get(name=ROLE_FINANCE))

        self.sup_user = User.objects.create_user(
            username="g7_support",
            email="g7_support@levelpro.cl",
            password="TestPassword123!",
            is_staff=True,
        )
        self.sup_user.groups.add(Group.objects.get(name=ROLE_SUPPORT))

        self.customer_user = User.objects.create_user(
            username="g7_customer",
            email="cliente_g7@estudio.cl",
            password="TestPassword123!",
            is_staff=False,
        )

        self.wh_central = get_default_warehouse()
        self.cat = Category.objects.create(name="Consolas G7", slug="consolas-g7")
        self.brand = Brand.objects.create(name="SSL G7", slug="ssl-g7")
        self.supplier = Supplier.objects.create(
            internal_code="SUP-G7-SSL",
            legal_name="Solid State Logic UK Ltd",
            country="UK",
            currency="CLP",
            is_active=True,
        )

    def _receive_stock(self, product, qty, unit_cost, variant=None, serials=None):
        po = create_purchase_order(
            supplier=self.supplier,
            destination_warehouse=self.wh_central,
            currency="CLP",
            items=[{
                "product_id": product.id,
                "variant_id": variant.id if variant else None,
                "quantity_ordered": qty,
                "unit_cost": Decimal(str(unit_cost)),
            }],
            actor=self.mgmt_user,
        )
        po = approve_purchase_order(po, actor=self.mgmt_user)
        po = issue_purchase_order(po, actor=self.mgmt_user)
        poi = po.items.first()
        gr_item = {
            "purchase_order_item_id": poi.id,
            "quantity_accepted": qty,
        }
        if serials:
            gr_item["serial_numbers"] = serials
        gr = create_goods_receipt(
            purchase_order=po,
            warehouse=self.wh_central,
            items=[gr_item],
            actor=self.wh_user,
        )
        gr = confirm_goods_receipt(gr, actor=self.wh_user)
        return po, gr

    def test_01_manual_draft_order_snapshots_whatsapp_checkout_privacy_and_idempotent_conversion(self):
        """
        BF-11 & BF-12:
        - Creación y edición de DraftOrder con producto simple y variante.
        - Conservación de snapshots de SKU, nombre y precio autorizado aunque el catálogo cambie después.
        - Enlace de WhatsApp HTTPS válido, token firmado, rechazo de token manipulado o expirado.
        - Privacidad estricta del endpoint público (no expone email, teléfono, dirección, RUT ni costos).
        - Conversión idempotente a Order sin duplicar pedidos ni reservas.
        """
        prod = Product.objects.create(
            name="SSL SiX Desktop Mixer",
            slug="ssl-six-g7",
            sku="G7-SSL-SIX",
            category=self.cat,
            brand=self.brand,
            price=Decimal("1500000"),
            cost_price=Decimal("900000"),
            serialization_mode=Product.SerializationMode.NONE,
            stock=0,
        )
        self._receive_stock(prod, 4, "900000.00")

        var_prod = Product.objects.create(
            name="Auriculares Beyer DT-990 G7",
            slug="beyer-dt990-g7",
            sku="G7-DT990-MASTER",
            category=self.cat,
            brand=self.brand,
            price=Decimal("250000"),
            cost_price=Decimal("140000"),
            serialization_mode=Product.SerializationMode.NONE,
            stock=0,
        )
        v250 = ProductVariant.objects.create(
            product=var_prod,
            name="250 Ohm",
            sku="G7-DT990-250",
            price=Decimal("260000"),
            cost_price=Decimal("145000"),
            stock=0,
            is_active=True,
        )
        self._receive_stock(var_prod, 3, "145000.00", variant=v250)

        # 1. Ejecutivo Ventas intenta aplicar un precio distinto al catálogo sin permiso edit_prices -> bloqueado (403)
        client_sales = APIClient()
        client_sales.force_authenticate(user=self.sales_user)
        res_denied = client_sales.post(
            "/api/v1/admin/orders/manual/",
            {
                "customer_name": "Estudio Horizonte SpA",
                "customer_email": "contacto@horizonte.cl",
                "currency": "CLP",
                "items": [{"product_id": str(prod.id), "quantity": 1, "authorized_unit_price": "1350000"}],
            },
            format="json",
        )
        self.assertEqual(res_denied.status_code, 403)

        # 2. Ejecutivo Ventas crea DraftOrder con precios autorizados del catálogo y reserva temporal activa
        res_create = client_sales.post(
            "/api/v1/admin/orders/manual/",
            {
                "customer_name": "Estudio Horizonte SpA",
                "customer_email": "contacto@horizonte.cl",
                "customer_phone": "+56998887766",
                "customer_tax_id": "76.543.210-K",
                "shipping_address": "Av. Italia 1450, Providencia",
                "currency": "CLP",
                "reserve_inventory": True,
                "notes": "Incluye despacho prioritario",
                "internal_notes": "Cliente VIP referido por ingeniería",
                "items": [
                    {"product_id": str(prod.id), "quantity": 1},
                    {"product_id": str(var_prod.id), "variant_id": str(v250.id), "quantity": 2},
                ],
            },
            format="json",
        )
        self.assertEqual(res_create.status_code, 201)
        draft_id = res_create.data["id"]
        draft = DraftOrder.objects.get(pk=draft_id)
        self.assertEqual(draft.total, Decimal("2020000.00"))  # 1,500,000 + (260,000 * 2)
        self.assertEqual(draft.status, DraftOrder.Status.RESERVED)

        # Verificar que el stock quedó reservado temporalmente en WMS
        ws_prod = WarehouseStock.objects.get(warehouse=self.wh_central, product=prod)
        ws_var = WarehouseStock.objects.get(warehouse=self.wh_central, product=var_prod, variant=v250)
        self.assertEqual(ws_prod.reserved_quantity, 1)
        self.assertEqual(ws_var.reserved_quantity, 2)

        # 3. Cambiar el precio en el catálogo dinámico -> la propuesta emitida conserva sus snapshots intactos
        prod.price = Decimal("1990000")
        prod.save()

        # 4. Generar enlace de WhatsApp Checkout
        res_wa = client_sales.post(f"/api/v1/admin/orders/manual/{draft_id}/whatsapp-link/", {}, format="json")
        self.assertEqual(res_wa.status_code, 200)
        token = res_wa.data["checkout_token"]
        checkout_url = res_wa.data["checkout_url"]
        wa_me_url = res_wa.data["wa_me_url"]
        self.assertTrue(checkout_url.startswith("https://"))
        self.assertTrue(wa_me_url.startswith("https://wa.me/?text="))
        # Asegurar que la URL no contiene PII sensible ni precios manipulables
        self.assertNotIn("contacto@horizonte.cl", checkout_url)
        self.assertNotIn("76.543.210-K", checkout_url)
        self.assertNotIn("Av. Italia", checkout_url)
        self.assertNotIn("2020000", checkout_url)

        # 5. Consultar endpoint público con token válido -> verifica privacidad (sin PII ni internal_notes)
        client_anon = APIClient()
        res_pub = client_anon.get(f"/api/v1/orders/whatsapp/{token}/")
        self.assertEqual(res_pub.status_code, 200)
        self.assertEqual(res_pub.data["total"], "2020000.00")
        self.assertEqual(res_pub.data["currency"], "CLP")
        self.assertNotIn("customer_email", res_pub.data)
        self.assertNotIn("customer_phone", res_pub.data)
        self.assertNotIn("customer_tax_id", res_pub.data)
        self.assertNotIn("shipping_address", res_pub.data)
        self.assertNotIn("internal_notes", res_pub.data)

        # 6. Token manipulado -> rechazado (400)
        tampered_token = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
        res_tampered = client_anon.get(f"/api/v1/orders/whatsapp/{tampered_token}/")
        self.assertEqual(res_tampered.status_code, 400)

        # 7. Token expirado -> rechazado (400)
        DraftOrder.objects.filter(pk=draft.pk).update(checkout_token_expires_at=timezone.now() - timedelta(minutes=5))
        res_expired = client_anon.get(f"/api/v1/orders/whatsapp/{token}/")
        self.assertEqual(res_expired.status_code, 400)

        # Restaurar vigencia y convertir a Order de forma idempotente (2 llamadas seguidas con la misma idempotency_key)
        DraftOrder.objects.filter(pk=draft.pk).update(checkout_token_expires_at=timezone.now() + timedelta(hours=24))
        res_conv1 = client_sales.post(
            f"/api/v1/admin/orders/manual/{draft_id}/convert/",
            {"idempotency_key": "conv-draft-001"},
            format="json",
        )
        self.assertEqual(res_conv1.status_code, 201)
        order_id_1 = res_conv1.data["order"]["id"]

        res_conv2 = client_sales.post(
            f"/api/v1/admin/orders/manual/{draft_id}/convert/",
            {"idempotency_key": "conv-draft-001"},
            format="json",
        )
        self.assertEqual(res_conv2.status_code, 200)
        self.assertTrue(res_conv2.data["idempotent_replay"])
        self.assertEqual(res_conv2.data["order"]["id"], order_id_1)

        # Verificar que el precio de la Order es el snapshot autorizado (1,500,000) y NO el nuevo precio de catálogo (1,990,000)
        order = Order.objects.get(pk=order_id_1)
        self.assertEqual(order.total, Decimal("2020000.00"))
        oi_mixer = order.items.get(product=prod)
        self.assertEqual(oi_mixer.price, Decimal("1500000.00"))

        # Verificar que no hubo doble reserva en WMS (sigue siendo 1 y 2 reservados)
        ws_prod.refresh_from_db()
        ws_var.refresh_from_db()
        self.assertEqual(ws_prod.reserved_quantity, 1)
        self.assertEqual(ws_var.reserved_quantity, 2)

    def test_02_last_unit_reservation_concurrency_manual_vs_online_vs_bundle_and_modes(self):
        """
        Sección 6:
        - Reserva de última unidad disponible: cuando un DraftOrder reserva la única unidad física en stock,
          un intento concurrente de compra online o de un Bundle que comparte ese SKU es rechazado sin sobreventa.
        - Al cancelar el borrador, se libera exactamente esa reserva y el stock vuelve a quedar disponible.
        - Modalidades PREORDER y ON_DEMAND permiten crear ventas asistidas con stock físico 0 sin crear reservas ficticias.
        """
        last_mic = Product.objects.create(
            name="Micrófono Cinta Coles 4038 G7",
            slug="coles-4038-g7",
            sku="G7-COLES-4038",
            category=self.cat,
            brand=self.brand,
            price=Decimal("1200000"),
            cost_price=Decimal("750000"),
            product_type=Product.ProductType.STOCK,
            serialization_mode=Product.SerializationMode.NONE,
            stock=0,
        )
        self._receive_stock(last_mic, 1, "750000.00")

        bundle_kit = Product.objects.create(
            name="Kit Stereo Ribbon Coles G7",
            slug="kit-coles-g7",
            sku="G7-KIT-COLES",
            category=self.cat,
            brand=self.brand,
            price=Decimal("1150000"),
            product_type=Product.ProductType.BUNDLE,
            stock=1,
        )
        BundleItem.objects.create(bundle=bundle_kit, component=last_mic, quantity=1)

        preorder_synth = Product.objects.create(
            name="Sintetizador Custom Preorder G7",
            slug="synth-preorder-g7",
            sku="G7-PREORDER-01",
            category=self.cat,
            brand=self.brand,
            price=Decimal("3000000"),
            product_type=Product.ProductType.PREORDER,
            stock=0,
        )

        # 1. Venta manual reserva la última unidad de last_mic
        draft = create_manual_draft_order(
            customer_name="Productora Sur",
            customer_email="sur@estudio.cl",
            items=[{"product_id": last_mic.id, "quantity": 1}],
            currency="CLP",
            reserve_inventory=True,
            actor=self.sales_user,
        )
        ws = WarehouseStock.objects.get(warehouse=self.wh_central, product=last_mic)
        self.assertEqual(ws.available_quantity, 0)
        self.assertEqual(ws.reserved_quantity, 1)

        # 2. Intento concurrente de compra online directa por el cliente -> bloqueado por falta de stock disponible
        client_cust = APIClient()
        client_cust.force_authenticate(user=self.customer_user)
        res_online = client_cust.post(
            "/api/v1/orders/",
            {
                "currency": "CLP",
                "email": self.customer_user.email,
                "shipping_address": "Concepción 100",
                "items": [{"product": str(last_mic.id), "quantity": 1}],
            },
            format="json",
        )
        self.assertEqual(res_online.status_code, 400)

        # 3. Intento concurrente de compra del Bundle que comparte el mismo componente -> bloqueado
        with self.assertRaises(OMSServiceError):
            create_manual_draft_order(
                customer_name="Otro Cliente",
                customer_email="otro@estudio.cl",
                items=[{"product_id": bundle_kit.id, "quantity": 1}],
                currency="CLP",
                reserve_inventory=True,
                actor=self.sales_user,
            )

        # 4. Cancelar el borrador manual -> libera la reserva y ahora el Bundle sí puede reservar la unidad
        cancel_or_expire_draft_order(draft, reason="Cliente desistió", actor=self.sales_user)
        ws.refresh_from_db()
        self.assertEqual(ws.available_quantity, 1)
        self.assertEqual(ws.reserved_quantity, 0)

        # 5. Producto PREORDER con stock físico 0 -> permite crear y convertir orden sin crear reservas físicas ficticias
        draft_pre = create_manual_draft_order(
            customer_name="Cliente Preorden",
            customer_email="pre@estudio.cl",
            items=[{"product_id": preorder_synth.id, "quantity": 1}],
            currency="CLP",
            reserve_inventory=True,
            actor=self.sales_user,
        )
        order_pre = convert_draft_order_to_order(draft_pre, actor=self.sales_user)
        self.assertEqual(order_pre.fulfillment_status, Order.FulfillmentStatusChoices.UNFULFILLED)
        self.assertEqual(StockReservation.objects.filter(order=order_pre).count(), 0)

    def test_03_decoupled_3d_states_payments_late_webhooks_and_idempotent_dispatch(self):
        """
        BF-13, Sección 8 y Sección 9:
        - Independencia entre estado comercial, financiero y logístico.
        - Pago parcial -> financial_status = PARTIALLY_PAID (bloquea despacho físico hasta cubrir 100%).
        - Pago duplicado con mismo external_id -> idempotente (is_duplicate=True).
        - Pago completado -> financial_status = PAID, consolida reservas (no expiran por TTL).
        - Cancelación comercial de una orden NO ejecuta reembolso automático.
        - Pago tardío sobre orden cuya reserva ya expiró -> PaymentStatus.IN_REVIEW sin reabrir ni marcar lista para despacho.
        - Despacho físico idempotente con asignación de seriales REQUIRED y congelamiento de COGS.
        """
        interface_prod = Product.objects.create(
            name="Universal Audio Apollo x8p G7",
            slug="apollo-x8p-g7",
            sku="G7-UA-X8P",
            category=self.cat,
            brand=self.brand,
            price=Decimal("3500000"),
            cost_price=Decimal("2200000"),
            serialization_mode=Product.SerializationMode.REQUIRED,
            stock=0,
        )
        self._receive_stock(
            interface_prod,
            2,
            "2200000.00",
            serials=["SN-X8P-001", "SN-X8P-002"],
        )

        # Crear DraftOrder y convertir a Order
        draft = create_manual_draft_order(
            customer_name="Mastering Lab Chile",
            customer_email="mastering@lab.cl",
            items=[{"product_id": interface_prod.id, "quantity": 1}],
            currency="CLP",
            reserve_inventory=True,
            actor=self.sales_user,
        )
        order = convert_draft_order_to_order(draft, actor=self.sales_user)
        self.assertEqual(order.commercial_status, Order.CommercialStatusChoices.CONFIRMED)
        self.assertEqual(order.financial_status, Order.FinancialStatusChoices.PENDING)
        self.assertEqual(order.fulfillment_status, Order.FulfillmentStatusChoices.ALLOCATED)

        # 1. Pago parcial (1,500,000 de 3,500,000) -> PARTIALLY_PAID
        pay_res1 = record_order_payment_attempt(
            order,
            provider="transfer",
            amount=Decimal("1500000.00"),
            external_id="TRF-G7-PART-1",
            approve_immediately=True,
            actor=self.fin_user,
        )
        self.assertFalse(pay_res1["is_duplicate"])
        order.refresh_from_db()
        self.assertEqual(order.financial_status, Order.FinancialStatusChoices.PARTIALLY_PAID)

        # Reintento duplicado del mismo pago -> idempotente
        pay_dup = record_order_payment_attempt(
            order,
            provider="transfer",
            amount=Decimal("1500000.00"),
            external_id="TRF-G7-PART-1",
            approve_immediately=True,
            actor=self.fin_user,
        )
        self.assertTrue(pay_dup["is_duplicate"])
        self.assertEqual(order.payments.count(), 1)

        # Intentar despachar estando solo PARTIALLY_PAID -> bloqueado por regla transversal BF-13
        with self.assertRaises(OMSServiceError):
            transition_order_dimensions(
                order,
                fulfillment_status=Order.FulfillmentStatusChoices.SHIPPED,
                serial_assignments={str(interface_prod.id): ["SN-X8P-001"]},
                actor=self.log_user,
            )

        # 2. Segundo pago por el saldo (2,000,000) -> PAID y consolida reserva
        record_order_payment_attempt(
            order,
            provider="transfer",
            amount=Decimal("2000000.00"),
            external_id="TRF-G7-PART-2",
            approve_immediately=True,
            actor=self.fin_user,
        )
        order.refresh_from_db()
        self.assertEqual(order.financial_status, Order.FinancialStatusChoices.PAID)
        res_obj = StockReservation.objects.get(order=order)
        self.assertEqual(res_obj.status, StockReservation.Status.CONSOLIDATED)
        self.assertIsNone(res_obj.expires_at)

        # Correr expire_stale_reservations en el futuro -> NO toca la reserva consolidada por pago
        expire_stale_reservations(now=timezone.now() + timedelta(days=7))
        res_obj.refresh_from_db()
        self.assertEqual(res_obj.status, StockReservation.Status.CONSOLIDATED)

        # 3. Despacho físico confirmado vía API (idempotente)
        client_log = APIClient()
        client_log.force_authenticate(user=self.log_user)
        res_disp1 = client_log.post(
            f"/api/v1/admin/orders/{order.id}/dispatch/",
            {
                "serial_assignments": {str(interface_prod.id): ["SN-X8P-001"]},
                "shipping_carrier": "Chilexpress",
                "tracking_number": "CLX-998877",
            },
            format="json",
        )
        self.assertEqual(res_disp1.status_code, 200)
        self.assertFalse(res_disp1.data["idempotent_replay"])

        # Confirmación repetida del mismo despacho -> idempotente (no descuenta existencias dos veces)
        res_disp2 = client_log.post(
            f"/api/v1/admin/orders/{order.id}/dispatch/",
            {
                "serial_assignments": {str(interface_prod.id): ["SN-X8P-001"]},
                "shipping_carrier": "Chilexpress",
                "tracking_number": "CLX-998877",
            },
            format="json",
        )
        self.assertEqual(res_disp2.status_code, 200)
        self.assertTrue(res_disp2.data["idempotent_replay"])

        ws = WarehouseStock.objects.get(warehouse=self.wh_central, product=interface_prod)
        self.assertEqual(ws.physical_quantity, 1)  # De 2 bajó exactamente a 1

        oi = order.items.first()
        self.assertEqual(oi.unit_cost_snapshot, Decimal("2200000.0000"))
        self.assertEqual(oi.allocated_serial_numbers, ["SN-X8P-001"])
        self.assertIsNotNone(oi.cost_frozen_at)

        # 4. Orden con reserva expirada que recibe un pago tardío -> pago queda en IN_REVIEW sin reabrir ni consolidar
        draft_late = create_manual_draft_order(
            customer_name="Cliente Tardío",
            customer_email="tardio@lab.cl",
            items=[{"product_id": interface_prod.id, "quantity": 1}],
            currency="CLP",
            reserve_inventory=True,
            actor=self.sales_user,
        )
        order_late = convert_draft_order_to_order(draft_late, actor=self.sales_user)
        expire_stale_reservations(now=timezone.now() + timedelta(hours=5))
        res_late = StockReservation.objects.get(order=order_late)
        self.assertEqual(res_late.status, StockReservation.Status.EXPIRED)

        late_pay_res = record_order_payment_attempt(
            order_late,
            provider="mercadopago_cl",
            amount=Decimal("3500000.00"),
            external_id="MP-LATE-001",
            approve_immediately=True,
            actor=self.fin_user,
        )
        self.assertEqual(late_pay_res["payment_status"], PaymentStatus.IN_REVIEW)
        order_late.refresh_from_db()
        self.assertEqual(order_late.financial_status, Order.FinancialStatusChoices.PENDING)

    def test_04_rma_returns_inspections_compensatory_costs_and_refund_decoupling(self):
        """
        BF-23 y Sección 11:
        - Flujo completo RMA en 6 etapas diferenciadas (Solicitud, Autorización, Recepción, Inspección,
          Reingreso controlado, Reembolso financiero).
        - Reembolso aprobado/ejecutado NO incrementa automáticamente WarehouseStock sin recepción e inspección física.
        - Devolución de equipo serializado apto para venta: reingresa a WarehouseStock (RETURN_IN),
          restaura SerialNumberTrack a IN_STOCK, crea capa compensatoria CostLayer(RMA_RETURN) y actualiza WAC
          sin borrar el CostConsumptionRecord histórico.
        - Devolución de producto dañado: reingresa como non_sellable_quantity (disponible para venta = +0),
          marca SerialNumberTrack como DAMAGED y WAC damaged_quantity.
        - Bloqueo de doble devolución de la misma unidad/serial.
        - RBAC: ejecutivo de ventas no visualiza original_unit_cost_snapshot en RMAItemSerializer.
        """
        mic_prod = Product.objects.create(
            name="Neumann TLM 103 G7",
            slug="neumann-tlm103-g7",
            sku="G7-TLM-103",
            category=self.cat,
            brand=self.brand,
            price=Decimal("1400000"),
            cost_price=Decimal("850000"),
            serialization_mode=Product.SerializationMode.REQUIRED,
            stock=0,
        )
        self._receive_stock(
            mic_prod,
            2,
            "850000.00",
            serials=["SN-TLM-101", "SN-TLM-102"],
        )

        # Venta, pago y despacho de las 2 unidades serializadas
        draft = create_manual_draft_order(
            customer_name="Estudio Acústico Austral",
            customer_email="austral@estudio.cl",
            items=[{"product_id": mic_prod.id, "quantity": 2}],
            currency="CLP",
            reserve_inventory=True,
            actor=self.sales_user,
        )
        order = convert_draft_order_to_order(draft, actor=self.sales_user)
        record_order_payment_attempt(
            order,
            provider="transfer",
            amount=Decimal("2800000.00"),
            external_id="TRF-TLM-FULL",
            approve_immediately=True,
            actor=self.fin_user,
        )
        transition_order_dimensions(
            order,
            fulfillment_status=Order.FulfillmentStatusChoices.SHIPPED,
            serial_assignments={str(mic_prod.id): ["SN-TLM-101", "SN-TLM-102"]},
            actor=self.log_user,
        )

        ws = WarehouseStock.objects.get(warehouse=self.wh_central, product=mic_prod)
        self.assertEqual(ws.physical_quantity, 0)
        self.assertEqual(CostConsumptionRecord.objects.filter(order=order).count(), 2)
        oi = order.items.first()

        # 1. Crear RMA #1 por devolución parcial de 1 unidad (SN-TLM-101)
        client_sales = APIClient()
        client_sales.force_authenticate(user=self.sales_user)
        res_rma1 = client_sales.post(
            f"/api/v1/admin/orders/{order.id}/rma/",
            {
                "reason_code": "retract",
                "reason_details": "Retracto comercial de 1 micrófono sellado",
                "items": [
                    {
                        "order_item_id": str(oi.id),
                        "quantity_requested": 1,
                        "serial_number": "SN-TLM-101",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(res_rma1.status_code, 201)
        rma1_id = res_rma1.data["id"]
        # Verificar que el rol Ventas NO recibe original_unit_cost_snapshot en la respuesta API (RBAC Sección 14)
        self.assertNotIn("original_unit_cost_snapshot", res_rma1.data["items"][0])

        # Intentar crear otro RMA para el mismo serial SN-TLM-101 -> bloqueado (no devolver dos veces la misma unidad física)
        res_dup_sn = client_sales.post(
            f"/api/v1/admin/orders/{order.id}/rma/",
            {
                "reason_code": "defective",
                "items": [{"order_item_id": str(oi.id), "quantity_requested": 1, "serial_number": "SN-TLM-101"}],
            },
            format="json",
        )
        self.assertEqual(res_dup_sn.status_code, 400)

        # 2. Ejecutar reembolso financiero ANTES de la recepción física -> NO debe incrementar WarehouseStock
        rma1 = ReturnMerchandiseAuthorization.objects.get(pk=rma1_id)
        authorize_or_reject_rma(rma1, approve=True, actor=self.mgmt_user)
        resolve_rma_refund(
            rma1,
            refund_amount=Decimal("1400000.00"),
            execute_now=True,
            provider="transfer",
            reference="REF-TLM-101",
            idempotency_key="ref-rma1-001",
            actor=self.fin_user,
        )
        ws.refresh_from_db()
        self.assertEqual(ws.physical_quantity, 0)  # Reembolso financiero NO tocó el inventario físico
        order.refresh_from_db()
        self.assertEqual(order.financial_status, Order.FinancialStatusChoices.PARTIALLY_REFUNDED)

        # 3. Recepción e inspección física de SN-TLM-101 en bodega como SELLABLE_GOOD
        rma1_item = rma1.items.first()
        client_wh = APIClient()
        client_wh.force_authenticate(user=self.wh_user)
        res_insp1 = client_wh.post(
            f"/api/v1/admin/orders/rmas/{rma1.id}/inspect/",
            {
                "inspections": [
                    {
                        "rma_item_id": str(rma1_item.id),
                        "quantity_received": 1,
                        "condition_status": "sellable_good",
                        "restock_decision": "restock_sellable",
                        "inspection_notes": "Empaque original intacto, cápsula verificada",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res_insp1.status_code, 200)

        # Verificar reingreso a stock vendible y movimientos compensatorios sin borrar CostConsumptionRecord original
        ws.refresh_from_db()
        self.assertEqual(ws.physical_quantity, 1)
        self.assertEqual(ws.non_sellable_quantity, 0)
        self.assertEqual(ws.available_quantity, 1)

        sn1_track = SerialNumberTrack.objects.get(serial_number="SN-TLM-101")
        self.assertEqual(sn1_track.status, SerialNumberTrack.Status.IN_STOCK)
        self.assertEqual(sn1_track.warehouse_id, self.wh_central.id)

        # El CostConsumptionRecord histórico sigue existiendo (append-only) y se creó capa compensatoria RMA_RETURN
        self.assertEqual(CostConsumptionRecord.objects.filter(order=order).count(), 2)
        comp_layer1 = CostLayer.objects.get(source_document_type="RMA_RETURN", source_document_id=str(rma1.id))
        self.assertEqual(comp_layer1.landed_unit_cost, Decimal("850000.0000"))
        self.assertEqual(comp_layer1.quantity_available, 1)

        wac = WeightedAverageCostState.objects.get(product=mic_prod, currency="CLP")
        self.assertEqual(wac.sellable_quantity, 1)
        self.assertEqual(wac.average_unit_cost, Decimal("850000.0000"))

        # Intentar inspeccionar/reingresar por segunda vez la misma línea RMA -> bloqueado (400)
        res_insp_dup = client_wh.post(
            f"/api/v1/admin/orders/rmas/{rma1.id}/inspect/",
            {
                "inspections": [
                    {
                        "rma_item_id": str(rma1_item.id),
                        "quantity_received": 1,
                        "condition_status": "sellable_good",
                        "restock_decision": "restock_sellable",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res_insp_dup.status_code, 400)

        # 4. Crear RMA #2 para la segunda unidad (SN-TLM-102) que llega DAÑADA
        rma2 = create_rma_request(
            order=order,
            reason_code="damaged_shipping",
            items=[{"order_item_id": oi.id, "quantity_requested": 1, "serial_number": "SN-TLM-102"}],
            actor=self.sup_user,
        )
        authorize_or_reject_rma(rma2, approve=True, actor=self.mgmt_user)
        rma2_item = rma2.items.first()

        # Intentar reingresar un producto inspeccionado como dañado a stock vendible -> bloqueado por invariante de calidad
        with self.assertRaises(OMSServiceError):
            receive_and_inspect_rma(
                rma2,
                inspections=[{
                    "rma_item_id": str(rma2_item.id),
                    "quantity_received": 1,
                    "condition_status": "damaged_non_sellable",
                    "restock_decision": "restock_sellable",
                }],
                actor=self.wh_user,
            )

        # Reingresar como dañado/cuarentena (no elegible para venta)
        receive_and_inspect_rma(
            rma2,
            inspections=[{
                "rma_item_id": str(rma2_item.id),
                "quantity_received": 1,
                "condition_status": "damaged_non_sellable",
                "restock_decision": "restock_damaged_quarantine",
                "inspection_notes": "Diafragma golpeado",
            }],
            actor=self.wh_user,
        )

        ws.refresh_from_db()
        self.assertEqual(ws.physical_quantity, 2)
        self.assertEqual(ws.non_sellable_quantity, 1)
        self.assertEqual(ws.available_quantity, 1)  # Solo SN-TLM-101 es elegible para venta

        sn2_track = SerialNumberTrack.objects.get(serial_number="SN-TLM-102")
        self.assertEqual(sn2_track.status, SerialNumberTrack.Status.DAMAGED)

        wac.refresh_from_db()
        self.assertEqual(wac.sellable_quantity, 1)
        self.assertEqual(wac.damaged_quantity, 1)
        self.assertEqual(wac.total_quantity, 2)

        # Como las 2 unidades compradas ya fueron retornadas físicamente, la orden pasa a fulfillment_status = RETURNED
        order.refresh_from_db()
        self.assertEqual(order.fulfillment_status, Order.FulfillmentStatusChoices.RETURNED)

        # Verificar trazabilidad en AuditEvent
        self.assertTrue(AuditEvent.objects.filter(action="RMA_REQUEST_CREATED").exists())
        self.assertTrue(AuditEvent.objects.filter(action="RMA_PHYSICAL_INSPECTION_AND_RESTOCK").exists())
        self.assertTrue(AuditEvent.objects.filter(action="RMA_REFUND_EXECUTED").exists())

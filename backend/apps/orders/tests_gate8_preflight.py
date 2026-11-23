# apps/orders/tests_gate8_preflight.py
"""
LEVELPRO OS V4.0 — GATE 8 PREFLIGHT TESTS (CRM-PF-01..04)
- CRM-PF-01: Integración B2BQuote -> Order con WMS (reservas, prevención sobreventa, estados 3D, idempotencia).
- CRM-PF-02: Contrato explícito de impuestos por país/régimen (CLP sin país NO asume 19%, bloquea emisión).
- CRM-PF-03: Precisión monetaria Decimal/Money sin float() en cálculos/respuestas B2B.
- CRM-PF-04: Privacidad y minimización de PII en direcciones, notas internas y auditoría.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.analytics.models import AuditEvent
from apps.inventory.models import StockReservation, Warehouse, WarehouseStock
from apps.orders.models import B2BQuote, B2BQuoteItem, B2BQuoteStatus, Order
from apps.products.models import Brand, Category, Product
from core.rbac.constants import ROLE_MANAGEMENT, ROLE_SALES, ROLE_WAREHOUSE

User = get_user_model()


class Gate8PreflightTests(TransactionTestCase):
    def setUp(self):
        call_command("setup_rbac")
        self.cat = Category.objects.create(name="Microfonos", slug="mics-g8pf")
        self.brand = Brand.objects.create(name="Neumann", slug="neumann-g8pf")

        Warehouse.objects.filter(is_default=True).update(is_default=False)
        self.wh = Warehouse.objects.create(
            code="WH-G8PF", name="Bodega Central G8PF", is_default=True, is_active=True
        )

        self.sales_user = User.objects.create_user(
            username="g8pf_sales", email="g8pf_sales@levelpro.cl", password="pw", is_staff=True
        )
        self.sales_user.groups.add(Group.objects.get(name=ROLE_SALES))

        self.mgmt_user = User.objects.create_user(
            username="g8pf_mgmt", email="g8pf_mgmt@levelpro.cl", password="pw", is_staff=True
        )
        self.mgmt_user.groups.add(Group.objects.get(name=ROLE_MANAGEMENT))

        self.wh_user = User.objects.create_user(
            username="g8pf_wh", email="g8pf_wh@levelpro.cl", password="pw", is_staff=True
        )
        self.wh_user.groups.add(Group.objects.get(name=ROLE_WAREHOUSE))

        self.prod = Product.objects.create(
            name="U87 Ai Studio",
            slug="u87-ai-g8pf",
            sku="NEU-U87-PF",
            category=self.cat,
            brand=self.brand,
            price=Decimal("3200000.00"),
            cost_price=Decimal("2100000.00"),
            stock=2,
            product_type=Product.ProductType.STOCK,
            is_active=True,
        )
        self.ws = WarehouseStock.objects.create(
            warehouse=self.wh,
            product=self.prod,
            physical_quantity=2,
            reserved_quantity=0,
            non_sellable_quantity=0,
        )

    def test_crm_pf_02_03_tax_jurisdiction_and_decimal_precision(self):
        """
        CRM-PF-02 & CRM-PF-03:
        - CLP sin país NO asume IVA 19% ni inventa impuestos.
        - Respuestas B2B devuelven montos exactos en string Decimal (sin float).
        - Bloquea aprobación definitiva si no hay jurisdicción resuelta.
        - Con country='CL', aplica 19% IVA configurado.
        """
        client = APIClient()
        # 1. Crear solicitud pública en CLP SIN país -> tax_amount = "0.00", tax_jurisdiction_resolved = False
        res = client.post(
            "/api/v1/orders/b2b/quotes/",
            {
                "company_name": "Estudio Austral SpA",
                "tax_id": "76.123.456-7",
                "contact_name": "Camila Soto",
                "email": "camila@austral.cl",
                "phone": "+56911112222",
                "currency": "CLP",
                "items": [{"product_id": str(self.prod.id), "quantity": 1}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIsInstance(data["subtotal"], str)
        self.assertEqual(data["subtotal"], "3200000.00")
        self.assertEqual(data["tax_amount"], "0.00")
        self.assertEqual(data["total"], "3200000.00")
        self.assertFalse(data["tax_jurisdiction_resolved"])

        quote_id = data["id"]

        # 2. Intentar aprobar definitivamente sin declarar país/régimen -> 400
        client.force_authenticate(user=self.mgmt_user)
        res_bad_approve = client.patch(
            f"/api/v1/admin/b2b/quotes/{quote_id}/",
            {"status": "approved"},
            format="json",
        )
        self.assertEqual(res_bad_approve.status_code, 400)

        # 3. Aprobar con country='CL' -> resuelve IVA 19% SII y total exacto
        res_ok_approve = client.patch(
            f"/api/v1/admin/b2b/quotes/{quote_id}/",
            {"status": "approved", "country": "CL"},
            format="json",
        )
        self.assertEqual(res_ok_approve.status_code, 200)
        ok_data = res_ok_approve.json()
        self.assertEqual(ok_data["tax_amount"], "608000.00")
        self.assertEqual(ok_data["total"], "3808000.00")

    def test_crm_pf_01_04_b2b_convert_oms_wms_idempotency_and_privacy(self):
        """
        CRM-PF-01 & CRM-PF-04:
        - Conversión crea Order con estados 3D, reserva WMS y previene sobreventa.
        - Reintento con idempotency_key retorna replay idempotente sin duplicar orden ni reserva.
        - shipping_address no duplica RUT/CUIT en texto libre; notas internas enmascaradas sin rol comercial.
        """
        quote = B2BQuote.objects.create(
            company_name="Productora Norte Ltda",
            tax_id="76123456-7",
            contact_name="Luis Vega",
            email="luis@norte.cl",
            phone="+56933334444",
            currency="CLP",
            subtotal=Decimal("6400000.00"),
            tax_amount=Decimal("1216000.00"),
            total=Decimal("7616000.00"),
            status=B2BQuoteStatus.APPROVED,
            admin_notes="Margen interno confidencial",
        )
        B2BQuoteItem.objects.create(
            quote=quote,
            product=self.prod,
            product_name=self.prod.name,
            unit_price=Decimal("3200000.00"),
            quantity=2,
            subtotal=Decimal("6400000.00"),
        )

        # CRM-PF-04: Bodega no tiene acceso a admin_notes en detalle
        client_wh = APIClient()
        client_wh.force_authenticate(user=self.wh_user)
        # Intentar leer detalle como Bodega (si tiene permiso orders read o 403)
        res_wh = client_wh.get(f"/api/v1/admin/b2b/quotes/{quote.id}/")
        if res_wh.status_code == 200:
            self.assertEqual(res_wh.json()["admin_notes"], "")

        # CRM-PF-01: Conversión con idempotency_key -> reserva 2 unidades en WMS
        client_sales = APIClient()
        client_sales.force_authenticate(user=self.sales_user)
        res_conv = client_sales.post(
            f"/api/v1/admin/b2b/quotes/{quote.id}/convert/",
            {"idempotency_key": "b2b-conv-001"},
            format="json",
        )
        self.assertEqual(res_conv.status_code, 201)
        conv_data = res_conv.json()
        self.assertFalse(conv_data["idempotent_replay"])
        self.assertEqual(conv_data["commercial_status"], "confirmed")
        self.assertEqual(conv_data["financial_status"], "pending")
        self.assertEqual(conv_data["fulfillment_status"], "allocated")

        order = Order.objects.get(pk=conv_data["order_id"])
        self.assertEqual(order.order_origin, Order.OrderOriginChoices.B2B)
        self.assertEqual(order.customer_tax_id, "76123456-7")
        # CRM-PF-04: No duplicar RUT/CUIT en shipping_address libre
        self.assertNotIn("76123456-7", order.shipping_address)

        self.ws.refresh_from_db()
        self.assertEqual(self.ws.reserved_quantity, 2)
        self.assertEqual(StockReservation.objects.filter(order=order).count(), 1)

        # Replay idempotente
        res_replay = client_sales.post(
            f"/api/v1/admin/b2b/quotes/{quote.id}/convert/",
            {"idempotency_key": "b2b-conv-001"},
            format="json",
        )
        self.assertEqual(res_replay.status_code, 200)
        self.assertTrue(res_replay.json()["idempotent_replay"])
        self.assertEqual(res_replay.json()["order_id"], str(order.id))
        self.assertEqual(StockReservation.objects.filter(order=order).count(), 1)

        # Auditoría sin PII cruda
        evt = AuditEvent.objects.filter(action="B2B_QUOTE_CONVERTED", resource_id=str(quote.id)).first()
        self.assertIsNotNone(evt)
        self.assertNotIn("76123456-7", str(evt.new_values))
        self.assertNotIn("luis@norte.cl", str(evt.new_values))

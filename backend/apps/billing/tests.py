# apps/billing/tests.py — Documentación Tributaria (registro/seguimiento)
#
# El módulo ya no genera documentos ni folios — ahora solo REGISTRA lo
# que se emite por fuera en el SII. Estos tests cubren el registro, la
# actualización, y que el cliente no tenga acceso.

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderStatus
from apps.billing.models import TributaryDocument

User = get_user_model()


class TaxDocumentRecordTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="taxadmin@test.com", username="taxadmin", password="x")
        self.cliente = User.objects.create_user(
            email="cliente@test.com", username="taxcliente", password="x")
        self.order = Order.objects.create(
            user=self.cliente, status=OrderStatus.PAID,
            total=Decimal("119000"), email="cliente@test.com",
            shipping_address="Calle 1",
        )
        self.client = APIClient()

    def test_admin_can_register_document(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/v1/billing/record/", {
            "order_id": str(self.order.id),
            "tipo": "boleta",
            "numero_externo": "SII-889977",
            "estado": "emitido",
            "monto": "119000",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["numero_externo"], "SII-889977")
        self.assertEqual(resp.data["estado"], "emitido")

        doc = TributaryDocument.objects.get(order=self.order)
        self.assertEqual(doc.numero_externo, "SII-889977")

    def test_register_is_idempotent_per_order(self):
        """Registrar dos veces la misma orden actualiza, no duplica."""
        self.client.force_authenticate(user=self.admin)
        self.client.post("/api/v1/billing/record/", {
            "order_id": str(self.order.id), "tipo": "boleta",
        }, format="json")
        self.client.post("/api/v1/billing/record/", {
            "order_id": str(self.order.id), "tipo": "factura",
        }, format="json")
        self.assertEqual(
            TributaryDocument.objects.filter(order=self.order).count(), 1)
        self.assertEqual(
            TributaryDocument.objects.get(order=self.order).tipo, "factura")

    def test_invalid_tipo_rejected(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/v1/billing/record/", {
            "order_id": str(self.order.id), "tipo": "no-existe",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_client_cannot_access_dashboard(self):
        self.client.force_authenticate(user=self.cliente)
        resp = self.client.get("/api/v1/billing/dashboard/")
        self.assertEqual(resp.status_code, 403)

    def test_client_cannot_register(self):
        self.client.force_authenticate(user=self.cliente)
        resp = self.client.post("/api/v1/billing/record/", {
            "order_id": str(self.order.id), "tipo": "boleta",
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_dashboard_lists_paid_orders(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/v1/billing/dashboard/")
        self.assertEqual(resp.status_code, 200)
        order_ids = [r["order_id"] for r in resp.data["results"]]
        self.assertIn(str(self.order.id), order_ids)

    def test_dashboard_shows_null_document_when_not_registered(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/v1/billing/dashboard/")
        row = next(r for r in resp.data["results"] if r["order_id"] == str(self.order.id))
        self.assertIsNone(row["documento"])

    def test_dashboard_pagination_and_counts(self):
        self.client.force_authenticate(user=self.admin)
        for i in range(5):
            Order.objects.create(
                user=self.cliente, status=OrderStatus.PAID,
                total=Decimal("10000"), email=f"page{i}@test.com",
                shipping_address="Calle Test",
            )
        resp = self.client.get("/api/v1/billing/dashboard/?page=1&page_size=2")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 2)
        self.assertEqual(resp.data["page"], 1)
        self.assertEqual(resp.data["page_size"], 2)
        self.assertGreaterEqual(resp.data["count"], 6)
        self.assertGreaterEqual(resp.data["total_pages"], 3)

    def test_dashboard_filter_by_currency(self):
        self.client.force_authenticate(user=self.admin)
        order_usd = Order.objects.create(
            user=self.cliente, status=OrderStatus.PAID,
            total=Decimal("150"), currency="USD",
            email="usd@test.com", shipping_address="Calle Test",
        )
        resp_usd = self.client.get("/api/v1/billing/dashboard/?currency=USD")
        self.assertEqual(resp_usd.status_code, 200)
        self.assertTrue(all(r["currency"] == "USD" for r in resp_usd.data["results"]))
        self.assertIn(str(order_usd.id), [r["order_id"] for r in resp_usd.data["results"]])

        resp_clp = self.client.get("/api/v1/billing/dashboard/?currency=CLP")
        self.assertEqual(resp_clp.status_code, 200)
        self.assertTrue(all(r["currency"] == "CLP" for r in resp_clp.data["results"]))

    def test_dashboard_filter_by_doc_estado(self):
        self.client.force_authenticate(user=self.admin)
        TributaryDocument.objects.create(
            order=self.order, tipo="boleta", numero_externo="SII-123", estado="emitido"
        )
        unregistered_order = Order.objects.create(
            user=self.cliente, status=OrderStatus.PAID,
            total=Decimal("5000"), email="unreg@test.com", shipping_address="Calle 2"
        )
        resp_emitido = self.client.get("/api/v1/billing/dashboard/?doc_estado=emitido")
        self.assertEqual(resp_emitido.status_code, 200)
        self.assertIn(str(self.order.id), [r["order_id"] for r in resp_emitido.data["results"]])
        self.assertNotIn(str(unregistered_order.id), [r["order_id"] for r in resp_emitido.data["results"]])

        resp_sin_doc = self.client.get("/api/v1/billing/dashboard/?doc_estado=sin_documento")
        self.assertEqual(resp_sin_doc.status_code, 200)
        self.assertIn(str(unregistered_order.id), [r["order_id"] for r in resp_sin_doc.data["results"]])
        self.assertNotIn(str(self.order.id), [r["order_id"] for r in resp_sin_doc.data["results"]])

    def test_negative_monto_rejected(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/v1/billing/record/", {
            "order_id": str(self.order.id),
            "tipo": "boleta",
            "monto": "-5000",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("El monto no puede ser negativo", resp.data["error"])

    def test_foreign_order_document_preserves_null_monto(self):
        self.client.force_authenticate(user=self.admin)
        order_foreign = Order.objects.create(
            user=self.cliente, status=OrderStatus.PAID,
            total=Decimal("250.00"), currency="USD",
            email="foreign@test.com", shipping_address="Miami, FL",
        )
        resp = self.client.post("/api/v1/billing/record/", {
            "order_id": str(order_foreign.id),
            "tipo": "factura",
            "numero_externo": "INVOICE-US-001",
            "estado": "pendiente",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.data["monto"])
        self.assertEqual(resp.data["currency"], "USD")


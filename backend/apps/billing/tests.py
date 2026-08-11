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

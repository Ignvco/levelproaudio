# apps/products/tests_special_orders.py
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.products.models import SpecialOrderRequest

User = get_user_model()


class SpecialOrderPublicTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_anonymous_can_create_request(self):
        resp = self.client.post("/api/v1/special-orders/", {
            "name": "Juan Pérez", "email": "juan@test.com",
            "equipment": "Consola digital 32 canales", "quantity": 1,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(SpecialOrderRequest.objects.count(), 1)
        obj = SpecialOrderRequest.objects.first()
        self.assertEqual(obj.status, "pending")
        self.assertIsNone(obj.user)  # anónimo

    def test_logged_user_request_links_to_user(self):
        user = User.objects.create_user(email="u@test.com", username="u", password="x")
        self.client.force_authenticate(user=user)
        resp = self.client.post("/api/v1/special-orders/", {
            "name": "U", "email": "u@test.com", "equipment": "Micrófono X",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(SpecialOrderRequest.objects.first().user, user)

    def test_missing_required_fields_fails(self):
        resp = self.client.post("/api/v1/special-orders/", {
            "name": "Sin equipo",
        }, format="json")
        self.assertEqual(resp.status_code, 400)


class SpecialOrderAdminTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="soadmin@test.com", username="soadmin", password="x")
        self.cliente = User.objects.create_user(
            email="socli@test.com", username="socli", password="x")
        self.req = SpecialOrderRequest.objects.create(
            name="Test", email="t@test.com", equipment="Amplificador")
        self.client = APIClient()

    def test_admin_can_list_requests(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/v1/admin/special-orders/")
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get("results", resp.data)
        self.assertTrue(len(results) >= 1)

    def test_admin_can_update_status_and_notes(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(f"/api/v1/admin/special-orders/{self.req.id}/", {
            "status": "contacted", "admin_notes": "Llamado, cotizando",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, "contacted")
        self.assertEqual(self.req.admin_notes, "Llamado, cotizando")

    def test_client_cannot_access_admin(self):
        self.client.force_authenticate(user=self.cliente)
        resp = self.client.get("/api/v1/admin/special-orders/")
        self.assertIn(resp.status_code, (401, 403))

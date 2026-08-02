# apps/services/tests.py
#
# Antes: price_type se guardaba sin validar (mismo tipo de riesgo que
# rompió Productos con product_type), y duration_hours con basura tiraba
# un 500 crudo en vez de un 400 con mensaje claro.

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.services.models import Service

User = get_user_model()


class AdminServiceValidationTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(email="svcadmin@test.com", username="svcadmin", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_create_service_with_valid_price_type_succeeds(self):
        for ptype in ["fixed", "quote", "hourly", "project"]:
            resp = self.client.post("/api/v1/admin/services/list/", {
                "name": f"Servicio {ptype}", "price_type": ptype, "price": "50000",
            }, format="json")
            self.assertEqual(resp.status_code, 201, resp.data)

    def test_create_service_with_invalid_price_type_rejected(self):
        resp = self.client.post("/api/v1/admin/services/list/", {
            "name": "Servicio roto", "price_type": "invalido",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Service.objects.filter(name="Servicio roto").exists())

    def test_update_service_with_invalid_price_type_rejected(self):
        service = Service.objects.create(name="Original", price_type="quote", description="x")
        resp = self.client.patch(f"/api/v1/admin/services/{service.id}/", {
            "price_type": "invalido",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        service.refresh_from_db()
        self.assertEqual(service.price_type, "quote")  # no cambió

    def test_create_service_with_garbage_duration_hours_returns_clean_400(self):
        resp = self.client.post("/api/v1/admin/services/list/", {
            "name": "Servicio duración rota", "price_type": "quote",
            "duration_hours": "no-es-un-numero",
        }, format="json")
        self.assertEqual(resp.status_code, 400)  # no un 500 crudo
        self.assertIn("error", resp.data)

    def test_update_service_with_garbage_duration_hours_returns_clean_400(self):
        service = Service.objects.create(name="Original2", price_type="quote", description="x")
        resp = self.client.patch(f"/api/v1/admin/services/{service.id}/", {
            "duration_hours": "abc",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

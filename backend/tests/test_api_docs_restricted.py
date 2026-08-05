# tests/test_api_docs_restricted.py
#
# Antes, /api/schema/, /api/docs/ (swagger) y /api/redoc/ eran públicos
# — cualquiera en internet podía ver la estructura completa de la API
# (todos los endpoints, campos, modelos de datos) sin loguearse. Ahora
# requieren ser staff/admin.

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class ApiDocsRestrictedTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_schema_not_accessible_anonymously(self):
        resp = self.client.get("/api/schema/")
        self.assertIn(resp.status_code, (401, 403))

    def test_swagger_not_accessible_anonymously(self):
        resp = self.client.get("/api/docs/")
        self.assertIn(resp.status_code, (401, 403))

    def test_redoc_not_accessible_anonymously(self):
        resp = self.client.get("/api/redoc/")
        self.assertIn(resp.status_code, (401, 403))

    def test_regular_user_cannot_access_docs(self):
        user = User.objects.create_user(email="regular@test.com", username="regular", password="x")
        self.client.force_authenticate(user=user)
        resp = self.client.get("/api/schema/")
        self.assertEqual(resp.status_code, 403)

    def test_staff_can_access_docs(self):
        staff = User.objects.create_user(
            email="staffdocs@test.com", username="staffdocs", password="x", is_staff=True
        )
        self.client.force_authenticate(user=staff)
        resp = self.client.get("/api/schema/")
        self.assertEqual(resp.status_code, 200)

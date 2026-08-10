# apps/products/tests_category_reparent.py
#
# Bug real encontrado en el admin: el botón "editar" de una categoría
# hija siempre abría el modal de la categoría PADRE (por un closure mal
# armado en el frontend), así que nunca se podía editar ni reasignar el
# padre de una hija de verdad. Estos tests confirman que el backend, del
# lado de la API, siempre soportó correctamente esta operación — el bug
# era puramente del frontend.

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.products.models import Category

User = get_user_model()


class CategoryReparentTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="catadmin@test.com", username="catadmin", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.parent_a = Category.objects.create(name="Micrófonos", slug="microfonos-rp")
        self.parent_b = Category.objects.create(name="Audio Pro", slug="audio-pro-rp")
        self.child = Category.objects.create(
            name="Dinámicos", slug="dinamicos-rp", parent=self.parent_a)

    def test_move_child_to_different_parent(self):
        resp = self.client.patch(f"/api/v1/admin/categories/{self.child.id}/", {
            "parent": str(self.parent_b.id),
        }, format="json")
        self.assertEqual(resp.status_code, 200)

        self.child.refresh_from_db()
        self.assertEqual(self.child.parent_id, self.parent_b.id)

    def test_promote_child_to_root(self):
        """Sacarle el padre — debería poder convertirse en categoría raíz."""
        resp = self.client.patch(f"/api/v1/admin/categories/{self.child.id}/", {
            "parent": None,
        }, format="json")
        self.assertEqual(resp.status_code, 200)

        self.child.refresh_from_db()
        self.assertIsNone(self.child.parent_id)

    def test_edit_child_name_independently_of_parent(self):
        """Editar el nombre de la hija no debe tocar al padre."""
        resp = self.client.patch(f"/api/v1/admin/categories/{self.child.id}/", {
            "name": "Micrófonos Dinámicos",
        }, format="json")
        self.assertEqual(resp.status_code, 200)

        self.child.refresh_from_db()
        self.parent_a.refresh_from_db()
        self.assertEqual(self.child.name, "Micrófonos Dinámicos")
        self.assertEqual(self.parent_a.name, "Micrófonos")  # el padre no cambió

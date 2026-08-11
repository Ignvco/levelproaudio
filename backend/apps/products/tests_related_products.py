# apps/products/tests_related_products.py
#
# Cross-sell "Completá tu setup" — productos complementarios elegidos
# a mano en el admin (accesorios de otra categoría, no "más de lo
# mismo"), mostrados en la ficha pública del producto.

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.products.models import Category, Product

User = get_user_model()


class RelatedProductsTest(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Test", slug="test-related")
        self.mic = Product.objects.create(
            name="Shure SM57", slug="sm57-related", category=self.category,
            price=Decimal("150000"),
        )
        self.cable = Product.objects.create(
            name="Cable XLR", slug="cable-xlr-related", category=self.category,
            price=Decimal("15000"),
        )
        self.stand = Product.objects.create(
            name="Pedestal de mic", slug="pedestal-related", category=self.category,
            price=Decimal("25000"),
        )
        self.admin = User.objects.create_superuser(
            email="reladmin@test.com", username="reladmin", password="x")
        self.client = APIClient()

    def test_admin_can_assign_related_products(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(f"/api/v1/admin/products/{self.mic.id}/", {
            "related_products": [str(self.cable.id), str(self.stand.id)],
        }, format="json")
        self.assertEqual(resp.status_code, 200)

        self.mic.refresh_from_db()
        related_ids = set(self.mic.related_products.values_list("id", flat=True))
        self.assertEqual(related_ids, {self.cable.id, self.stand.id})

    def test_related_products_appear_in_public_detail(self):
        self.mic.related_products.set([self.cable, self.stand])
        resp = self.client.get(f"/api/v1/products/{self.mic.slug}/")
        self.assertEqual(resp.status_code, 200)
        names = {p["name"] for p in resp.data["related_products"]}
        self.assertEqual(names, {"Cable XLR", "Pedestal de mic"})

    def test_relationship_is_not_symmetrical(self):
        """Asignar accesorios a un mic no hace que el mic aparezca como
        accesorio del cable — la relación va en un solo sentido."""
        self.mic.related_products.set([self.cable])
        resp = self.client.get(f"/api/v1/products/{self.cable.slug}/")
        self.assertEqual(resp.data["related_products"], [])

    def test_product_cannot_be_related_to_itself(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(f"/api/v1/admin/products/{self.mic.id}/", {
            "related_products": [str(self.mic.id), str(self.cable.id)],
        }, format="json")
        self.assertEqual(resp.status_code, 200)

        self.mic.refresh_from_db()
        related_ids = set(self.mic.related_products.values_list("id", flat=True))
        self.assertEqual(related_ids, {self.cable.id})  # el mic no se auto-incluyó

    def test_no_related_products_omits_empty_section_gracefully(self):
        resp = self.client.get(f"/api/v1/products/{self.stand.slug}/")
        self.assertEqual(resp.data["related_products"], [])

# apps/products/tests_bundles.py
#
# Kits/combos: un producto tipo "bundle" con precio fijo propio, cuyo
# stock se deriva de sus componentes. Al comprarlo, descuenta stock de
# cada componente (no tiene stock propio).

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.products.models import Category, Product, BundleItem
from apps.orders.models import Order, OrderStatus

User = get_user_model()


class BundleStockTest(TestCase):
    def setUp(self):
        self.cat = Category.objects.create(name="Audio", slug="audio-bundle")
        self.mic = Product.objects.create(
            name="Micrófono", slug="mic-bundle", category=self.cat,
            price=Decimal("60000"), stock=10, product_type="stock")
        self.cable = Product.objects.create(
            name="Cable XLR", slug="cable-bundle", category=self.cat,
            price=Decimal("8000"), stock=20, product_type="stock")
        # El kit: precio fijo 85k (más barato que 60+8+8=76k... ponemos combo real)
        self.kit = Product.objects.create(
            name="Kit de grabación", slug="kit-grab", category=self.cat,
            price=Decimal("62000"), stock=0, product_type="bundle")
        BundleItem.objects.create(bundle=self.kit, component=self.mic, quantity=1)
        BundleItem.objects.create(bundle=self.kit, component=self.cable, quantity=2)

        self.user = User.objects.create_user(
            email="kit@test.com", username="kituser", password="x")
        self.client = APIClient()

    def test_bundle_in_stock_depends_on_components(self):
        self.assertTrue(self.kit.in_stock)
        # Si el mic se queda sin stock, el kit deja de estar disponible
        self.mic.stock = 0
        self.mic.save()
        self.assertFalse(self.kit.in_stock)

    def test_bundle_out_of_stock_if_component_insufficient(self):
        # El kit necesita 2 cables; si hay 1, no alcanza
        self.cable.stock = 1
        self.cable.save()
        self.assertFalse(self.kit.in_stock)

    def test_buying_bundle_discounts_component_stock(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/v1/orders/", {
            "items": [{"product": str(self.kit.id), "quantity": 1}],
            "shipping_address": "Calle 1",
            "email": "kit@test.com",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)

        self.mic.refresh_from_db()
        self.cable.refresh_from_db()
        self.kit.refresh_from_db()
        self.assertEqual(self.mic.stock, 9)    # 10 - 1
        self.assertEqual(self.cable.stock, 18)  # 20 - 2
        self.assertEqual(self.kit.stock, 0)     # el kit no tiene stock propio

    def test_buying_two_bundles_multiplies_component_discount(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/v1/orders/", {
            "items": [{"product": str(self.kit.id), "quantity": 2}],
            "shipping_address": "Calle 1",
            "email": "kit@test.com",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)

        self.mic.refresh_from_db()
        self.cable.refresh_from_db()
        self.assertEqual(self.mic.stock, 8)    # 10 - 2×1
        self.assertEqual(self.cable.stock, 16)  # 20 - 2×2

    def test_bundle_price_is_its_own_not_sum_of_components(self):
        """El precio del kit es fijo, puesto a mano — no la suma de componentes."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/v1/orders/", {
            "items": [{"product": str(self.kit.id), "quantity": 1}],
            "shipping_address": "Calle 1",
            "email": "kit@test.com",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        # Precio del kit = 62000, no 60000 + 2×8000 = 76000
        order = Order.objects.get(id=resp.data["id"])
        self.assertEqual(order.items.first().price, Decimal("62000"))

    def test_cannot_buy_bundle_without_component_stock(self):
        self.mic.stock = 0
        self.mic.save()
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/v1/orders/", {
            "items": [{"product": str(self.kit.id), "quantity": 1}],
            "shipping_address": "Calle 1",
            "email": "kit@test.com",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_cancelling_bundle_order_restores_component_stock(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/v1/orders/", {
            "items": [{"product": str(self.kit.id), "quantity": 1}],
            "shipping_address": "Calle 1",
            "email": "kit@test.com",
        }, format="json")
        order_id = resp.data["id"]
        self.mic.refresh_from_db()
        self.assertEqual(self.mic.stock, 9)

        self.client.delete(f"/api/v1/orders/{order_id}/")
        self.mic.refresh_from_db()
        self.cable.refresh_from_db()
        self.assertEqual(self.mic.stock, 10)   # repuesto
        self.assertEqual(self.cable.stock, 20)  # repuesto

    def test_bundle_items_in_public_detail(self):
        resp = self.client.get(f"/api/v1/products/{self.kit.slug}/")
        self.assertEqual(resp.status_code, 200)
        items = resp.data["bundle_items"]
        self.assertEqual(len(items), 2)
        names = {i["product"]["name"] for i in items}
        self.assertEqual(names, {"Micrófono", "Cable XLR"})

    def test_normal_product_has_empty_bundle_items(self):
        resp = self.client.get(f"/api/v1/products/{self.mic.slug}/")
        self.assertEqual(resp.data["bundle_items"], [])

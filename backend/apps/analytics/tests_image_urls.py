# apps/analytics/tests_image_urls.py
#
# Antes, 3 endpoints del admin devolvían img.image.url directo — con el
# bucket privado y sin URLs firmadas (GS_QUERYSTRING_AUTH=False), eso da
# 403 en el navegador. El comentario decía "relativa" pero .url en un
# ImageField respaldado por GCS siempre devuelve la URL absoluta del
# bucket. Confirma que ahora usan el proxy /media/.

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.products.models import Category, Product, ProductImage

User = get_user_model()


class ProductImageProxyUrlTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(email="imgadmin@test.com", username="imgadmin", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        category = Category.objects.create(name="Mics", slug="mics-imgtest")
        self.product = Product.objects.create(
            name="SM7B", slug="sm7b-imgtest", category=category,
            price=Decimal("100000"), stock=2, stock_min=5, is_active=True,
        )
        self.image = ProductImage.objects.create(
            product=self.product, image="products/test-image.jpg", is_primary=True,
        )

    def test_product_images_endpoint_returns_proxy_path(self):
        resp = self.client.get(f"/api/v1/admin/products/{self.product.id}/images/")
        assert resp.status_code == 200
        img_url = resp.data[0]["image"]
        assert img_url.startswith("/media/")
        assert "storage.googleapis.com" not in img_url
        assert "amazonaws.com" not in img_url  # por si acaso, ningún host absoluto

    def test_inventory_alerts_returns_proxy_path(self):
        resp = self.client.get("/api/v1/admin/inventory/alerts/")
        assert resp.status_code == 200
        products_with_image = [p for p in resp.data if p["image"]]
        assert len(products_with_image) >= 1
        for p in products_with_image:
            assert p["image"].startswith("/media/")

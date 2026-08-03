# apps/seo/tests.py
#
# El sitemap vive en /api/v1/seo/sitemap.xml, pero robots.txt apuntaba
# a la ruta convencional /sitemap.xml (que da 404) — ya corregido en
# robots.txt. Estos tests cubren que el sitemap real, en la ruta que
# realmente existe, devuelve XML válido con el contenido esperado.

from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from apps.products.models import Category, Product
from apps.services.models import Service
from apps.academy.models import Course


class SitemapTest(TestCase):
    def test_sitemap_returns_valid_xml(self):
        resp = self.client.get("/api/v1/seo/sitemap.xml")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("xml", resp["Content-Type"])
        content = resp.content.decode()
        self.assertTrue(content.startswith('<?xml version="1.0"'))
        self.assertIn("<urlset", content)

    def test_sitemap_includes_static_pages(self):
        resp = self.client.get("/api/v1/seo/sitemap.xml")
        content = resp.content.decode()
        self.assertIn("<loc>https://levelproaudio.com/</loc>", content)
        self.assertIn("<loc>https://levelproaudio.com/shop</loc>", content)

    def test_sitemap_includes_active_product_not_inactive(self):
        cat = Category.objects.create(name="Mics", slug="mics-sitemap")
        active = Product.objects.create(
            name="Activo", slug="activo-sitemap", category=cat,
            price=Decimal("50000"), stock=5, is_active=True,
        )
        inactive = Product.objects.create(
            name="Inactivo", slug="inactivo-sitemap", category=cat,
            price=Decimal("50000"), stock=5, is_active=False,
        )
        resp = self.client.get("/api/v1/seo/sitemap.xml")
        content = resp.content.decode()
        self.assertIn("/shop/activo-sitemap", content)
        self.assertNotIn("/shop/inactivo-sitemap", content)

    def test_sitemap_includes_published_course_not_draft(self):
        published = Course.objects.create(
            title="Curso publicado", slug="publicado-sitemap",
            price=Decimal("50000"), is_published=True,
        )
        draft = Course.objects.create(
            title="Curso borrador", slug="borrador-sitemap",
            price=Decimal("50000"), is_published=False,
        )
        resp = self.client.get("/api/v1/seo/sitemap.xml")
        content = resp.content.decode()
        self.assertIn("/academy/publicado-sitemap", content)
        self.assertNotIn("/academy/borrador-sitemap", content)

    def test_sitemap_includes_active_service(self):
        Service.objects.create(
            name="Mezcla y masterización", slug="mezcla-sitemap",
            price_type="quote", description="x", is_active=True,
        )
        resp = self.client.get("/api/v1/seo/sitemap.xml")
        content = resp.content.decode()
        self.assertIn("/services/mezcla-sitemap", content)

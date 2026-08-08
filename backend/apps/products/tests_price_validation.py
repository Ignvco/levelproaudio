# apps/products/tests_price_validation.py
#
# Antes, price/compare_price/cost_price no tenían ningún validador — se
# podía guardar un producto con precio negativo tanto por el admin como
# por la API directa, sin ningún error ni en el frontend ni en el
# backend. Confirma que ahora sí se rechaza, en los 3 modelos que
# comparten el mismo hueco (Product, Service, Course).

from decimal import Decimal
from django.core.exceptions import ValidationError
from django.test import TestCase
from apps.products.models import Product, Category


class ProductPriceValidationTest(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Test", slug="test-precio")

    def test_negative_price_rejected(self):
        p = Product(name="Test", slug="test-precio-neg", category=self.category,
                     price=Decimal("-100"))
        with self.assertRaises(ValidationError) as ctx:
            p.full_clean()
        self.assertIn("price", ctx.exception.message_dict)

    def test_negative_compare_price_rejected(self):
        p = Product(name="Test", slug="test-compare-neg", category=self.category,
                     price=Decimal("1000"), compare_price=Decimal("-50"))
        with self.assertRaises(ValidationError) as ctx:
            p.full_clean()
        self.assertIn("compare_price", ctx.exception.message_dict)

    def test_negative_cost_price_rejected(self):
        p = Product(name="Test", slug="test-cost-neg", category=self.category,
                     price=Decimal("1000"), cost_price=Decimal("-50"))
        with self.assertRaises(ValidationError) as ctx:
            p.full_clean()
        self.assertIn("cost_price", ctx.exception.message_dict)

    def test_zero_price_still_allowed(self):
        # Cero es válido (producto gratis/promocional) — solo negativos
        # deberían rechazarse.
        p = Product(name="Test", slug="test-precio-cero", category=self.category,
                     price=Decimal("0"))
        p.full_clean()  # no debería tirar excepción

    def test_positive_price_allowed(self):
        p = Product(name="Test", slug="test-precio-ok", category=self.category,
                     price=Decimal("15000"))
        p.full_clean()


class ServicePriceValidationTest(TestCase):
    def test_negative_price_rejected(self):
        from apps.services.models import Service, ServiceCategory
        cat = ServiceCategory.objects.create(name="Test", slug="test-serv-cat")
        s = Service(name="Test", slug="test-serv-precio", category=cat,
                    description="Descripción de prueba", price=Decimal("-500"))
        with self.assertRaises(ValidationError) as ctx:
            s.full_clean()
        self.assertIn("price", ctx.exception.message_dict)


class CoursePriceValidationTest(TestCase):
    def test_negative_price_rejected(self):
        from apps.academy.models import Course
        c = Course(title="Test", slug="test-curso-precio",
                   description="Descripción de prueba", price=Decimal("-1000"))
        with self.assertRaises(ValidationError) as ctx:
            c.full_clean()
        self.assertIn("price", ctx.exception.message_dict)

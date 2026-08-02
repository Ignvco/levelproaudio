# apps/products/tests_fix_invalid_types.py
#
# Valida el comando que normaliza productos con product_type inválido
# (guardado antes del fix del formulario admin) a "stock".

from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.products.models import Category, Product


def _product(name, product_type):
    category = Category.objects.get_or_create(name="Mics", slug="mics-fixtypes")[0]
    return Product.objects.create(
        name=name, slug=f"{name.lower().replace(' ', '-')}-fixtypes",
        category=category, price=Decimal("50000"), stock=3,
        product_type=product_type, is_active=True,
    )


class FixInvalidProductTypesTest(TestCase):
    def test_dry_run_changes_nothing(self):
        # Bypass del modelo/serializer para simular el estado roto real
        # (guardado directo, como hacía _save_product antes del fix)
        p = _product("Roto Physical", "physical")

        out = StringIO()
        call_command("fix_invalid_product_types", stdout=out)

        p.refresh_from_db()
        self.assertEqual(p.product_type, "physical")  # no tocado
        self.assertIn("dry-run", out.getvalue())

    def test_confirm_normalizes_invalid_types_to_stock(self):
        p1 = _product("Roto Physical", "physical")
        p2 = _product("Roto Digital", "digital")
        p3 = _product("Roto Service", "service")
        p_ok = _product("Ya válido", "preorder")  # este NO debe tocarse

        call_command("fix_invalid_product_types", "--confirm")

        p1.refresh_from_db(); p2.refresh_from_db(); p3.refresh_from_db(); p_ok.refresh_from_db()
        self.assertEqual(p1.product_type, "stock")
        self.assertEqual(p2.product_type, "stock")
        self.assertEqual(p3.product_type, "stock")
        self.assertEqual(p_ok.product_type, "preorder")  # sigue igual, ya era válido

    def test_no_invalid_products_reports_nothing_to_fix(self):
        _product("Producto sano", "stock")
        out = StringIO()
        call_command("fix_invalid_product_types", stdout=out)
        self.assertIn("Nada que corregir", out.getvalue())

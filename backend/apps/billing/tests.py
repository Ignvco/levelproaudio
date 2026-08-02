"""
apps/billing/tests.py — numeración de folios y config singleton.
"""
from django.test import TestCase
from apps.billing.models import BillingConfig


class FolioNumberingTest(TestCase):
    def setUp(self):
        self.config = BillingConfig.get()

    def test_first_folio_is_one(self):
        numero, folio = self.config.siguiente_numero("boleta")
        self.assertEqual(numero, 1)
        self.assertEqual(folio, "B-000001")

    def test_folios_increment_sequentially(self):
        n1, _ = self.config.siguiente_numero("boleta")
        n2, _ = self.config.siguiente_numero("boleta")
        n3, _ = self.config.siguiente_numero("boleta")
        self.assertEqual([n1, n2, n3], [1, 2, 3])

    def test_folios_never_repeat_across_many_calls(self):
        """
        Regresión para el fix de select_for_update: generar muchos folios
        seguidos nunca debe producir números repetidos.
        """
        numeros = [self.config.siguiente_numero("boleta")[0] for _ in range(25)]
        self.assertEqual(len(numeros), len(set(numeros)))
        self.assertEqual(numeros, list(range(1, 26)))

    def test_each_document_type_has_independent_sequence(self):
        b1, _ = self.config.siguiente_numero("boleta")
        f1, _ = self.config.siguiente_numero("factura")
        b2, _ = self.config.siguiente_numero("boleta")
        self.assertEqual(b1, 1)
        self.assertEqual(f1, 1)  # secuencia independiente de boleta
        self.assertEqual(b2, 2)

    def test_config_is_singleton(self):
        c1 = BillingConfig.get()
        c2 = BillingConfig.get()
        self.assertEqual(c1.pk, c2.pk)

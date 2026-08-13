# apps/payments/tests_method_config.py
#
# Métodos de pago configurables desde el admin: el checkout lee del
# backend qué métodos ofrecer (filtrados por moneda) y las cuentas
# bancarias para transferencia. Nada hardcodeado.

from django.test import TestCase
from rest_framework.test import APIClient

from apps.payments.models import PaymentMethodConfig, BankAccount


class PaymentMethodConfigTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_only_active_methods_returned(self):
        PaymentMethodConfig.objects.create(method="transfer", is_active=True)
        PaymentMethodConfig.objects.create(method="paypal", is_active=False)
        resp = self.client.get("/api/v1/payments/methods/")
        ids = [m["id"] for m in resp.data["methods"]]
        self.assertIn("transfer", ids)
        self.assertNotIn("paypal", ids)

    def test_method_filtered_by_currency(self):
        # Payoneer solo en USD; transferencia en CLP
        PaymentMethodConfig.objects.create(method="payoneer", is_active=True, currencies="USD")
        PaymentMethodConfig.objects.create(method="transfer", is_active=True, currencies="CLP")

        resp_clp = self.client.get("/api/v1/payments/methods/?currency=CLP")
        ids_clp = [m["id"] for m in resp_clp.data["methods"]]
        self.assertIn("transfer", ids_clp)
        self.assertNotIn("payoneer", ids_clp)

        resp_usd = self.client.get("/api/v1/payments/methods/?currency=USD")
        ids_usd = [m["id"] for m in resp_usd.data["methods"]]
        self.assertIn("payoneer", ids_usd)
        self.assertNotIn("transfer", ids_usd)

    def test_method_without_currency_shown_for_all(self):
        PaymentMethodConfig.objects.create(method="transfer", is_active=True, currencies="")
        resp = self.client.get("/api/v1/payments/methods/?currency=ARS")
        ids = [m["id"] for m in resp.data["methods"]]
        self.assertIn("transfer", ids)

    def test_bank_accounts_only_when_transfer_active(self):
        BankAccount.objects.create(label="Cuenta CLP", currency="CLP",
                                   bank_name="Banco X", account_number="123",
                                   holder_name="LevelPro")
        # Transferencia NO activa → no se devuelven cuentas
        resp = self.client.get("/api/v1/payments/methods/?currency=CLP")
        self.assertEqual(resp.data["bank_accounts"], [])

        # Activamos transferencia → ahora sí
        PaymentMethodConfig.objects.create(method="transfer", is_active=True)
        resp2 = self.client.get("/api/v1/payments/methods/?currency=CLP")
        self.assertEqual(len(resp2.data["bank_accounts"]), 1)
        self.assertEqual(resp2.data["bank_accounts"][0]["bank_name"], "Banco X")

    def test_bank_accounts_filtered_by_currency(self):
        PaymentMethodConfig.objects.create(method="transfer", is_active=True)
        BankAccount.objects.create(label="CLP", currency="CLP", bank_name="Banco CL",
                                   account_number="1", holder_name="LP")
        BankAccount.objects.create(label="ARS", currency="ARS", bank_name="Banco AR",
                                   account_number="2", holder_name="LP")
        resp = self.client.get("/api/v1/payments/methods/?currency=ARS")
        banks = {b["bank_name"] for b in resp.data["bank_accounts"]}
        self.assertEqual(banks, {"Banco AR"})

    def test_inactive_bank_account_not_shown(self):
        PaymentMethodConfig.objects.create(method="transfer", is_active=True)
        BankAccount.objects.create(label="Vieja", currency="CLP", bank_name="Banco Z",
                                   account_number="9", holder_name="LP", is_active=False)
        resp = self.client.get("/api/v1/payments/methods/?currency=CLP")
        self.assertEqual(resp.data["bank_accounts"], [])

    def test_empty_config_returns_empty(self):
        resp = self.client.get("/api/v1/payments/methods/")
        self.assertEqual(resp.data["methods"], [])
        self.assertEqual(resp.data["bank_accounts"], [])

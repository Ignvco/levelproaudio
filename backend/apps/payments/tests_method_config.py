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
        # Partimos de tabla limpia: la migración 0004 siembra métodos,
        # pero estos tests controlan su propio estado.
        PaymentMethodConfig.objects.all().delete()
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


class TransferPaymentFlowTest(TestCase):
    """El método transfer crea un Payment pendiente sin pasarela externa."""
    def setUp(self):
        from django.contrib.auth import get_user_model
        from apps.orders.models import Order
        from decimal import Decimal
        User = get_user_model()
        self.user = User.objects.create_user(
            email="tf@test.com", username="tfuser", password="x")
        self.order = Order.objects.create(
            user=self.user, status="pending", total=Decimal("50000"),
            email="tf@test.com", shipping_address="Calle 1")
        self.client = APIClient()

    def test_transfer_creates_pending_payment(self):
        from apps.payments.models import Payment
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/v1/payments/create/", {
            "order_id": str(self.order.id), "provider": "transfer",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["provider"], "transfer")
        self.assertEqual(resp.data["status"], "pending")
        # Se creó el Payment pendiente
        payment = Payment.objects.get(order=self.order, provider="transfer")
        self.assertEqual(payment.status, "pending")

    def test_transfer_reference_format(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/v1/payments/create/", {
            "order_id": str(self.order.id), "provider": "transfer",
        }, format="json")
        self.assertTrue(resp.data["reference"].startswith("LEVELPRO-"))


class AdminPaymentConfigCRUDTest(TestCase):
    """Endpoints admin para gestionar métodos y cuentas desde el panel React."""
    def setUp(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.admin = User.objects.create_superuser(
            email="padmin@test.com", username="padmin", password="x")
        self.cliente = User.objects.create_user(
            email="pcli@test.com", username="pcli", password="x")
        PaymentMethodConfig.objects.all().delete()
        self.client = APIClient()

    def test_admin_can_create_payment_method(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/v1/payments/admin/payment-methods/", {
            "method": "transfer", "is_active": True, "currencies": "CLP",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_admin_can_toggle_method(self):
        from apps.payments.models import PaymentMethodConfig
        m = PaymentMethodConfig.objects.create(method="paypal", is_active=False)
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(f"/api/v1/payments/admin/payment-methods/{m.id}/", {
            "is_active": True,
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        m.refresh_from_db()
        self.assertTrue(m.is_active)

    def test_admin_can_create_bank_account(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/v1/payments/admin/bank-accounts/", {
            "label": "Cuenta CLP", "currency": "CLP", "bank_name": "Banco Estado",
            "account_number": "123456", "holder_name": "LevelPro Audio SpA",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_client_cannot_access_admin_endpoints(self):
        self.client.force_authenticate(user=self.cliente)
        resp = self.client.get("/api/v1/payments/admin/payment-methods/")
        self.assertIn(resp.status_code, (401, 403))

    def test_anon_cannot_access_admin_endpoints(self):
        resp = self.client.get("/api/v1/payments/admin/bank-accounts/")
        self.assertIn(resp.status_code, (401, 403))


class SeededMethodsTest(TestCase):
    """La migración 0004 siembra los métodos que existían antes."""
    def test_existing_methods_are_seeded(self):
        from apps.payments.models import PaymentMethodConfig
        # La migración ya corrió en la DB de test
        methods = set(PaymentMethodConfig.objects.values_list("method", flat=True))
        self.assertIn("mercadopago_cl", methods)
        self.assertIn("paypal", methods)
        self.assertIn("transfer", methods)

    def test_seeded_methods_are_inactive_by_default(self):
        from apps.payments.models import PaymentMethodConfig
        mp = PaymentMethodConfig.objects.filter(method="mercadopago_cl").first()
        if mp:
            self.assertFalse(mp.is_active)  # el admin decide activar

"""
backend/tests/test_p14_02_idempotency.py
Pruebas de idempotencia de creación de pagos y deduplicación transaccional
de webhooks para Patch 14 (Issue #15 / P14-02).
"""

from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User
from apps.orders.models import Order, OrderStatus
from apps.payments.models import (
    Payment,
    PaymentMethodConfig,
    PaymentProvider,
    PaymentStatus,
    BankAccount,
    PaymentWebhookEvent,
    WebhookEventStatus,
)


class PaymentCreationAndWebhookIdempotencyTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="idempotency@example.test",
            username="idempotency_user",
            password="testpassword123",
        )
        self.order = Order.objects.create(
            user=self.user,
            currency="CLP",
            total=Decimal("75000"),
            status=OrderStatus.PENDING,
            email=self.user.email,
            shipping_address="Calle Test 456",
        )

        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.MERCADOPAGO_CL,
            defaults={"is_active": True, "currencies": "CLP"},
        )
        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.PAYPAL,
            defaults={"is_active": True, "currencies": "CLP,USD"},
        )
        PaymentMethodConfig.objects.update_or_create(
            method=PaymentProvider.TRANSFER,
            defaults={"is_active": True, "currencies": "CLP"},
        )
        BankAccount.objects.get_or_create(
            payment_method=PaymentProvider.TRANSFER,
            currency="CLP",
            defaults={
                "bank_name": "Banco Estado",
                "account_number": "112233",
                "holder_name": "LevelPro",
                "is_active": True,
            },
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("apps.payments.views.create_mercadopago_preference")
    def test_create_payment_reuse_pending_mercadopago_preference(self, mock_create_pref):
        """
        Si el cliente reintenta la creación de pago para MercadoPago y ya existe
        un Payment PENDING con preference_id e init_point, se reutiliza
        el intent sin llamar a la API de MP ni duplicar registros.
        """
        Payment.objects.create(
            order=self.order,
            provider=PaymentProvider.MERCADOPAGO_CL,
            status=PaymentStatus.PENDING,
            amount=self.order.total,
            currency="CLP",
            preference_id="PREF-12345",
            payment_url="https://mercadopago.cl/checkout/v1/12345",
        )

        res = self.client.post("/api/v1/payments/create/", {
            "order_id": str(self.order.id),
            "provider": PaymentProvider.MERCADOPAGO_CL,
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["preference_id"], "PREF-12345")
        self.assertEqual(res.data["init_point"], "https://mercadopago.cl/checkout/v1/12345")

        mock_create_pref.assert_not_called()
        self.assertEqual(Payment.objects.filter(order=self.order).count(), 1)

    @patch("apps.payments.views.create_paypal_order")
    def test_create_payment_reuse_pending_paypal_intent(self, mock_create_paypal):
        """
        Reintento de creación de pago en PayPal reutiliza el intent PENDING existente.
        """
        Payment.objects.create(
            order=self.order,
            provider=PaymentProvider.PAYPAL,
            status=PaymentStatus.PENDING,
            amount=Decimal("100.00"),
            currency="USD",
            preference_id="PAYID-9999",
            payment_url="https://www.paypal.com/checkoutnow?token=9999",
        )

        res = self.client.post("/api/v1/payments/create/", {
            "order_id": str(self.order.id),
            "provider": PaymentProvider.PAYPAL,
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["paypal_order_id"], "PAYID-9999")
        self.assertEqual(res.data["approve_url"], "https://www.paypal.com/checkoutnow?token=9999")

        mock_create_paypal.assert_not_called()
        self.assertEqual(Payment.objects.filter(order=self.order).count(), 1)

    def test_create_payment_reuse_pending_manual_transfer(self):
        """
        Reintento de pago por transferencia no crea múltiples filas Payment PENDING.
        """
        res1 = self.client.post("/api/v1/payments/create/", {
            "order_id": str(self.order.id),
            "provider": PaymentProvider.TRANSFER,
        })
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(Payment.objects.filter(order=self.order).count(), 1)

        # Segundo llamado idéntico
        res2 = self.client.post("/api/v1/payments/create/", {
            "order_id": str(self.order.id),
            "provider": PaymentProvider.TRANSFER,
        })
        self.assertEqual(res2.status_code, 200)
        # Sigue existiendo exactamente un solo Payment
        self.assertEqual(Payment.objects.filter(order=self.order).count(), 1)

    @patch("apps.payments.views.process_mercadopago_webhook")
    @patch("apps.payments.views.normalize_mp_webhook")
    @patch("apps.payments.views.verify_mp_webhook_signature", return_value=True)
    @patch("apps.payments.views.get_mp_webhook_secret", return_value="secret_test")
    def test_webhook_deduplication_executes_once_and_skips_replays(
        self, mock_secret, mock_verify, mock_normalize, mock_process
    ):
        """
        Un webhook recibido por primera vez se registra como PROCESSED.
        Si la pasarela reenvía el mismo evento, se reconoce y descarta
        inmediatamente con 200 OK sin volver a invocar la lógica de negocio.
        """
        mock_normalize.return_value = {
            "type": "payment",
            "data": {"id": "1234567890"},
        }

        # Primer envío del webhook
        res1 = self.client.post(
            "/api/v1/payments/webhook/mercadopago/cl/?id=1234567890&topic=payment",
            {"type": "payment", "data": {"id": "1234567890"}},
            format="json",
            HTTP_X_REQUEST_ID="req_unique_001",
        )
        self.assertEqual(res1.status_code, 200)
        mock_process.assert_called_once()

        # Verificar que el evento quedó registrado en base de datos
        event = PaymentWebhookEvent.objects.get(
            provider=PaymentProvider.MERCADOPAGO_CL,
            resource_id="1234567890",
        )
        self.assertEqual(event.status, WebhookEventStatus.PROCESSED)
        self.assertIsNotNone(event.processed_at)

        # Segundo envío idéntico (reintento del proveedor)
        res2 = self.client.post(
            "/api/v1/payments/webhook/mercadopago/cl/?id=1234567890&topic=payment",
            {"type": "payment", "data": {"id": "1234567890"}},
            format="json",
            HTTP_X_REQUEST_ID="req_unique_001",
        )
        self.assertEqual(res2.status_code, 200)
        # mock_process NO debe haberse llamado nuevamente
        self.assertEqual(mock_process.call_count, 1)

    @patch("apps.payments.views.process_mercadopago_webhook", side_effect=ValueError("Simulated MP API failure"))
    @patch("apps.payments.views.normalize_mp_webhook")
    @patch("apps.payments.views.verify_mp_webhook_signature", return_value=True)
    @patch("apps.payments.views.get_mp_webhook_secret", return_value="secret_test")
    def test_webhook_error_records_status_error_and_returns_503(
        self, mock_secret, mock_verify, mock_normalize, mock_process
    ):
        """
        Si ocurre un error en el procesamiento de la lógica de negocio,
        el webhook registra status='error' y retorna 503 para que el proveedor reintente.
        """
        mock_normalize.return_value = {
            "type": "payment",
            "data": {"id": "999888777"},
        }

        res = self.client.post(
            "/api/v1/payments/webhook/mercadopago/cl/?id=999888777&topic=payment",
            {"type": "payment", "data": {"id": "999888777"}},
            format="json",
            HTTP_X_REQUEST_ID="req_err_001",
        )
        self.assertEqual(res.status_code, 503)

        event = PaymentWebhookEvent.objects.get(
            provider=PaymentProvider.MERCADOPAGO_CL,
            resource_id="999888777",
        )
        self.assertEqual(event.status, WebhookEventStatus.ERROR)
        self.assertIn("Simulated MP API failure", event.error_message)

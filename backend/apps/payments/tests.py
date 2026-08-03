# apps/payments/tests.py
#
# Antes, process_mercadopago_webhook y capture_paypal_payment marcaban
# la orden como pagada confiando únicamente en el status que devolvía
# el proveedor — sin comparar nunca el monto realmente cobrado contra
# el total real de la orden. Es la misma clase de vulnerabilidad que
# ya se había tapado en la creación de órdenes (nunca confiar en un
# monto sin validarlo contra lo que el sistema espera).

from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.payments.services import process_mercadopago_webhook, capture_paypal_payment

User = get_user_model()


def _pending_order(user, total="100000"):
    return Order.objects.create(
        user=user, email=user.email, shipping_address="dir",
        total=Decimal(total), status=OrderStatus.PENDING,
    )


class MercadoPagoWebhookAmountValidationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="mpbuyer@test.com", username="mpbuyer", password="x")

    @patch("apps.payments.services.get_mp_sdk")
    def test_matching_amount_approves_order(self, mock_get_sdk):
        order = _pending_order(self.user, total="100000")
        mock_sdk = MagicMock()
        mock_sdk.payment().get.return_value = {
            "status": 200,
            "response": {
                "id": "mp-123", "status": "approved",
                "external_reference": str(order.id),
                "transaction_amount": 100000,
            },
        }
        mock_get_sdk.return_value = mock_sdk

        process_mercadopago_webhook(
            {"type": "payment", "data": {"id": "mp-123"}},
            PaymentProvider.MERCADOPAGO_CL,
        )

        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PAID)
        payment = Payment.objects.get(external_id="mp-123")
        self.assertEqual(payment.status, PaymentStatus.APPROVED)
        self.assertIsNotNone(payment.paid_at)

    @patch("apps.payments.services.get_mp_sdk")
    def test_mismatched_amount_does_not_approve_order(self, mock_get_sdk):
        """El caso crítico: MP dice 'approved' pero el monto real cobrado
        es mucho menor al total de la orden — no debe marcarse como pagada."""
        order = _pending_order(self.user, total="100000")
        mock_sdk = MagicMock()
        mock_sdk.payment().get.return_value = {
            "status": 200,
            "response": {
                "id": "mp-456", "status": "approved",
                "external_reference": str(order.id),
                "transaction_amount": 1000,  # muchísimo menos que 100.000
            },
        }
        mock_get_sdk.return_value = mock_sdk

        process_mercadopago_webhook(
            {"type": "payment", "data": {"id": "mp-456"}},
            PaymentProvider.MERCADOPAGO_CL,
        )

        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PENDING)  # NO se aprobó
        payment = Payment.objects.get(external_id="mp-456")
        self.assertEqual(payment.status, PaymentStatus.IN_REVIEW)
        self.assertIsNone(payment.paid_at)

    @patch("apps.payments.services.get_mp_sdk")
    def test_small_rounding_difference_still_approves(self, mock_get_sdk):
        """Una diferencia de centavos por redondeo no debe bloquear el pago."""
        order = _pending_order(self.user, total="100000")
        mock_sdk = MagicMock()
        mock_sdk.payment().get.return_value = {
            "status": 200,
            "response": {
                "id": "mp-789", "status": "approved",
                "external_reference": str(order.id),
                "transaction_amount": 99999.5,  # diferencia mínima
            },
        }
        mock_get_sdk.return_value = mock_sdk

        process_mercadopago_webhook(
            {"type": "payment", "data": {"id": "mp-789"}},
            PaymentProvider.MERCADOPAGO_CL,
        )

        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PAID)

    @patch("apps.payments.services.get_mp_sdk")
    def test_pending_status_does_not_check_amount_or_approve(self, mock_get_sdk):
        order = _pending_order(self.user, total="100000")
        mock_sdk = MagicMock()
        mock_sdk.payment().get.return_value = {
            "status": 200,
            "response": {
                "id": "mp-000", "status": "pending",
                "external_reference": str(order.id),
                "transaction_amount": 100000,
            },
        }
        mock_get_sdk.return_value = mock_sdk

        process_mercadopago_webhook(
            {"type": "payment", "data": {"id": "mp-000"}},
            PaymentProvider.MERCADOPAGO_CL,
        )

        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PENDING)


class PayPalCaptureAmountValidationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="ppbuyer@test.com", username="ppbuyer", password="x")

    def _make_payment(self, order, preference_id="pp-order-1", amount="100.00"):
        return Payment.objects.create(
            order=order, provider=PaymentProvider.PAYPAL,
            status=PaymentStatus.PENDING, amount=Decimal(amount),
            currency="USD", preference_id=preference_id,
        )

    @patch("apps.payments.services.paypalrestsdk.Payment.find")
    @patch("apps.payments.services.configure_paypal")
    def test_matching_amount_approves_order(self, mock_configure, mock_find):
        order = _pending_order(self.user, total="100000")
        self._make_payment(order, preference_id="pp-1", amount="100.00")

        mock_paypal_payment = MagicMock()
        mock_paypal_payment.execute.return_value = True
        mock_paypal_payment.transactions = [MagicMock(amount=MagicMock(total="100.00"))]
        mock_paypal_payment.to_dict.return_value = {}
        mock_find.return_value = mock_paypal_payment

        result = capture_paypal_payment("pp-1", "PAYER123")

        self.assertTrue(result)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PAID)

    @patch("apps.payments.services.paypalrestsdk.Payment.find")
    @patch("apps.payments.services.configure_paypal")
    def test_mismatched_amount_does_not_approve_order(self, mock_configure, mock_find):
        order = _pending_order(self.user, total="100000")
        self._make_payment(order, preference_id="pp-2", amount="100.00")

        mock_paypal_payment = MagicMock()
        mock_paypal_payment.execute.return_value = True
        mock_paypal_payment.transactions = [MagicMock(amount=MagicMock(total="1.00"))]  # mucho menos
        mock_paypal_payment.to_dict.return_value = {}
        mock_find.return_value = mock_paypal_payment

        result = capture_paypal_payment("pp-2", "PAYER123")

        self.assertFalse(result)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PENDING)  # NO se aprobó
        payment = Payment.objects.get(preference_id="pp-2")
        self.assertEqual(payment.status, PaymentStatus.IN_REVIEW)


class AdminManualPaymentApprovalTest(TestCase):
    """
    Antes, admin_update_payment_status repetía a mano "order.status=paid"
    + creación de IncomeRecord — la misma lógica que el signal de
    apps/payments/signals.py ya dispara automáticamente al guardar el
    Payment. Confirma que, tras limpiar la duplicación, la aprobación
    manual (ej: confirmar una transferencia Global66) sigue completando
    el flujo real de punta a punta vía el signal.
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(email="payadmin@test.com", username="payadmin", password="x")
        self.buyer = User.objects.create_user(email="manualbuyer@test.com", username="manualbuyer", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_approving_payment_marks_order_paid_via_signal(self):
        order = _pending_order(self.buyer, total="50000")
        payment = Payment.objects.create(
            order=order, provider=PaymentProvider.GLOBAL66,
            status=PaymentStatus.PENDING, amount=Decimal("50000"), currency="CLP",
        )

        resp = self.client.patch(f"/api/v1/admin/payments/{payment.id}/status/", {
            "status": "approved",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)

        order.refresh_from_db()
        self.assertEqual(order.status, "paid")

        from apps.analytics.models import IncomeRecord
        self.assertTrue(IncomeRecord.objects.filter(order=order).exists())

    def test_rejecting_payment_cancels_order(self):
        order = _pending_order(self.buyer, total="50000")
        payment = Payment.objects.create(
            order=order, provider=PaymentProvider.GLOBAL66,
            status=PaymentStatus.PENDING, amount=Decimal("50000"), currency="CLP",
        )

        resp = self.client.patch(f"/api/v1/admin/payments/{payment.id}/status/", {
            "status": "rejected",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)

        order.refresh_from_db()
        self.assertEqual(order.status, "cancelled")


class WebhookSignatureRealFormatsTest(TestCase):
    """
    CRÍTICO — bug real encontrado en producción con una compra real: MP
    manda notificaciones en distintos formatos de URL:
      ?id=X&topic=payment            (formato viejo)
      ?data.id=X&type=payment        (formato nuevo)
      ?id=X&topic=merchant_order     (otro tipo de evento)
    Antes, verify_mp_webhook_signature solo buscaba "data.id" en la URL,
    así que para el formato viejo (?id=...) el id quedaba vacío, el
    manifest se armaba mal, y la firma NUNCA coincidía — el webhook se
    rechazaba con 401 aunque el secreto estuviera bien configurado.
    """
    def setUp(self):
        self.secret = "test-secret-key"

    def _make_signature(self, data_id, request_id, ts):
        import hmac, hashlib
        manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
        return hmac.new(self.secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()

    @override_settings(MP_CL_WEBHOOK_SECRET="test-secret-key")
    def test_old_format_id_query_param_validates_correctly(self):
        """El formato que rompía: ?id=X&topic=payment (sin data.id)."""
        from apps.payments.services import verify_mp_webhook_signature
        from apps.payments.models import PaymentProvider
        from rest_framework.test import APIRequestFactory

        ts = "1234567890"
        request_id = "req-abc-123"
        data_id = "171025041287"
        v1 = self._make_signature(data_id, request_id, ts)

        factory = APIRequestFactory()
        request = factory.post(
            f"/api/v1/payments/webhook/mercadopago/cl/?id={data_id}&topic=payment",
            HTTP_X_SIGNATURE=f"ts={ts},v1={v1}",
            HTTP_X_REQUEST_ID=request_id,
        )
        from rest_framework.request import Request
        drf_request = Request(request)

        self.assertTrue(verify_mp_webhook_signature(drf_request, PaymentProvider.MERCADOPAGO_CL))

    @override_settings(MP_CL_WEBHOOK_SECRET="test-secret-key")
    def test_new_format_data_id_query_param_still_validates(self):
        """El formato nuevo (?data.id=X&type=payment) — confirma que no rompimos esto."""
        from apps.payments.services import verify_mp_webhook_signature
        from apps.payments.models import PaymentProvider
        from rest_framework.test import APIRequestFactory
        from rest_framework.request import Request

        ts = "1234567890"
        request_id = "req-xyz-456"
        data_id = "171025041287"
        v1 = self._make_signature(data_id, request_id, ts)

        factory = APIRequestFactory()
        request = factory.post(
            f"/api/v1/payments/webhook/mercadopago/cl/?data.id={data_id}&type=payment",
            HTTP_X_SIGNATURE=f"ts={ts},v1={v1}",
            HTTP_X_REQUEST_ID=request_id,
        )
        drf_request = Request(request)

        self.assertTrue(verify_mp_webhook_signature(drf_request, PaymentProvider.MERCADOPAGO_CL))

    @override_settings(MP_CL_WEBHOOK_SECRET="test-secret-key")
    def test_wrong_signature_still_rejected(self):
        """Confirma que el fix no abrió la puerta a firmas inválidas."""
        from apps.payments.services import verify_mp_webhook_signature
        from apps.payments.models import PaymentProvider
        from rest_framework.test import APIRequestFactory
        from rest_framework.request import Request

        factory = APIRequestFactory()
        request = factory.post(
            "/api/v1/payments/webhook/mercadopago/cl/?id=171025041287&topic=payment",
            HTTP_X_SIGNATURE="ts=1234567890,v1=firma_invalida_a_proposito",
            HTTP_X_REQUEST_ID="req-1",
        )
        drf_request = Request(request)

        self.assertFalse(verify_mp_webhook_signature(drf_request, PaymentProvider.MERCADOPAGO_CL))


class WebhookQueryParamsFallbackTest(TestCase):
    """
    Segundo bug encontrado en el mismo incidente: process_mercadopago_webhook
    solo miraba el CUERPO del request para topic/id — pero MP a veces manda
    esa info solo en los query params de la URL. Confirma que ahora se
    combinan ambas fuentes antes de procesar.
    """
    def setUp(self):
        self.user = User.objects.create_user(email="qpbuyer@test.com", username="qpbuyer", password="x")

    @patch("apps.payments.services.get_mp_sdk")
    def test_topic_and_id_from_query_params_only_still_processes(self, mock_get_sdk):
        from apps.payments.services import process_mercadopago_webhook

        order = _pending_order(self.user, total="1500")
        mock_sdk = MagicMock()
        mock_sdk.payment().get.return_value = {
            "status": 200,
            "response": {
                "id": "171025041287", "status": "approved",
                "external_reference": str(order.id),
                "transaction_amount": 1500,
            },
        }
        mock_get_sdk.return_value = mock_sdk

        # Simula exactamente lo que arma la vista: query params + body (vacío)
        data = {"id": "171025041287", "topic": "payment"}
        process_mercadopago_webhook(data, PaymentProvider.MERCADOPAGO_CL)

        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PAID)

    @patch("apps.payments.services.get_mp_sdk")
    def test_merchant_order_topic_without_matching_id_is_ignored_safely(self, mock_get_sdk):
        """merchant_order con un id que no corresponde a ningún pago real
        — no debe romper, solo no encontrar nada que procesar."""
        from apps.payments.services import process_mercadopago_webhook

        mock_sdk = MagicMock()
        mock_sdk.payment().get.return_value = {"status": 404, "response": {}}
        mock_get_sdk.return_value = mock_sdk

        data = {"id": "43307324538", "topic": "merchant_order"}
        # No debe lanzar ninguna excepción
        process_mercadopago_webhook(data, PaymentProvider.MERCADOPAGO_CL)

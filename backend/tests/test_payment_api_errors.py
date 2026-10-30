"""Payment API errors must not disclose SDK responses or internal exceptions."""

import json
import logging
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.users.models import User


pytestmark = pytest.mark.django_db

CREATE_URL = "/api/v1/payments/create/"
CAPTURE_URL = "/api/v1/payments/paypal/capture/"
PRIVATE_DETAIL = "test-only-secret /internal/payments.py database=private-test-db"
CREATE_ERROR = "Error al procesar el pago. Intenta de nuevo."
CAPTURE_ERROR = (
    "No pudimos confirmar el pago de PayPal. "
    "Revisa el estado de tu orden antes de volver a pagar."
)


@pytest.fixture
def buyer():
    return User.objects.create_user(
        email="payment-errors@example.test", username="payment-errors", password="x"
    )


@pytest.fixture
def client(buyer):
    client = APIClient()
    client.force_authenticate(user=buyer)
    return client


@pytest.fixture
def order(buyer):
    return Order.objects.create(
        user=buyer, email=buyer.email, shipping_address="Test 123",
        total=Decimal("50000"), status=OrderStatus.PENDING,
        stock_deductions={},
    )


@pytest.fixture
def paypal_payment(order):
    return Payment.objects.create(
        order=order, provider=PaymentProvider.PAYPAL,
        amount=Decimal("50.00"), currency="USD",
        preference_id="PAY-test-capture", status=PaymentStatus.PENDING,
    )


def post_json(client, url, payload):
    # APIClient.post(None) otherwise sends an empty form, not JSON null.
    return client.generic(
        "POST", url, json.dumps(payload), content_type="application/json"
    )


def assert_private_failure(response, message, caplog):
    assert response.status_code == 500
    assert response["Content-Type"].startswith("application/json")
    body = response.json()
    assert set(body) == {"error", "error_id"}
    assert body["error"] == message
    assert UUID(body["error_id"]).version == 4
    assert PRIVATE_DETAIL not in response.content.decode()
    assert "Traceback" not in response.content.decode()
    matching = [
        record for record in caplog.records
        if record.name == "apps.payments.views"
        and body["error_id"] in record.getMessage()
    ]
    assert len(matching) == 1
    assert matching[0].exc_info is not None
    return body["error_id"]


@pytest.mark.parametrize("debug", [False, True])
@pytest.mark.parametrize("provider,service", [
    ("mercadopago_cl", "create_mercadopago_preference"),
    ("mercadopago_ar", "create_mercadopago_preference"),
    ("paypal", "create_paypal_order"),
    ("global66", "get_global66_info"),
])
def test_create_hides_internal_error_and_logs_reference(
    client, order, provider, service, debug, settings, caplog
):
    settings.DEBUG = debug
    with patch(f"apps.payments.views.{service}", side_effect=RuntimeError(PRIVATE_DETAIL)):
        with caplog.at_level(logging.ERROR):
            response = client.post(CREATE_URL, {
                "order_id": str(order.pk), "provider": provider,
            }, format="json")

    assert_private_failure(response, CREATE_ERROR, caplog)
    assert str(order.pk) in caplog.text
    assert provider in caplog.text
    order.refresh_from_db()
    assert order.status == OrderStatus.PENDING
    assert not Payment.objects.exists()


@pytest.mark.parametrize("provider", ["transfer", "payoneer"])
def test_manual_payment_storage_error_is_private(client, order, provider, caplog):
    with patch("apps.payments.models.Payment.objects.create", side_effect=RuntimeError(PRIVATE_DETAIL)):
        response = client.post(CREATE_URL, {
            "order_id": str(order.pk), "provider": provider,
        }, format="json")
    assert_private_failure(response, CREATE_ERROR, caplog)


def test_order_lookup_failure_is_private(client, order, caplog):
    with patch("apps.payments.views.Order.objects.get", side_effect=RuntimeError(PRIVATE_DETAIL)):
        response = client.post(CREATE_URL, {
            "order_id": str(order.pk), "provider": "paypal",
        }, format="json")
    assert_private_failure(response, CREATE_ERROR, caplog)


@pytest.mark.parametrize("url", [CREATE_URL, CAPTURE_URL])
@pytest.mark.parametrize("payload", [None, [], [{}], "not-an-object", 42, True])
def test_non_object_body_is_a_client_error(client, url, payload):
    with patch("apps.payments.views.create_paypal_order") as create:
        with patch("apps.payments.views.capture_paypal_payment") as capture:
            response = post_json(client, url, payload)
    assert response.status_code == 400
    assert set(response.json()) == {"error"}
    create.assert_not_called()
    capture.assert_not_called()
    assert not Payment.objects.exists()


@pytest.mark.parametrize("order_id", [None, "", "not-a-uuid", [], {}, 2.5])
def test_invalid_order_id_never_reaches_payment_service(client, order_id):
    with patch("apps.payments.views.create_paypal_order") as create:
        response = client.post(CREATE_URL, {
            "order_id": order_id, "provider": "paypal",
        }, format="json")
    assert response.status_code == 400
    create.assert_not_called()


@pytest.mark.parametrize("provider", [None, "", "bitcoin", "cash", [], {}])
def test_invalid_provider_is_a_client_error(client, order, provider):
    response = client.post(CREATE_URL, {
        "order_id": str(order.pk), "provider": provider,
    }, format="json")
    assert response.status_code == 400
    assert not Payment.objects.exists()


@pytest.mark.parametrize("field", ["paypal_payment_id", "payer_id"])
@pytest.mark.parametrize("value", [None, "", "   ", [], {}, True, "x" * 256])
def test_invalid_capture_reference_does_not_call_service(client, field, value):
    payload = {"paypal_payment_id": "PAY-test-capture", "payer_id": "PAYER123"}
    payload[field] = value
    with patch("apps.payments.views.capture_paypal_payment") as capture:
        response = client.post(CAPTURE_URL, payload, format="json")
    assert response.status_code == 400
    capture.assert_not_called()


@pytest.mark.parametrize("url,payload", [
    (CREATE_URL, {"provider": "paypal"}),
    (CREATE_URL, {"order_id": "00000000-0000-0000-0000-000000000001"}),
    (CAPTURE_URL, {"paypal_payment_id": "PAY-test-capture"}),
    (CAPTURE_URL, {"payer_id": "PAYER123"}),
])
def test_missing_required_field_is_a_client_error(client, url, payload):
    with patch("apps.payments.views.create_paypal_order") as create:
        with patch("apps.payments.views.capture_paypal_payment") as capture:
            response = client.post(url, payload, format="json")
    assert response.status_code == 400
    create.assert_not_called()
    capture.assert_not_called()


@pytest.mark.parametrize("debug", [False, True])
@pytest.mark.parametrize("stage", ["find", "execute"])
def test_paypal_sdk_exception_is_private_and_does_not_approve_order(
    client, paypal_payment, stage, debug, settings, caplog
):
    settings.DEBUG = debug
    with patch("apps.payments.services.configure_paypal"):
        with patch("apps.payments.services.paypalrestsdk.Payment.find") as find:
            if stage == "find":
                find.side_effect = RuntimeError(PRIVATE_DETAIL)
            else:
                find.return_value.execute.side_effect = RuntimeError(PRIVATE_DETAIL)
            response = client.post(CAPTURE_URL, {
                "paypal_payment_id": paypal_payment.preference_id, "payer_id": "PAYER123",
            }, format="json")

    assert_private_failure(response, CAPTURE_ERROR, caplog)
    paypal_payment.refresh_from_db()
    assert paypal_payment.status == PaymentStatus.PENDING
    assert paypal_payment.paid_at is None
    assert paypal_payment.order.status == OrderStatus.PENDING


def test_capture_success_keeps_existing_response(client, buyer, paypal_payment):
    with patch("apps.payments.views.capture_paypal_payment", return_value=True) as capture:
        response = client.post(CAPTURE_URL, {
            "paypal_payment_id": paypal_payment.preference_id, "payer_id": "PAYER123",
        }, format="json")
    assert response.status_code == 200
    assert response.json() == {"status": "approved"}
    capture.assert_called_once_with(paypal_payment.preference_id, "PAYER123", buyer)


def test_error_after_successful_capture_does_not_reverse_payment(client, paypal_payment, caplog):
    with patch("apps.payments.services.configure_paypal"):
        with patch("apps.payments.services.paypalrestsdk.Payment.find") as find:
            find.return_value.execute.return_value = True
            find.return_value.transactions[0].amount.total = "50.00"
            find.return_value.to_dict.return_value = {}
            with patch(
                "apps.payments.services.send_payment_confirmation_email",
                side_effect=RuntimeError(PRIVATE_DETAIL),
            ):
                response = client.post(CAPTURE_URL, {
                    "paypal_payment_id": paypal_payment.preference_id, "payer_id": "PAYER123",
                }, format="json")
    assert_private_failure(response, CAPTURE_ERROR, caplog)
    paypal_payment.refresh_from_db()
    assert paypal_payment.status == PaymentStatus.APPROVED
    assert paypal_payment.paid_at is not None
    assert paypal_payment.order.status == OrderStatus.PAID


def test_capture_rejection_keeps_existing_response(client):
    with patch("apps.payments.views.capture_paypal_payment", return_value=False):
        response = client.post(CAPTURE_URL, {
            "paypal_payment_id": "PAY-test-capture", "payer_id": "PAYER123",
        }, format="json")
    assert response.status_code == 400
    assert response.json() == {"error": "Error al capturar el pago de PayPal."}


def test_capture_cannot_call_sdk_for_another_users_payment(client, paypal_payment):
    stranger = User.objects.create_user(
        email="stranger@example.test", username="stranger", password="x"
    )
    client.force_authenticate(user=stranger)
    with patch("apps.payments.services.paypalrestsdk.Payment.find") as find:
        response = client.post(CAPTURE_URL, {
            "paypal_payment_id": paypal_payment.preference_id, "payer_id": "PAYER123",
        }, format="json")
    assert response.status_code == 400
    find.assert_not_called()


def test_unknown_order_stays_404(client):
    with patch("apps.payments.views.create_paypal_order") as create:
        response = client.post(CREATE_URL, {
            "order_id": str(uuid4()), "provider": "paypal",
        }, format="json")
    assert response.status_code == 404
    assert response.json() == {"error": "Orden no encontrada."}
    create.assert_not_called()


def test_error_references_are_unique(client, order):
    with patch("apps.payments.views.create_paypal_order", side_effect=RuntimeError(PRIVATE_DETAIL)):
        responses = [client.post(CREATE_URL, {
            "order_id": str(order.pk), "provider": "paypal",
        }, format="json") for _ in range(2)]
    assert responses[0].json()["error_id"] != responses[1].json()["error_id"]

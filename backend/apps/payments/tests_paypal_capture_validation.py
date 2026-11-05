"""Capture validation using the real SDK resource and a mocked HTTP transport."""

from copy import deepcopy
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import paypalrestsdk
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.analytics.models import IncomeRecord
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.payments.services import capture_paypal_payment


pytestmark = pytest.mark.django_db
CAPTURE_URL = "/api/v1/payments/paypal/capture/"


def response_for(amount):
    return {"id": "PAY-validation", "state": "approved", "transactions": [{"amount": amount}]}


@pytest.fixture
def payment():
    user = get_user_model().objects.create_user(
        email="capture-validation@example.test", username="capture-validation", password="test",
    )
    order = Order.objects.create(
        user=user, email=user.email, shipping_address="Synthetic address",
        total=Decimal("95000.00"), currency="CLP", status="pending",
    )
    return Payment.objects.create(
        order=order, provider="paypal", status="pending", amount=Decimal("100.00"),
        currency="USD", preference_id="PAY-validation",
    )


@pytest.fixture
def capture(payment):
    # find() has valid, older data. execute() uses the real SDK merge logic;
    # only the HTTP transport is mocked, so omitted fields cannot hide in mocks.
    api = MagicMock()
    initial = response_for({"total": "100.00", "currency": "USD"})
    initial["state"] = "created"
    remote = paypalrestsdk.Payment(deepcopy(initial), api=api)
    api.post.return_value = response_for({"total": "100.00", "currency": "USD"})
    with patch("apps.payments.services.configure_paypal"), patch(
        "apps.payments.services.paypalrestsdk.Payment.find", return_value=remote,
    ) as find, patch("apps.payments.services.send_payment_confirmation_email") as email:
        yield SimpleNamespace(api=api, remote=remote, find=find, email=email)


def assert_under_review(payment, capture):
    payment.refresh_from_db()
    payment.order.refresh_from_db()
    assert payment.status == "in_review"
    assert payment.paid_at is None
    assert payment.order.status == "pending"
    assert not IncomeRecord.objects.filter(order=payment.order).exists()
    capture.email.assert_not_called()


@pytest.mark.parametrize("amount", [
    pytest.param({"currency": "USD"}, id="missing-total"),
    pytest.param({"total": None, "currency": "USD"}, id="null-total"),
    pytest.param({"total": "", "currency": "USD"}, id="empty-total"),
    pytest.param({"total": "invalid", "currency": "USD"}, id="nonnumeric-total"),
    pytest.param({"total": True, "currency": "USD"}, id="boolean-total"),
    pytest.param({"total": [], "currency": "USD"}, id="list-total"),
    pytest.param({"total": "NaN", "currency": "USD"}, id="not-a-number"),
    pytest.param({"total": "sNaN", "currency": "USD"}, id="signaling-nan"),
    pytest.param({"total": "Infinity", "currency": "USD"}, id="infinity"),
    pytest.param({"total": "-Infinity", "currency": "USD"}, id="negative-infinity"),
    pytest.param({"total": "0.00", "currency": "USD"}, id="zero-total"),
    pytest.param({"total": "-100.00", "currency": "USD"}, id="negative-total"),
    pytest.param({"total": "1e9999999", "currency": "USD"}, id="huge-total"),
    pytest.param({"total": "100.00"}, id="missing-currency"),
    pytest.param({"total": "100.00", "currency": None}, id="null-currency"),
    pytest.param({"total": "100.00", "currency": ""}, id="empty-currency"),
    pytest.param({"total": "100.00", "currency": "EUR"}, id="wrong-currency"),
    pytest.param({"total": "100.00", "currency": "usd"}, id="malformed-currency"),
    pytest.param({"total": "100.00", "currency": ["USD"]}, id="list-currency"),
])
def test_invalid_money_is_kept_for_review(payment, capture, amount):
    payload = response_for(amount)
    capture.api.post.return_value = payload

    assert capture_paypal_payment(payment.preference_id, "PAYER123", payment.order.user) is False

    assert_under_review(payment, capture)
    assert payment.raw_response["transactions"] == payload["transactions"]
    capture.api.post.assert_called_once()


@pytest.mark.parametrize("transactions", [
    pytest.param(None, id="null-transactions"),
    pytest.param([], id="empty-transactions"),
    pytest.param({}, id="object-instead-of-list"),
    pytest.param([None], id="null-transaction"),
    pytest.param([{}], id="missing-amount"),
    pytest.param([{"amount": None}], id="null-amount"),
    pytest.param([{"amount": []}], id="list-amount"),
    pytest.param([{"amount": "100.00 USD"}], id="string-amount"),
    pytest.param([
        {"amount": {"total": "100.00", "currency": "USD"}},
        {"amount": {"total": "100.00", "currency": "USD"}},
    ], id="multiple-transactions"),
])
def test_incomplete_or_ambiguous_transactions_are_kept_for_review(payment, capture, transactions):
    capture.api.post.return_value = {"id": payment.preference_id, "transactions": transactions}
    assert capture_paypal_payment(payment.preference_id, "PAYER123", payment.order.user) is False
    assert_under_review(payment, capture)


def test_execute_cannot_reuse_transactions_from_find(payment, capture):
    capture.api.post.return_value = {"id": payment.preference_id, "state": "approved"}
    assert capture_paypal_payment(payment.preference_id, "PAYER123", payment.order.user) is False
    assert_under_review(payment, capture)
    assert payment.raw_response["transactions"] == []
    # Clearing the local SDK resource must not add fields to the capture POST.
    assert capture.api.post.call_args.args[:2] == (
        "v1/payments/payment/PAY-validation/execute", {"payer_id": "PAYER123"},
    )


@pytest.mark.parametrize("total", ["100.00", "99.00", "101.00"])
def test_valid_capture_preserves_existing_one_percent_tolerance(payment, capture, total):
    capture.api.post.return_value = response_for({"total": total, "currency": "USD"})
    assert capture_paypal_payment(payment.preference_id, "PAYER123", payment.order.user) is True
    payment.refresh_from_db()
    payment.order.refresh_from_db()
    assert payment.status == "approved"
    assert payment.paid_at is not None
    assert payment.order.status == "paid"
    assert IncomeRecord.objects.filter(payment=payment).count() == 1
    capture.email.assert_called_once()


@pytest.mark.parametrize("total", ["98.99", "101.01"])
def test_capture_outside_existing_tolerance_requires_review(payment, capture, total):
    capture.api.post.return_value = response_for({"total": total, "currency": "USD"})
    assert capture_paypal_payment(payment.preference_id, "PAYER123", payment.order.user) is False
    assert_under_review(payment, capture)


def test_usd_order_keeps_its_cents_without_conversion(payment, capture):
    payment.order.total = Decimal("49.99")
    payment.order.currency = "USD"
    payment.order.save(update_fields=["total", "currency"])
    payment.amount = Decimal("49.99")
    payment.save(update_fields=["amount"])
    capture.api.post.return_value = response_for({"total": "49.99", "currency": "USD"})
    assert capture_paypal_payment(payment.preference_id, "PAYER123", payment.order.user) is True
    payment.refresh_from_db()
    assert payment.status == "approved"
    assert payment.amount == Decimal("49.99")


def test_cent_tolerance_uses_decimal_comparison(payment, capture):
    payment.amount = Decimal("1.00")
    payment.save(update_fields=["amount"])
    capture.api.post.return_value = response_for({"total": "0.99", "currency": "USD"})
    assert capture_paypal_payment(payment.preference_id, "PAYER123", payment.order.user) is True


def test_failed_execution_does_not_change_pending_payment(payment, capture):
    capture.api.post.return_value = {"error": {"name": "PAYMENT_NOT_APPROVED_FOR_EXECUTION"}}
    assert capture_paypal_payment(payment.preference_id, "PAYER123", payment.order.user) is False
    payment.refresh_from_db()
    assert payment.status == "pending"
    assert payment.paid_at is None
    assert payment.order.status == "pending"
    capture.email.assert_not_called()


def test_api_does_not_recapture_payment_under_review(payment, capture):
    capture.api.post.return_value = response_for({"total": "100.00", "currency": "EUR"})
    client = APIClient()
    client.force_authenticate(payment.order.user)
    payload = {"paypal_payment_id": payment.preference_id, "payer_id": "PAYER123"}
    first = client.post(CAPTURE_URL, payload, format="json")
    second = client.post(CAPTURE_URL, payload, format="json")
    assert first.status_code == second.status_code == 400
    assert first.json() == second.json() == {"error": "Error al capturar el pago de PayPal."}
    assert_under_review(payment, capture)
    capture.api.post.assert_called_once()
    capture.find.assert_called_once()

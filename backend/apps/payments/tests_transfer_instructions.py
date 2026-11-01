from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.payments.models import BankAccount, Payment, PaymentMethodConfig


@pytest.fixture
def transfer(db):
    user = get_user_model().objects.create_user(email="transfer@example.test", username="transfer", password="x")
    order = Order.objects.create(user=user, email=user.email, shipping_address="Test", total=Decimal("49.99"), currency="USD")
    payment = Payment.objects.create(order=order, provider="transfer", amount=order.total, currency="USD")
    account = BankAccount.objects.create(label="USD transfer", currency="USD", bank_name="Test bank", account_number="TEST-123", holder_name="Test holder")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, order, payment, account


def url(order):
    return f"/api/v1/payments/transfer/{order.pk}/"


def test_reload_is_read_only_and_exact(transfer):
    client, order, payment, account = transfer
    before = list(Payment.objects.values())
    for _ in range(2):
        response = client.get(url(order))
        assert response.status_code == 200
        assert response.data["state"] == "ready"
        assert response.data["amount"] == "49.99"
        assert response.data["currency"] == "USD"
        assert response.data["reference"] == f"LEVELPRO-{str(order.pk)[:8].upper()}"
        assert response.data["bank_accounts"][0]["id"] == account.pk
        assert response["Cache-Control"] == "private, no-store"
    assert list(Payment.objects.values()) == before
    order.refresh_from_db()
    assert order.status == "pending"


def test_other_owner_and_missing_order_are_indistinguishable(transfer):
    client, order, _, _ = transfer
    user = get_user_model().objects.create_user(email="other@example.test", username="other", password="x")
    client.force_authenticate(user=user)
    denied = client.get(url(order))
    missing = client.get(f"/api/v1/payments/transfer/{uuid4()}/")
    assert denied.status_code == missing.status_code == 404
    assert denied.data == missing.data


def test_anonymous_cannot_read(transfer):
    _, order, _, _ = transfer
    assert APIClient().get(url(order)).status_code in (401, 403)


@pytest.mark.parametrize("status,expected", [("paid", "confirmed"), ("shipped", "confirmed"), ("completed", "confirmed"), ("cancelled", "cancelled")])
def test_processed_order_has_no_transfer_details(transfer, status, expected):
    client, order, _, _ = transfer
    Order.objects.filter(pk=order.pk).update(status=status)
    response = client.get(url(order))
    assert response.data["state"] == expected
    assert response.data["bank_accounts"] == []


@pytest.mark.parametrize("status,expected", [("in_review", "review"), ("approved", "review"), ("refunded", "refunded"), ("rejected", "unavailable"), ("cancelled", "unavailable")])
def test_non_pending_payment_has_no_transfer_details(transfer, status, expected):
    client, order, payment, _ = transfer
    Payment.objects.filter(pk=payment.pk).update(status=status)
    response = client.get(url(order))
    assert response.data["state"] == expected
    assert response.data["bank_accounts"] == []


def test_review_of_older_payment_blocks_new_transfer(transfer):
    client, order, payment, _ = transfer
    Payment.objects.filter(pk=payment.pk).update(status="in_review")
    Payment.objects.create(order=order, provider="transfer", amount=order.total, currency="USD")
    assert client.get(url(order)).data["state"] == "review"


@pytest.mark.parametrize("change", ["currency", "inactive", "provider", "amount", "payment_currency"])
def test_never_substitutes_mismatched_details(transfer, change):
    client, order, payment, account = transfer
    if change == "currency":
        account.currency = "CLP"
        account.save()
    elif change == "inactive":
        account.is_active = False
        account.save()
    elif change == "provider":
        account.payment_method = "payoneer"
        account.save()
    elif change == "amount":
        Payment.objects.filter(pk=payment.pk).update(amount=Decimal("9.99"))
    else:
        Payment.objects.filter(pk=payment.pk).update(currency="CLP")
    response = client.get(url(order))
    assert response.data["state"] == "unavailable"
    assert response.data["bank_accounts"] == []


def test_payoneer_uses_its_own_account(transfer):
    client, order, payment, _ = transfer
    Payment.objects.filter(pk=payment.pk).update(provider="payoneer")
    account = BankAccount.objects.create(label="Payoneer", payment_method="payoneer", currency="USD", bank_name="Payoneer test", account_number="USD-TEST", holder_name="Test")
    response = client.get(url(order))
    assert response.data["state"] == "ready"
    assert [row["id"] for row in response.data["bank_accounts"]] == [account.pk]


def test_latest_online_intent_does_not_reuse_old_transfer(transfer):
    client, order, _, _ = transfer
    Payment.objects.create(order=order, provider="paypal", amount=order.total, currency="USD")
    assert client.get(url(order)).data["bank_accounts"] == []


def test_no_payment_is_not_created_on_get(transfer):
    client, order, payment, _ = transfer
    payment.delete()
    assert client.get(url(order)).data["state"] == "unavailable"
    assert not order.payments.exists()


@pytest.mark.parametrize("currency,alias,state", [("CLP", "TEST-ALIAS", "ready"), ("CLP", "", "unavailable"), ("USD", "TEST-ALIAS", "unavailable")])
def test_global66_uses_configured_clp_alias_only(transfer, settings, currency, alias, state):
    client, order, payment, _ = transfer
    settings.GLOBAL66_ALIAS = alias
    Order.objects.filter(pk=order.pk).update(currency=currency)
    Payment.objects.filter(pk=payment.pk).update(provider="global66", currency=currency)
    response = client.get(url(order))
    assert response.data["state"] == state
    assert order.payments.count() == 1
    if state == "ready":
        assert response.data["bank_accounts"][0]["account_number"] == alias
    else:
        assert response.data["bank_accounts"] == []


def test_read_error_is_safe(transfer):
    client, order, _, _ = transfer
    with patch("apps.payments.views.instructions_for", side_effect=RuntimeError("private credential TEST-SECRET")):
        response = client.get(url(order))
    assert response.status_code == 500
    assert len(response.data["error_id"]) == 32
    assert "TEST-SECRET" not in str(response.data)


def test_methods_never_fall_back_to_wrong_currency(transfer):
    client, _, _, _ = transfer
    PaymentMethodConfig.objects.update_or_create(method="transfer", defaults={"is_active": True, "currencies": "CLP,USD"})
    response = client.get("/api/v1/payments/methods/?currency=CLP")
    assert response.data["bank_accounts"] == []


def test_methods_return_payoneer_accounts_without_transfer_enabled(transfer):
    client, _, _, _ = transfer
    PaymentMethodConfig.objects.all().update(is_active=False)
    PaymentMethodConfig.objects.update_or_create(method="payoneer", defaults={"is_active": True, "currencies": "USD"})
    account = BankAccount.objects.create(label="Payoneer", payment_method="payoneer", currency="USD", bank_name="Test", account_number="USD-TEST", holder_name="Test")
    response = client.get("/api/v1/payments/methods/?currency=USD")
    assert [str(row["id"]) for row in response.data["bank_accounts"]] == [str(account.pk)]


def test_admin_can_assign_account_to_payoneer(transfer):
    client, order, _, account = transfer
    order.user.is_staff = True
    order.user.save(update_fields=["is_staff"])
    client.force_authenticate(order.user)
    response = client.patch(f"/api/v1/payments/admin/bank-accounts/{account.pk}/", {"payment_method": "payoneer"}, format="json")
    assert response.status_code == 200
    account.refresh_from_db()
    assert account.payment_method == "payoneer"

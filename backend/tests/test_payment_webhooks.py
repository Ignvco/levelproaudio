"""Webhooks reales por HTTP/HMAC; solo la API externa y el correo se simulan."""

import hashlib
import hmac
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory

from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment, PaymentProvider
from apps.payments.webhooks import verify_mp_webhook_signature
from apps.users.models import User


pytestmark = pytest.mark.django_db
RESOURCE_ID = "171025041287"
REQUEST_ID = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e"
TIMESTAMP = "1742505638683"


def signed_headers(secret, resource_id=RESOURCE_ID, request_id=REQUEST_ID, ts=TIMESTAMP):
    manifest = f"id:{str(resource_id).lower()};request-id:{request_id};ts:{ts};"
    signature = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return {"HTTP_X_SIGNATURE": f"ts={ts},v1={signature}", "HTTP_X_REQUEST_ID": request_id}


@pytest.fixture(params=[
    ("webhook-mp-cl", PaymentProvider.MERCADOPAGO_CL, "MP_CL_WEBHOOK_SECRET", "cl-test-secret"),
    ("webhook-mp-ar", PaymentProvider.MERCADOPAGO_AR, "MP_AR_WEBHOOK_SECRET", "ar-test-secret"),
])
def endpoint(request, settings):
    settings.MP_CL_WEBHOOK_SECRET = "cl-test-secret"
    settings.MP_AR_WEBHOOK_SECRET = "ar-test-secret"
    name, provider, setting, secret = request.param
    return {"url": reverse(name), "provider": provider, "setting": setting, "secret": secret}


@pytest.fixture
def client():
    return APIClient(enforce_csrf_checks=True)


@pytest.fixture
def order():
    user = User.objects.create_user(email="webhook@test.com", username="webhook", password="x")
    return Order.objects.create(
        user=user, email=user.email, shipping_address="dir",
        total=Decimal("1500"), status=OrderStatus.PENDING,
    )


@pytest.fixture
def external(order):
    with patch("apps.payments.services.get_mp_sdk") as get_sdk, \
         patch("apps.payments.services.send_payment_confirmation_email") as email:
        sdk = MagicMock()
        sdk.payment().get.return_value = {"status": 200, "response": {
            "id": RESOURCE_ID, "status": "approved", "external_reference": str(order.id),
            "transaction_amount": 1500,
        }}
        get_sdk.return_value = sdk
        yield get_sdk, sdk, email


def assert_untouched(order, external):
    get_sdk, _, email = external
    get_sdk.assert_not_called()
    email.assert_not_called()
    order.refresh_from_db()
    assert order.status == OrderStatus.PENDING
    assert not Payment.objects.exists()


def url(endpoint, query=None):
    return endpoint["url"] + "?" + (query or f"data.id={RESOURCE_ID}&type=payment")


@pytest.mark.parametrize("query,body", [
    (f"data.id={RESOURCE_ID}&type=payment", {"type": "payment", "data": {"id": RESOURCE_ID}, "id": "event-not-payment"}),
    (f"data.id={RESOURCE_ID}&type=payment", {}),
    (f"id={RESOURCE_ID}&topic=payment", {}),
    (f"id={RESOURCE_ID}&topic=payment", {"id": "notification-id", "topic": "payment"}),
    (f"data.id={RESOURCE_ID}", {"type": "payment", "data": {"id": int(RESOURCE_ID)}}),
    (f"id={RESOURCE_ID}&data.id={RESOURCE_ID}&type=payment", {}),
])
def test_valid_signature_processes_only_the_signed_payment(client, endpoint, order, external, query, body):
    response = client.post(url(endpoint, query), body, format="json", **signed_headers(endpoint["secret"]))
    assert response.status_code == 200
    get_sdk, sdk, email = external
    get_sdk.assert_called_once_with(endpoint["provider"])
    sdk.payment().get.assert_called_once_with(RESOURCE_ID)
    order.refresh_from_db()
    assert order.status == OrderStatus.PAID
    assert Payment.objects.get(external_id=RESOURCE_ID).provider == endpoint["provider"]
    email.assert_called_once()


@pytest.mark.parametrize("secret", ["", "  \t", None])
def test_missing_secret_disables_webhook_even_with_valid_headers(client, endpoint, settings, order, external, secret):
    setattr(settings, endpoint["setting"], secret)
    response = client.post(url(endpoint), {}, format="json", **signed_headers(endpoint["secret"]))
    assert response.status_code == 503
    assert response.data == {"status": "webhook unavailable"}
    assert_untouched(order, external)


@pytest.mark.parametrize("header,value", [
    ("HTTP_X_SIGNATURE", ""),
    ("HTTP_X_REQUEST_ID", ""),
    ("HTTP_X_REQUEST_ID", "altered-request"),
    ("HTTP_X_REQUEST_ID", "bad;ts:123"),
    ("HTTP_X_SIGNATURE", f"ts={TIMESTAMP},v1=" + "0" * 64),
    ("HTTP_X_SIGNATURE", f"ts={TIMESTAMP},v1=ñ"),
    ("HTTP_X_SIGNATURE", "ts=abc,v1=" + "0" * 64),
    ("HTTP_X_SIGNATURE", "ts=0,v1=" + "0" * 64),
    ("HTTP_X_SIGNATURE", "ts=-1,v1=" + "0" * 64),
    ("HTTP_X_SIGNATURE", "ts=" + "1" * 100 + ",v1=" + "0" * 64),
    ("HTTP_X_SIGNATURE", f"ts={TIMESTAMP}"),
    ("HTTP_X_SIGNATURE", "v1=" + "0" * 64),
    ("HTTP_X_SIGNATURE", f"ts={TIMESTAMP},v1=short"),
])
def test_bad_headers_are_rejected_without_side_effects(client, endpoint, order, external, header, value):
    headers = signed_headers(endpoint["secret"])
    headers[header] = value
    response = client.post(url(endpoint), {}, format="json", **headers)
    assert response.status_code == 401
    assert_untouched(order, external)


@pytest.mark.parametrize("part", ["ts", "v1"])
def test_duplicate_signature_components_are_rejected(client, endpoint, order, external, part):
    headers = signed_headers(endpoint["secret"])
    original = headers["HTTP_X_SIGNATURE"]
    headers["HTTP_X_SIGNATURE"] += "," + next(p for p in original.split(",") if p.startswith(part + "="))
    response = client.post(url(endpoint), {}, format="json", **headers)
    assert response.status_code == 401
    assert_untouched(order, external)


def test_other_country_secret_cannot_authenticate(client, endpoint, order, external):
    other = "ar-test-secret" if endpoint["provider"] == PaymentProvider.MERCADOPAGO_CL else "cl-test-secret"
    response = client.post(url(endpoint), {}, format="json", **signed_headers(other))
    assert response.status_code == 401
    assert_untouched(order, external)


@pytest.mark.parametrize("query", [
    "type=payment", "data.id=&type=payment", "data.id=other&type=payment",
    f"id=other&data.id={RESOURCE_ID}&type=payment",
    f"data.id={RESOURCE_ID}&data.id={RESOURCE_ID}&type=payment",
    f"id={RESOURCE_ID}&id=other&topic=payment",
    "data.id=x%3Brequest-id%3Ay&type=payment",
])
def test_missing_ambiguous_or_changed_query_id_is_rejected(client, endpoint, order, external, query):
    # Un ID en el cuerpo nunca sustituye al ID firmado de la URL.
    response = client.post(url(endpoint, query), {"type": "payment", "data": {"id": RESOURCE_ID}},
                           format="json", **signed_headers(endpoint["secret"]))
    assert response.status_code == 401
    assert_untouched(order, external)


@pytest.mark.parametrize("body", [
    [], ["payment"], "payment", 1, {"data": None}, {"data": []},
    {"data": {"id": None}}, {"data": {"id": True}}, {"data": {"id": [RESOURCE_ID]}},
    {"data": {"id": "another-payment"}}, {"type": ["payment"]}, {"type": {}},
    {"type": "merchant_order"}, {"topic": "refund"},
])
def test_malformed_or_conflicting_body_is_rejected(client, endpoint, order, external, body):
    response = client.post(url(endpoint), body, format="json", **signed_headers(endpoint["secret"]))
    assert response.status_code == 400
    assert_untouched(order, external)


@pytest.mark.parametrize("query", [
    f"data.id={RESOURCE_ID}",
    f"data.id={RESOURCE_ID}&type=payment&type=payment",
    f"data.id={RESOURCE_ID}&topic=payment&topic=payment",
    f"data.id={RESOURCE_ID}&type=payment&topic=merchant_order",
])
def test_missing_or_ambiguous_event_type_is_rejected(client, endpoint, order, external, query):
    response = client.post(url(endpoint, query), {}, format="json", **signed_headers(endpoint["secret"]))
    assert response.status_code == 400
    assert_untouched(order, external)


def test_invalid_json_is_a_client_error_not_a_server_error(client, endpoint, order, external):
    response = client.post(url(endpoint), '{"data":', content_type="application/json",
                           **signed_headers(endpoint["secret"]))
    assert response.status_code == 400
    assert_untouched(order, external)


def test_header_whitespace_and_seconds_timestamp_are_supported(client, endpoint, external):
    headers = signed_headers(endpoint["secret"], ts="1742505638")
    headers["HTTP_X_SIGNATURE"] = headers["HTTP_X_SIGNATURE"].replace(",", ", ").replace("v1=", "v1 = ")
    response = client.post(url(endpoint), {}, format="json", **headers)
    assert response.status_code == 200
    external[1].payment().get.assert_called_once_with(RESOURCE_ID)


def test_alphanumeric_id_uses_official_lowercase_manifest(client, endpoint, external):
    headers = signed_headers(endpoint["secret"], resource_id="AbC-123")
    response = client.post(url(endpoint, "data.id=AbC-123&type=payment"), {"data": {"id": "abc-123"}},
                           format="json", **headers)
    assert response.status_code == 200
    external[1].payment().get.assert_called_once_with("abc-123")


def test_webhook_uses_signature_even_if_jwt_cookies_or_header_are_invalid(client, endpoint, external):
    client.cookies["access_token"] = "expired-cookie"
    response = client.post(url(endpoint), {}, format="json", HTTP_AUTHORIZATION="Bearer invalid",
                           **signed_headers(endpoint["secret"]))
    assert response.status_code == 200
    external[1].payment().get.assert_called_once_with(RESOURCE_ID)


def test_valid_browser_session_cannot_replace_provider_signature(client, endpoint, order, external):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = str(RefreshToken.for_user(order.user).access_token)
    client.cookies["access_token"] = token
    response = client.post(url(endpoint), {}, format="json", HTTP_AUTHORIZATION=f"Bearer {token}")
    assert response.status_code == 401
    assert_untouched(order, external)


@pytest.mark.parametrize("topic", ["merchant_order", "topic_merchant_order_wh", "chargebacks", "unknown"])
def test_other_resource_types_do_not_lookup_payment_with_an_unrelated_id(client, endpoint, order, external, topic):
    response = client.post(url(endpoint, f"data.id={RESOURCE_ID}&type={topic}"), {}, format="json",
                           **signed_headers(endpoint["secret"]))
    assert response.status_code == 200
    assert_untouched(order, external)


def test_internal_failure_is_retryable_without_exposing_exception(client, endpoint, order, external):
    external[1].payment().get.side_effect = RuntimeError("private-provider-detail")
    response = client.post(url(endpoint), {}, format="json", **signed_headers(endpoint["secret"]))
    assert response.status_code == 503
    assert response.data == {"status": "error"}
    assert b"private-provider-detail" not in response.content
    assert not Payment.objects.exists()
    order.refresh_from_db()
    assert order.status == OrderStatus.PENDING


def test_unknown_provider_does_not_fall_back_to_chilean_secret(settings):
    settings.MP_CL_WEBHOOK_SECRET = "cl-test-secret"
    request = APIRequestFactory().post(f"/?data.id={RESOURCE_ID}", **signed_headers("cl-test-secret"))
    assert not verify_mp_webhook_signature(Request(request), PaymentProvider.PAYPAL)

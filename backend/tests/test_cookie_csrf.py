"""CSRF real: cookies JWT y APIClient(enforce_csrf_checks=True), sin force_authenticate."""
import importlib
from unittest.mock import patch

import pytest
from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.users.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    cache.clear()
    return APIClient(enforce_csrf_checks=True)


@pytest.fixture
def user():
    return User.objects.create_user(
        email="csrf@test.com", username="csrf", password="ClaveSegura123!",
    )


def csrf_headers(client):
    response = client.get(reverse("auth-csrf"))
    assert response.status_code == 200
    return {"HTTP_X_CSRFTOKEN": response.data["csrfToken"]}


def cookie_session(client, user):
    refresh = RefreshToken.for_user(user)
    client.cookies[settings.AUTH_COOKIE_ACCESS] = str(refresh.access_token)
    client.cookies[settings.AUTH_COOKIE_REFRESH] = str(refresh)
    return refresh


def assert_csrf_rejected(response):
    assert response.status_code == 403
    assert response.data["code"] == "csrf_failed"


def test_bootstrap_sets_readable_cookie_without_auth_and_is_not_cacheable(client):
    # Una sesión vencida no debe impedir recuperar el token CSRF.
    client.cookies[settings.AUTH_COOKIE_ACCESS] = "expired-access"
    response = client.get(reverse("auth-csrf"))
    assert response.status_code == 200
    cookie = response.cookies[settings.CSRF_COOKIE_NAME]
    assert len(cookie.value) == 32
    assert not cookie["httponly"]
    assert cookie["secure"]
    assert len(response.data["csrfToken"]) == 64
    assert "no-store" in response["Cache-Control"]
    assert "Cookie" in response["Vary"]
    assert settings.AUTH_COOKIE_ACCESS not in response.cookies


def test_login_without_csrf_cannot_create_a_session(client, user):
    response = client.post(reverse("auth-login"), {
        "email": user.email, "password": "ClaveSegura123!",
    }, format="json")
    assert_csrf_rejected(response)
    assert settings.AUTH_COOKIE_ACCESS not in response.cookies
    assert settings.AUTH_COOKIE_REFRESH not in response.cookies


def test_login_rotates_csrf_and_next_write_accepts_only_new_token(client, user):
    previous = csrf_headers(client)
    before_cookie = client.cookies[settings.CSRF_COOKIE_NAME].value
    response = client.post(reverse("auth-login"), {
        "email": user.email, "password": "ClaveSegura123!",
    }, format="json", **previous)
    assert response.status_code == 200
    assert response.data == {"detail": "ok"}
    assert response.cookies[settings.AUTH_COOKIE_ACCESS]["httponly"]
    assert response.cookies[settings.AUTH_COOKIE_REFRESH]["httponly"]
    new_token = client.cookies[settings.CSRF_COOKIE_NAME].value
    assert new_token != before_cookie
    rejected = client.patch(reverse("auth-profile"), {"first_name": "Rechazado"},
                            format="json", **previous)
    assert_csrf_rejected(rejected)
    accepted = client.patch(reverse("auth-profile"), {"first_name": "Permitido"},
                            format="json", HTTP_X_CSRFTOKEN=new_token)
    assert accepted.status_code == 200
    user.refresh_from_db()
    assert user.first_name == "Permitido"


@pytest.mark.parametrize("format", ["json", "multipart"])
def test_cookie_write_with_matching_csrf_is_allowed(client, user, format):
    cookie_session(client, user)
    response = client.patch(reverse("auth-profile"), {"first_name": "Cambio"},
                            format=format, **csrf_headers(client))
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.first_name == "Cambio"


@pytest.mark.parametrize("missing", ["header", "cookie", "both", "mismatch"])
def test_cookie_write_requires_cookie_and_matching_token(client, user, missing):
    cookie_session(client, user)
    headers = csrf_headers(client)
    if missing in ("header", "both"):
        headers = {}
    if missing in ("cookie", "both"):
        del client.cookies[settings.CSRF_COOKIE_NAME]
    if missing == "mismatch":
        headers = {"HTTP_X_CSRFTOKEN": "A" * 32}
    response = client.patch(reverse("auth-profile"), {"first_name": "Intruso"},
                            format="json", **headers)
    assert_csrf_rejected(response)
    user.refresh_from_db()
    assert user.first_name == ""


@pytest.mark.parametrize("method", ["get", "head", "options"])
def test_cookie_read_does_not_require_csrf(client, user, method):
    cookie_session(client, user)
    assert getattr(client, method)(reverse("auth-profile")).status_code == 200


def test_explicit_bearer_works_without_csrf_even_with_stale_cookie(client, user):
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies[settings.AUTH_COOKIE_ACCESS] = "stale-cookie"
    response = client.patch(reverse("auth-profile"), {"first_name": "API"},
                            format="json", HTTP_AUTHORIZATION=f"Bearer {token}")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.first_name == "API"


def test_untrusted_origin_rejected_even_with_correct_token(client, user):
    cookie_session(client, user)
    response = client.patch(reverse("auth-profile"), {"first_name": "Intruso"},
                            format="json", HTTP_ORIGIN="https://evil.example",
                            **csrf_headers(client))
    assert_csrf_rejected(response)


@pytest.mark.parametrize("origin", ["https://levelproaudio.com", "https://www.levelproaudio.com"])
def test_production_origins_work_through_internal_proxy_host(client, user, monkeypatch, origin):
    for name in ["DJANGO_ALLOWED_HOSTS", "GCS_BUCKET_NAME", "GCS_PROJECT_ID"]:
        monkeypatch.setenv(name, "test-value")
    monkeypatch.delenv("CSRF_TRUSTED_ORIGINS", raising=False)
    production = importlib.reload(importlib.import_module("config.settings.production"))
    cookie_session(client, user)
    headers = csrf_headers(client)
    with override_settings(CSRF_TRUSTED_ORIGINS=production.CSRF_TRUSTED_ORIGINS):
        response = client.patch(reverse("auth-profile"), {"first_name": "Proxy"},
                                format="json", secure=True,
                                HTTP_HOST="levelproaudio-backend.internal",
                                HTTP_ORIGIN=origin, **headers)
    assert response.status_code == 200


@pytest.mark.parametrize("in_body", [False, True])
def test_refresh_without_csrf_is_rejected_before_token_rotation(client, user, in_body):
    refresh = cookie_session(client, user)
    data = {"refresh": str(refresh)} if in_body else {}
    if in_body:
        client.cookies.clear()
    response = client.post(reverse("auth-token-refresh"), data, format="json")
    assert_csrf_rejected(response)
    assert not BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()
    assert settings.AUTH_COOKIE_ACCESS not in response.cookies


def test_refresh_works_with_expired_access_and_valid_csrf(client, user):
    refresh = cookie_session(client, user)
    client.cookies[settings.AUTH_COOKIE_ACCESS] = "expired-access"
    headers = csrf_headers(client)
    csrf_before = client.cookies[settings.CSRF_COOKIE_NAME].value
    response = client.post(reverse("auth-token-refresh"), {}, format="json", **headers)
    assert response.status_code == 200
    assert response.data == {"detail": "ok"}
    assert response.cookies[settings.AUTH_COOKIE_REFRESH].value != str(refresh)
    assert BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()
    assert client.cookies[settings.CSRF_COOKIE_NAME].value == csrf_before
    assert client.get(reverse("auth-profile")).status_code == 200


def test_logout_without_csrf_does_not_clear_or_blacklist_session(client, user):
    refresh = cookie_session(client, user)
    response = client.post(reverse("auth-logout"), {}, format="json")
    assert_csrf_rejected(response)
    assert settings.AUTH_COOKIE_REFRESH not in response.cookies
    assert not BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()


def test_logout_with_expired_access_still_clears_and_blacklists_refresh(client, user):
    refresh = cookie_session(client, user)
    client.cookies[settings.AUTH_COOKIE_ACCESS] = "expired-access"
    response = client.post(reverse("auth-logout"), {}, format="json", **csrf_headers(client))
    assert response.status_code == 200
    assert response.cookies[settings.AUTH_COOKIE_ACCESS]["max-age"] == 0
    assert response.cookies[settings.AUTH_COOKIE_REFRESH]["max-age"] == 0
    assert BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()


@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_login_requires_csrf_before_verifying_credentials(verify, client):
    response = client.post(reverse("auth-google"), {"credential": "credential"}, format="json")
    assert_csrf_rejected(response)
    verify.assert_not_called()


@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_login_with_csrf_rotates_cookie_and_recovers_stale_access(verify, client):
    verify.return_value = {"email": "google-csrf@test.com", "email_verified": True}
    client.cookies[settings.AUTH_COOKIE_ACCESS] = "expired-access"
    headers = csrf_headers(client)
    csrf_before = client.cookies[settings.CSRF_COOKIE_NAME].value
    response = client.post(reverse("auth-google"), {"credential": "credential"},
                           format="json", **headers)
    assert response.status_code == 200
    assert response.cookies[settings.AUTH_COOKIE_ACCESS]["httponly"]
    assert client.cookies[settings.CSRF_COOKIE_NAME].value != csrf_before


@pytest.mark.parametrize("endpoint", ["auth-login", "auth-google", "auth-token-refresh", "auth-logout"])
def test_auth_endpoints_reject_foreign_origin_with_matching_token(client, endpoint):
    response = client.post(reverse(endpoint), {}, format="json",
                           HTTP_ORIGIN="https://evil.example", **csrf_headers(client))
    assert_csrf_rejected(response)


@patch("apps.payments.views.process_mercadopago_webhook")
@override_settings(MP_CL_WEBHOOK_SECRET="csrf-webhook-test-secret")
def test_verified_provider_webhook_does_not_need_browser_csrf(process, client):
    import hashlib
    import hmac
    manifest = "id:123;request-id:csrf-test;ts:1742505638683;"
    signature = hmac.new(b"csrf-webhook-test-secret", manifest.encode(), hashlib.sha256).hexdigest()
    response = client.post(reverse("webhook-mp-cl") + "?data.id=123&type=payment",
                           {"type": "payment", "data": {"id": "123"}}, format="json",
                           HTTP_X_SIGNATURE=f"ts=1742505638683,v1={signature}",
                           HTTP_X_REQUEST_ID="csrf-test")
    assert response.status_code == 200
    process.assert_called_once()

# tests/test_users_auth.py
#
# Cubre el flujo de autenticación real (no era testeado antes):
#   - Registro público
#   - Login: tokens SOLO en cookies HttpOnly, nunca en el body
#   - /profile/ exige autenticación
#   - Password reset: respuesta genérica exista o no el email (anti-enumeración)

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.users.models import User


@pytest.mark.django_db
def test_register_creates_user():
    client = APIClient()
    resp = client.post(reverse("auth-register"), {
        "email": "nuevo@test.com",
        "username": "nuevo",
        "password": "ContraseñaSegura123!",
        "password2": "ContraseñaSegura123!",
    }, format="json")

    assert resp.status_code == 201
    assert User.objects.filter(email="nuevo@test.com").exists()


@pytest.mark.django_db
def test_login_sets_httponly_cookies_not_body():
    User.objects.create_user(email="user@test.com", username="user", password="clave123!")
    client = APIClient()

    resp = client.post(reverse("auth-login"), {
        "email": "user@test.com", "password": "clave123!",
    }, format="json")

    assert resp.status_code == 200
    # Los tokens NUNCA deben viajar en el body de la respuesta.
    assert "access" not in resp.data
    assert "refresh" not in resp.data
    # Deben estar en cookies HttpOnly.
    assert resp.cookies.get("access_token") or resp.cookies.get("access")
    access_cookie = resp.cookies.get("access_token") or resp.cookies.get("access")
    assert access_cookie["httponly"]


@pytest.mark.django_db
def test_login_wrong_password_rejected():
    User.objects.create_user(email="user@test.com", username="user", password="clave123!")
    client = APIClient()

    resp = client.post(reverse("auth-login"), {
        "email": "user@test.com", "password": "incorrecta",
    }, format="json")

    assert resp.status_code == 401


@pytest.mark.django_db
def test_profile_requires_authentication():
    client = APIClient()
    resp = client.get(reverse("auth-profile"))
    assert resp.status_code == 401


@pytest.mark.django_db
def test_profile_returns_own_data_when_authenticated():
    user = User.objects.create_user(email="user@test.com", username="user", password="clave123!")
    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.get(reverse("auth-profile"))
    assert resp.status_code == 200
    assert resp.data["email"] == "user@test.com"


@pytest.mark.django_db
def test_password_reset_same_response_for_existing_and_nonexisting_email():
    """Anti-enumeración: la respuesta debe ser idéntica exista o no el email."""
    User.objects.create_user(email="existe@test.com", username="existe", password="x")
    client = APIClient()

    resp_existing = client.post(reverse("auth-password-reset"), {"email": "existe@test.com"}, format="json")
    resp_missing  = client.post(reverse("auth-password-reset"), {"email": "no-existe@test.com"}, format="json")

    assert resp_existing.status_code == 200
    assert resp_missing.status_code == 200
    assert resp_existing.data == resp_missing.data


@pytest.mark.django_db
def test_change_password_requires_authentication():
    client = APIClient()
    resp = client.post(reverse("auth-password-change"), {
        "current_password": "x", "password": "NuevaClave123!", "password2": "NuevaClave123!",
    }, format="json")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_change_password_rejects_wrong_current_password():
    user = User.objects.create_user(email="cp@test.com", username="cp", password="ClaveVieja123!")
    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post(reverse("auth-password-change"), {
        "current_password": "incorrecta", "password": "NuevaClave123!", "password2": "NuevaClave123!",
    }, format="json")
    assert resp.status_code == 400
    user.refresh_from_db()
    assert user.check_password("ClaveVieja123!")  # no cambió


@pytest.mark.django_db
def test_change_password_succeeds_with_correct_current_password():
    user = User.objects.create_user(email="cp2@test.com", username="cp2", password="ClaveVieja123!")
    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post(reverse("auth-password-change"), {
        "current_password": "ClaveVieja123!", "password": "NuevaClave123!", "password2": "NuevaClave123!",
    }, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.check_password("NuevaClave123!")
    assert not user.check_password("ClaveVieja123!")

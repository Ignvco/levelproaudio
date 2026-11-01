from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError, PermissionDenied, Throttled
from rest_framework.test import APIClient
from core.api_errors import safe_exception_handler
from apps.products.models import Product
from apps.loyalty.models import LoyaltyAccount

PRIVATE = "credential=PRIVATE-TEST database/internal.sql storage-signing-secret"


@pytest.fixture
def admin(db):
    user = get_user_model().objects.create_superuser(email="admin-errors@example.test", username="admin-errors", password="x")
    client = APIClient()
    client.force_authenticate(user)
    return client, user


def assert_safe(response, code=500):
    assert response.status_code == code
    assert set(response.data) == {"error", "error_id"}
    assert len(response.data["error_id"]) == 32
    assert PRIVATE not in str(response.data)


def test_unhandled_exception_returns_safe_id_and_logs(caplog):
    try:
        raise RuntimeError(PRIVATE)
    except RuntimeError as exc:
        response = safe_exception_handler(exc, {"view": object()})
    assert_safe(response)
    assert response.data["error_id"] in caplog.text
    assert PRIVATE in caplog.text


@pytest.mark.parametrize("exc,code", [(ValidationError({"field": "Invalid"}), 400), (PermissionDenied(), 403), (Throttled(wait=10), 429)])
def test_expected_drf_errors_keep_status_and_details(exc, code):
    response = safe_exception_handler(exc, {})
    assert response.status_code == code
    assert "error_id" not in response.data
    if code == 429:
        assert response["Retry-After"] == "10"


@pytest.mark.parametrize("method", ["create", "update"])
def test_product_error_rolls_back_and_hides_exception(admin, method):
    client, _ = admin
    product = Product.objects.create(name="Before", slug="before", price=Decimal("100"), stock=3)
    def broken_save(*args, **kwargs):
        Product.objects.filter(pk=product.pk).update(name="Partial write")
        raise RuntimeError(PRIVATE)
    with patch("apps.analytics.views.AdminProductViewSet._save_product", side_effect=broken_save):
        if method == "create":
            response = client.post("/api/v1/admin/products/", {"name": "New"}, format="json")
        else:
            response = client.patch(f"/api/v1/admin/products/{product.pk}/", {"name": "New"}, format="json")
    assert_safe(response)
    product.refresh_from_db()
    assert product.name == "Before"


def test_product_validation_still_400(admin):
    client, _ = admin
    response = client.post("/api/v1/admin/products/", {"name": "Test", "product_type": "invalid"}, format="json")
    assert response.status_code == 400
    assert "tipo de producto" in response.data["error"]


def test_invalid_product_relationship_is_safe_400(admin):
    client, _ = admin
    response = client.post("/api/v1/admin/products/", {"name": "Test", "price": "100", "category": "invalid-uuid"}, format="json")
    assert_safe(response, 400)
    assert not Product.objects.exists()


def test_upload_signing_failure_is_safe(admin):
    client, _ = admin
    with patch("google.cloud.storage.Client", side_effect=RuntimeError(PRIVATE)):
        response = client.post("/api/v1/admin/academy/lessons/upload-url/", {"filename": "test.mp4"}, format="json")
    assert_safe(response)


@pytest.mark.parametrize("payload", [{}, {"user_id": "invalid", "course_id": "invalid"}])
def test_enrollment_invalid_ids_are_400(admin, payload):
    client, _ = admin
    assert client.post("/api/v1/admin/academy/enrollments/create/", payload, format="json").status_code == 400


def test_enrollment_missing_has_safe_404(admin):
    client, _ = admin
    response = client.post("/api/v1/admin/academy/enrollments/create/", {"user_id": str(uuid4()), "course_id": str(uuid4())}, format="json")
    assert response.status_code == 404
    assert response.data == {"error": "Usuario o curso no encontrado."}


@pytest.mark.parametrize("points", ["not-a-number", {}, 1.5, 999999999999999999999])
def test_invalid_points_are_400(admin, points):
    client, user = admin
    response = client.post("/api/v1/loyalty/admin/adjust/", {"user_id": str(user.pk), "points": points}, format="json")
    assert response.status_code == 400


def test_points_failure_does_not_keep_partial_adjustment(admin):
    client, user = admin
    account, _ = LoyaltyAccount.objects.get_or_create(user=user)
    before = account.puntos_canjeados
    with patch("apps.loyalty.views.LoyaltyTransaction.objects.create", side_effect=RuntimeError(PRIVATE)):
        response = client.post("/api/v1/loyalty/admin/adjust/", {"user_id": str(user.pk), "points": -5}, format="json")
    assert_safe(response)
    account.refresh_from_db()
    assert account.puntos_canjeados == before


def test_non_admin_cannot_request_upload(db):
    user = get_user_model().objects.create_user(email="reader-errors@example.test", username="reader-errors", password="x")
    client = APIClient()
    client.force_authenticate(user)
    with patch("google.cloud.storage.Client") as storage:
        response = client.post("/api/v1/admin/academy/lessons/upload-url/", {"filename": "test.mp4"}, format="json")
    assert response.status_code == 403
    storage.assert_not_called()

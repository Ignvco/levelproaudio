"""Tests for POST /api/v1/service-requests/ (ServiceRequest flow)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
CLIENT_EMAIL = os.environ.get("TEST_CLIENT_EMAIL") or os.environ.get("SEED_CLIENT_EMAIL")
CLIENT_PASSWORD = os.environ.get("TEST_CLIENT_PASSWORD") or os.environ.get("SEED_CLIENT_PASSWORD")

if not all([BASE_URL, CLIENT_EMAIL, CLIENT_PASSWORD]):
    pytest.skip(
        "REACT_APP_BACKEND_URL / TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD "
        "(o SEED_*) requeridos para tests de service-requests.",
        allow_module_level=True,
    )
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api/v1"


@pytest.fixture(scope="module")
def client_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login/", json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def service(client_session):
    r = client_session.get(f"{API}/services/mastering/")
    assert r.status_code == 200, r.text[:200]
    return r.json()


def _payload(service_id, **overrides):
    p = {
        "service": service_id,
        "name": "TEST_Cliente Presupuesto",
        "email": "TEST_cliente@test.com",
        "phone": "+56912345678",
        "message": "TEST solicitud automatica",
        "budget": 500000,
        "preferred_date": None,
    }
    p.update(overrides)
    return p


def test_create_service_request_valid(client_session, service):
    r = client_session.post(f"{API}/service-requests/", json=_payload(service["id"]))
    assert r.status_code == 201, r.text[:300]
    data = r.json()
    assert data["name"] == "TEST_Cliente Presupuesto"
    assert str(data.get("budget")).replace(".00", "") in ("500000", "500000.00")


def test_create_service_request_null_budget(client_session, service):
    r = client_session.post(f"{API}/service-requests/", json=_payload(service["id"], budget=None))
    assert r.status_code == 201, r.text[:300]


def test_create_service_request_currency_formatted_budget_fails(client_session, service):
    """Verify the backend still rejects raw '$500.000' — proving frontend must sanitize."""
    r = client_session.post(f"{API}/service-requests/", json=_payload(service["id"], budget="$500.000"))
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "budget" in body


def test_create_service_request_sanitized_500000(client_session, service):
    """Simulate the frontend sanitized value (from '$500.000' → 500000)."""
    r = client_session.post(f"{API}/service-requests/", json=_payload(service["id"], budget=500000))
    assert r.status_code == 201, r.text[:300]


def test_unauth_forbidden():
    r = requests.post(f"{API}/service-requests/", json={"service": 1, "name": "x", "email": "x@x.com", "message": "x"})
    assert r.status_code in (401, 403)


def test_list_service_requests_contains_created(client_session):
    r = client_session.get(f"{API}/service-requests/")
    assert r.status_code == 200
    data = r.json()
    items = data.get("results", data) if isinstance(data, dict) else data
    assert isinstance(items, list)
    assert any(it.get("name", "").startswith("TEST_") for it in items)

"""
Backend tests for LevelPro Loyalty module (Phase 2).
Covers:
- GET /api/v1/loyalty/me/ (auth)
- Admin summary / config GET+PATCH / adjust
- Order create with loyalty_points_redeemed (happy path, below minimum, exceed available)
- Order create WITHOUT loyalty_points_redeemed remains working (regression)
- Signal: award points automatically when order.status -> paid (idempotent)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL, ADMIN_PASS = "ventas@levelproaudio.com", "[REDACTED]"
CLIENT_EMAIL, CLIENT_PASS = "cliente@test.com", "[REDACTED]"


# ── Auth ─────────────────────────────────────────
def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/v1/auth/login/",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text[:200]}"
    return r.json()["access"]


@pytest.fixture(scope="session")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PASS)}"}


@pytest.fixture(scope="session")
def client_headers():
    return {"Authorization": f"Bearer {_login(CLIENT_EMAIL, CLIENT_PASS)}"}


@pytest.fixture(scope="session")
def client_user_id(client_headers):
    r = requests.get(f"{BASE_URL}/api/v1/auth/me/", headers=client_headers, timeout=30)
    if r.status_code != 200:
        r = requests.get(f"{BASE_URL}/api/v1/auth/profile/", headers=client_headers, timeout=30)
    assert r.status_code == 200, f"profile fetch failed {r.status_code}"
    return r.json().get("id") or r.json().get("user", {}).get("id")


# ── Client-facing endpoint ─────────────────────────
class TestMyLoyalty:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/v1/loyalty/me/", timeout=30)
        assert r.status_code in (401, 403)

    def test_me_structure(self, client_headers):
        r = requests.get(f"{BASE_URL}/api/v1/loyalty/me/", headers=client_headers, timeout=30)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        expected = {"nivel", "puntos_disponibles", "puntos_totales", "puntos_canjeados",
                    "valor_disponible", "minimo_canje", "siguiente_nivel",
                    "progreso_nivel", "transactions"}
        assert expected.issubset(data.keys()), f"missing keys: {expected - data.keys()}"
        assert data["nivel"] in ("bronze", "silver", "gold", "platinum")
        assert isinstance(data["transactions"], list)
        assert isinstance(data["puntos_disponibles"], int)


# ── Admin endpoints ────────────────────────────────
class TestAdminLoyalty:
    def test_summary_requires_staff(self, client_headers):
        r = requests.get(f"{BASE_URL}/api/v1/loyalty/admin/summary/",
                         headers=client_headers, timeout=30)
        assert r.status_code == 403

    def test_summary_structure(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/v1/loyalty/admin/summary/",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert "kpis" in data and "accounts" in data
        kpis = data["kpis"]
        for k in ("total_accounts", "total_points_issued",
                  "total_points_available", "total_points_redeemed", "by_nivel"):
            assert k in kpis, f"missing kpi {k}"
        for lvl in ("bronze", "silver", "gold", "platinum"):
            assert lvl in kpis["by_nivel"]
        assert isinstance(data["accounts"], list)
        if data["accounts"]:
            a = data["accounts"][0]
            for k in ("id", "user_id", "user_email", "user_name", "nivel",
                      "puntos_disponibles", "puntos_totales", "puntos_canjeados",
                      "total_ganados", "total_canjeados", "valor_disponible"):
                assert k in a, f"missing account field {k}"

    def test_config_get(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/v1/loyalty/admin/config/",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        for k in ("puntos_por_peso", "peso_por_punto", "minimo_canje",
                  "expiracion_dias", "is_active"):
            assert k in data, f"missing config field {k}"

    def test_config_patch_and_restore(self, admin_headers):
        # Read current
        r = requests.get(f"{BASE_URL}/api/v1/loyalty/admin/config/",
                         headers=admin_headers, timeout=30)
        original = r.json()
        # Patch minimo_canje to 600
        r2 = requests.patch(f"{BASE_URL}/api/v1/loyalty/admin/config/",
                            headers=admin_headers,
                            json={"minimo_canje": 600}, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["minimo_canje"] == 600
        # Verify persistence via GET
        r3 = requests.get(f"{BASE_URL}/api/v1/loyalty/admin/config/",
                          headers=admin_headers, timeout=30)
        assert r3.json()["minimo_canje"] == 600
        # Restore
        requests.patch(f"{BASE_URL}/api/v1/loyalty/admin/config/",
                       headers=admin_headers,
                       json={"minimo_canje": original["minimo_canje"]}, timeout=30)

    def test_adjust_add_and_subtract(self, admin_headers, client_user_id, client_headers):
        # baseline
        b = requests.get(f"{BASE_URL}/api/v1/loyalty/me/", headers=client_headers, timeout=30).json()
        base_available = b["puntos_disponibles"]

        # Add 1500 pts (frontend-style payload)
        r = requests.post(f"{BASE_URL}/api/v1/loyalty/admin/adjust/",
                          headers=admin_headers,
                          json={"user_id": client_user_id, "points": 1500,
                                "reason": "TEST_add"}, timeout=30)
        assert r.status_code == 200, r.text[:200]
        after_add = r.json()["puntos_disponibles"]
        assert after_add == base_available + 1500

        # Subtract 500 pts (backend-style payload)
        r2 = requests.post(f"{BASE_URL}/api/v1/loyalty/admin/adjust/",
                           headers=admin_headers,
                           json={"user_id": client_user_id, "puntos": -500,
                                 "descripcion": "TEST_sub"}, timeout=30)
        assert r2.status_code == 200
        after_sub = r2.json()["puntos_disponibles"]
        assert after_sub == after_add - 500

    def test_adjust_requires_staff(self, client_headers, client_user_id):
        r = requests.post(f"{BASE_URL}/api/v1/loyalty/admin/adjust/",
                          headers=client_headers,
                          json={"user_id": client_user_id, "points": 100,
                                "reason": "TEST"}, timeout=30)
        assert r.status_code == 403


# ── Order creation with/without loyalty ────────────
@pytest.fixture(scope="session")
def product_for_order():
    r = requests.get(f"{BASE_URL}/api/v1/products/", timeout=30)
    assert r.status_code == 200
    products = r.json().get("results", r.json())
    # find any with stock > 0
    for p in products:
        if p.get("stock", 0) > 0 and float(p.get("price", 0)) > 0:
            return p
    pytest.skip("No product with stock available")


class TestOrderLoyalty:
    def test_create_order_without_loyalty_still_works(self, client_headers, product_for_order):
        p = product_for_order
        payload = {
            "email": CLIENT_EMAIL,
            "shipping_address": "Test Address 123",
            "items": [{
                "product": p["id"],
                "product_name": p["name"],
                "price": p["price"],
                "quantity": 1,
            }],
        }
        r = requests.post(f"{BASE_URL}/api/v1/orders/",
                          headers=client_headers, json=payload, timeout=30)
        assert r.status_code == 201, r.text[:300]
        data = r.json()
        assert float(data["total"]) == float(p["price"])
        # No loyalty applied
        assert int(data.get("loyalty_points_redeemed") or 0) == 0
        assert float(data.get("loyalty_discount") or 0) == 0
        # cleanup: cancel
        requests.delete(f"{BASE_URL}/api/v1/orders/{data['id']}/",
                        headers=client_headers, timeout=30)

    def test_create_order_below_minimum_returns_400(self, client_headers, product_for_order, admin_headers, client_user_id):
        # Ensure user has some points (>500)
        requests.post(f"{BASE_URL}/api/v1/loyalty/admin/adjust/",
                      headers=admin_headers,
                      json={"user_id": client_user_id, "points": 1000, "reason": "TEST_setup_min"},
                      timeout=30)
        p = product_for_order
        payload = {
            "email": CLIENT_EMAIL,
            "shipping_address": "Test",
            "loyalty_points_redeemed": 100,   # below minimum 500
            "items": [{"product": p["id"], "product_name": p["name"],
                       "price": p["price"], "quantity": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/v1/orders/",
                          headers=client_headers, json=payload, timeout=30)
        assert r.status_code == 400, r.text[:300]
        assert "error" in r.json() or "Mínimo" in r.text or "minimo" in r.text.lower()

    def test_create_order_exceeds_available_returns_400(self, client_headers, product_for_order):
        # Get current available
        me = requests.get(f"{BASE_URL}/api/v1/loyalty/me/",
                          headers=client_headers, timeout=30).json()
        exceed = me["puntos_disponibles"] + 100000
        p = product_for_order
        payload = {
            "email": CLIENT_EMAIL,
            "shipping_address": "Test",
            "loyalty_points_redeemed": exceed,
            "items": [{"product": p["id"], "product_name": p["name"],
                       "price": p["price"], "quantity": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/v1/orders/",
                          headers=client_headers, json=payload, timeout=30)
        assert r.status_code == 400, r.text[:300]
        body = r.json()
        assert "puntos" in (body.get("error", "") + r.text).lower()

    def test_create_order_with_redeem_happy_path(self, client_headers, product_for_order,
                                                 admin_headers, client_user_id):
        # Ensure user has 1000 points
        requests.post(f"{BASE_URL}/api/v1/loyalty/admin/adjust/",
                      headers=admin_headers,
                      json={"user_id": client_user_id, "points": 1000, "reason": "TEST_setup_happy"},
                      timeout=30)
        me = requests.get(f"{BASE_URL}/api/v1/loyalty/me/",
                          headers=client_headers, timeout=30).json()
        assert me["puntos_disponibles"] >= 500

        p = product_for_order
        # Ensure enough subtotal to cover discount
        qty = max(1, int(500 / max(1, float(p["price"]))) + 1)
        subtotal = float(p["price"]) * qty
        payload = {
            "email": CLIENT_EMAIL,
            "shipping_address": "Test",
            "loyalty_points_redeemed": 500,
            "items": [{"product": p["id"], "product_name": p["name"],
                       "price": p["price"], "quantity": qty}],
        }
        r = requests.post(f"{BASE_URL}/api/v1/orders/",
                          headers=client_headers, json=payload, timeout=30)
        assert r.status_code == 201, r.text[:400]
        data = r.json()
        # NOTE: loyalty_points_redeemed / loyalty_discount are NOT exposed in OrderSerializer
        # (bug: fields missing from serializer). We validate via total + points diff.
        assert abs(float(data["total"]) - (subtotal - 500)) < 1.0, (
            f"Expected total {subtotal - 500}, got {data['total']}"
        )

        # Verify puntos_canjeados incremented
        me2 = requests.get(f"{BASE_URL}/api/v1/loyalty/me/",
                           headers=client_headers, timeout=30).json()
        assert me2["puntos_disponibles"] == me["puntos_disponibles"] - 500

        # cleanup
        requests.delete(f"{BASE_URL}/api/v1/orders/{data['id']}/",
                        headers=client_headers, timeout=30)


# ── Signal: award on paid (idempotent) ─────────────
class TestSignalAward:
    def test_signal_awards_on_paid_and_idempotent(self, client_headers, product_for_order,
                                                  admin_headers):
        """
        Create order, mark as paid via Django ORM (through a debug endpoint would be ideal;
        since there isn't one, we call the signal path indirectly by re-saving via admin.
        We'll do the mutation through a shell command in the container.
        """
        p = product_for_order
        payload = {
            "email": CLIENT_EMAIL,
            "shipping_address": "Test signal",
            "items": [{"product": p["id"], "product_name": p["name"],
                       "price": p["price"], "quantity": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/v1/orders/",
                          headers=client_headers, json=payload, timeout=30)
        assert r.status_code == 201, r.text[:300]
        order_id = r.json()["id"]

        # Fetch baseline points
        me_before = requests.get(f"{BASE_URL}/api/v1/loyalty/me/",
                                 headers=client_headers, timeout=30).json()

        # Trigger signal: mark as paid via django shell
        import subprocess
        cmd = (
            "cd /app/backend && DJANGO_SETTINGS_MODULE=config.settings.local "
            "python manage.py shell -c "
            f"\"from apps.orders.models import Order; "
            f"o=Order.objects.get(id='{order_id}'); o.status='paid'; o.save(); "
            f"o.save();\""  # save twice to test idempotency
        )
        result = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True, timeout=60)
        assert result.returncode == 0, f"shell failed: {result.stderr}"

        me_after = requests.get(f"{BASE_URL}/api/v1/loyalty/me/",
                                headers=client_headers, timeout=30).json()

        # puntos_por_peso default 0.01 -> earned = int(total * 0.01)
        # We just assert points increased and only once (idempotent) after two saves
        earned = me_after["puntos_totales"] - me_before["puntos_totales"]
        expected = int(float(p["price"]) * 0.01)
        assert earned == expected, f"expected {expected} earned, got {earned} (idempotency check)"

        # Cleanup: cannot cancel a paid order; leave it. Points remain.

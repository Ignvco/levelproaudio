"""
Backend regression: LevelPro Audio admin panel endpoints.
Auth via HTTPOnly cookies (JWT). Uses admin credentials.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://lpa-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api/v1"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL") or os.environ.get("SEED_ADMIN_EMAIL")
ADMIN_PASS = os.environ.get("TEST_ADMIN_PASSWORD") or os.environ.get("SEED_ADMIN_PASSWORD")

if not ADMIN_EMAIL or not ADMIN_PASS:
    pytest.skip(
        "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD (o SEED_*) requeridos para tests admin.",
        allow_module_level=True,
    )


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login/", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    return s


# ---------- AUTH ----------
def test_auth_login_and_profile():
    s = requests.Session()
    r = s.post(f"{API}/auth/login/", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text[:300]
    # Cookies set
    assert any(c.name in ("access", "access_token", "jwt") for c in s.cookies), f"cookies={s.cookies.items()}"
    p = s.get(f"{API}/auth/profile/", timeout=10)
    assert p.status_code == 200
    data = p.json()
    assert data.get("email") == ADMIN_EMAIL


# ---------- DASHBOARD / ANALYTICS / EXECUTIVE ----------
@pytest.mark.parametrize("path", [
    "/admin/dashboard/",
    "/admin/analytics/",
    "/admin/executive/",
])
def test_dashboards(admin_session, path):
    r = admin_session.get(f"{API}{path}", timeout=20)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"
    assert isinstance(r.json(), (dict, list))


# ---------- ORDERS ----------
def test_orders_list(admin_session):
    r = admin_session.get(f"{API}/admin/orders/", timeout=20)
    assert r.status_code == 200, r.text[:300]


def test_orders_update_status(admin_session):
    r = admin_session.get(f"{API}/admin/orders/", timeout=20)
    assert r.status_code == 200
    data = r.json()
    orders = data.get("results", data) if isinstance(data, dict) else data
    if not orders:
        pytest.skip("No orders to update")
    oid = orders[0]["id"]
    original = orders[0].get("status", "pending")
    # PATCH to paid
    r2 = admin_session.patch(f"{API}/admin/orders/{oid}/", json={"status": "paid"}, timeout=15)
    assert r2.status_code in (200, 202), f"{r2.status_code} {r2.text[:300]}"
    # verify
    r3 = admin_session.get(f"{API}/admin/orders/{oid}/", timeout=15)
    assert r3.status_code == 200
    assert r3.json().get("status") == "paid"
    # restore
    admin_session.patch(f"{API}/admin/orders/{oid}/", json={"status": original}, timeout=10)


# ---------- PRODUCTS ----------
def test_products_list(admin_session):
    r = admin_session.get(f"{API}/admin/products/", timeout=20)
    assert r.status_code == 200
    data = r.json()
    items = data.get("results", data) if isinstance(data, dict) else data
    assert len(items) > 0
    # is_active should be exposed in list/detail
    first = items[0]
    assert "is_active" in first, f"is_active missing from product serializer: keys={list(first.keys())[:20]}"


def test_product_crud(admin_session):
    # get a category and brand
    cats = admin_session.get(f"{API}/admin/categories/", timeout=15).json()
    cats = cats.get("results", cats) if isinstance(cats, dict) else cats
    brands = admin_session.get(f"{API}/admin/brands/", timeout=15).json()
    brands = brands.get("results", brands) if isinstance(brands, dict) else brands
    if not cats or not brands:
        pytest.skip("No cats/brands")
    payload = {
        "name": f"TEST_Product_{uuid.uuid4().hex[:6]}",
        "price": "99990",
        "category": cats[0]["id"],
        "brand": brands[0]["id"],
        "stock": 5,
        "is_active": True,
        "description": "Test",
    }
    r = admin_session.post(f"{API}/admin/products/", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"CREATE -> {r.status_code} {r.text[:400]}"
    pid = r.json()["id"]
    # UPDATE
    r2 = admin_session.patch(f"{API}/admin/products/{pid}/", json={"price": "88880"}, timeout=15)
    assert r2.status_code in (200, 202), f"UPDATE -> {r2.status_code} {r2.text[:300]}"
    # GET verify
    r3 = admin_session.get(f"{API}/admin/products/{pid}/", timeout=15)
    assert r3.status_code == 200
    assert "is_active" in r3.json(), "ProductDetailSerializer must expose is_active"
    # DELETE
    r4 = admin_session.delete(f"{API}/admin/products/{pid}/", timeout=15)
    assert r4.status_code in (200, 204), f"DELETE -> {r4.status_code}"


# ---------- BRANDS ----------
def test_brand_crud(admin_session):
    payload = {"name": f"TEST_Brand_{uuid.uuid4().hex[:6]}", "slug": f"test-brand-{uuid.uuid4().hex[:6]}"}
    r = admin_session.post(f"{API}/admin/brands/", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text[:300]}"
    bid = r.json()["id"]
    r2 = admin_session.patch(f"{API}/admin/brands/{bid}/", json={"name": payload["name"] + "_upd"}, timeout=15)
    assert r2.status_code in (200, 202)
    r3 = admin_session.delete(f"{API}/admin/brands/{bid}/", timeout=15)
    assert r3.status_code in (200, 204)


# ---------- CATEGORIES ----------
def test_category_crud(admin_session):
    payload = {"name": f"TEST_Cat_{uuid.uuid4().hex[:6]}", "slug": f"test-cat-{uuid.uuid4().hex[:6]}"}
    r = admin_session.post(f"{API}/admin/categories/", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text[:300]}"
    cid = r.json()["id"]
    r2 = admin_session.patch(f"{API}/admin/categories/{cid}/", json={"name": payload["name"] + "_upd"}, timeout=15)
    assert r2.status_code in (200, 202)
    r3 = admin_session.delete(f"{API}/admin/categories/{cid}/", timeout=15)
    assert r3.status_code in (200, 204)


# ---------- USERS & PAYMENTS ----------
def test_users_list(admin_session):
    r = admin_session.get(f"{API}/admin/users/", timeout=15)
    assert r.status_code == 200, r.text[:300]


def test_payments_list(admin_session):
    r = admin_session.get(f"{API}/admin/payments/", timeout=15)
    assert r.status_code == 200, r.text[:300]


# ---------- FINANCE ----------
@pytest.mark.parametrize("path", [
    "/admin/finance/summary/",
    "/admin/finance/categories/",
    "/admin/finance/withdrawals/",
    "/admin/finance/by-product/",
])
def test_finance_endpoints(admin_session, path):
    r = admin_session.get(f"{API}{path}", timeout=20)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"


def test_finance_category_and_withdrawal_crud(admin_session):
    # Category
    payload = {"name": f"TEST_FinCat_{uuid.uuid4().hex[:6]}", "percentage": 5}
    r = admin_session.post(f"{API}/admin/finance/categories/", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
    cid = r.json().get("id")
    if cid:
        rd = admin_session.delete(f"{API}/admin/finance/categories/{cid}/", timeout=15)
        assert rd.status_code in (200, 204)

    # Withdrawal: needs a finance category id
    cats = admin_session.get(f"{API}/admin/finance/categories/", timeout=10).json()
    cats = cats.get("results", cats) if isinstance(cats, dict) else cats
    if not cats:
        pytest.skip("No finance categories to attach withdrawal")
    wpayload = {"category_id": cats[0]["id"], "amount": "1000", "notes": "TEST_withdrawal"}
    rw = admin_session.post(f"{API}/admin/finance/withdrawals/", json=wpayload, timeout=15)
    assert rw.status_code in (200, 201), f"withdrawal create -> {rw.status_code} {rw.text[:400]}"
    wid = rw.json().get("id")
    if wid:
        rd = admin_session.delete(f"{API}/admin/finance/withdrawals/{wid}/", timeout=15)
        assert rd.status_code in (200, 204)


# ---------- BILLING ----------
@pytest.mark.parametrize("path", [
    "/billing/documents/",
    "/billing/config/",
])
def test_billing_endpoints(admin_session, path):
    r = admin_session.get(f"{API}{path}", timeout=15)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"


# ---------- INVENTORY ----------
@pytest.mark.parametrize("path", [
    "/admin/inventory/summary/",
    "/admin/inventory/alerts/",
    "/admin/inventory/rotation/",
    "/admin/inventory/by-category/",
])
def test_inventory_endpoints(admin_session, path):
    r = admin_session.get(f"{API}{path}", timeout=20)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"


# ---------- LOYALTY ----------
@pytest.mark.parametrize("path", [
    "/loyalty/admin/summary/",
    "/loyalty/admin/config/",
])
def test_loyalty_endpoints(admin_session, path):
    r = admin_session.get(f"{API}{path}", timeout=15)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"


# ---------- ACADEMY ----------
@pytest.mark.parametrize("path", [
    "/admin/academy/",
    "/admin/academy/courses/",
    "/admin/academy/modules/",
    "/admin/academy/lessons/",
    "/admin/academy/enrollments/",
])
def test_academy_endpoints(admin_session, path):
    r = admin_session.get(f"{API}{path}", timeout=15)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"


def test_course_crud(admin_session):
    payload = {"title": f"TEST_Course_{uuid.uuid4().hex[:6]}", "slug": f"test-course-{uuid.uuid4().hex[:6]}", "price": "0", "description": "Test course description"}
    r = admin_session.post(f"{API}/admin/academy/courses/", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
    cid = r.json()["id"]
    rd = admin_session.delete(f"{API}/admin/academy/courses/{cid}/", timeout=15)
    assert rd.status_code in (200, 204)


# ---------- SERVICES ----------
@pytest.mark.parametrize("path", [
    "/admin/services/",
    "/admin/services/list/",
    "/admin/service-requests/",
])
def test_services_endpoints(admin_session, path):
    r = admin_session.get(f"{API}{path}", timeout=15)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"


# ---------- REWARDS ----------
@pytest.mark.parametrize("path", [
    "/admin/rewards/dashboard/",
    "/admin/rewards/campaigns/",
    "/admin/rewards/entries/",
    "/admin/rewards/winners/",
])
def test_rewards_endpoints(admin_session, path):
    r = admin_session.get(f"{API}{path}", timeout=15)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:300]}"


# ---------- SETTINGS ----------
def test_site_settings(admin_session):
    r = admin_session.get(f"{API}/admin/site-settings/", timeout=15)
    assert r.status_code == 200, r.text[:300]

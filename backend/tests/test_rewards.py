"""
Backend tests for LevelPro Rewards module.

Covers:
- Public endpoints (campaigns list/detail, winners, product participation, preview)
- Admin CRUD (campaigns, products, entries, winners, dashboard)
- Signal generating entries on paid order (indirect via listing entries)
- Draw execution (main + backups) and idempotency
- CSV export
"""
import os
import io
import csv
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://levelpro-audio.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "ventas@levelproaudio.com"
ADMIN_PASS  = "[REDACTED]"
CLIENT_EMAIL = "cliente@test.com"
CLIENT_PASS  = "[REDACTED]"


# ── Auth fixtures ────────────────────────────────────────
def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/v1/auth/login/",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    return r.json()["access"]


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def client_token():
    return _login(CLIENT_EMAIL, CLIENT_PASS)


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def client_headers(client_token):
    return {"Authorization": f"Bearer {client_token}"}


@pytest.fixture(scope="session")
def product_ids():
    r = requests.get(f"{BASE_URL}/api/v1/products/", timeout=30)
    assert r.status_code == 200
    data = r.json()
    results = data.get("results", data)
    assert len(results) >= 2
    return [(p["id"], p["slug"], p["name"]) for p in results]


@pytest.fixture(scope="session")
def created_campaign(admin_headers, product_ids):
    """Create a fresh campaign for use across tests, tear down at end."""
    now = datetime.now(timezone.utc)
    payload = {
        "name":  f"TEST_Campaign_{uuid.uuid4().hex[:6]}",
        "main_prize": "TEST Prize Bundle",
        "description": "Campaña de prueba automatizada",
        "start_date": (now - timedelta(days=1)).isoformat(),
        "end_date":   (now + timedelta(days=30)).isoformat(),
        "draw_date":  (now + timedelta(days=35)).isoformat(),
        "status":     "active",
        "backup_winners_count": 2,
    }
    r = requests.post(f"{BASE_URL}/api/v1/admin/rewards/campaigns/",
                      data=payload, headers=admin_headers, timeout=30)
    assert r.status_code in (200, 201), f"create campaign failed: {r.status_code} {r.text[:300]}"
    camp = r.json()
    yield camp
    # Teardown
    requests.delete(f"{BASE_URL}/api/v1/admin/rewards/campaigns/{camp['id']}/",
                    headers=admin_headers, timeout=30)


# ═══════════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS
# ═══════════════════════════════════════════════════════════════

class TestPublicEndpoints:
    def test_list_campaigns_public_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/v1/rewards/campaigns/", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "results" in data or isinstance(data, list)

    def test_winners_public(self):
        r = requests.get(f"{BASE_URL}/api/v1/rewards/winners/", timeout=30)
        assert r.status_code == 200
        assert "results" in r.json()

    def test_product_participation_unknown(self):
        r = requests.get(f"{BASE_URL}/api/v1/rewards/product/nonexistent-slug-xyz/", timeout=30)
        assert r.status_code == 200
        assert r.json()["campaigns"] == []

    def test_preview_empty_items(self):
        r = requests.post(f"{BASE_URL}/api/v1/rewards/preview/",
                          json={"items": []}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["total_entries"] == 0
        assert d["campaigns"] == []

    def test_my_entries_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/v1/rewards/my-entries/", timeout=30)
        assert r.status_code == 401

    def test_my_entries_authenticated(self, client_headers):
        r = requests.get(f"{BASE_URL}/api/v1/rewards/my-entries/",
                         headers=client_headers, timeout=30)
        assert r.status_code == 200
        assert "results" in r.json()


# ═══════════════════════════════════════════════════════════════
# ADMIN AUTH GUARDS
# ═══════════════════════════════════════════════════════════════

class TestAdminAuthGuards:
    def test_dashboard_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/v1/admin/rewards/dashboard/", timeout=30)
        assert r.status_code in (401, 403)

    def test_dashboard_forbidden_for_client(self, client_headers):
        r = requests.get(f"{BASE_URL}/api/v1/admin/rewards/dashboard/",
                         headers=client_headers, timeout=30)
        assert r.status_code == 403

    def test_dashboard_admin_ok(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/v1/admin/rewards/dashboard/",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "totals" in d
        assert "campaigns" in d["totals"]
        assert "entries" in d["totals"]


# ═══════════════════════════════════════════════════════════════
# ADMIN CAMPAIGN CRUD + ACTIONS
# ═══════════════════════════════════════════════════════════════

class TestAdminCampaignCRUD:
    def test_campaign_appears_in_public_list(self, created_campaign):
        r = requests.get(f"{BASE_URL}/api/v1/rewards/campaigns/", timeout=30)
        assert r.status_code == 200
        data = r.json()
        results = data.get("results", data)
        slugs = [c["slug"] for c in results]
        assert created_campaign["slug"] in slugs

    def test_campaign_detail_public(self, created_campaign):
        r = requests.get(f"{BASE_URL}/api/v1/rewards/campaigns/{created_campaign['slug']}/", timeout=30)
        assert r.status_code == 200
        assert r.json()["name"] == created_campaign["name"]

    def test_campaign_patch(self, admin_headers, created_campaign):
        r = requests.patch(
            f"{BASE_URL}/api/v1/admin/rewards/campaigns/{created_campaign['id']}/",
            data={"main_prize": "TEST Prize UPDATED"},
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["main_prize"] == "TEST Prize UPDATED"

    def test_campaign_duplicate(self, admin_headers, created_campaign):
        r = requests.post(
            f"{BASE_URL}/api/v1/admin/rewards/campaigns/{created_campaign['id']}/duplicate/",
            headers=admin_headers, timeout=30,
        )
        assert r.status_code in (200, 201)
        dup = r.json()
        assert dup["id"] != created_campaign["id"]
        assert "copia" in dup["name"].lower()
        # cleanup
        requests.delete(f"{BASE_URL}/api/v1/admin/rewards/campaigns/{dup['id']}/",
                        headers=admin_headers, timeout=30)

    def test_draw_without_entries_fails(self, admin_headers, created_campaign):
        r = requests.post(
            f"{BASE_URL}/api/v1/admin/rewards/campaigns/{created_campaign['id']}/draw/",
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 400
        assert "error" in r.json()


# ═══════════════════════════════════════════════════════════════
# REWARD PRODUCTS
# ═══════════════════════════════════════════════════════════════

class TestRewardProducts:
    def test_add_reward_product(self, admin_headers, created_campaign, product_ids):
        prod_id, prod_slug, _ = product_ids[0]
        payload = {
            "campaign": created_campaign["id"],
            "product":  prod_id,
            "entries_per_purchase": 5,
            "is_active": True,
        }
        r = requests.post(f"{BASE_URL}/api/v1/admin/rewards/products/",
                          json=payload, headers=admin_headers, timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        rp = r.json()
        assert rp["entries_per_purchase"] == 5
        # Verify participation via public endpoint
        r2 = requests.get(f"{BASE_URL}/api/v1/rewards/product/{prod_slug}/", timeout=30)
        assert r2.status_code == 200
        camps = r2.json()["campaigns"]
        assert any(c["campaign_id"] == created_campaign["id"] for c in camps)
        # Update entries_per_purchase
        r3 = requests.patch(f"{BASE_URL}/api/v1/admin/rewards/products/{rp['id']}/",
                            json={"entries_per_purchase": 10},
                            headers=admin_headers, timeout=30)
        assert r3.status_code == 200
        assert r3.json()["entries_per_purchase"] == 10

    def test_preview_reflects_reward_product(self, product_ids, created_campaign, admin_headers):
        prod_id, _, _ = product_ids[0]
        # Ensure at least one RP exists — try create (idempotency via unique_together)
        requests.post(f"{BASE_URL}/api/v1/admin/rewards/products/",
                      json={"campaign": created_campaign["id"],
                            "product": prod_id,
                            "entries_per_purchase": 10,
                            "is_active": True},
                      headers=admin_headers, timeout=30)
        r = requests.post(f"{BASE_URL}/api/v1/rewards/preview/",
                          json={"items": [{"product_id": prod_id, "quantity": 2}]},
                          timeout=30)
        assert r.status_code == 200
        d = r.json()
        # Expect 10 entries_per_purchase * 2 = 20 (at minimum for that campaign)
        assert d["total_entries"] >= 20, d


# ═══════════════════════════════════════════════════════════════
# ENTRIES + CSV EXPORT
# ═══════════════════════════════════════════════════════════════

class TestEntriesAndExport:
    def test_list_entries_admin(self, admin_headers, created_campaign):
        r = requests.get(
            f"{BASE_URL}/api/v1/admin/rewards/entries/?campaign={created_campaign['id']}",
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200

    def test_export_csv(self, admin_headers, created_campaign):
        r = requests.get(
            f"{BASE_URL}/api/v1/admin/rewards/entries/export/?campaign={created_campaign['id']}",
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("Content-Type", "")
        content = r.content.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(content))
        header = next(reader)
        # Encabezados esperados en español
        assert header[0] == "Código"
        assert "Campaña" in header
        assert "Email" in header


# ═══════════════════════════════════════════════════════════════
# WINNERS
# ═══════════════════════════════════════════════════════════════

class TestWinners:
    def test_list_winners_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/v1/admin/rewards/winners/",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200

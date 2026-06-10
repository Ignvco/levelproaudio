"""
Backend regression tests for LevelPro Audio admin bug fixes.

Covers:
- BUG-04: Admin course thumbnail upload (write_only logo + thumbnail_url read)
- BUG-06: Admin services endpoints (list + service-requests separation)
- BUG-07: Admin brand logo upload (write_only logo + logo_url read)

Plus basic catalog/auth smoke checks used by the public frontend.
"""

import io
import os
import uuid

import pytest
import requests
from PIL import Image

# We use the LOCAL backend URL because the file upload endpoint must hit
# the same Django process where media is stored, and that is what the
# Vite frontend proxies to in this environment.
BASE_URL = "http://localhost:8001/api/v1"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL") or os.environ.get("SEED_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD") or os.environ.get("SEED_ADMIN_PASSWORD")

if not ADMIN_EMAIL or not ADMIN_PASSWORD:
    pytest.skip(
        "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD (o SEED_*) requeridos para tests admin.",
        allow_module_level=True,
    )


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/auth/login/",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access"]


@pytest.fixture
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}"})
    return s


def _png_bytes(size=(64, 64), color=(26, 255, 110)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    buf.seek(0)
    return buf


# ---------- Public catalog smoke ----------

class TestPublicCatalog:
    def test_products_listing(self):
        r = requests.get(f"{BASE_URL}/products/", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        assert isinstance(items, list)
        assert len(items) >= 1, "Expected seeded products"

    def test_brands_listing(self):
        r = requests.get(f"{BASE_URL}/brands/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        assert len(items) >= 1


# ---------- BUG-06: Admin services ----------

class TestAdminServices:
    def test_services_list_endpoint(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/admin/services/list/", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        items = body.get("results", body) if isinstance(body, dict) else body
        assert isinstance(items, list)
        # Seed expects 4 services
        assert len(items) >= 1, "Expected at least 1 service in seed"

    def test_service_requests_endpoint(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/admin/service-requests/", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        items = body.get("results", body) if isinstance(body, dict) else body
        assert isinstance(items, list)
        assert len(items) >= 1, "Expected at least 1 seeded service request"

    def test_legacy_services_overview_still_works(self, admin_client):
        # The original /admin/services/ overview should also respond.
        r = admin_client.get(f"{BASE_URL}/admin/services/", timeout=15)
        assert r.status_code == 200, r.text


# ---------- BUG-07: Admin brand logo ----------

class TestAdminBrandLogo:
    def test_create_brand_with_logo_and_persist(self, admin_client):
        files = {"logo": ("brand.png", _png_bytes(), "image/png")}
        data = {
            "name": f"TEST_Brand_{uuid.uuid4().hex[:8]}",
            "description": "Brand created in pytest",
            "is_active": "true",
        }
        r = admin_client.post(
            f"{BASE_URL}/admin/brands/", data=data, files=files, timeout=20
        )
        assert r.status_code in (200, 201), r.text
        created = r.json()
        assert "id" in created
        assert created["name"] == data["name"]
        # logo_url should be returned, not the raw 'logo' write field
        assert created.get("logo_url"), f"logo_url missing in response: {created}"
        brand_id = created["id"]

        # Verify in GET
        g = admin_client.get(f"{BASE_URL}/admin/brands/{brand_id}/", timeout=15)
        assert g.status_code == 200
        got = g.json()
        assert got.get("logo_url"), "logo_url not persisted on GET"

        # Verify the media URL actually serves an image
        url = got["logo_url"]
        if url.startswith("/"):
            url = f"http://localhost:8001{url}"
        media = requests.get(url, timeout=15)
        assert media.status_code == 200, f"logo media fetch failed: {media.status_code}"
        assert "image" in media.headers.get("Content-Type", ""), media.headers

    def test_update_brand_logo(self, admin_client):
        # Create first
        r = admin_client.post(
            f"{BASE_URL}/admin/brands/",
            data={"name": f"TEST_BrandUpd_{uuid.uuid4().hex[:6]}", "is_active": "true"},
            files={"logo": ("a.png", _png_bytes(color=(10, 10, 10)), "image/png")},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        bid = r.json()["id"]
        first_url = r.json().get("logo_url")

        # Patch with new logo
        r2 = admin_client.patch(
            f"{BASE_URL}/admin/brands/{bid}/",
            files={"logo": ("b.png", _png_bytes(color=(200, 50, 50)), "image/png")},
            timeout=20,
        )
        assert r2.status_code in (200, 202), r2.text
        new_url = r2.json().get("logo_url")
        assert new_url, "logo_url missing after patch"
        # URL should change (different filename)
        assert new_url != first_url, "logo_url did not change after update"


# ---------- BUG-04: Admin course thumbnail ----------

class TestAdminCourseThumbnail:
    def test_create_course_with_thumbnail(self, admin_client):
        files = {"thumbnail": ("cover.png", _png_bytes(color=(0, 200, 100)), "image/png")}
        data = {
            "title": f"TEST_Course_{uuid.uuid4().hex[:8]}",
            "description": "Course created in pytest",
            "price": "19990",
            "is_published": "true",
        }
        r = admin_client.post(
            f"{BASE_URL}/admin/academy/courses/", data=data, files=files, timeout=20
        )
        assert r.status_code in (200, 201), r.text
        created = r.json()
        assert created.get("thumbnail_url"), f"thumbnail_url missing: {created}"
        cid = created["id"]

        # GET to confirm persistence
        g = admin_client.get(f"{BASE_URL}/admin/academy/courses/{cid}/", timeout=15)
        assert g.status_code == 200
        got = g.json()
        assert got.get("thumbnail_url"), "thumbnail_url not persisted on GET"

        url = got["thumbnail_url"]
        if url.startswith("/"):
            url = f"http://localhost:8001{url}"
        media = requests.get(url, timeout=15)
        assert media.status_code == 200, f"thumbnail fetch failed: {media.status_code}"
        assert "image" in media.headers.get("Content-Type", ""), media.headers

    def test_update_course_thumbnail(self, admin_client):
        r = admin_client.post(
            f"{BASE_URL}/admin/academy/courses/",
            data={
                "title": f"TEST_CourseUpd_{uuid.uuid4().hex[:6]}",
                "description": "x",
                "price": "10000",
                "is_published": "true",
            },
            files={"thumbnail": ("c1.png", _png_bytes(), "image/png")},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        cid = r.json()["id"]
        first = r.json().get("thumbnail_url")

        r2 = admin_client.patch(
            f"{BASE_URL}/admin/academy/courses/{cid}/",
            files={"thumbnail": ("c2.png", _png_bytes(color=(255, 128, 0)), "image/png")},
            timeout=20,
        )
        assert r2.status_code in (200, 202), r2.text
        new = r2.json().get("thumbnail_url")
        assert new and new != first, "thumbnail_url not updated"

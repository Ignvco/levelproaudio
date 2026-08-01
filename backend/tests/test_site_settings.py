"""Tests for site-settings singleton (public GET + admin GET/PATCH)."""
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
# Use internal backend for backend tests to avoid ingress caching / rate-limits
INTERNAL = "http://localhost:8001"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL") or os.environ.get("SEED_ADMIN_EMAIL")
ADMIN_PASS = os.environ.get("TEST_ADMIN_PASSWORD") or os.environ.get("SEED_ADMIN_PASSWORD")

if not ADMIN_EMAIL or not ADMIN_PASS:
    pytest.skip(
        "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD (o SEED_*) requeridos para tests admin.",
        allow_module_level=True,
    )

DEFAULT_HERO_TITLE = "Llevá tu sonido al nivel profesional."

PUBLIC_FIELDS = [
    "hero_title", "hero_subtitle", "hero_cta1_text", "hero_cta1_link",
    "hero_cta2_text", "hero_cta2_link", "hero_image_url",
    "site_name", "tagline", "logo_url", "accent_color",
    "contact_whatsapp", "contact_instagram", "contact_email",
    "show_trust_strip", "show_pillars", "show_products", "show_courses",
    "show_services", "show_testimonial", "show_brands", "show_final_cta",
    "seo_title", "seo_description", "og_image_url",
    "testimonial_photo_url", "testimonial_name", "testimonial_role",
    "testimonial_quote",
]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{INTERNAL}/api/v1/auth/login/",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    return data.get("access") or data.get("token") or data.get("access_token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    assert admin_token, "no token"
    return {"Authorization": f"Bearer {admin_token}"}


def test_public_get_no_auth():
    r = requests.get(f"{INTERNAL}/api/v1/site-settings/", timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    for f in PUBLIC_FIELDS:
        assert f in data, f"missing field {f}"
    # hero_title may already be modified from earlier run; restore below
    assert isinstance(data["hero_title"], str) and len(data["hero_title"]) > 0


def test_public_get_via_external_url():
    r = requests.get(f"{BASE_URL}/api/v1/site-settings/", timeout=15)
    assert r.status_code == 200
    for f in PUBLIC_FIELDS:
        assert f in r.json()


def test_admin_get_singleton(auth_headers):
    r = requests.get(f"{INTERNAL}/api/v1/admin/site-settings/", headers=auth_headers, timeout=10)
    assert r.status_code == 200, r.text
    pub = requests.get(f"{INTERNAL}/api/v1/site-settings/", timeout=10).json()
    assert r.json()["id"] == pub["id"]


def test_admin_get_requires_auth():
    r = requests.get(f"{INTERNAL}/api/v1/admin/site-settings/", timeout=10)
    assert r.status_code in (401, 403)


def test_patch_json_persists(auth_headers):
    payload = {
        "hero_title": "Testeando el título nuevo",
        "show_products": False,
        "contact_email": "nuevo@levelpro.com",
    }
    r = requests.patch(f"{INTERNAL}/api/v1/admin/site-settings/",
                       json=payload, headers=auth_headers, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["hero_title"] == payload["hero_title"]
    assert body["show_products"] is False
    assert body["contact_email"] == payload["contact_email"]

    # Public GET reflects change
    pub = requests.get(f"{INTERNAL}/api/v1/site-settings/", timeout=10).json()
    assert pub["hero_title"] == payload["hero_title"]
    assert pub["show_products"] is False


def test_patch_multipart_logo(auth_headers):
    # Create tiny in-memory PNG
    img = Image.new("RGB", (10, 10), color=(255, 0, 0))
    buf = io.BytesIO(); img.save(buf, format="PNG"); buf.seek(0)
    files = {"logo": ("TEST_logo.png", buf, "image/png")}
    r = requests.patch(f"{INTERNAL}/api/v1/admin/site-settings/",
                       files=files, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    logo_url = r.json().get("logo_url")
    assert logo_url and logo_url.startswith("/media/site/")


def test_restore_defaults(auth_headers):
    payload = {"hero_title": DEFAULT_HERO_TITLE, "show_products": True,
               "contact_email": "ventas@levelproaudio.com"}
    r = requests.patch(f"{INTERNAL}/api/v1/admin/site-settings/",
                       json=payload, headers=auth_headers, timeout=10)
    assert r.status_code == 200
    assert r.json()["hero_title"] == DEFAULT_HERO_TITLE
    assert r.json()["show_products"] is True

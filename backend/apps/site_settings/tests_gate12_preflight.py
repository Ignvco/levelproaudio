# apps/site_settings/tests_gate12_preflight.py
"""
LEVELPRO OS V4.0 — GATE 12 PREFLIGHT TESTS (CMS12-PF-01..05)
"""

import io
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from apps.seo.metadata import metadata_for
from apps.site_settings.cms_preflight import (
    CMS_MARKETING_BOUNDARY,
    EDITORIAL_TEXT_FIELDS,
    PUBLICATION_LIFECYCLE,
    SYSTEMIC_FIELDS,
    validate_cms_image_upload,
    validate_safe_cms_url,
)
from apps.site_settings.models import SiteSettings

User = get_user_model()


def _make_png_bytes(width=120, height=120):
    buf = io.BytesIO()
    Image.new("RGB", (width, height), (26, 255, 110)).save(buf, format="PNG")
    return buf.getvalue()


class Gate12PreflightTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="g12_pf_admin",
            email="g12pf@levelpro.cl",
            password="pw",
            is_staff=True,
            is_superuser=True,
        )

    def test_cms12_pf_01_sitesettings_isolation_and_fx_protection(self):
        """CMS12-PF-01: Separación estricta entre campos editoriales y sistémicos/financieros."""
        self.assertTrue(EDITORIAL_TEXT_FIELDS.isdisjoint(SYSTEMIC_FIELDS))
        self.assertIn("usd_to_clp", SYSTEMIC_FIELDS)
        self.assertIn("hero_title", EDITORIAL_TEXT_FIELDS)

        s = SiteSettings.get()
        orig_clp = s.usd_to_clp
        client = APIClient()
        client.force_authenticate(user=self.admin)
        resp = client.patch("/api/v1/admin/site-settings/", {"hero_cta1_link": "javascript:alert(1)"}, format="json")
        self.assertEqual(resp.status_code, 400)
        s.refresh_from_db()
        self.assertEqual(s.usd_to_clp, orig_clp)

    def test_cms12_pf_02_and_03_lifecycle_and_binary_image_validation(self):
        """CMS12-PF-02/03: Ciclo de vida editorial y validación binaria real anti-SVG/corrupto."""
        self.assertEqual(PUBLICATION_LIFECYCLE, ("draft", "in_review", "approved", "published", "superseded", "archived"))

        good = SimpleUploadedFile("hero.png", _make_png_bytes(200, 120), content_type="image/png")
        meta = validate_cms_image_upload(good)
        self.assertEqual(meta["format"], "PNG")
        self.assertEqual(meta["width"], 200)

        bad_svg = SimpleUploadedFile("xss.svg", b"<svg><script>alert(1)</script></svg>", content_type="image/svg+xml")
        with self.assertRaises(ValidationError):
            validate_cms_image_upload(bad_svg)

        bad_corrupt = SimpleUploadedFile("bad.png", b"not-a-real-png", content_type="image/png")
        with self.assertRaises(ValidationError):
            validate_cms_image_upload(bad_corrupt)

    def test_cms12_pf_04_and_05_seo_url_safety_and_marketing_boundary(self):
        """CMS12-PF-04/05: URLs seguras, SEO sin rutas privadas y frontera CMS-Marketing."""
        self.assertEqual(validate_safe_cms_url("/shop"), "/shop")
        self.assertEqual(validate_safe_cms_url("https://levelproaudio.com/promo"), "https://levelproaudio.com/promo")
        for bad_url in ("javascript:alert(1)", "data:text/html,hi", "//evil.test", "/admin/settings"):
            with self.assertRaises(ValidationError):
                validate_safe_cms_url(bad_url)

        self.assertFalse(CMS_MARKETING_BOUNDARY["cms_can_recalculate_prices"])
        self.assertFalse(CMS_MARKETING_BOUNDARY["cms_can_activate_promotions"])

        meta_home = metadata_for("/")
        self.assertEqual(meta_home["robots"], "index, follow")
        meta_admin = metadata_for("/admin/cms")
        self.assertEqual(meta_admin["robots"], "noindex, nofollow")

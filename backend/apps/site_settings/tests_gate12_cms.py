# apps/site_settings/tests_gate12_cms.py
"""
LEVELPRO OS V4.0 — GATE 12: WEBSITE & CONTENT MANAGEMENT TEST SUITE
Cobertura Sección 26:
- SiteSettings aislamiento editorial vs sistémico (tasas FX)
- CMSHeroSlide, CMSBanner (desktop/mobile, categorías), CMSAnnouncement (vigencia, zona horaria, campaña vencida)
- Ciclo BF-31: Draft -> Review -> Approve -> Publish atómico -> Rollback -> Checksum -> Auditoría
- Seguridad de imágenes (Pillow anti-SVG/corrupto), URLs inseguras, XSS, RBAC granular, SEO publicado-only.
"""

import io
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TransactionTestCase
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.orders.marketing_models import PromotionCampaign
from apps.products.models import Category
from apps.seo.metadata import metadata_for
from apps.site_settings.cms_models import CMSPublicationEvent, CMSVersion
from apps.site_settings.cms_services import (
    create_draft_version,
    get_public_cms_payload,
    publish_cms_version,
    register_cms_asset,
    rollback_to_version,
    save_draft_editorial_payload,
    transition_version_review,
    upsert_announcement,
    upsert_banner,
    upsert_hero_slide,
)
from apps.site_settings.models import SiteSettings
from core.rbac.constants import ROLE_MANAGEMENT, ROLE_MARKETING

User = get_user_model()


def _png_file(name="banner.png", width=240, height=120):
    buf = io.BytesIO()
    Image.new("RGB", (width, height), (11, 14, 20)).save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


class Gate12CMSTests(TransactionTestCase):
    def setUp(self):
        self.super_admin = User.objects.create_user(
            username="g12_super",
            email="g12super@levelpro.cl",
            password="pw",
            is_staff=True,
            is_superuser=True,
        )
        self.mkt_editor = User.objects.create_user(
            username="g12_mkt",
            email="g12mkt@levelpro.cl",
            password="pw",
            is_staff=True,
        )
        self.mgr_publisher = User.objects.create_user(
            username="g12_mgr",
            email="g12mgr@levelpro.cl",
            password="pw",
            is_staff=True,
        )
        self.plain_staff = User.objects.create_user(
            username="g12_plain",
            email="g12plain@levelpro.cl",
            password="pw",
            is_staff=True,
        )
        mkt_group, _ = Group.objects.get_or_create(name=ROLE_MARKETING)
        mgr_group, _ = Group.objects.get_or_create(name=ROLE_MANAGEMENT)
        self.mkt_editor.groups.add(mkt_group)
        self.mgr_publisher.groups.add(mgr_group)

        self.category = Category.objects.create(name="Monitores G12", slug="monitores-g12")

    def test_draft_isolation_publish_and_rollback_preserves_fx(self):
        """Borrador nunca se filtra al público; publicar aplica atómicamente; rollback restaura y preserva FX."""
        site = SiteSettings.get()
        orig_title = site.hero_title
        orig_clp = site.usd_to_clp

        # 1. Publicar baseline v1
        v1 = create_draft_version(user=self.mkt_editor, change_summary="Baseline v1")
        publish_cms_version(v1.id, self.mgr_publisher, notes="Publicación inicial")

        # 2. Crear borrador v2 con cambios y verificar aislamiento público + SEO
        v2 = create_draft_version(user=self.mkt_editor, change_summary="Black Friday Draft")
        save_draft_editorial_payload(
            v2.id,
            {
                "hero_title": "Black Friday Audio Pro",
                "seo_title": "Black Friday LevelPro Audio",
            },
            user=self.mkt_editor,
        )
        desktop_asset = register_cms_asset(_png_file("bf-desk.png", 1200, 600), title="BF Desk", device_target="desktop", user=self.mkt_editor)
        mobile_asset = register_cms_asset(_png_file("bf-mob.png", 600, 800), title="BF Mob", device_target="mobile", user=self.mkt_editor)
        upsert_hero_slide(
            v2.id,
            {
                "order": 1,
                "title": "Black Friday Studio",
                "desktop_image_id": desktop_asset.id,
                "mobile_image_id": mobile_asset.id,
                "cta1_text": "Ver ofertas",
                "cta1_link": "/shop",
            },
        )
        upsert_banner(
            v2.id,
            {
                "code": "BF-CAT-01",
                "name": "Banner Black Friday Monitores",
                "banner_type": "category_strip",
                "target_page": "category",
                "category_id": self.category.id,
                "desktop_image_id": desktop_asset.id,
                "mobile_image_id": mobile_asset.id,
                "title": "Monitores en Black Friday",
                "cta_text": "Explorar",
                "cta_link": "/shop?category=monitores-g12",
            },
            user=self.mkt_editor,
        )

        # Público sigue viendo baseline v1 y SEO original
        pub_before = get_public_cms_payload()
        self.assertEqual(pub_before["version_number"], v1.version_number)
        self.assertEqual(pub_before["hero_slides"], [])
        self.assertEqual(SiteSettings.get().hero_title, orig_title)
        self.assertEqual(metadata_for("/")["title"], SiteSettings.get().seo_title)

        # 3. Revisar, aprobar y publicar v2
        transition_version_review(v2.id, CMSVersion.Status.IN_REVIEW, self.mkt_editor)
        transition_version_review(v2.id, CMSVersion.Status.APPROVED, self.mgr_publisher)
        publish_cms_version(v2.id, self.mgr_publisher, notes="Salida Black Friday")

        pub_after = get_public_cms_payload()
        self.assertEqual(pub_after["version_number"], v2.version_number)
        self.assertEqual(len(pub_after["hero_slides"]), 1)
        self.assertEqual(len(pub_after["banners"]), 1)
        self.assertEqual(SiteSettings.get().hero_title, "Black Friday Audio Pro")
        self.assertEqual(SiteSettings.get().usd_to_clp, orig_clp)
        self.assertEqual(metadata_for("/")["title"], "Black Friday LevelPro Audio")

        # 4. Inmutabilidad de versión publicada
        with self.assertRaises(ValidationError):
            save_draft_editorial_payload(v2.id, {"hero_title": "Mutación prohibida"}, user=self.mkt_editor)

        # 5. Rollback hacia v1 genera v3 publicada y restaura hero_title + SEO
        v3 = rollback_to_version(v1.id, self.mgr_publisher, notes="Restaurar baseline")
        self.assertTrue(v3.is_rollback)
        self.assertEqual(v3.status, CMSVersion.Status.PUBLISHED)
        self.assertEqual(SiteSettings.get().hero_title, orig_title)
        self.assertEqual(CMSPublicationEvent.objects.filter(version=v3, event_type="rollback_published").count(), 1)

    def test_scheduled_windows_timezone_and_expired_campaign_boundary(self):
        """Anuncios/banners respetan ventanas horarias en consulta y bloquean campañas vencidas."""
        now = timezone.now()
        expired_promo = PromotionCampaign.objects.create(
            name="Promo Vencida G12",
            starts_at=now - timedelta(days=5),
            ends_at=now - timedelta(hours=1),
            currency="CLP",
            discount_type="percentage",
            discount_value=Decimal("10.00"),
            status="finished",
        )
        v = create_draft_version(user=self.mkt_editor, change_summary="Scheduled test")
        upsert_announcement(
            v.id,
            {
                "text": "Anuncio vigente CLP",
                "link_url": "/shop",
                "currency": "CLP",
                "starts_at": now - timedelta(minutes=10),
                "ends_at": now + timedelta(hours=2),
                "business_timezone": "America/Santiago",
            },
        )
        upsert_announcement(
            v.id,
            {
                "text": "Anuncio ligado a promo vencida",
                "link_url": "/shop",
                "promotion_campaign_id": expired_promo.id,
            },
        )
        publish_cms_version(v.id, self.mgr_publisher)

        pub_now = get_public_cms_payload(now=now)
        self.assertEqual(len(pub_now["announcements"]), 1)
        self.assertEqual(pub_now["announcements"][0]["text"], "Anuncio vigente CLP")

        pub_future = get_public_cms_payload(now=now + timedelta(hours=3))
        self.assertEqual(len(pub_future["announcements"]), 0)

    def test_rbac_granular_asset_security_and_url_injection_blocks(self):
        """RBAC separa editor Marketing de publicador Gerencia; rechaza SVG/XSS/URLs peligrosas y protege preview."""
        c = APIClient()
        # Anónimo no puede previsualizar ni acceder a CMS admin
        v = create_draft_version(user=self.mkt_editor, change_summary="RBAC test")
        self.assertIn(c.get(f"/api/v1/admin/cms/versions/{v.id}/preview/").status_code, (401, 403))

        # Staff sin rol denegado
        c.force_authenticate(user=self.plain_staff)
        self.assertEqual(c.get("/api/v1/admin/cms/versions/").status_code, 403)

        # Marketing puede editar borrador y previsualizar (con noindex), NO puede publicar ni modificar tasas FX
        c.force_authenticate(user=self.mkt_editor)
        prev = c.get(f"/api/v1/admin/cms/versions/{v.id}/preview/")
        self.assertEqual(prev.status_code, 200)
        self.assertEqual(prev.headers.get("X-Robots-Tag"), "noindex, nofollow")

        self.assertEqual(c.post(f"/api/v1/admin/cms/versions/{v.id}/publish/").status_code, 403)
        self.assertEqual(c.patch("/api/v1/admin/site-settings/", {"usd_to_clp": "999.00"}, format="json").status_code, 403)

        # Rechazo de campos sistémicos dentro del borrador CMS
        bad_fx = c.patch(f"/api/v1/admin/cms/versions/{v.id}/", {"payload": {"usd_to_clp": "999.00"}}, format="json")
        self.assertEqual(bad_fx.status_code, 400)

        # Rechazo de URL insegura y archivo SVG
        bad_url = c.post(
            "/api/v1/admin/cms/banners/",
            {"version_id": str(v.id), "name": "XSS", "cta_link": "javascript:alert(1)"},
            format="json",
        )
        self.assertEqual(bad_url.status_code, 400)

        bad_svg = SimpleUploadedFile("bad.svg", b"<svg><script>alert(1)</script></svg>", content_type="image/svg+xml")
        up_svg = c.post("/api/v1/admin/cms/assets/", {"file": bad_svg, "title": "SVG"}, format="multipart")
        self.assertEqual(up_svg.status_code, 400)

        # Gerencia puede publicar
        c.force_authenticate(user=self.mgr_publisher)
        pub_resp = c.post(f"/api/v1/admin/cms/versions/{v.id}/publish/")
        self.assertEqual(pub_resp.status_code, 200)

    def test_cms12_accept_03_legacy_patch_guard_and_concurrent_publish_conflict(self):
        """CMS12-ACCEPT-03: PATCH legacy bloquea campos editoriales versionados; concurrencia de publicación y preservación de FX/contacto."""
        from apps.analytics.models import AuditEvent

        c = APIClient()
        c.force_authenticate(user=self.super_admin)

        # PATCH legacy sobre hero_title o seo_title es rechazado (400) para no eludir el versionado CMS
        r_bypass = c.patch("/api/v1/admin/site-settings/", {"hero_title": "Bypass Directo"}, format="json")
        self.assertEqual(r_bypass.status_code, 400)
        self.assertIn("hero_title", r_bypass.data.get("fields", []))

        # PATCH sistémico (tasas FX y contacto operativo) sí funciona y queda aislado de publicaciones CMS
        r_sys = c.patch(
            "/api/v1/admin/site-settings/",
            {"usd_to_clp": "965.00", "contact_whatsapp": "+56911223344"},
            format="json",
        )
        self.assertEqual(r_sys.status_code, 200)

        # Publicar baseline v1
        v1 = create_draft_version(user=self.mkt_editor, change_summary="Base v1")
        publish_cms_version(v1.id, self.mgr_publisher)

        # Dos editores crean borradores concurrentes (v_a y v_b) desde la misma base v1
        v_a = create_draft_version(user=self.mkt_editor, change_summary="Editor A")
        v_b = create_draft_version(user=self.mkt_editor, change_summary="Editor B")
        save_draft_editorial_payload(v_a.id, {"hero_title": "Título Ganador A"}, user=self.mkt_editor)
        save_draft_editorial_payload(v_b.id, {"hero_title": "Título Conflicto B"}, user=self.mkt_editor)

        # Gerencia publica v_a primero -> éxito
        publish_cms_version(v_a.id, self.mgr_publisher)
        self.assertEqual(SiteSettings.get().hero_title, "Título Ganador A")

        # Intento concurrente de publicar v_b con base_version obsoleta (v1 != v_a) -> rechazado sin estado parcial
        with self.assertRaises(ValidationError):
            publish_cms_version(v_b.id, self.mgr_publisher)

        s = SiteSettings.get()
        self.assertEqual(s.hero_title, "Título Ganador A")
        self.assertEqual(s.usd_to_clp, Decimal("965.00"))
        self.assertEqual(s.contact_whatsapp, "+56911223344")
        self.assertTrue(AuditEvent.objects.filter(action="CMS_VERSION_PUBLISHED", resource_id=str(v_a.id)).exists())

    def test_cms12_accept_04_archived_asset_preservation_and_sitemap_exclusion(self):
        """CMS12-ACCEPT-04: Assets archivados no destruyen versiones históricas y sitemap no expone borradores ni rutas privadas."""
        v1 = create_draft_version(user=self.mkt_editor, change_summary="Con Asset v1")
        asset = register_cms_asset(_png_file("hist.png", 400, 200), title="Asset Histórico", device_target="desktop", user=self.mkt_editor)
        upsert_hero_slide(v1.id, {"order": 1, "title": "Slide Histórico", "desktop_image_id": asset.id})
        publish_cms_version(v1.id, self.mgr_publisher)

        # Archivar asset (soft delete) no destruye la versión publicada ni impide rollback posterior
        asset.is_archived = True
        asset.save(update_fields=["is_archived"])

        v2 = create_draft_version(user=self.mkt_editor, change_summary="Sin slides v2")
        v2.hero_slides.all().delete()
        publish_cms_version(v2.id, self.mgr_publisher)
        self.assertEqual(len(get_public_cms_payload()["hero_slides"]), 0)

        v3 = rollback_to_version(v1.id, self.mgr_publisher, notes="Restaurar con asset histórico")
        self.assertEqual(v3.status, CMSVersion.Status.PUBLISHED)
        self.assertEqual(len(get_public_cms_payload()["hero_slides"]), 1)
        self.assertEqual(get_public_cms_payload()["hero_slides"][0]["desktop_image"]["id"], str(asset.id))

        # Sitemap público no incluye /admin, /preview ni borradores
        pub_client = APIClient()
        sm = pub_client.get("/api/v1/seo/sitemap.xml")
        self.assertEqual(sm.status_code, 200)
        body = sm.content.decode("utf-8")
        self.assertNotIn("/admin", body)
        self.assertNotIn("cms_preview_version", body)

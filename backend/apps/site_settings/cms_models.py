# apps/site_settings/cms_models.py
"""
LEVELPRO OS V4.0 — GATE 12: WEBSITE & CONTENT MANAGEMENT MODELS
- BF-30: Editor Visual (CMSAsset, CMSHeroSlide, CMSBanner, CMSAnnouncement)
- BF-31: Borradores y Versiones (CMSVersion, CMSPublicationEvent)
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel


class CMSAsset(TimeStampedModel):
    class DeviceTarget(models.TextChoices):
        UNIVERSAL = "universal", "Universal"
        DESKTOP = "desktop", "Desktop"
        MOBILE = "mobile", "Mobile"

    title = models.CharField(max_length=160)
    alt_text = models.CharField(max_length=200, blank=True, default="")
    file = models.ImageField(upload_to="cms/assets/")
    device_target = models.CharField(max_length=20, choices=DeviceTarget.choices, default=DeviceTarget.UNIVERSAL)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    file_format = models.CharField(max_length=12, default="PNG")
    size_bytes = models.PositiveIntegerField(default=0)
    sha256 = models.CharField(max_length=64, db_index=True)
    is_archived = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.device_target} {self.width}x{self.height})"


class CMSVersion(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        IN_REVIEW = "in_review", "En revisión"
        APPROVED = "approved", "Aprobado"
        PUBLISHED = "published", "Publicado"
        SUPERSEDED = "superseded", "Reemplazado"
        ARCHIVED = "archived", "Archivado"

    version_number = models.PositiveIntegerField(unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    base_version = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="derived_versions")
    change_summary = models.CharField(max_length=255, blank=True, default="")
    payload_json = models.JSONField(default=dict, blank=True)
    diff_json = models.JSONField(default=dict, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True, default="")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cms_versions_created")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cms_versions_reviewed")
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cms_versions_published")
    published_at = models.DateTimeField(null=True, blank=True)
    is_rollback = models.BooleanField(default=False)
    rolled_back_from = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="rollback_targets")

    class Meta:
        ordering = ["-version_number"]

    def __str__(self):
        return f"v{self.version_number} [{self.status}]"


class CMSHeroSlide(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Activo"
        PAUSED = "paused", "Pausado"
        ARCHIVED = "archived", "Archivado"

    version = models.ForeignKey(CMSVersion, on_delete=models.CASCADE, related_name="hero_slides")
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=200, blank=True, default="")
    subtitle = models.TextField(blank=True, default="")
    desktop_image = models.ForeignKey(CMSAsset, on_delete=models.PROTECT, null=True, blank=True, related_name="hero_desktop_slides")
    mobile_image = models.ForeignKey(CMSAsset, on_delete=models.PROTECT, null=True, blank=True, related_name="hero_mobile_slides")
    alt_text = models.CharField(max_length=200, blank=True, default="")
    focal_point = models.CharField(max_length=20, default="center")
    overlay_opacity = models.PositiveSmallIntegerField(default=40, validators=[MinValueValidator(0), MaxValueValidator(100)])
    cta1_text = models.CharField(max_length=40, blank=True, default="")
    cta1_link = models.CharField(max_length=200, blank=True, default="")
    cta2_text = models.CharField(max_length=40, blank=True, default="")
    cta2_link = models.CharField(max_length=200, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    business_timezone = models.CharField(max_length=60, default="America/Santiago")

    class Meta:
        ordering = ["order", "created_at"]


class CMSBanner(TimeStampedModel):
    class BannerType(models.TextChoices):
        HERO_PROMO = "hero_promo", "Hero Promocional"
        CATEGORY_STRIP = "category_strip", "Franja de Categoría"
        HOME_MID = "home_mid", "Banner Intermedio Home"
        EDITORIAL_CARD = "editorial_card", "Card Editorial"

    class TargetPage(models.TextChoices):
        HOME = "home", "Home"
        SHOP = "shop", "Tienda"
        CATEGORY = "category", "Categoría"

    version = models.ForeignKey(CMSVersion, on_delete=models.CASCADE, related_name="banners")
    code = models.CharField(max_length=60, db_index=True)
    name = models.CharField(max_length=140)
    banner_type = models.CharField(max_length=30, choices=BannerType.choices, default=BannerType.HOME_MID)
    target_page = models.CharField(max_length=20, choices=TargetPage.choices, default=TargetPage.HOME)
    category = models.ForeignKey("products.Category", on_delete=models.SET_NULL, null=True, blank=True, related_name="cms_banners")
    desktop_image = models.ForeignKey(CMSAsset, on_delete=models.PROTECT, null=True, blank=True, related_name="banner_desktop_uses")
    mobile_image = models.ForeignKey(CMSAsset, on_delete=models.PROTECT, null=True, blank=True, related_name="banner_mobile_uses")
    title = models.CharField(max_length=180, blank=True, default="")
    body_text = models.TextField(blank=True, default="")
    cta_text = models.CharField(max_length=40, blank=True, default="")
    cta_link = models.CharField(max_length=200, blank=True, default="")
    order = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=CMSHeroSlide.Status.choices, default=CMSHeroSlide.Status.ACTIVE)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    business_timezone = models.CharField(max_length=60, default="America/Santiago")
    promotion_campaign = models.ForeignKey("orders.PromotionCampaign", on_delete=models.SET_NULL, null=True, blank=True, related_name="cms_banners")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["order", "created_at"]


class CMSAnnouncement(TimeStampedModel):
    version = models.ForeignKey(CMSVersion, on_delete=models.CASCADE, related_name="announcements")
    text = models.CharField(max_length=220)
    link_url = models.CharField(max_length=200, blank=True, default="")
    market = models.CharField(max_length=10, default="ALL")
    currency = models.CharField(max_length=10, default="ALL")
    priority = models.PositiveIntegerField(default=10)
    status = models.CharField(max_length=20, choices=CMSHeroSlide.Status.choices, default=CMSHeroSlide.Status.ACTIVE)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    business_timezone = models.CharField(max_length=60, default="America/Santiago")
    promotion_campaign = models.ForeignKey("orders.PromotionCampaign", on_delete=models.SET_NULL, null=True, blank=True, related_name="cms_announcements")

    class Meta:
        ordering = ["priority", "created_at"]


class CMSPublicationEvent(TimeStampedModel):
    version = models.ForeignKey(CMSVersion, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=30)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True, default="")
    checksum_sha256 = models.CharField(max_length=64, blank=True, default="")
    occurred_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-occurred_at"]

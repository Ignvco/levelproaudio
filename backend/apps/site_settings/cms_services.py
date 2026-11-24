# apps/site_settings/cms_services.py
"""
LEVELPRO OS V4.0 — GATE 12: WEBSITE & CONTENT MANAGEMENT SERVICES
- BF-30: Editor Visual (Hero Slides, Banners, Anuncios, Assets, Secciones)
- BF-31: Borradores, Revisión, Aprobación, Publicación Atómica, Rollback y Auditoría
"""

from __future__ import annotations

import hashlib
import json
from typing import Any
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.orders.marketing_models import PromotionCampaign
from apps.products.models import Category
from apps.site_settings.cms_models import (
    CMSAnnouncement,
    CMSAsset,
    CMSBanner,
    CMSHeroSlide,
    CMSPublicationEvent,
    CMSVersion,
)
from apps.site_settings.cms_preflight import (
    EDITORIAL_TEXT_FIELDS,
    SYSTEMIC_FIELDS,
    sanitize_cms_text,
    validate_cms_image_upload,
    validate_safe_cms_url,
)
from apps.site_settings.models import SiteSettings
from core.audit.constants import CATEGORY_CONFIG_CHANGE, RESULT_SUCCESS, SEVERITY_INFO, SEVERITY_WARNING
from core.audit.sanitizer import sanitize_audit_payload
from core.audit.services import record_audit_event
from core.media import media_url as _media_url
from core.rbac.constants import MODULE_SETTINGS


def _compute_checksum(payload: dict[str, Any], slides: list[dict], banners: list[dict], announcements: list[dict]) -> str:
    canonical = json.dumps(
        {
            "payload": payload,
            "slides": slides,
            "banners": banners,
            "announcements": announcements,
        },
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def extract_editorial_snapshot_from_site_settings(site: SiteSettings | None = None) -> dict[str, Any]:
    site = site or SiteSettings.get()
    snap = {}
    for field in sorted(EDITORIAL_TEXT_FIELDS):
        snap[field] = getattr(site, field)
    return snap


def _next_version_number() -> int:
    max_num = CMSVersion.objects.aggregate(m=Max("version_number"))["m"] or 0
    return max_num + 1


def _serialize_asset(asset: CMSAsset | None) -> dict[str, Any] | None:
    if not asset:
        return None
    return {
        "id": str(asset.id),
        "title": asset.title,
        "alt_text": asset.alt_text,
        "url": _media_url(asset.file),
        "device_target": asset.device_target,
        "width": asset.width,
        "height": asset.height,
        "file_format": asset.file_format,
        "size_bytes": asset.size_bytes,
        "sha256": asset.sha256,
    }


def _is_within_window(obj, now) -> bool:
    if getattr(obj, "status", "active") != "active":
        return False
    starts_at = getattr(obj, "starts_at", None)
    ends_at = getattr(obj, "ends_at", None)
    if starts_at and now < starts_at:
        return False
    if ends_at and now >= ends_at:
        return False
    return True


def serialize_version_content(version: CMSVersion, *, active_window_only: bool = False, now=None) -> dict[str, Any]:
    now = now or timezone.now()
    slides_qs = version.hero_slides.select_related("desktop_image", "mobile_image").order_by("order", "created_at")
    banners_qs = version.banners.select_related("desktop_image", "mobile_image", "category", "promotion_campaign").order_by("order", "created_at")
    anns_qs = version.announcements.select_related("promotion_campaign").order_by("priority", "created_at")

    slides = []
    for sl in slides_qs:
        if active_window_only and not _is_within_window(sl, now):
            continue
        slides.append({
            "id": str(sl.id),
            "order": sl.order,
            "title": sl.title,
            "subtitle": sl.subtitle,
            "desktop_image": _serialize_asset(sl.desktop_image),
            "mobile_image": _serialize_asset(sl.mobile_image),
            "alt_text": sl.alt_text,
            "focal_point": sl.focal_point,
            "overlay_opacity": sl.overlay_opacity,
            "cta1_text": sl.cta1_text,
            "cta1_link": sl.cta1_link,
            "cta2_text": sl.cta2_text,
            "cta2_link": sl.cta2_link,
            "status": sl.status,
            "starts_at": sl.starts_at.isoformat() if sl.starts_at else None,
            "ends_at": sl.ends_at.isoformat() if sl.ends_at else None,
            "business_timezone": sl.business_timezone,
        })

    banners = []
    for b in banners_qs:
        if active_window_only and not _is_within_window(b, now):
            continue
        banners.append({
            "id": str(b.id),
            "code": b.code,
            "name": b.name,
            "banner_type": b.banner_type,
            "target_page": b.target_page,
            "category_id": str(b.category_id) if b.category_id else None,
            "category_slug": b.category.slug if b.category_id else None,
            "desktop_image": _serialize_asset(b.desktop_image),
            "mobile_image": _serialize_asset(b.mobile_image),
            "title": b.title,
            "body_text": b.body_text,
            "cta_text": b.cta_text,
            "cta_link": b.cta_link,
            "order": b.order,
            "status": b.status,
            "starts_at": b.starts_at.isoformat() if b.starts_at else None,
            "ends_at": b.ends_at.isoformat() if b.ends_at else None,
            "business_timezone": b.business_timezone,
            "promotion_campaign_id": str(b.promotion_campaign_id) if b.promotion_campaign_id else None,
        })

    announcements = []
    for a in anns_qs:
        if active_window_only and not _is_within_window(a, now):
            continue
        # CMS12-PF-05: si está vinculado a campaña vencida o pausada, no prometer vigencia falsa
        if active_window_only and a.promotion_campaign_id:
            if a.promotion_campaign.status != "active" or now >= a.promotion_campaign.ends_at:
                continue
        announcements.append({
            "id": str(a.id),
            "text": a.text,
            "link_url": a.link_url,
            "market": a.market,
            "currency": a.currency,
            "priority": a.priority,
            "status": a.status,
            "starts_at": a.starts_at.isoformat() if a.starts_at else None,
            "ends_at": a.ends_at.isoformat() if a.ends_at else None,
            "business_timezone": a.business_timezone,
            "promotion_campaign_id": str(a.promotion_campaign_id) if a.promotion_campaign_id else None,
        })

    return {
        "version_id": str(version.id),
        "version_number": version.version_number,
        "status": version.status,
        "change_summary": version.change_summary,
        "checksum_sha256": version.checksum_sha256,
        "is_rollback": version.is_rollback,
        "published_at": version.published_at.isoformat() if version.published_at else None,
        "payload": version.payload_json or {},
        "hero_slides": slides,
        "banners": banners,
        "announcements": announcements,
    }


@transaction.atomic
def register_cms_asset(uploaded_file, *, title: str = "", alt_text: str = "", device_target: str = "universal", user=None) -> CMSAsset:
    meta = validate_cms_image_upload(uploaded_file)
    asset = CMSAsset.objects.create(
        title=sanitize_cms_text(title or getattr(uploaded_file, "name", "Asset CMS"))[:160],
        alt_text=sanitize_cms_text(alt_text)[:200],
        file=uploaded_file,
        device_target=device_target if device_target in {"universal", "desktop", "mobile"} else "universal",
        width=meta["width"],
        height=meta["height"],
        file_format=meta["format"],
        size_bytes=meta["size_bytes"],
        sha256=meta["sha256"],
        uploaded_by=user if getattr(user, "is_authenticated", False) else None,
    )
    return asset


def _clone_children(source: CMSVersion, target: CMSVersion):
    for sl in source.hero_slides.all():
        CMSHeroSlide.objects.create(
            version=target,
            order=sl.order,
            title=sl.title,
            subtitle=sl.subtitle,
            desktop_image=sl.desktop_image,
            mobile_image=sl.mobile_image,
            alt_text=sl.alt_text,
            focal_point=sl.focal_point,
            overlay_opacity=sl.overlay_opacity,
            cta1_text=sl.cta1_text,
            cta1_link=sl.cta1_link,
            cta2_text=sl.cta2_text,
            cta2_link=sl.cta2_link,
            status=sl.status,
            starts_at=sl.starts_at,
            ends_at=sl.ends_at,
            business_timezone=sl.business_timezone,
        )
    for b in source.banners.all():
        CMSBanner.objects.create(
            version=target,
            code=b.code,
            name=b.name,
            banner_type=b.banner_type,
            target_page=b.target_page,
            category=b.category,
            desktop_image=b.desktop_image,
            mobile_image=b.mobile_image,
            title=b.title,
            body_text=b.body_text,
            cta_text=b.cta_text,
            cta_link=b.cta_link,
            order=b.order,
            status=b.status,
            starts_at=b.starts_at,
            ends_at=b.ends_at,
            business_timezone=b.business_timezone,
            promotion_campaign=b.promotion_campaign,
            created_by=b.created_by,
        )
    for a in source.announcements.all():
        CMSAnnouncement.objects.create(
            version=target,
            text=a.text,
            link_url=a.link_url,
            market=a.market,
            currency=a.currency,
            priority=a.priority,
            status=a.status,
            starts_at=a.starts_at,
            ends_at=a.ends_at,
            business_timezone=a.business_timezone,
            promotion_campaign=a.promotion_campaign,
        )


def _refresh_checksum(version: CMSVersion):
    ser = serialize_version_content(version)
    version.checksum_sha256 = _compute_checksum(
        ser["payload"],
        ser["hero_slides"],
        ser["banners"],
        ser["announcements"],
    )
    version.save(update_fields=["checksum_sha256", "updated_at"])


@transaction.atomic
def create_draft_version(user=None, *, change_summary: str = "") -> CMSVersion:
    published = CMSVersion.objects.filter(status=CMSVersion.Status.PUBLISHED).order_by("-version_number").first()
    payload = dict(published.payload_json) if published else extract_editorial_snapshot_from_site_settings()
    draft = CMSVersion.objects.create(
        version_number=_next_version_number(),
        status=CMSVersion.Status.DRAFT,
        base_version=published,
        change_summary=sanitize_cms_text(change_summary or "Borrador editorial")[:255],
        payload_json=payload,
        created_by=user if getattr(user, "is_authenticated", False) else None,
    )
    if published:
        _clone_children(published, draft)
    _refresh_checksum(draft)
    CMSPublicationEvent.objects.create(
        version=draft,
        event_type="draft_created",
        actor=user if getattr(user, "is_authenticated", False) else None,
        notes=draft.change_summary,
        checksum_sha256=draft.checksum_sha256,
    )
    return draft


@transaction.atomic
def save_draft_editorial_payload(version_id, payload_updates: dict[str, Any], *, change_summary: str | None = None, user=None) -> CMSVersion:
    version = CMSVersion.objects.select_for_update().get(id=version_id)
    if version.status not in {CMSVersion.Status.DRAFT, CMSVersion.Status.IN_REVIEW}:
        raise ValidationError("Las versiones publicadas, reemplazadas o archivadas son inmutables.")

    forbidden_hit = SYSTEMIC_FIELDS.intersection(payload_updates.keys())
    if forbidden_hit:
        raise ValidationError(f"El CMS editorial no puede modificar campos sistémicos/financieros: {sorted(forbidden_hit)}")

    current = dict(version.payload_json or {})
    diff = dict(version.diff_json or {})
    for key, val in payload_updates.items():
        if key not in EDITORIAL_TEXT_FIELDS:
            continue
        if key in {"hero_cta1_link", "hero_cta2_link"}:
            clean_val = validate_safe_cms_url(val)
        elif isinstance(val, bool) or isinstance(val, int):
            clean_val = val
        else:
            clean_val = sanitize_cms_text(val)
        if current.get(key) != clean_val:
            diff[key] = {"before": current.get(key), "after": clean_val}
            current[key] = clean_val

    version.payload_json = current
    version.diff_json = diff
    if change_summary is not None:
        version.change_summary = sanitize_cms_text(change_summary)[:255]
    version.save(update_fields=["payload_json", "diff_json", "change_summary", "updated_at"])
    _refresh_checksum(version)
    return version


def _validate_window(starts_at, ends_at, tz_name: str):
    ZoneInfo(tz_name or "America/Santiago")
    if starts_at and ends_at and ends_at <= starts_at:
        raise ValidationError("ends_at debe ser posterior a starts_at.")


@transaction.atomic
def upsert_hero_slide(version_id, data: dict[str, Any]) -> CMSHeroSlide:
    version = CMSVersion.objects.select_for_update().get(id=version_id)
    if version.status not in {CMSVersion.Status.DRAFT, CMSVersion.Status.IN_REVIEW}:
        raise ValidationError("Solo puede editar slides en un borrador.")

    cta1_link = validate_safe_cms_url(data.get("cta1_link", ""))
    cta2_link = validate_safe_cms_url(data.get("cta2_link", ""))
    tz_name = data.get("business_timezone") or "America/Santiago"
    _validate_window(data.get("starts_at"), data.get("ends_at"), tz_name)

    desktop_img = CMSAsset.objects.filter(id=data["desktop_image_id"], is_archived=False).first() if data.get("desktop_image_id") else None
    mobile_img = CMSAsset.objects.filter(id=data["mobile_image_id"], is_archived=False).first() if data.get("mobile_image_id") else None

    slide_id = data.get("id")
    if slide_id:
        slide = CMSHeroSlide.objects.get(id=slide_id, version=version)
    else:
        slide = CMSHeroSlide(version=version)

    slide.order = int(data.get("order", 0))
    slide.title = sanitize_cms_text(data.get("title", ""))[:200]
    slide.subtitle = sanitize_cms_text(data.get("subtitle", ""))
    if "desktop_image_id" in data:
        slide.desktop_image = desktop_img
    if "mobile_image_id" in data:
        slide.mobile_image = mobile_img
    slide.alt_text = sanitize_cms_text(data.get("alt_text", ""))[:200]
    slide.focal_point = data.get("focal_point", "center")
    slide.overlay_opacity = max(0, min(100, int(data.get("overlay_opacity", 40))))
    slide.cta1_text = sanitize_cms_text(data.get("cta1_text", ""))[:40]
    slide.cta1_link = cta1_link
    slide.cta2_text = sanitize_cms_text(data.get("cta2_text", ""))[:40]
    slide.cta2_link = cta2_link
    slide.status = data.get("status", CMSHeroSlide.Status.ACTIVE)
    slide.starts_at = data.get("starts_at")
    slide.ends_at = data.get("ends_at")
    slide.business_timezone = tz_name
    slide.save()
    _refresh_checksum(version)
    return slide


@transaction.atomic
def upsert_banner(version_id, data: dict[str, Any], user=None) -> CMSBanner:
    version = CMSVersion.objects.select_for_update().get(id=version_id)
    if version.status not in {CMSVersion.Status.DRAFT, CMSVersion.Status.IN_REVIEW}:
        raise ValidationError("Solo puede editar banners en un borrador.")

    cta_link = validate_safe_cms_url(data.get("cta_link", ""))
    tz_name = data.get("business_timezone") or "America/Santiago"
    _validate_window(data.get("starts_at"), data.get("ends_at"), tz_name)

    desktop_img = CMSAsset.objects.filter(id=data["desktop_image_id"], is_archived=False).first() if data.get("desktop_image_id") else None
    mobile_img = CMSAsset.objects.filter(id=data["mobile_image_id"], is_archived=False).first() if data.get("mobile_image_id") else None
    category = Category.objects.filter(id=data["category_id"]).first() if data.get("category_id") else None
    promo = PromotionCampaign.objects.filter(id=data["promotion_campaign_id"]).first() if data.get("promotion_campaign_id") else None

    banner_id = data.get("id")
    if banner_id:
        banner = CMSBanner.objects.get(id=banner_id, version=version)
    else:
        banner = CMSBanner(version=version, created_by=user if getattr(user, "is_authenticated", False) else None)

    banner.code = sanitize_cms_text(data.get("code") or f"BNR-{version.version_number}")[:60]
    banner.name = sanitize_cms_text(data.get("name") or banner.code)[:140]
    banner.banner_type = data.get("banner_type", CMSBanner.BannerType.HOME_MID)
    banner.target_page = data.get("target_page", CMSBanner.TargetPage.HOME)
    banner.category = category
    if "desktop_image_id" in data:
        banner.desktop_image = desktop_img
    if "mobile_image_id" in data:
        banner.mobile_image = mobile_img
    banner.title = sanitize_cms_text(data.get("title", ""))[:180]
    banner.body_text = sanitize_cms_text(data.get("body_text", ""))
    banner.cta_text = sanitize_cms_text(data.get("cta_text", ""))[:40]
    banner.cta_link = cta_link
    banner.order = int(data.get("order", 0))
    banner.status = data.get("status", CMSHeroSlide.Status.ACTIVE)
    banner.starts_at = data.get("starts_at")
    banner.ends_at = data.get("ends_at")
    banner.business_timezone = tz_name
    banner.promotion_campaign = promo
    banner.save()
    _refresh_checksum(version)
    return banner


@transaction.atomic
def upsert_announcement(version_id, data: dict[str, Any]) -> CMSAnnouncement:
    version = CMSVersion.objects.select_for_update().get(id=version_id)
    if version.status not in {CMSVersion.Status.DRAFT, CMSVersion.Status.IN_REVIEW}:
        raise ValidationError("Solo puede editar anuncios en un borrador.")

    link_url = validate_safe_cms_url(data.get("link_url", ""))
    tz_name = data.get("business_timezone") or "America/Santiago"
    _validate_window(data.get("starts_at"), data.get("ends_at"), tz_name)
    promo = PromotionCampaign.objects.filter(id=data["promotion_campaign_id"]).first() if data.get("promotion_campaign_id") else None

    ann_id = data.get("id")
    if ann_id:
        ann = CMSAnnouncement.objects.get(id=ann_id, version=version)
    else:
        ann = CMSAnnouncement(version=version)

    ann.text = sanitize_cms_text(data.get("text", ""))[:220]
    if not ann.text:
        raise ValidationError("El texto del anuncio es obligatorio.")
    ann.link_url = link_url
    ann.market = (data.get("market") or "ALL").upper()[:10]
    ann.currency = (data.get("currency") or "ALL").upper()[:10]
    ann.priority = int(data.get("priority", 10))
    ann.status = data.get("status", CMSHeroSlide.Status.ACTIVE)
    ann.starts_at = data.get("starts_at")
    ann.ends_at = data.get("ends_at")
    ann.business_timezone = tz_name
    ann.promotion_campaign = promo
    ann.save()
    _refresh_checksum(version)
    return ann


@transaction.atomic
def transition_version_review(version_id, target_status: str, user) -> CMSVersion:
    version = CMSVersion.objects.select_for_update().get(id=version_id)
    if target_status == CMSVersion.Status.IN_REVIEW and version.status == CMSVersion.Status.DRAFT:
        version.status = CMSVersion.Status.IN_REVIEW
        version.save(update_fields=["status", "updated_at"])
        CMSPublicationEvent.objects.create(
            version=version,
            event_type="submitted_review",
            actor=user,
            checksum_sha256=version.checksum_sha256,
        )
        return version
    if target_status == CMSVersion.Status.APPROVED and version.status in {CMSVersion.Status.DRAFT, CMSVersion.Status.IN_REVIEW}:
        version.status = CMSVersion.Status.APPROVED
        version.reviewed_by = user
        version.save(update_fields=["status", "reviewed_by", "updated_at"])
        CMSPublicationEvent.objects.create(
            version=version,
            event_type="approved",
            actor=user,
            checksum_sha256=version.checksum_sha256,
        )
        return version
    raise ValidationError(f"Transición editorial inválida: {version.status} -> {target_status}")


@transaction.atomic
def publish_cms_version(version_id, user, *, notes: str = "") -> CMSVersion:
    version = CMSVersion.objects.select_for_update().get(id=version_id)
    if version.status == CMSVersion.Status.PUBLISHED:
        raise ValidationError("Esta versión ya está publicada.")
    if version.status not in {CMSVersion.Status.DRAFT, CMSVersion.Status.IN_REVIEW, CMSVersion.Status.APPROVED}:
        raise ValidationError(f"No se puede publicar una versión en estado {version.status}.")

    current_pub = CMSVersion.objects.select_for_update().filter(status=CMSVersion.Status.PUBLISHED).first()
    if current_pub and version.base_version_id and version.base_version_id != current_pub.id:
        raise ValidationError("Conflicto de edición: existe una versión publicada más reciente.")

    # Validar URLs y ventanas antes de publicar atómicamente
    payload = version.payload_json or {}
    validate_safe_cms_url(payload.get("hero_cta1_link", ""))
    validate_safe_cms_url(payload.get("hero_cta2_link", ""))
    for sl in version.hero_slides.all():
        validate_safe_cms_url(sl.cta1_link)
        validate_safe_cms_url(sl.cta2_link)
        _validate_window(sl.starts_at, sl.ends_at, sl.business_timezone)
    for b in version.banners.all():
        validate_safe_cms_url(b.cta_link)
        _validate_window(b.starts_at, b.ends_at, b.business_timezone)
    for a in version.announcements.all():
        validate_safe_cms_url(a.link_url)
        _validate_window(a.starts_at, a.ends_at, a.business_timezone)

    now = timezone.now()
    if current_pub:
        current_pub.status = CMSVersion.Status.SUPERSEDED
        current_pub.save(update_fields=["status", "updated_at"])

    # Aplicar campos editoriales a SiteSettings sin tocar campos sistémicos/financieros
    site = SiteSettings.get()
    for field in EDITORIAL_TEXT_FIELDS:
        if field in payload:
            setattr(site, field, payload[field])
    site.save()

    version.status = CMSVersion.Status.PUBLISHED
    version.published_by = user if getattr(user, "is_authenticated", False) else None
    version.published_at = now
    version.save(update_fields=["status", "published_by", "published_at", "updated_at"])
    _refresh_checksum(version)

    version.banners.filter(published_at__isnull=True).update(published_at=now)

    CMSPublicationEvent.objects.create(
        version=version,
        event_type="rollback_published" if version.is_rollback else "published",
        actor=user if getattr(user, "is_authenticated", False) else None,
        notes=sanitize_cms_text(notes)[:255],
        checksum_sha256=version.checksum_sha256,
        occurred_at=now,
    )
    record_audit_event(
        module=MODULE_SETTINGS,
        action="CMS_VERSION_PUBLISHED",
        event_category=CATEGORY_CONFIG_CHANGE,
        resource_type="CMSVersion",
        resource_id=str(version.id),
        resource_repr=f"CMS v{version.version_number}",
        actor=user,
        result=RESULT_SUCCESS,
        severity=SEVERITY_INFO,
        new_values=sanitize_audit_payload({"version_number": version.version_number, "checksum": version.checksum_sha256}),
        mandatory=True,
    )
    return version


@transaction.atomic
def rollback_to_version(target_version_id, user, *, notes: str = "") -> CMSVersion:
    target = CMSVersion.objects.get(id=target_version_id)
    if target.status not in {CMSVersion.Status.PUBLISHED, CMSVersion.Status.SUPERSEDED}:
        raise ValidationError("Solo puede hacer rollback hacia una versión publicada o reemplazada.")

    current_pub = CMSVersion.objects.select_for_update().filter(status=CMSVersion.Status.PUBLISHED).first()
    new_ver = CMSVersion.objects.create(
        version_number=_next_version_number(),
        status=CMSVersion.Status.DRAFT,
        base_version=current_pub,
        change_summary=sanitize_cms_text(notes or f"Rollback a v{target.version_number}")[:255],
        payload_json=dict(target.payload_json or {}),
        is_rollback=True,
        rolled_back_from=target,
        created_by=user if getattr(user, "is_authenticated", False) else None,
    )
    _clone_children(target, new_ver)
    _refresh_checksum(new_ver)
    return publish_cms_version(new_ver.id, user, notes=new_ver.change_summary)


def get_public_cms_payload(now=None) -> dict[str, Any]:
    now = now or timezone.now()
    published = CMSVersion.objects.filter(status=CMSVersion.Status.PUBLISHED).order_by("-version_number").first()
    if not published:
        site = SiteSettings.get()
        return {
            "version_number": 0,
            "published_at": None,
            "payload": extract_editorial_snapshot_from_site_settings(site),
            "hero_slides": [],
            "banners": [],
            "announcements": [],
        }
    return serialize_version_content(published, active_window_only=True, now=now)


def get_preview_cms_payload(version_id, now=None) -> dict[str, Any]:
    now = now or timezone.now()
    version = CMSVersion.objects.get(id=version_id)
    return serialize_version_content(version, active_window_only=False, now=now)

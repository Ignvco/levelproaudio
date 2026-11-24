# apps/site_settings/cms_views.py
"""
LEVELPRO OS V4.0 — GATE 12: CMS REST API VIEWS
Rutas rectoras:
- /api/v1/admin/cms/versions/ (listar / crear borrador)
- /api/v1/admin/cms/versions/<uuid:version_id>/ (editar borrador)
- /api/v1/admin/cms/versions/<uuid:version_id>/preview/ (previsualización protegida, noindex)
- /api/v1/admin/cms/versions/<uuid:version_id>/review/ (enviar a revisión / aprobar)
- /api/v1/admin/cms/versions/<uuid:version_id>/publish/ (publicación atómica)
- /api/v1/admin/cms/versions/<uuid:version_id>/rollback/ (rollback editorial)
- /api/v1/admin/cms/assets/ (listar / subir asset validado)
- /api/v1/admin/cms/hero-slides/ (crear/editar slide en borrador)
- /api/v1/admin/cms/banners/ (listar/crear/editar banner en borrador)
- /api/v1/admin/cms/announcements/ (crear/editar anuncio en borrador)
- /api/v1/admin/cms/events/ (historial auditable)
"""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.site_settings.cms_models import (
    CMSAnnouncement,
    CMSAsset,
    CMSBanner,
    CMSHeroSlide,
    CMSPublicationEvent,
    CMSVersion,
)
from apps.site_settings.cms_services import (
    create_draft_version,
    get_preview_cms_payload,
    publish_cms_version,
    register_cms_asset,
    rollback_to_version,
    save_draft_editorial_payload,
    serialize_version_content,
    transition_version_review,
    upsert_announcement,
    upsert_banner,
    upsert_hero_slide,
)
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.media import media_url as _media_url
from core.rbac.constants import (
    ACTION_APPROVE,
    ACTION_CREATE,
    ACTION_READ,
    ACTION_UPDATE,
    MODULE_MARKETING,
    ROLE_MANAGEMENT,
    ROLE_MARKETING,
    ROLE_SUPER_ADMIN,
)

CMS_EDITOR_ROLES = [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_MARKETING]
CMS_PUBLISHER_ROLES = [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT]


def _parse_dt(val):
    if not val:
        return None
    dt = parse_datetime(str(val))
    if dt and timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


@rbac_endpoint(
    module=MODULE_MARKETING,
    allowed_roles=CMS_EDITOR_ROLES,
    allowed_roles_by_method={"POST": CMS_EDITOR_ROLES},
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_cms_versions_view(request):
    if request.method == "GET":
        versions = CMSVersion.objects.select_related("created_by", "published_by").order_by("-version_number")[:50]
        return Response({
            "results": [
                {
                    "id": str(v.id),
                    "version_number": v.version_number,
                    "status": v.status,
                    "change_summary": v.change_summary,
                    "checksum_sha256": v.checksum_sha256,
                    "is_rollback": v.is_rollback,
                    "created_by_email": v.created_by.email if v.created_by else None,
                    "published_by_email": v.published_by.email if v.published_by else None,
                    "published_at": v.published_at.isoformat() if v.published_at else None,
                    "created_at": v.created_at.isoformat(),
                }
                for v in versions
            ]
        })

    draft = create_draft_version(user=request.user, change_summary=request.data.get("change_summary", ""))
    return Response(serialize_version_content(draft), status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_MARKETING,
    allowed_roles=CMS_EDITOR_ROLES,
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAdminOrStaff])
def admin_cms_version_detail_view(request, version_id):
    version = CMSVersion.objects.filter(id=version_id).first()
    if not version:
        return Response({"detail": "Versión CMS no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "GET":
        return Response(serialize_version_content(version))

    try:
        updated = save_draft_editorial_payload(
            version.id,
            request.data.get("payload") or request.data,
            change_summary=request.data.get("change_summary"),
            user=request.user,
        )
    except ValidationError as exc:
        msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    return Response(serialize_version_content(updated))


@rbac_endpoint(
    module=MODULE_MARKETING,
    action=ACTION_READ,
    allowed_roles=CMS_EDITOR_ROLES,
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_cms_version_preview_view(request, version_id):
    if not CMSVersion.objects.filter(id=version_id).exists():
        return Response({"detail": "Versión CMS no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = get_preview_cms_payload(version_id)
    resp = Response(data)
    resp["Cache-Control"] = "private, no-store"
    resp["X-Robots-Tag"] = "noindex, nofollow"
    return resp


@rbac_endpoint(
    module=MODULE_MARKETING,
    action=ACTION_UPDATE,
    allowed_roles=CMS_EDITOR_ROLES,
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_cms_version_review_view(request, version_id):
    target_status = request.data.get("target_status", CMSVersion.Status.IN_REVIEW)
    if target_status == CMSVersion.Status.APPROVED and request.user.groups.filter(name=ROLE_MARKETING).exists() and not (
        request.user.is_superuser or request.user.groups.filter(name__in=CMS_PUBLISHER_ROLES).exists()
    ):
        return Response({"detail": "Solo Gerencia o Super Admin puede aprobar versiones."}, status=status.HTTP_403_FORBIDDEN)
    try:
        ver = transition_version_review(version_id, target_status, request.user)
    except (CMSVersion.DoesNotExist, ValidationError) as exc:
        msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    return Response(serialize_version_content(ver))


@rbac_endpoint(
    module=MODULE_MARKETING,
    action=ACTION_APPROVE,
    allowed_roles=CMS_PUBLISHER_ROLES,
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_cms_version_publish_view(request, version_id):
    try:
        pub = publish_cms_version(version_id, request.user, notes=request.data.get("notes", ""))
    except (CMSVersion.DoesNotExist, ValidationError) as exc:
        msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    return Response(serialize_version_content(pub))


@rbac_endpoint(
    module=MODULE_MARKETING,
    action=ACTION_APPROVE,
    allowed_roles=CMS_PUBLISHER_ROLES,
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_cms_version_rollback_view(request, version_id):
    try:
        pub = rollback_to_version(version_id, request.user, notes=request.data.get("notes", ""))
    except (CMSVersion.DoesNotExist, ValidationError) as exc:
        msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    return Response(serialize_version_content(pub))


@rbac_endpoint(
    module=MODULE_MARKETING,
    allowed_roles=CMS_EDITOR_ROLES,
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def admin_cms_assets_view(request):
    if request.method == "GET":
        assets = CMSAsset.objects.filter(is_archived=False).order_by("-created_at")[:100]
        return Response({
            "results": [
                {
                    "id": str(a.id),
                    "title": a.title,
                    "alt_text": a.alt_text,
                    "url": _media_url(a.file),
                    "device_target": a.device_target,
                    "width": a.width,
                    "height": a.height,
                    "file_format": a.file_format,
                    "size_bytes": a.size_bytes,
                    "sha256": a.sha256,
                    "created_at": a.created_at.isoformat(),
                }
                for a in assets
            ]
        })

    uploaded = request.FILES.get("file")
    try:
        asset = register_cms_asset(
            uploaded,
            title=request.data.get("title", ""),
            alt_text=request.data.get("alt_text", ""),
            device_target=request.data.get("device_target", "universal"),
            user=request.user,
        )
    except ValidationError as exc:
        msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
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
    }, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_MARKETING,
    allowed_roles=CMS_EDITOR_ROLES,
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_cms_hero_slides_view(request):
    version_id = request.data.get("version_id")
    if not version_id:
        return Response({"detail": "version_id requerido."}, status=status.HTTP_400_BAD_REQUEST)
    payload = dict(request.data)
    payload["starts_at"] = _parse_dt(request.data.get("starts_at"))
    payload["ends_at"] = _parse_dt(request.data.get("ends_at"))
    try:
        slide = upsert_hero_slide(version_id, payload)
    except (CMSVersion.DoesNotExist, CMSHeroSlide.DoesNotExist, ValidationError) as exc:
        msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(slide.id), "order": slide.order, "title": slide.title}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_MARKETING,
    allowed_roles=CMS_EDITOR_ROLES,
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_cms_banners_view(request):
    if request.method == "GET":
        version_id = request.query_params.get("version_id")
        qs = CMSBanner.objects.select_related("desktop_image", "mobile_image", "category", "version")
        if version_id:
            qs = qs.filter(version_id=version_id)
        return Response({
            "results": [
                {
                    "id": str(b.id),
                    "version_id": str(b.version_id),
                    "code": b.code,
                    "name": b.name,
                    "banner_type": b.banner_type,
                    "target_page": b.target_page,
                    "category_id": str(b.category_id) if b.category_id else None,
                    "title": b.title,
                    "cta_text": b.cta_text,
                    "cta_link": b.cta_link,
                    "order": b.order,
                    "status": b.status,
                    "desktop_image_url": _media_url(b.desktop_image.file) if b.desktop_image_id else None,
                    "mobile_image_url": _media_url(b.mobile_image.file) if b.mobile_image_id else None,
                }
                for b in qs[:100]
            ]
        })

    version_id = request.data.get("version_id")
    if not version_id:
        return Response({"detail": "version_id requerido."}, status=status.HTTP_400_BAD_REQUEST)
    payload = dict(request.data)
    payload["starts_at"] = _parse_dt(request.data.get("starts_at"))
    payload["ends_at"] = _parse_dt(request.data.get("ends_at"))
    try:
        banner = upsert_banner(version_id, payload, user=request.user)
    except (CMSVersion.DoesNotExist, CMSBanner.DoesNotExist, ValidationError) as exc:
        msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(banner.id), "code": banner.code, "name": banner.name}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_MARKETING,
    allowed_roles=CMS_EDITOR_ROLES,
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_cms_announcements_view(request):
    version_id = request.data.get("version_id")
    if not version_id:
        return Response({"detail": "version_id requerido."}, status=status.HTTP_400_BAD_REQUEST)
    payload = dict(request.data)
    payload["starts_at"] = _parse_dt(request.data.get("starts_at"))
    payload["ends_at"] = _parse_dt(request.data.get("ends_at"))
    try:
        ann = upsert_announcement(version_id, payload)
    except (CMSVersion.DoesNotExist, CMSAnnouncement.DoesNotExist, ValidationError) as exc:
        msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(ann.id), "text": ann.text, "status": ann.status}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_MARKETING,
    action=ACTION_READ,
    allowed_roles=CMS_EDITOR_ROLES,
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_cms_events_view(request):
    events = CMSPublicationEvent.objects.select_related("version", "actor").order_by("-occurred_at")[:100]
    return Response({
        "results": [
            {
                "id": str(ev.id),
                "version_number": ev.version.version_number,
                "event_type": ev.event_type,
                "actor_email": ev.actor.email if ev.actor else None,
                "notes": ev.notes,
                "checksum_sha256": ev.checksum_sha256,
                "occurred_at": ev.occurred_at.isoformat(),
            }
            for ev in events
        ]
    })

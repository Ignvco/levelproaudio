# apps/site_settings/cms_preflight.py
"""
LEVELPRO OS V4.0 — GATE 12 PREFLIGHT CONTRACTS (CMS12-PF-01..05)
- CMS12-PF-01: Aislamiento de SiteSettings (Editorial vs Sistémico/Financiero)
- CMS12-PF-02: Ciclo de vida editorial y aislamiento estricto de borradores
- CMS12-PF-03: Validación binaria real de imágenes (Pillow, anti-SVG/script, dimensiones, peso)
- CMS12-PF-04: Consistencia SEO (solo contenido publicado)
- CMS12-PF-05: Separación CMS vs Motor Comercial Gate 11
"""

from __future__ import annotations

import hashlib
import io
import re
from typing import Any
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.utils.html import strip_tags
from PIL import Image, UnidentifiedImageError

EDITORIAL_TEXT_FIELDS = {
    "hero_title",
    "hero_subtitle",
    "hero_cta1_text",
    "hero_cta1_link",
    "hero_cta2_text",
    "hero_cta2_link",
    "site_name",
    "tagline",
    "accent_color",
    "show_trust_strip",
    "show_pillars",
    "show_products",
    "show_courses",
    "show_services",
    "show_about",
    "show_trust_details",
    "show_testimonial",
    "show_brands",
    "show_final_cta",
    "seo_title",
    "seo_description",
    "testimonial_name",
    "testimonial_role",
    "testimonial_quote",
    "about_title",
    "about_body",
    "home_bg_type",
    "home_bg_color",
    "home_bg_image_mode",
    "home_bg_image_opacity",
    "home_bg_overlay_opacity",
}

EDITORIAL_IMAGE_FIELDS = {
    "hero_image",
    "hero_image_2",
    "hero_image_3",
    "pillar_shop_image",
    "pillar_academy_image",
    "pillar_services_image",
    "logo",
    "og_image",
    "testimonial_photo",
    "home_bg_image",
}

SYSTEMIC_FIELDS = {
    "usd_to_clp",
    "usd_to_ars",
    "contact_whatsapp",
    "contact_instagram",
    "contact_email",
}

PUBLICATION_LIFECYCLE = (
    "draft",
    "in_review",
    "approved",
    "published",
    "superseded",
    "archived",
)

CMS_MARKETING_BOUNDARY = {
    "cms_can_recalculate_prices": False,
    "cms_can_activate_promotions": False,
    "cms_can_grant_discounts": False,
    "cms_can_modify_fx_rates": False,
}

ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
MIN_IMAGE_DIM = 32
MAX_IMAGE_DIM = 4096
FORBIDDEN_URL_SCHEMES = ("javascript:", "data:", "vbscript:", "file:")
FORBIDDEN_INTERNAL_PREFIXES = ("/admin", "/api/v1/admin")


def sanitize_cms_text(value: str | None) -> str:
    if value is None:
        return ""
    cleaned = strip_tags(str(value)).strip()
    return re.sub(r"\s+", " ", cleaned)


def validate_safe_cms_url(url: str | None, *, allow_empty: bool = True) -> str:
    raw = (url or "").strip()
    if not raw:
        if allow_empty:
            return ""
        raise ValidationError("La URL de destino es obligatoria.")

    lowered = raw.lower()
    if any(lowered.startswith(scheme) for scheme in FORBIDDEN_URL_SCHEMES):
        raise ValidationError("Esquema de URL prohibido por seguridad.")
    if "<" in raw or ">" in raw or "javascript:" in lowered:
        raise ValidationError("La URL contiene caracteres o payloads inseguros.")

    if raw.startswith("/"):
        if raw.startswith("//"):
            raise ValidationError("No se permiten redirecciones protocol-relative (//).")
        if any(lowered.startswith(prefix) for prefix in FORBIDDEN_INTERNAL_PREFIXES):
            raise ValidationError("No se permiten enlaces CMS hacia rutas administrativas o privadas.")
        return raw

    parsed = urlsplit(raw)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValidationError("Las URLs externas del CMS deben usar HTTPS válido o ser rutas relativas internas.")
    return raw


def validate_cms_image_upload(uploaded_file) -> dict[str, Any]:
    """
    Valida contenido binario real con Pillow (anti-SVG, anti-script, anti-corrupto),
    tamaño máximo y dimensiones seguras.
    """
    if uploaded_file is None:
        raise ValidationError("Archivo de imagen requerido.")

    name = getattr(uploaded_file, "name", "") or ""
    if name.lower().endswith(".svg"):
        raise ValidationError("Archivos SVG no están permitidos por seguridad.")

    size = getattr(uploaded_file, "size", None)
    if size is not None and size > MAX_IMAGE_BYTES:
        raise ValidationError(f"La imagen supera el máximo permitido ({MAX_IMAGE_BYTES // (1024 * 1024)} MB).")

    pos = uploaded_file.tell() if hasattr(uploaded_file, "tell") else 0
    raw_bytes = uploaded_file.read()
    if hasattr(uploaded_file, "seek"):
        uploaded_file.seek(pos)

    if not raw_bytes:
        raise ValidationError("El archivo de imagen está vacío.")
    if len(raw_bytes) > MAX_IMAGE_BYTES:
        raise ValidationError(f"La imagen supera el máximo permitido ({MAX_IMAGE_BYTES // (1024 * 1024)} MB).")

    head_lower = raw_bytes[:512].lstrip().lower()
    if head_lower.startswith(b"<svg") or b"<script" in head_lower or head_lower.startswith(b"<?xml"):
        raise ValidationError("Contenido SVG/XML o ejecutable rechazado.")

    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            img.verify()
        with Image.open(io.BytesIO(raw_bytes)) as img2:
            fmt = (img2.format or "").upper()
            width, height = img2.size
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValidationError("Archivo de imagen inválido o corrupto.") from exc

    if fmt not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError(f"Formato de imagen no permitido: {fmt}. Use JPEG, PNG o WEBP.")
    if width < MIN_IMAGE_DIM or height < MIN_IMAGE_DIM:
        raise ValidationError(f"Dimensiones mínimas requeridas: {MIN_IMAGE_DIM}x{MIN_IMAGE_DIM}px.")
    if width > MAX_IMAGE_DIM or height > MAX_IMAGE_DIM:
        raise ValidationError(f"Dimensiones máximas permitidas: {MAX_IMAGE_DIM}x{MAX_IMAGE_DIM}px.")

    return {
        "format": fmt,
        "width": width,
        "height": height,
        "size_bytes": len(raw_bytes),
        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
    }

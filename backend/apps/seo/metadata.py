"""Public metadata only: no order, user, token or unpublished content lookup."""
import re
from urllib.parse import parse_qs, quote, unquote, urlsplit

from django.conf import settings
from django.utils.html import escape, strip_tags

from apps.academy.models import Course
from apps.products.models import Category, Product
from apps.services.models import Service
from apps.site_settings.models import SiteSettings
from core.media import media_url

STATIC = {
    "/shop": ("Tienda", "Equipamiento de audio profesional de las mejores marcas, con stock real y envíos en Chile y Argentina."),
    "/academy": ("Academia", "Cursos técnicos de audio en video con instructores del oficio: producción, mezcla, masterización y más. Certificaciones LevelPro."),
    "/services": ("Servicios", "Mezcla, mastering, operación en vivo y asesoría técnica de audio profesional, a medida de tu proyecto."),
    "/bajo-pedido": ("Equipos bajo pedido", "Solicitá equipamiento de audio profesional bajo pedido."),
    "/rewards": ("Rewards", "Participá en los sorteos de LevelPro Audio y consultá las bases de cada campaña."),
    "/terminos": ("Términos y condiciones", "Condiciones de compra y uso de LevelPro Audio."),
    "/privacidad": ("Política de privacidad", "Cómo tratamos y protegemos tus datos personales."),
    "/bases-sorteo": ("Bases de los sorteos", "Condiciones de participación en los sorteos de LevelPro Audio."),
    "/garantia": ("Garantías y devoluciones", "Información sobre garantías y devoluciones de productos."),
    "/envios": ("Política de envíos", "Información sobre despachos y entregas de LevelPro Audio."),
}


def plain(value, limit=170):
    return " ".join(strip_tags(str(value or "")).split())[:limit]


def metadata_for(raw_uri):
    base = (getattr(settings, "SITE_URL", "") or "https://levelproaudio.com").rstrip("/")
    # Do not write singleton settings on an anonymous GET.
    site = SiteSettings.objects.first() or SiteSettings()
    default_image = base + (media_url(site.og_image) or "/og-image.png")
    result = {
        "title": site.site_name, "description": "Consultá tu cuenta en LevelPro Audio.",
        "site_name": site.site_name, "image": default_image, "type": "website",
        "canonical": base, "robots": "noindex, nofollow",
    }
    if not isinstance(raw_uri, str) or len(raw_uri) > 4096 or not raw_uri.startswith("/") or raw_uri.startswith("//"):
        return result
    parts = urlsplit(raw_uri)
    path = unquote(parts.path).rstrip("/") or "/"
    if not re.fullmatch(r"/[a-zA-Z0-9_/-]*", path):
        return result
    query = parse_qs(parts.query, max_num_fields=50)
    # Never reflect private path IDs, search terms, tracking or payment tokens.
    title = None
    if path == "/":
        result.update(title=plain(site.seo_title or site.site_name, 160), description=plain(site.seo_description), robots="index, follow")
    elif path in STATIC:
        result["canonical"] = base + path
        title, description = STATIC[path]
        result.update(description=description, robots="index, follow")
        if path == "/shop":
            category = Category.objects.filter(slug=query.get("category", [""])[0], is_active=True).first()
            if category:
                title = f"{category.name} en Chile"
                result["description"] = f"Comprá {plain(category.name, 80).lower()} de audio profesional en Chile. Envíos a Chile y Argentina."
                result["canonical"] += "?category=" + quote(category.slug, safe="")
            if query.get("search"):
                result["robots"] = "noindex, follow"
    else:
        match = re.fullmatch(r"/(shop|academy|services)/([a-zA-Z0-9_-]+)", path)
        if match:
            result["canonical"] = base + path
            kind, slug = match.groups()
            obj = {
                "shop": lambda: Product.objects.filter(slug=slug, is_active=True).first(),
                "academy": lambda: Course.objects.filter(slug=slug, is_published=True).first(),
                "services": lambda: Service.objects.filter(slug=slug, is_active=True).first(),
            }[kind]()
            if obj:
                title = getattr(obj, "seo_title", "") or getattr(obj, "name", "") or obj.title
                description = getattr(obj, "seo_description", "") or getattr(obj, "short_description", "") or obj.description
                result.update(description=plain(description), robots="index, follow")
                if kind == "shop":
                    image = obj.images.order_by("-is_primary", "order", "id").first()
                    image = image.image if image else None
                    result["type"] = "product"
                else:
                    image = obj.thumbnail
                if image:
                    # Public media proxy; never sign a storage URL or expose a bucket.
                    result["image"] = base + quote(media_url(image), safe="/")
            else:
                title = "Página no encontrada"
                result["description"] = "El contenido solicitado no está disponible."
    if title:
        result["title"] = f"{plain(title, 140)} · {site.site_name}"
    return result


def render_head(metadata):
    def tag(key, value, property=False):
        attribute = "property" if property else "name"
        return f'<meta data-initial-seo {attribute}="{key}" content="{escape(value)}">'
    return "\n".join([
        f'<title data-initial-seo>{escape(metadata["title"])}</title>',
        tag("description", metadata["description"]), tag("robots", metadata["robots"]),
        f'<link data-initial-seo rel="canonical" href="{escape(metadata["canonical"])}">',
        *[tag("og:" + key, metadata[key], True) for key in ("site_name", "title", "description", "type", "image")],
        tag("og:url", metadata["canonical"], True),
        tag("twitter:card", "summary_large_image"),
        *[tag("twitter:" + key, metadata[key]) for key in ("title", "description", "image")],
    ])


def generate_product_schema_ld(product, currency="CLP"):
    """Genera datos estructurados Schema.org JSON-LD para Google Search y Google Shopping (V3.3 Módulo 4)."""
    base = (getattr(settings, "SITE_URL", "") or "https://levelproaudio.com").rstrip("/")
    site = SiteSettings.objects.first() or SiteSettings()

    images = [
        base + quote(media_url(img.image), safe="/")
        for img in product.images.order_by("-is_primary", "order", "id")
        if img.image
    ]
    if not images:
        images = [base + (media_url(site.og_image) or "/og-image.png")]

    from apps.site_settings.models import SiteSettings as SS
    _s = SS.objects.first()
    rate_clp = _s.usd_to_clp if _s else None
    rate_ars = _s.usd_to_ars if _s else None
    prices = product.prices_by_currency(rate_clp, rate_ars)

    availability = "https://schema.org/InStock" if product.stock > 0 else "https://schema.org/PreOrder"

    offers_list = []
    for curr_code in ("CLP", "USD", "ARS"):
        p_val = prices.get(curr_code)
        if p_val is not None:
            offers_list.append({
                "@type": "Offer",
                "priceCurrency": curr_code,
                "price": str(p_val),
                "availability": availability,
                "itemCondition": "https://schema.org/NewCondition",
                "url": f"{base}/shop/{product.slug}",
            })

    category_name = product.category.name if product.category else "Audio Profesional"

    schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.name,
        "image": images,
        "description": plain(product.description or product.short_description or product.name, 300),
        "sku": product.sku or str(product.id)[:8].upper(),
        "offers": {
            "@type": "AggregateOffer",
            "priceCurrency": currency,
            "lowPrice": str(prices.get(currency) or product.price),
            "highPrice": str(prices.get(currency) or product.price),
            "offerCount": len(offers_list),
            "offers": offers_list,
        },
        "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Inicio", "item": base},
                {"@type": "ListItem", "position": 2, "name": "Tienda", "item": f"{base}/shop"},
                {"@type": "ListItem", "position": 3, "name": category_name, "item": f"{base}/shop?category={product.category.slug if product.category else 'all'}"},
                {"@type": "ListItem", "position": 4, "name": product.name, "item": f"{base}/shop/{product.slug}"},
            ]
        }
    }

    if product.brand:
        schema["brand"] = {"@type": "Brand", "name": product.brand.name}

    return schema


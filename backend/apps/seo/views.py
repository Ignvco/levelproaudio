"""SEO — sitemap.xml dinámico generado desde la base de datos."""
from django.conf import settings
from django.http import HttpResponse
from django.utils.html import escape
from urllib.parse import quote

from apps.products.models import Product, Category
from apps.services.models import Service
from apps.academy.models import Course


def _site_url():
    return (getattr(settings, "SITE_URL", "") or "https://levelproaudio.com").rstrip("/")


def _lastmod(obj):
    dt = getattr(obj, "updated_at", None) or getattr(obj, "created_at", None)
    return dt.date().isoformat() if dt else None


def _url_xml(loc, lastmod=None, changefreq=None, priority=None):
    parts = [f"<loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"<lastmod>{lastmod}</lastmod>")
    if changefreq:
        parts.append(f"<changefreq>{changefreq}</changefreq>")
    if priority:
        parts.append(f"<priority>{priority}</priority>")
    return "<url>" + "".join(parts) + "</url>"


def sitemap_view(request):
    base = _site_url()
    rows = []

    # Estáticas públicas
    static_pages = [
        ("/", "daily", "1.0"),
        ("/shop", "daily", "0.9"),
        ("/services", "weekly", "0.8"),
        ("/bajo-pedido", "weekly", "0.7"),
        ("/academy", "weekly", "0.8"),
        ("/rewards", "weekly", "0.7"),
        ("/terminos", "yearly", "0.3"),
        ("/privacidad", "yearly", "0.3"),
        ("/bases-sorteo", "yearly", "0.3"),
        ("/garantia", "yearly", "0.3"),
        ("/envios", "yearly", "0.3"),
    ]
    for path, cf, pr in static_pages:
        rows.append(_url_xml(f"{base}{path}", changefreq=cf, priority=pr))

    # Categorías (URL actual: /shop?category=<slug>)
    for cat in Category.objects.filter(is_active=True):
        rows.append(_url_xml(f"{base}/shop?category={quote(cat.slug, safe='')}",
                             lastmod=_lastmod(cat), changefreq="weekly", priority="0.7"))

    # Productos activos
    for p in Product.objects.filter(is_active=True).only("slug", "updated_at", "created_at"):
        rows.append(_url_xml(f"{base}/shop/{p.slug}",
                             lastmod=_lastmod(p), changefreq="weekly", priority="0.8"))

    # Servicios activos
    for s in Service.objects.filter(is_active=True).only("slug", "updated_at", "created_at"):
        rows.append(_url_xml(f"{base}/services/{s.slug}",
                             lastmod=_lastmod(s), changefreq="monthly", priority="0.7"))

    # Cursos publicados
    for c in Course.objects.filter(is_published=True).only("slug", "updated_at", "created_at"):
        rows.append(_url_xml(f"{base}/academy/{c.slug}",
                             lastmod=_lastmod(c), changefreq="monthly", priority="0.7"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(rows)
        + "\n</urlset>\n"
    )
    return HttpResponse(xml, content_type="application/xml; charset=utf-8")


# Included by nginx in the initial HTML, for users and crawlers alike.
from django.views.decorators.http import require_GET
from .metadata import metadata_for, render_head


@require_GET
def head_view(request):
    import logging
    try:
        uri = request.headers.get("X-SEO-Path") or request.GET.get("path", "/")
        response = HttpResponse(render_head(metadata_for(uri)), content_type="text/html; charset=utf-8")
    except Exception:
        logging.getLogger(__name__).exception("Unable to render public SEO metadata")
        # An empty response triggers nginx's safe SSI fallback.
        response = HttpResponse("", status=503)
    response["Cache-Control"] = "no-store"
    response["X-Robots-Tag"] = "noindex"
    return response


from django.http import JsonResponse
from .metadata import generate_product_schema_ld


@require_GET
def product_schema_view(request, slug):
    """
    GET /api/v1/seo/schema/product/<slug>/
    Entrega el bloque JSON-LD estructurado Schema.org para indexadores y bots (V3.3 Módulo 4).
    """
    try:
        product = Product.objects.select_related("category", "brand").prefetch_related("images").get(
            slug=slug, is_active=True
        )
    except Product.DoesNotExist:
        return JsonResponse({"error": "Producto no encontrado."}, status=404)

    currency = (request.GET.get("currency") or "CLP").upper()
    if currency not in ("CLP", "USD", "ARS"):
        currency = "CLP"

    schema = generate_product_schema_ld(product, currency=currency)
    response = JsonResponse(schema)
    response["Cache-Control"] = "public, max-age=3600"
    return response


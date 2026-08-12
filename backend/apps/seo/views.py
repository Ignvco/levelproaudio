"""SEO — sitemap.xml dinámico generado desde la base de datos."""
from django.conf import settings
from django.http import HttpResponse
from django.utils.text import Truncator  # noqa: F401 (por si se usa a futuro)

from apps.products.models import Product, Category
from apps.services.models import Service
from apps.academy.models import Course


def _site_url():
    return (getattr(settings, "SITE_URL", "") or "https://levelproaudio.com").rstrip("/")


def _lastmod(obj):
    dt = getattr(obj, "updated_at", None) or getattr(obj, "created_at", None)
    return dt.date().isoformat() if dt else None


def _url_xml(loc, lastmod=None, changefreq=None, priority=None):
    parts = [f"<loc>{loc}</loc>"]
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
        rows.append(_url_xml(f"{base}/shop?category={cat.slug}",
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

    # Artículos del blog publicados
    from apps.blog.models import Article
    for a in Article.objects.filter(is_published=True).only("slug", "updated_at", "created_at"):
        rows.append(_url_xml(f"{base}/blog/{a.slug}",
                             lastmod=_lastmod(a), changefreq="monthly", priority="0.6"))

    # Índice del blog
    rows.append(_url_xml(f"{base}/blog", changefreq="daily", priority="0.7"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(rows)
        + "\n</urlset>\n"
    )
    return HttpResponse(xml, content_type="application/xml; charset=utf-8")

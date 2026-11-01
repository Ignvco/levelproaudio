from decimal import Decimal
from html.parser import HTMLParser
from unittest.mock import patch
from xml.etree import ElementTree

import pytest
from django.test import Client

from apps.academy.models import Course
from apps.products.models import Category, Product, ProductImage
from apps.services.models import Service
from apps.site_settings.models import SiteSettings
from apps.seo.metadata import metadata_for


class Head(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = []
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


@pytest.fixture
def catalog(db):
    category = Category.objects.create(name="Micrófonos", slug="microfonos")
    product = Product.objects.create(name="Mic test", slug="mic-test", price=Decimal("100"), stock=1, category=category, short_description="Micrófono de estudio", seo_title="Título de producto", seo_description="Descripción del producto")
    ProductImage.objects.create(product=product, image="products/microfono.png", is_primary=True)
    course = Course.objects.create(title="Curso test", slug="curso-test", price=Decimal("100"), is_published=True, description="<p>Mezcla profesional</p>", thumbnail="courses/test.png")
    service = Service.objects.create(name="Servicio test", slug="servicio-test", description="Mastering", is_active=True, thumbnail="services/test.png")
    return product, course, service


def test_home_uses_config_without_creating_on_read(db):
    SiteSettings.objects.all().delete()
    assert metadata_for("/")["robots"] == "index, follow"
    assert not SiteSettings.objects.exists()
    SiteSettings.objects.create(seo_title="Mi título", seo_description="Mi descripción")
    data = metadata_for("/")
    assert data["title"] == "Mi título"
    assert data["description"] == "Mi descripción"


@pytest.mark.parametrize("path,title,image", [("/shop/mic-test", "Título de producto", "/media/products/microfono.png"), ("/academy/curso-test", "Curso test", "/media/courses/test.png"), ("/services/servicio-test", "Servicio test", "/media/services/test.png")])
def test_initial_fragment_contains_page_metadata_without_javascript(catalog, path, title, image):
    response = Client().get("/api/v1/seo/head/", HTTP_X_SEO_PATH=path)
    assert response.status_code == 200
    head = Head(response.content.decode())
    tags = [attrs for tag, attrs in head.tags if tag == "meta"]
    assert len([attrs for attrs in tags if attrs.get("property") == "og:title"]) == 1
    assert next(attrs["content"] for attrs in tags if attrs.get("property") == "og:title").startswith(title)
    assert next(attrs["content"] for attrs in tags if attrs.get("property") == "og:image") == "https://levelproaudio.com" + image
    assert next(attrs["content"] for attrs in tags if attrs.get("name") == "robots") == "index, follow"
    assert response["Cache-Control"] == "no-store"


@pytest.mark.parametrize("kind,path", [(0, "/shop/mic-test"), (1, "/academy/curso-test"), (2, "/services/servicio-test")])
def test_hidden_content_never_exposed(catalog, kind, path):
    obj = catalog[kind]
    setattr(obj, "is_published" if kind == 1 else "is_active", False)
    obj.save()
    data = metadata_for(path)
    assert data["robots"] == "noindex, nofollow"
    assert data["title"].startswith("Página no encontrada")
    assert data["image"].endswith("/og-image.png")


@pytest.mark.parametrize("path", ["/payment/success?paymentId=PRIVATE-PAYMENT", "/dashboard/orders/PRIVATE-ID", "/admin/users", "/login", "/cart", "/checkout", "/not-real", "//evil.test", "/%3Cscript%3E"])
def test_private_or_unknown_routes_have_generic_noindex_metadata(db, path):
    data = metadata_for(path)
    assert data["robots"] == "noindex, nofollow"
    assert "PRIVATE" not in str(data)
    assert "evil.test" not in str(data)
    assert data["canonical"] == "https://levelproaudio.com"


def test_category_canonical_keeps_only_category_and_search_is_noindex(catalog):
    data = metadata_for("/shop?category=microfonos&utm_source=test&search=private-search")
    assert data["canonical"] == "https://levelproaudio.com/shop?category=microfonos"
    assert data["title"].startswith("Micrófonos en Chile")
    assert data["robots"] == "noindex, follow"
    assert "private-search" not in str(data)


def test_untrusted_text_cannot_create_html_tags(catalog):
    product, _, _ = catalog
    Product.objects.filter(pk=product.pk).update(seo_title='</title><script>window.x=1</script>', seo_description='" onload="alert(1) & text')
    response = Client().get("/api/v1/seo/head/", {"path": "/shop/mic-test"})
    head = Head(response.content.decode())
    assert not any(tag in ("script", "img") for tag, _ in head.tags)
    assert not any("onload" in attrs for _, attrs in head.tags)
    assert len([tag for tag, _ in head.tags if tag == "title"]) == 1


def test_backend_failure_is_empty_for_nginx_fallback(db):
    with patch("apps.seo.views.metadata_for", side_effect=RuntimeError("private-backend-detail")):
        response = Client().get("/api/v1/seo/head/")
    assert response.status_code == 503
    assert response.content == b""


def test_sitemap_escapes_xml_and_includes_special_order(db, settings):
    settings.SITE_URL = "https://example.test/?a=1&b=2"
    response = Client().get("/api/v1/seo/sitemap.xml")
    root = ElementTree.fromstring(response.content)
    assert root is not None
    assert b"&amp;" in response.content
    assert b"/bajo-pedido" in response.content

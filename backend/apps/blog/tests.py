# apps/blog/tests.py

from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.blog.models import Article
from apps.products.models import Category, Product


class BlogTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.published = Article.objects.create(
            title="Cómo elegir un micrófono para iglesia",
            body="<p>Guía completa...</p>",
            pillar="education", is_published=True,
        )
        self.draft = Article.objects.create(
            title="Borrador interno",
            body="<p>No listo</p>",
            pillar="brand", is_published=False,
        )

    def test_list_only_shows_published(self):
        resp = self.client.get("/api/v1/blog/articles/")
        self.assertEqual(resp.status_code, 200)
        results = resp.data["results"] if "results" in resp.data else resp.data
        slugs = [a["slug"] for a in results]
        self.assertIn("como-elegir-un-microfono-para-iglesia", slugs)
        self.assertNotIn("borrador-interno", slugs)

    def test_draft_detail_returns_404(self):
        resp = self.client.get(f"/api/v1/blog/articles/{self.draft.slug}/")
        self.assertEqual(resp.status_code, 404)

    def test_published_detail_returns_body(self):
        resp = self.client.get(f"/api/v1/blog/articles/{self.published.slug}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Guía completa", resp.data["body"])

    def test_filter_by_pillar(self):
        Article.objects.create(title="Otro educativo", body="x",
                               pillar="education", is_published=True)
        Article.objects.create(title="Nota de marca", body="x",
                               pillar="brand", is_published=True)
        resp = self.client.get("/api/v1/blog/articles/?pillar=brand")
        results = resp.data["results"] if "results" in resp.data else resp.data
        pillars = {a["pillar"] for a in results}
        self.assertEqual(pillars, {"brand"})

    def test_published_at_set_on_publish(self):
        a = Article.objects.create(title="Test fecha", body="x", is_published=True)
        self.assertIsNotNone(a.published_at)

    def test_draft_has_no_published_at(self):
        self.assertIsNone(self.draft.published_at)

    def test_linked_products_only_active(self):
        cat = Product.objects.create  # noqa
        c = Category.objects.create(name="Audio", slug="audio-blog")
        active = Product.objects.create(name="Mic activo", slug="mic-activo-blog",
                                        category=c, price=Decimal("1000"), is_active=True)
        inactive = Product.objects.create(name="Mic inactivo", slug="mic-inactivo-blog",
                                          category=c, price=Decimal("1000"), is_active=False)
        self.published.linked_products.set([active, inactive])
        resp = self.client.get(f"/api/v1/blog/articles/{self.published.slug}/")
        names = {p["name"] for p in resp.data["linked_products"]}
        self.assertEqual(names, {"Mic activo"})  # el inactivo no aparece

    def test_related_articles_only_published(self):
        rel_pub = Article.objects.create(title="Relacionado pub", body="x", is_published=True)
        rel_draft = Article.objects.create(title="Relacionado draft", body="x", is_published=False)
        self.published.related_articles.set([rel_pub, rel_draft])
        resp = self.client.get(f"/api/v1/blog/articles/{self.published.slug}/")
        titles = {a["title"] for a in resp.data["related_articles"]}
        self.assertEqual(titles, {"Relacionado pub"})

    def test_article_in_sitemap(self):
        resp = self.client.get("/api/v1/seo/sitemap.xml")
        content = resp.content.decode()
        self.assertIn("/blog/como-elegir-un-microfono-para-iglesia", content)
        self.assertNotIn("/blog/borrador-interno", content)

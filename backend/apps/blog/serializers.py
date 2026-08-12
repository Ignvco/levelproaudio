# apps/blog/serializers.py

from rest_framework import serializers
from core.media import media_url as _media_url
from apps.products.serializers import ProductListSerializer
from .models import Article


class ArticleListSerializer(serializers.ModelSerializer):
    """Liviano — para la lista del blog. No trae body ni relaciones."""
    cover_image  = serializers.SerializerMethodField()
    pillar_label = serializers.CharField(source="get_pillar_display", read_only=True)

    class Meta:
        model  = Article
        fields = ["id", "title", "slug", "excerpt", "cover_image",
                  "pillar", "pillar_label", "author_name", "published_at"]

    def get_cover_image(self, obj):
        return _media_url(obj.cover_image) if obj.cover_image else None


class ArticleDetailSerializer(serializers.ModelSerializer):
    """Completo — body, productos enlazados, artículos relacionados."""
    cover_image      = serializers.SerializerMethodField()
    pillar_label     = serializers.CharField(source="get_pillar_display", read_only=True)
    linked_products  = serializers.SerializerMethodField()
    related_articles = serializers.SerializerMethodField()

    class Meta:
        model  = Article
        fields = ["id", "title", "slug", "excerpt", "body", "cover_image",
                  "pillar", "pillar_label", "author_name", "published_at",
                  "linked_products", "related_articles",
                  "seo_title", "seo_description"]

    def get_cover_image(self, obj):
        return _media_url(obj.cover_image) if obj.cover_image else None

    def get_linked_products(self, obj):
        # Solo productos activos, para no enlazar a fichas despublicadas
        products = obj.linked_products.filter(is_active=True)
        return ProductListSerializer(products, many=True, context=self.context).data

    def get_related_articles(self, obj):
        related = obj.related_articles.filter(is_published=True)[:3]
        return ArticleListSerializer(related, many=True, context=self.context).data

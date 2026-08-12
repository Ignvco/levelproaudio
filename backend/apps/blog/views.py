# apps/blog/views.py

from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend

from .models import Article
from .serializers import ArticleListSerializer, ArticleDetailSerializer


class ArticleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Blog público. Solo artículos publicados. Filtrable por pilar
    (?pillar=education), buscable por título/bajada.
    """
    lookup_field       = "slug"
    permission_classes = [AllowAny]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ["pillar"]
    search_fields      = ["title", "excerpt"]
    ordering           = ["-published_at"]

    def get_queryset(self):
        return (
            Article.objects
            .filter(is_published=True)
            .prefetch_related("linked_products", "related_articles")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ArticleDetailSerializer
        return ArticleListSerializer

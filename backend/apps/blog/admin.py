# apps/blog/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import Article


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display  = ["title", "pillar", "is_published", "published_at", "cover_preview"]
    list_filter   = ["is_published", "pillar"]
    search_fields = ["title", "excerpt", "body"]
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ["linked_products", "related_articles"]
    readonly_fields = ["cover_preview"]
    fieldsets = (
        ("Contenido", {
            "fields": ["title", "slug", "pillar", "excerpt", "body",
                       "cover_image", "cover_preview", "author_name"],
        }),
        ("Publicación", {
            "fields": ["is_published", "published_at"],
        }),
        ("Enlaces", {
            "fields": ["linked_products", "related_articles"],
            "description": "Productos que se muestran como tarjetas dentro del artículo, "
                           "y otros artículos sugeridos al final.",
        }),
        ("SEO", {
            "fields": ["seo_title", "seo_description"],
            "classes": ["collapse"],
        }),
    )

    def cover_preview(self, obj):
        if obj.cover_image:
            # /media/ proxy (bucket privado, sin URLs firmadas) — mismo
            # patrón que el resto del admin.
            return format_html(
                '<img src="/media/{}" style="max-width:200px;border-radius:6px;" />',
                obj.cover_image.name
            )
        return "Sin imagen"
    cover_preview.short_description = "Preview de portada"

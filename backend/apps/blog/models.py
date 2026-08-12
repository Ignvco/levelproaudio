# apps/blog/models.py
#
# Blog / contenido para SEO y los 4 pilares de contenido de LevelPro.
# Un Article tiene contenido rico, meta SEO, se clasifica por pilar, y
# puede enlazar productos (blog → tienda) y otros artículos (relacionados).

from django.db import models
from django.utils.text import slugify
from django.conf import settings
from core.models import TimeStampedModel


class Article(TimeStampedModel):
    """Artículo del blog. Los 4 pilares son los mismos del plan de
    contenido: educación, problemas reales, marca, productos."""

    class Pillar(models.TextChoices):
        EDUCATION = "education", "Educación"
        PROBLEMS  = "problems",  "Problemas reales"
        BRAND     = "brand",     "Marca / detrás de escena"
        PRODUCTS  = "products",  "Productos"

    title        = models.CharField(max_length=300)
    slug         = models.SlugField(max_length=320, unique=True, blank=True)
    excerpt      = models.CharField(
        max_length=300, blank=True,
        verbose_name="Bajada / resumen",
        help_text="El resumen corto que se ve en la lista y en las previews.",
    )
    # Contenido rico en HTML (el editor del admin ya maneja RichText en
    # otros modelos del proyecto; acá guardamos el HTML resultante).
    body         = models.TextField(verbose_name="Contenido")
    cover_image  = models.ImageField(upload_to="blog/", blank=True, null=True,
                                     verbose_name="Imagen de portada")
    pillar       = models.CharField(
        max_length=20, choices=Pillar.choices, default=Pillar.EDUCATION,
        verbose_name="Pilar de contenido",
    )
    author_name  = models.CharField(max_length=120, blank=True, default="LevelPro Audio")

    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    # Blog → tienda: productos mencionados en el artículo, para mostrar
    # sus tarjetas con link directo a comprar.
    linked_products = models.ManyToManyField(
        "products.Product", blank=True, related_name="articles",
        verbose_name="Productos enlazados",
        help_text="Se muestran como tarjetas dentro del artículo, con link a comprar.",
    )
    # Artículos relacionados (self, no simétrico — igual criterio que el
    # cross-sell de productos).
    related_articles = models.ManyToManyField(
        "self", symmetrical=False, blank=True, related_name="+",
        verbose_name="Artículos relacionados",
    )

    # SEO
    seo_title       = models.CharField(max_length=255, blank=True)
    seo_description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]
        verbose_name = "Artículo"
        verbose_name_plural = "Artículos"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        # Setear published_at la primera vez que se publica
        if self.is_published and not self.published_at:
            from django.utils import timezone
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

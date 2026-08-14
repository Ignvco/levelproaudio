"""
Site Settings — modelo singleton para la personalización del sitio.
Todos los textos, imágenes, toggles y meta-data configurables desde el admin.
"""
from django.db import models
from decimal import Decimal
from core.models import TimeStampedModel


class SiteSettings(TimeStampedModel):
    """Singleton — sólo puede existir 1 instancia."""

    # ── Hero (Home) ────────────────────────────────────────
    hero_title      = models.CharField(max_length=200, default="Llevá tu sonido al nivel profesional.")
    hero_subtitle   = models.TextField(default="El ecosistema completo para músicos, productores e ingenieros. Equipamiento, formación y servicios en un solo lugar.")
    hero_cta1_text  = models.CharField(max_length=40, default="Explorar tienda")
    hero_cta1_link  = models.CharField(max_length=200, default="/shop")
    hero_cta2_text  = models.CharField(max_length=40, default="Ver academia")
    hero_cta2_link  = models.CharField(max_length=200, default="/academy")
    hero_image      = models.ImageField(upload_to="site/", blank=True, null=True)
    hero_image_2    = models.ImageField(upload_to="site/", blank=True, null=True)
    hero_image_3    = models.ImageField(upload_to="site/", blank=True, null=True)

    # ── Pilares (fondos configurables de las 3 cards) ──────
    pillar_shop_image     = models.ImageField(upload_to="site/", blank=True, null=True)
    pillar_academy_image  = models.ImageField(upload_to="site/", blank=True, null=True)
    pillar_services_image = models.ImageField(upload_to="site/", blank=True, null=True)

    # ── Marca / Branding ───────────────────────────────────
    site_name       = models.CharField(max_length=60, default="LevelPro Audio")
    tagline         = models.CharField(max_length=200, default="Audio profesional · Chile & Argentina")
    logo            = models.ImageField(upload_to="site/", blank=True, null=True)
    accent_color    = models.CharField(max_length=9, default="#1aff6e")

    # ── Contacto ───────────────────────────────────────────
    contact_whatsapp  = models.CharField(max_length=40, default="+5492622635045", blank=True)
    contact_instagram = models.CharField(max_length=60, default="levelproar", blank=True)
    contact_email     = models.EmailField(default="ventas@levelproaudio.com", blank=True)

    # ── Secciones (mostrar/ocultar) ────────────────────────
    show_trust_strip = models.BooleanField(default=True)
    show_pillars     = models.BooleanField(default=True)
    show_products    = models.BooleanField(default=True)
    show_courses     = models.BooleanField(default=True)
    show_services    = models.BooleanField(default=True)
    show_about       = models.BooleanField(default=True)
    show_trust_details = models.BooleanField(default=True)
    show_testimonial = models.BooleanField(default=True)
    show_brands      = models.BooleanField(default=True)
    show_final_cta   = models.BooleanField(default=True)

    # ── SEO / Metadata ─────────────────────────────────────
    seo_title       = models.CharField(max_length=70, default="LevelPro Audio · Equipamiento y academia de audio profesional")
    seo_description = models.CharField(max_length=170, default="La plataforma completa para producir y grabar profesionalmente en Chile y Argentina. Tienda, academia y servicios.")
    og_image        = models.ImageField(upload_to="site/", blank=True, null=True)

    # ── Testimonial destacado ──────────────────────────────
    testimonial_photo = models.ImageField(upload_to="site/", blank=True, null=True)
    testimonial_name  = models.CharField(max_length=80,  default="Diego Ramírez")
    testimonial_role  = models.CharField(max_length=120, default="Productor · Santiago de Chile")
    testimonial_quote = models.TextField(default="La asesoría técnica marcó la diferencia. Compré exactamente lo que necesitaba para mi estudio y encima aprendí a mezclarlo con los cursos.")

    about_title = models.CharField(
        max_length=200, blank=True,
        default="No vendemos audio por vender.",
    )
    about_body = models.TextField(
        blank=True,
        default="Creemos que comprar equipamiento profesional debería empezar con una buena decisión técnica. Por eso combinamos equipamiento, formación y asesoría para ayudarte a construir un sistema que realmente funcione.",
    )

    # ── Tasas de cambio (multi-moneda) ──────────────────────────────
    # CLP es la moneda base (el precio principal del producto). Estas
    # tasas se usan para CALCULAR los precios USD/ARS cuando el producto
    # no los tiene cargados a mano. El admin las actualiza cuando quiere.
    usd_to_clp = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("950"),
        verbose_name="1 USD = ? CLP",
        help_text="Cuántos pesos chilenos vale un dólar (para calcular precios USD).",
    )
    usd_to_ars = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("1000"),
        verbose_name="1 USD = ? ARS",
        help_text="Cuántos pesos argentinos vale un dólar (para el precio ARS referencial).",
    )

    class Meta:
        verbose_name        = "Configuración del sitio"
        verbose_name_plural = "Configuración del sitio"

    def __str__(self):
        return f"Site Settings · {self.site_name}"

    @classmethod
    def get(cls):
        """Devuelve la instancia singleton (crea si no existe)."""
        obj = cls.objects.first()
        return obj or cls.objects.create()

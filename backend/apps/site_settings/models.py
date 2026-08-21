"""
Site Settings — modelo singleton para la personalización del sitio.
Todos los textos, imágenes, toggles y meta-data configurables desde el admin.
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
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

    # ── Fondo del Home (configurable desde el admin) ────────────────
    # Permite elegir un color sólido o una imagen de fondo para toda la
    # página de inicio, con control de opacidad de la imagen y un overlay
    # oscuro ajustable encima (para que el texto se lea sobre cualquier foto).
    class HomeBgType(models.TextChoices):
        COLOR = "color", "Color sólido"
        IMAGE = "image", "Imagen"

    home_bg_type = models.CharField(
        max_length=8, choices=HomeBgType.choices, default=HomeBgType.COLOR,
        verbose_name="Tipo de fondo del Home",
        help_text="Elegí si el fondo del Home es un color sólido o una imagen.",
    )
    home_bg_color = models.CharField(
        max_length=9, default="#0a0a0a",
        verbose_name="Color de fondo del Home",
        help_text="Color sólido de fondo (hex, ej. #0a0a0a). Se usa si el tipo es 'color'.",
    )
    home_bg_image = models.ImageField(
        upload_to="site/", blank=True, null=True,
        verbose_name="Imagen de fondo del Home",
        help_text="Imagen de fondo. Se usa si el tipo es 'imagen'.",
    )
    home_bg_image_opacity = models.PositiveSmallIntegerField(
        default=100,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Opacidad de la imagen (%)",
        help_text="0 = invisible, 100 = totalmente opaca.",
    )
    home_bg_overlay_opacity = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Overlay oscuro sobre la imagen (%)",
        help_text="Capa negra encima de la imagen para mejorar la legibilidad del texto. 0 = sin overlay.",
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

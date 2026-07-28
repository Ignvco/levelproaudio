from rest_framework import serializers
from .models import SiteSettings


def _media_url(f):
    return f"/media/{f.name}" if f and f.name else None


class SiteSettingsSerializer(serializers.ModelSerializer):
    """Uso publico (GET) — devuelve URLs relativas /media/."""

    hero_image_url        = serializers.SerializerMethodField()
    logo_url              = serializers.SerializerMethodField()
    og_image_url          = serializers.SerializerMethodField()
    testimonial_photo_url = serializers.SerializerMethodField()

    class Meta:
        model  = SiteSettings
        fields = [
            "id",
            # Hero
            "hero_title", "hero_subtitle",
            "hero_cta1_text", "hero_cta1_link",
            "hero_cta2_text", "hero_cta2_link",
            "hero_image_url",
            # Brand
            "site_name", "tagline", "logo_url", "accent_color",
            # Contact
            "contact_whatsapp", "contact_instagram", "contact_email",
            # Sections toggles
            "show_trust_strip", "show_pillars", "show_products",
            "show_courses", "show_services", "show_testimonial",
            "show_brands", "show_final_cta",
            # SEO
            "seo_title", "seo_description", "og_image_url",
            # Testimonial
            "testimonial_photo_url", "testimonial_name",
            "testimonial_role", "testimonial_quote",
        ]

    def get_hero_image_url(self, obj):        return _media_url(obj.hero_image)
    def get_logo_url(self, obj):              return _media_url(obj.logo)
    def get_og_image_url(self, obj):          return _media_url(obj.og_image)
    def get_testimonial_photo_url(self, obj): return _media_url(obj.testimonial_photo)


class SiteSettingsWriteSerializer(SiteSettingsSerializer):
    """Uso admin (PATCH) — permite escribir imágenes."""

    hero_image        = serializers.ImageField(write_only=True, required=False)
    logo              = serializers.ImageField(write_only=True, required=False)
    og_image          = serializers.ImageField(write_only=True, required=False)
    testimonial_photo = serializers.ImageField(write_only=True, required=False)

    class Meta(SiteSettingsSerializer.Meta):
        fields = SiteSettingsSerializer.Meta.fields + [
            "hero_image", "logo", "og_image", "testimonial_photo",
        ]

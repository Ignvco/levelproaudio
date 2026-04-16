# apps/products/serializers.py
from rest_framework import serializers
from .models import Category, Brand, Product, ProductImage


def _safe_image_url(image_field):
    """
    Devuelve la URL de un campo de imagen de forma segura.
    En producción con GCS: devuelve la URL pública del bucket.
    En desarrollo: devuelve la URL relativa del servidor local.
    Nunca lanza excepción — devuelve None si no hay imagen.
    """
    if not image_field:
        return None
    try:
        return image_field.url
    except Exception:
        return None


class CategorySerializer(serializers.ModelSerializer):
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model  = Category
        fields = ["id", "name", "slug", "parent", "description", "image", "order", "is_active"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def validate(self, data):
        if not data.get("slug"):
            from django.utils.text import slugify
            data["slug"] = slugify(data.get("name", ""))
        return data

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["parent"] = str(instance.parent_id) if instance.parent_id else None
        ret["image"]  = _safe_image_url(instance.image)
        return ret


class BrandSerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()

    class Meta:
        model  = Brand
        fields = ["id", "name", "slug", "logo", "website", "is_active"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def get_logo(self, obj):
        return _safe_image_url(obj.logo)

    def validate(self, data):
        if not data.get("slug"):
            from django.utils.text import slugify
            data["slug"] = slugify(data.get("name", ""))
        return data


class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model  = ProductImage
        fields = ["id", "image", "alt_text", "order", "is_primary"]

    def get_image(self, obj):
        return _safe_image_url(obj.image)


class ProductListSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    in_stock      = serializers.BooleanField(read_only=True)
    brand_name    = serializers.CharField(source="brand.name", read_only=True, allow_null=True)

    class Meta:
        model  = Product
        fields = [
            "id", "name", "slug", "price", "compare_price",
            "stock", "in_stock", "is_featured",
            "primary_image", "brand_name",
            "has_discount", "discount_percentage",
        ]

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or \
              obj.images.order_by("order", "id").first()
        return _safe_image_url(img.image) if img else None


class ProductDetailSerializer(serializers.ModelSerializer):
    category           = CategorySerializer(read_only=True)
    brand              = BrandSerializer(read_only=True)
    images             = ProductImageSerializer(many=True, read_only=True)
    primary_image      = serializers.SerializerMethodField()
    has_discount       = serializers.BooleanField(read_only=True)
    discount_percentage = serializers.IntegerField(read_only=True)
    in_stock           = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Product
        fields = [
            "id", "name", "slug", "sku",
            "category", "brand",
            "description", "short_description",
            "price", "compare_price", "cost_price",
            "has_discount", "discount_percentage",
            "stock", "in_stock", "is_featured",
            "primary_image", "images",
            "created_at", "updated_at",
        ]

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or \
              obj.images.order_by("order", "id").first()
        return _safe_image_url(img.image) if img else None

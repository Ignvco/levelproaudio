# apps/products/serializers.py
from rest_framework import serializers
from .models import Category, Brand, Product, ProductImage


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model  = Category
        fields = ["id", "name", "slug", "parent", "description",
                  "image", "order", "is_active", "children"]
        extra_kwargs = {
            "slug":   {"required": False, "allow_blank": True},
            "parent": {"required": False, "allow_null": True},
        }

    def validate(self, data):
        if not data.get("slug"):
            from django.utils.text import slugify
            data["slug"] = slugify(data.get("name", ""))
        return data

    def get_children(self, obj):
        children = obj.children.filter(is_active=True)
        return CategorySerializer(children, many=True).data


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Brand
        fields = ["id", "name", "slug", "logo", "website", "is_active"]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
        }

    def validate(self, data):
        if not data.get("slug"):
            from django.utils.text import slugify
            data["slug"] = slugify(data.get("name", ""))
        return data


class ProductImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model  = ProductImage
        fields = ["id", "image", "image_url", "alt_text", "order", "is_primary"]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        return obj.image.url


class ProductListSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    in_stock      = serializers.BooleanField(read_only=True)
    brand_name    = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model  = Product
        fields = [
            "id", "name", "slug", "price", "compare_price",
            "stock", "in_stock", "is_featured",
            "primary_image", "brand_name",
            "has_discount", "discount_percentage",
        ]

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first()
        if not img:
            img = obj.images.order_by("order", "id").first()
        if img and img.image:
            return img.image.url
        return None


class ProductDetailSerializer(serializers.ModelSerializer):
    category            = CategorySerializer(read_only=True)
    brand               = BrandSerializer(read_only=True)
    images              = ProductImageSerializer(many=True, read_only=True)
    primary_image       = serializers.SerializerMethodField()
    has_discount        = serializers.BooleanField(read_only=True)
    discount_percentage = serializers.IntegerField(read_only=True)
    in_stock            = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Product
        fields = [
            "id", "name", "slug", "sku",
            "category", "brand",
            "description", "short_description",
            "price", "compare_price",
            "has_discount", "discount_percentage",
            "stock", "in_stock", "is_featured",
            "primary_image", "images",
            "created_at", "updated_at",
        ]

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first()
        if not img:
            img = obj.images.order_by("order", "id").first()
        if img and img.image:
            return img.image.url
        return None

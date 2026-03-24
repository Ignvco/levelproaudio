# apps/products/serializers.py
# Serializers del catálogo de productos

from rest_framework import serializers
from .models import Category, Brand, Product, ProductImage


class CategorySerializer(serializers.ModelSerializer):
    """
    Serializer de categorías.
    """

    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'image',
            'children'
        ]

    def get_children(self, obj):
        children = obj.children.filter(is_active=True)
        return CategorySerializer(children, many=True).data


class BrandSerializer(serializers.ModelSerializer):
    """
    Serializer de marcas.
    """

    class Meta:
        model = Brand
        fields = [
            'id',
            'name',
            'slug',
            'logo',
            'website'
        ]


class ProductImageSerializer(serializers.ModelSerializer):
    """
    Serializer de imágenes de producto.
    """

    class Meta:
        model = ProductImage
        fields = [
            'id',
            'image',
            'alt_text',
            'order',
            'is_primary'
        ]


class ProductListSerializer(serializers.ModelSerializer):
    """
    Serializer liviano para listado de productos.
    """

    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'slug',
            'price',
            'compare_price',
            'is_featured',
            'primary_image'
        ]

    def get_primary_image(self, obj):
        image = obj.images.filter(is_primary=True).first()

        if image:
            return image.image.url

        return None


class ProductDetailSerializer(serializers.ModelSerializer):
    """
    Serializer completo para detalle de producto.
    """

    images = ProductImageSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    brand = BrandSerializer(read_only=True)

    class Meta:
        model = Product

        fields = [
            'id',
            'name',
            'slug',
            'sku',
            'category',
            'brand',
            'description',
            'short_description',
            'price',
            'compare_price',
            'stock',
            'is_featured',
            'images'
        ]
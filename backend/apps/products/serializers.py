# apps/products/serializers.py
from rest_framework import serializers
from decimal import Decimal
from .models import (
    Category, Brand, Product, ProductImage,
    ProductVariant, TechnicalAttributeDefinition,
    CategoryTechnicalTemplate, ProductTechnicalSpec,
)
from core.media import media_url as _media_url


def _get_exchange_rates(context):
    """
    Obtiene las tasas de cambio de SiteSettings, cacheadas en el contexto
    del serializer para no consultar la DB una vez por producto.
    """
    cached = context.get("_exchange_rates") if context else None
    if cached:
        return cached
    try:
        from apps.site_settings.models import SiteSettings
        s = SiteSettings.objects.first()
        rates = {
            "usd_to_clp": s.usd_to_clp if s else Decimal("950"),
            "usd_to_ars": s.usd_to_ars if s else Decimal("1000"),
        }
    except Exception:
        rates = {"usd_to_clp": Decimal("950"), "usd_to_ars": Decimal("1000")}
    if context is not None:
        context["_exchange_rates"] = rates
    return rates


class CategorySerializer(serializers.ModelSerializer):
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        allow_null=True,
        required=False,
    )
    image = serializers.SerializerMethodField()
    product_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model  = Category
        fields = ["id", "name", "slug", "parent", "description", "image", "order", "is_active", "product_count"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def get_image(self, obj):
        return _media_url(obj.image)

    def validate(self, data):
        if not data.get("slug"):
            from django.utils.text import slugify
            data["slug"] = slugify(data.get("name", ""))
        return data

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["parent"] = str(instance.parent_id) if instance.parent_id else None
        return ret


class BrandSerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()
    product_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model  = Brand
        fields = ["id", "name", "slug", "logo", "website", "is_active", "product_count"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def get_logo(self, obj):
        return _media_url(obj.logo)

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
        return _media_url(obj.image)


class ProductVariantPublicSerializer(serializers.ModelSerializer):
    """Serializer público de variante (sin cost_price ni datos internos)."""
    price = serializers.DecimalField(source="effective_price", max_digits=12, decimal_places=2, read_only=True)
    compare_price = serializers.DecimalField(source="effective_compare_price", max_digits=12, decimal_places=2, read_only=True, allow_null=True)
    weight = serializers.DecimalField(source="effective_weight", max_digits=6, decimal_places=2, read_only=True, allow_null=True)
    prices = serializers.SerializerMethodField()
    in_stock = serializers.BooleanField(read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            "id", "sku", "barcode", "name", "attributes",
            "price", "compare_price", "prices",
            "stock", "in_stock", "weight",
            "image", "image_url", "is_active", "is_default", "order",
        ]

    def get_prices(self, obj):
        rates = _get_exchange_rates(self.context)
        p = obj.prices_by_currency(rates["usd_to_clp"], rates["usd_to_ars"])
        return {k: str(v) for k, v in p.items()}

    def get_image_url(self, obj):
        if obj.image and obj.image.image:
            return _media_url(obj.image.image)
        return None


class TechnicalAttributeDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TechnicalAttributeDefinition
        fields = [
            "id", "key", "label", "data_type", "unit", "options",
            "min_value", "max_value", "is_comparable", "is_filterable", "order",
        ]


class ProductTechnicalSpecSerializer(serializers.ModelSerializer):
    key = serializers.CharField(source="attribute.key", read_only=True)
    label = serializers.CharField(source="attribute.label", read_only=True)
    unit = serializers.CharField(source="attribute.unit", read_only=True)
    data_type = serializers.CharField(source="attribute.data_type", read_only=True)
    is_comparable = serializers.BooleanField(source="attribute.is_comparable", read_only=True)
    display_value = serializers.CharField(read_only=True)

    class Meta:
        model = ProductTechnicalSpec
        fields = [
            "id", "attribute", "key", "label", "unit", "data_type",
            "is_comparable", "value_text", "value_number", "value_json",
            "display_value", "notes",
        ]


class ProductListSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    images        = serializers.SerializerMethodField()
    in_stock      = serializers.BooleanField(read_only=True)
    brand_name    = serializers.CharField(source="brand.name", read_only=True, allow_null=True)
    brand_logo    = serializers.SerializerMethodField()
    is_favorited  = serializers.SerializerMethodField()
    badge_display = serializers.CharField(source="get_badge_display", read_only=True)
    is_low_stock  = serializers.SerializerMethodField()
    prices        = serializers.SerializerMethodField()
    has_variants  = serializers.SerializerMethodField()
    variants_count = serializers.SerializerMethodField()
    effective_stock = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Product
        fields = [
            "id", "name", "slug", "price", "compare_price",
            "price_usd", "price_ars", "prices",
            "short_description",
            "stock", "effective_stock", "in_stock", "is_featured",
            "has_variants", "variants_count",
            "badge", "badge_display", "is_low_stock", "product_type",
            "primary_image", "images", "brand_name", "brand_logo",
            "has_discount", "discount_percentage", "is_favorited",
        ]

    def get_has_variants(self, obj):
        return obj.variants.filter(is_active=True).exists()

    def get_variants_count(self, obj):
        return obj.variants.filter(is_active=True).count()

    def get_prices(self, obj):
        rates = _get_exchange_rates(self.context)
        p = obj.prices_by_currency(rates["usd_to_clp"], rates["usd_to_ars"])
        return {k: str(v) for k, v in p.items()}

    def get_is_low_stock(self, obj):
        # No exponemos el umbral real (stock_min) — solo si o no, para
        # no filtrar información interna de reposición al público.
        return obj.product_type == Product.ProductType.STOCK and 0 < obj.stock <= obj.stock_min

    def get_is_favorited(self, obj):
        fav_ids = self.context.get("favorite_ids")
        if fav_ids is not None:
            return obj.id in fav_ids
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            from .models import Favorite
            return Favorite.objects.filter(user=request.user, product=obj).exists()
        return False

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or \
              obj.images.order_by("order", "id").first()
        return _media_url(img.image) if img else None

    def get_images(self, obj):
        imgs = sorted(
            obj.images.all(),
            key=lambda i: (not i.is_primary, i.order, i.id),
        )
        return [_media_url(i.image) for i in imgs if i.image]

    def get_brand_logo(self, obj):
        return _media_url(obj.brand.logo) if obj.brand and obj.brand.logo else None


class ProductDetailSerializer(serializers.ModelSerializer):
    category            = CategorySerializer(read_only=True)
    brand                = BrandSerializer(read_only=True)
    images              = ProductImageSerializer(many=True, read_only=True)
    primary_image       = serializers.SerializerMethodField()
    has_discount        = serializers.BooleanField(read_only=True)
    discount_percentage = serializers.IntegerField(read_only=True)
    in_stock            = serializers.BooleanField(read_only=True)
    badge_display       = serializers.CharField(source="get_badge_display", read_only=True)
    is_low_stock        = serializers.SerializerMethodField()
    related_products    = ProductListSerializer(many=True, read_only=True)
    bundle_items        = serializers.SerializerMethodField()
    prices              = serializers.SerializerMethodField()
    variants            = serializers.SerializerMethodField()
    technical_specs     = serializers.SerializerMethodField()
    has_variants        = serializers.SerializerMethodField()
    effective_stock     = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Product
        fields = [
            "id", "name", "slug", "sku",
            "category", "brand",
            "description", "short_description",
            "price", "compare_price",
            "price_usd", "price_ars", "prices",
            "has_discount", "discount_percentage",
            "stock", "effective_stock", "in_stock", "is_active", "is_featured",
            "has_variants", "variants", "technical_specs",
            "badge", "badge_display", "is_low_stock", "product_type",
            "weight",
            "primary_image", "images", "related_products", "bundle_items",
            "seo_title", "seo_description",
            "created_at", "updated_at",
        ]

    def get_has_variants(self, obj):
        return obj.variants.filter(is_active=True).exists()

    def get_variants(self, obj):
        qs = obj.variants.filter(is_active=True).select_related("image").order_by("order", "created_at")
        return ProductVariantPublicSerializer(qs, many=True, context=self.context).data

    def get_technical_specs(self, obj):
        qs = obj.technical_specs.select_related("attribute").order_by("attribute__order", "attribute__label")
        return ProductTechnicalSpecSerializer(qs, many=True, context=self.context).data

    def get_prices(self, obj):
        rates = _get_exchange_rates(self.context)
        p = obj.prices_by_currency(rates["usd_to_clp"], rates["usd_to_ars"])
        return {k: str(v) for k, v in p.items()}

    def get_bundle_items(self, obj):
        if obj.product_type != Product.ProductType.BUNDLE:
            return []
        items = obj.bundle_components.select_related("component", "variant").all()
        result = []
        for bi in items:
            entry = {
                "quantity": bi.quantity,
                "product": ProductListSerializer(bi.component, context=self.context).data,
                "variant": None,
            }
            if bi.variant_id:
                entry["variant"] = {
                    "id": str(bi.variant.id),
                    "sku": bi.variant.sku,
                    "name": bi.variant.name,
                    "attributes": bi.variant.attributes or {},
                }
            result.append(entry)
        return result

    def get_is_low_stock(self, obj):
        return obj.product_type == Product.ProductType.STOCK and 0 < obj.stock <= obj.stock_min

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or \
              obj.images.order_by("order", "id").first()
        return _media_url(img.image) if img else None

class SpecialOrderRequestSerializer(serializers.ModelSerializer):
    """Público: para crear una solicitud bajo pedido."""
    class Meta:
        from .models import SpecialOrderRequest
        model = SpecialOrderRequest
        fields = ["id", "name", "email", "phone", "equipment", "brand_model",
                  "quantity", "details", "budget", "created_at"]
        read_only_fields = ["id", "created_at"]


class SpecialOrderRequestAdminSerializer(serializers.ModelSerializer):
    """Admin: gestión completa con estado y notas."""
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        from .models import SpecialOrderRequest
        model = SpecialOrderRequest
        fields = ["id", "name", "email", "phone", "equipment", "brand_model",
                  "quantity", "details", "budget", "status", "status_display",
                  "admin_notes", "created_at"]
        read_only_fields = ["id", "created_at"]

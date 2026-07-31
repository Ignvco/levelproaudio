"""
apps/rewards/serializers.py — DRF serializers.
"""
from rest_framework import serializers

from apps.products.models import Product
from .models import Campaign, RewardProduct, Entry, Winner


# ═══════════════════════════════════════════════════════════════
# PÚBLICOS (sitio web)
# ═══════════════════════════════════════════════════════════════

class ProductInCampaignSerializer(serializers.ModelSerializer):
    image             = serializers.SerializerMethodField()
    price             = serializers.DecimalField(max_digits=12, decimal_places=2)
    entries_per_purchase = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Product
        fields = ["id", "name", "slug", "price", "image", "entries_per_purchase"]

    def get_image(self, obj):
        primary = obj.images.filter(is_primary=True).first() or obj.images.first()
        return f"/media/{primary.image.name}" if primary and primary.image else None


class WinnerPublicSerializer(serializers.ModelSerializer):
    name        = serializers.SerializerMethodField()
    campaign    = serializers.CharField(source="campaign.name", read_only=True)
    prize       = serializers.CharField(source="campaign.main_prize", read_only=True)
    drawn_at    = serializers.DateTimeField(source="campaign.drawn_at", read_only=True)

    class Meta:
        model  = Winner
        fields = ["id", "name", "campaign", "prize", "is_backup",
                  "backup_position", "drawn_at"]

    def get_name(self, obj):
        # Muestra sólo la inicial del apellido por privacidad
        parts = (obj.user_name or "").strip().split()
        if not parts:
            return "Anónimo"
        first = parts[0]
        last_initial = parts[-1][0] + "." if len(parts) > 1 else ""
        return f"{first} {last_initial}".strip()


class CampaignPublicSerializer(serializers.ModelSerializer):
    products    = serializers.SerializerMethodField()
    winners     = serializers.SerializerMethodField()
    total_entries      = serializers.IntegerField(read_only=True)
    total_participants = serializers.IntegerField(read_only=True)
    image       = serializers.SerializerMethodField()
    banner      = serializers.SerializerMethodField()

    class Meta:
        model  = Campaign
        fields = [
            "id", "name", "slug", "description", "main_prize",
            "sticker_price",
            "start_date", "end_date", "draw_date", "status",
            "legal_terms", "show_counter",
            "image", "banner",
            "total_entries", "total_participants",
            "products", "winners",
            "is_drawn", "drawn_at",
        ]

    def get_image(self, obj):
        return f"/media/{obj.image.name}" if obj.image and obj.image.name else None

    def get_banner(self, obj):
        return f"/media/{obj.banner.name}" if obj.banner and obj.banner.name else None

    def get_products(self, obj):
        rps = obj.reward_products.filter(is_active=True).select_related("product")
        products = []
        for rp in rps:
            data = ProductInCampaignSerializer(rp.product).data
            data["entries_per_purchase"] = rp.entries_per_purchase
            products.append(data)
        return products

    def get_winners(self, obj):
        return WinnerPublicSerializer(
            obj.winners.all().order_by("backup_position"), many=True
        ).data


class UserEntriesGroupedSerializer(serializers.Serializer):
    """Vista agrupada por campaña para /rewards/my-entries/."""
    id           = serializers.UUIDField()
    name         = serializers.CharField()
    slug         = serializers.CharField()
    main_prize   = serializers.CharField()
    draw_date    = serializers.DateTimeField()
    status       = serializers.CharField()
    is_drawn     = serializers.BooleanField()
    entries_count = serializers.IntegerField(source="user_entries_count")
    image        = serializers.SerializerMethodField()
    codes        = serializers.SerializerMethodField()
    won          = serializers.SerializerMethodField()

    def get_image(self, obj):
        return f"/media/{obj.image.name}" if obj.image and obj.image.name else None

    def get_codes(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return []
        return list(
            obj.entries.filter(user=request.user)
            .order_by("created_at")
            .values_list("unique_code", flat=True)
        )

    def get_won(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        w = obj.winners.filter(user=request.user).order_by("backup_position").first()
        if not w:
            return None
        return {
            "is_backup":       w.is_backup,
            "backup_position": w.backup_position,
        }


# ═══════════════════════════════════════════════════════════════
# ADMIN
# ═══════════════════════════════════════════════════════════════

class AdminRewardProductSerializer(serializers.ModelSerializer):
    product_name  = serializers.CharField(source="product.name", read_only=True)
    product_price = serializers.DecimalField(
        source="product.price", max_digits=12, decimal_places=2, read_only=True
    )
    product_image = serializers.SerializerMethodField()

    class Meta:
        model  = RewardProduct
        fields = [
            "id", "campaign", "product", "entries_per_purchase",
            "is_active", "product_name", "product_price", "product_image",
        ]

    def get_product_image(self, obj):
        primary = obj.product.images.filter(is_primary=True).first() \
                  or obj.product.images.first()
        return f"/media/{primary.image.name}" if primary and primary.image else None


class AdminCampaignSerializer(serializers.ModelSerializer):
    total_entries      = serializers.IntegerField(read_only=True)
    total_participants = serializers.IntegerField(read_only=True)
    image_url          = serializers.SerializerMethodField()
    banner_url         = serializers.SerializerMethodField()
    reward_products    = AdminRewardProductSerializer(many=True, read_only=True)
    is_drawn           = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Campaign
        fields = [
            "id", "name", "slug", "description", "main_prize",
            "sticker_price",
            "start_date", "end_date", "draw_date",
            "status", "legal_terms", "show_counter",
            "backup_winners_count",
            "image", "image_url",
            "banner", "banner_url",
            "total_entries", "total_participants",
            "reward_products",
            "is_drawn", "drawn_at",
            "created_at",
        ]
        extra_kwargs = {
            "slug":   {"required": False, "allow_blank": True},
            "image":  {"write_only": True, "required": False},
            "banner": {"write_only": True, "required": False},
        }

    def get_image_url(self, obj):
        return f"/media/{obj.image.name}" if obj.image and obj.image.name else None

    def get_banner_url(self, obj):
        return f"/media/{obj.banner.name}" if obj.banner and obj.banner.name else None


class AdminEntrySerializer(serializers.ModelSerializer):
    user_email    = serializers.EmailField(source="user.email", read_only=True)
    user_name     = serializers.SerializerMethodField()
    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    product_name  = serializers.CharField(source="product.name", read_only=True)
    order_short   = serializers.SerializerMethodField()

    class Meta:
        model  = Entry
        fields = [
            "id", "unique_code",
            "campaign", "campaign_name",
            "user", "user_email", "user_name",
            "order", "order_short",
            "product", "product_name",
            "created_at",
        ]

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.email

    def get_order_short(self, obj):
        return str(obj.order.id)[:8].upper()


class AdminWinnerSerializer(serializers.ModelSerializer):
    campaign_name  = serializers.CharField(source="campaign.name", read_only=True)
    unique_code    = serializers.CharField(source="entry.unique_code", read_only=True)
    proof_url      = serializers.SerializerMethodField()

    class Meta:
        model  = Winner
        fields = [
            "id",
            "campaign", "campaign_name",
            "entry", "unique_code",
            "user", "user_email", "user_name",
            "is_backup", "backup_position",
            "notes", "delivery_proof", "proof_url",
            "created_at",
        ]
        extra_kwargs = {
            "delivery_proof": {"write_only": True, "required": False},
        }

    def get_proof_url(self, obj):
        return f"/media/{obj.delivery_proof.name}" \
               if obj.delivery_proof and obj.delivery_proof.name else None

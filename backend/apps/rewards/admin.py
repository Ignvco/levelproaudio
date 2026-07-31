from django.contrib import admin
from .models import Campaign, RewardProduct, Entry, Winner, StickerPurchase


@admin.register(StickerPurchase)
class StickerPurchaseAdmin(admin.ModelAdmin):
    list_display  = ("id", "campaign", "quantity", "order", "created_at")
    list_filter   = ("campaign",)
    search_fields = ("campaign__name", "order__id")


class RewardProductInline(admin.TabularInline):
    model = RewardProduct
    extra = 0


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display  = ("name", "status", "draw_date", "start_date", "end_date")
    list_filter   = ("status",)
    search_fields = ("name", "main_prize")
    inlines       = [RewardProductInline]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display  = ("unique_code", "campaign", "user", "product", "created_at")
    list_filter   = ("campaign",)
    search_fields = ("unique_code", "user__email")
    readonly_fields = ("unique_code",)


@admin.register(Winner)
class WinnerAdmin(admin.ModelAdmin):
    list_display  = ("campaign", "user_email", "is_backup",
                     "backup_position", "created_at")
    list_filter   = ("campaign", "is_backup")
    search_fields = ("user_email", "user_name")

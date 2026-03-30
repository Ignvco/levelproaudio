# apps/products/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import Category, Brand, Product, ProductImage


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display        = ["name", "parent", "is_active", "order"]
    list_filter         = ["is_active", "parent"]
    search_fields       = ["name"]
    prepopulated_fields = {"slug": ("name",)}
    ordering            = ["order", "name"]


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display        = ["name", "website", "is_active"]
    list_filter         = ["is_active"]
    search_fields       = ["name"]
    prepopulated_fields = {"slug": ("name",)}


class ProductImageInline(admin.TabularInline):
    model   = ProductImage
    extra   = 4          # ← 4 slots vacíos para agregar fotos
    fields  = ["image_preview", "image", "alt_text", "order", "is_primary"]
    readonly_fields = ["image_preview"]
    ordering = ["order"]

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="width:60px;height:60px;'
                'object-fit:cover;border-radius:4px;" />',
                obj.image.url
            )
        return "Sin imagen"
    image_preview.short_description = "Preview"


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display  = [
        "name", "category", "brand", "price",
        "stock_display", "is_active", "is_featured", "discount_badge"
    ]
    list_filter   = ["is_active", "is_featured", "category", "brand", "product_type"]
    search_fields = ["name", "sku"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields     = ["created_at", "updated_at"]
    inlines             = [ProductImageInline]

    fieldsets = (
        ("Información Principal", {
            "fields": ("name", "slug", "sku", "category", "brand", "product_type")
        }),
        ("Descripción", {
            "fields": ("short_description", "description")
        }),
        ("Precios y Stock", {
            "fields": ("price", "compare_price", "stock", "weight")
        }),
        ("SEO", {
            "fields": ("seo_title", "seo_description"),
            "classes": ("collapse",)
        }),
        ("Visibilidad", {
            "fields": ("is_active", "is_featured")
        }),
        ("Auditoría", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

    def stock_display(self, obj):
        color = "#ff4444" if obj.stock == 0 else "#f59e0b" if obj.stock <= 5 else "#00e676"
        return format_html(
            '<span style="color:{};font-weight:bold;">{}</span>',
            color, obj.stock
        )
    stock_display.short_description = "Stock"

    def discount_badge(self, obj):
        if obj.has_discount:
            return format_html(
                '<span style="color:#00e676;font-weight:bold;">-{}%</span>',
                obj.discount_percentage
            )
        return "—"
    discount_badge.short_description = "Descuento"
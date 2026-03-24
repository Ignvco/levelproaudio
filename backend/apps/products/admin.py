# apps/products/admin.py
# Configuración del panel admin para gestionar el catálogo completo

from django.contrib import admin
from django.utils.html import format_html
from .models import Category, Brand, Product, ProductImage


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'is_active', 'order']
    list_filter = ['is_active', 'parent']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}  # Genera el slug automático en el admin
    ordering = ['order', 'name']


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'website', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


class ProductImageInline(admin.TabularInline):
    """
    Permite cargar las imágenes de un producto
    directamente desde la pantalla del producto.
    """
    model = ProductImage
    extra = 3
    fields = ['image', 'alt_text', 'order', 'is_primary']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'category', 'brand',
        'price', 'stock', 'is_active', 'is_featured',
        'discount_badge'
    ]
    list_filter = ['is_active', 'is_featured', 'category', 'brand']
    search_fields = ['name', 'sku']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ProductImageInline]

    fieldsets = (
        ('Información Principal', {
            'fields': ('name', 'slug', 'sku', 'category', 'brand')
        }),
        ('Descripción', {
            'fields': ('short_description', 'description')
        }),
        ('Precios y Stock', {
            'fields': ('price', 'compare_price', 'stock')
        }),
        ('Visibilidad', {
            'fields': ('is_active', 'is_featured')
        }),
        ('Auditoría', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)  # Sección colapsable
        }),
    )

    def discount_badge(self, obj):
        """Muestra el % de descuento en color verde si existe."""
        if obj.has_discount:
            return format_html(
                '<span style="color: green; font-weight: bold;">-{}%</span>',
                obj.discount_percentage
            )
        return '-'
    discount_badge.short_description = 'Descuento'
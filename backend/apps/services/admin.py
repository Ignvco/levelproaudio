# apps/services/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import ServiceCategory, Service, Booking, ServiceRequest


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display    = ["icon", "name", "slug", "order"]
    prepopulated_fields = {"slug": ("name",)}
    ordering        = ["order"]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display    = [
        "name", "category", "price_type",
        "price_display_admin", "is_active", "is_featured", "order"
    ]
    list_filter     = ["is_active", "is_featured", "price_type", "category"]
    search_fields   = ["name", "description"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        ("Información principal", {
            "fields": ("name", "slug", "category", "short_description", "description", "thumbnail")
        }),
        ("Precio y duración", {
            "fields": ("price_type", "price", "duration_hours")
        }),
        ("Entregables", {
            "fields": ("deliverables",),
            "description": "Escribe un entregable por línea."
        }),
        ("Visibilidad", {
            "fields": ("is_active", "is_featured", "order")
        }),
        ("Auditoría", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

    def price_display_admin(self, obj):
        return format_html(
            '<span style="color:var(--accent);">{}</span>',
            obj.price_display
        )
    price_display_admin.short_description = "Precio"


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display    = ["user", "service", "scheduled_date", "status_badge", "created_at"]
    list_filter     = ["status", "service"]
    search_fields   = ["user__email", "service__name"]
    readonly_fields = ["created_at", "updated_at"]

    status_colors = {
        "pending":   "#f59e0b",
        "confirmed": "#00e676",
        "completed": "#3b82f6",
        "cancelled": "#ff4444",
    }

    def status_badge(self, obj):
        color = self.status_colors.get(obj.status, "#888")
        return format_html(
            '<span style="color:{};font-weight:bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = "Estado"


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display    = [
        "name", "email", "service", "budget",
        "preferred_date", "status_badge", "created_at"
    ]
    list_filter     = ["status", "service"]
    search_fields   = ["name", "email", "message"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        ("Solicitud", {
            "fields": ("user", "service", "name", "email", "phone", "message")
        }),
        ("Detalles", {
            "fields": ("budget", "preferred_date", "status")
        }),
        ("Notas internas", {
            "fields": ("admin_notes",),
            "classes": ("collapse",)
        }),
        ("Auditoría", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

    status_colors = {
        "pending":   "#f59e0b",
        "contacted": "#3b82f6",
        "accepted":  "#00e676",
        "rejected":  "#ff4444",
    }

    def status_badge(self, obj):
        color = self.status_colors.get(obj.status, "#888")
        return format_html(
            '<span style="color:{};font-weight:bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = "Estado"
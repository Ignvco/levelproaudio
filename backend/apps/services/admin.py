# apps/services/admin.py

from django.contrib import admin
from django.utils import timezone
from .models import ServiceCategory, Service, Booking, ServiceRequest


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display        = ["name", "icon", "order"]  # ← quitado is_active que no existe
    prepopulated_fields = {"slug": ("name",)}
    ordering            = ["order"]
    search_fields       = ["name"]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display  = [
        "name", "category", "price_type",
        "price_display", "is_active", "is_featured"
    ]
    list_filter   = ["is_active", "is_featured", "price_type", "category"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields     = ["price_display", "created_at", "updated_at"]

    fieldsets = (
        ("Información", {
            "fields": ("name", "slug", "category", "short_description",
                       "description", "thumbnail")
        }),
        ("Precio", {
            # ← usa price (no base_price) y quita price_display del form
            "fields": ("price_type", "price", "duration_hours")
        }),
        ("Entregables", {
            "fields": ("deliverables",)
        }),
        ("Visibilidad", {
            "fields": ("is_active", "is_featured", "order")
        }),
        ("Auditoría", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display  = ["user", "service", "scheduled_date", "status", "created_at"]
    list_filter   = ["status", "service"]
    search_fields = ["user__email"]
    ordering      = ["-created_at"]

    actions = ["confirm_bookings", "complete_bookings"]

    @admin.action(description="Confirmar reservas seleccionadas")
    def confirm_bookings(self, request, queryset):
        queryset.update(status="confirmed", confirmed_at=timezone.now())

    @admin.action(description="Marcar como completadas")
    def complete_bookings(self, request, queryset):
        queryset.update(status="completed")


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display  = ["name", "email", "service", "status", "created_at"]
    list_filter   = ["status"]
    search_fields = ["name", "email"]
    ordering      = ["-created_at"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        ("Cliente", {
            "fields": ("user", "name", "email", "phone")
        }),
        ("Solicitud", {
            "fields": ("service", "message", "budget", "preferred_date")
        }),
        ("Gestión", {
            "fields": ("status", "admin_notes")
        }),
        ("Auditoría", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )
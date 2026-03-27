# apps/payments/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import Payment

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = [
        "order", "provider", "status_badge",
        "amount_display", "currency", "paid_at", "created_at"
    ]
    list_filter   = ["status", "provider", "currency"]
    search_fields = ["order__id", "external_id", "preference_id"]
    readonly_fields = [
        "order", "provider", "status", "amount", "currency",
        "external_id", "preference_id", "payment_url",
        "paid_at", "raw_response", "created_at", "updated_at"
    ]

    status_colors = {
        "pending":   "#f59e0b",
        "approved":  "#00e676",
        "rejected":  "#ff4444",
        "cancelled": "#888888",
        "refunded":  "#3b82f6",
        "in_review": "#a78bfa",
    }

    def status_badge(self, obj):
        color = self.status_colors.get(obj.status, "#888")
        return format_html(
            '<span style="color:{};font-weight:bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = "Estado"

    def amount_display(self, obj):
        return format_html(
            '<strong>${:,.0f}</strong>', obj.amount
        )
    amount_display.short_description = "Monto"
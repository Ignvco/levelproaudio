# apps/payments/admin.py
# Administración de pagos del ecommerce

from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):

    list_display = [
        'id',
        'order',
        'method',
        'status',
        'amount',
        'created_at'
    ]

    list_filter = ['method', 'status']

    search_fields = ['transaction_id', 'order__id']

    readonly_fields = [
        'transaction_id',
        'created_at',
        'updated_at'
    ]

    fieldsets = (
        ('Información del Pago', {
            'fields': ('order', 'method', 'status')
        }),
        ('Detalles', {
            'fields': ('amount', 'transaction_id')
        }),
        ('Auditoría', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
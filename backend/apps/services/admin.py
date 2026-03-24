# apps/services/admin.py
# Administración de servicios profesionales de audio

from django.contrib import admin
from .models import ServiceCategory, Service, Booking, ServiceRequest


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):

    list_display = ['name']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):

    list_display = [
        'name',
        'category',
        'price',
        'is_active'
    ]

    list_filter = ['category', 'is_active']
    search_fields = ['name']

    prepopulated_fields = {'slug': ('name',)}

    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('Información del Servicio', {
            'fields': ('name', 'slug', 'category')
        }),
        ('Descripción', {
            'fields': ('description',)
        }),
        ('Precio', {
            'fields': ('price',)
        }),
        ('Estado', {
            'fields': ('is_active',)
        }),
        ('Auditoría', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):

    list_display = [
        'service',
        'user',
        'scheduled_date',
        'status'
    ]

    list_filter = ['status', 'service']
    search_fields = ['user__email']


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):

    list_display = [
        'id',
        'user',
        'service',
        'status',
        'created_at'
    ]

    list_filter = ['status']
    search_fields = ['user__email']
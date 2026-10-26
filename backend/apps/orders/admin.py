# apps/orders/admin.py
# Configuración del panel admin para carritos y pedidos

from django.contrib import admin
from django.db import connection
from .models import Cart, CartItem, Order, OrderItem


class CartItemInline(admin.TabularInline):
    """
    Permite ver los productos dentro del carrito.
    """
    model = CartItem
    extra = 0
    readonly_fields = ['product', 'quantity']


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):

    list_display = [
        'id',
        'user',
        'is_active',
        'created_at'
    ]

    list_filter = [
        'is_active'
    ]

    search_fields = [
        'user__email'
    ]

    readonly_fields = [
        'created_at',
        'updated_at'
    ]

    inlines = [CartItemInline]


class OrderItemInline(admin.TabularInline):
    """
    Muestra los productos comprados dentro de un pedido.
    """
    model = OrderItem
    extra = 0
    readonly_fields = [
        'product',
        'product_name',
        'price',
        'quantity'
    ]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):

    def get_object(self, request, object_id, from_field=None):
        obj = super().get_object(request, object_id, from_field)
        # Django envuelve el POST del formulario en atomic. Leer bajo el
        # bloqueo evita validar un estado viejo mientras se confirma un pago.
        if obj is not None and request.method == "POST" and connection.in_atomic_block:
            return Order.objects.select_for_update().get(pk=obj.pk)
        return obj

    list_display = [
        'id',
        'user',
        'status',
        'total',
        'created_at'
    ]

    list_filter = [
        'status',
        'created_at'
    ]

    search_fields = [
        'user__email'
    ]

    readonly_fields = [
        'total',
        'created_at',
        'updated_at'
    ]

    inlines = [OrderItemInline]

    fieldsets = (
        ('Información del Cliente', {
            'fields': ('user', 'email')
        }),

        ('Estado del Pedido', {
            'fields': ('status',)
        }),

        ('Dirección de Envío', {
            'fields': ('shipping_address',)
        }),

        ('Totales', {
            'fields': ('total',)
        }),

        ('Auditoría', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

# apps/orders/urls.py
# Endpoints del carrito, pedidos y cotizaciones B2B

from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CartViewSet, OrderViewSet
from .views_b2b import (
    b2b_quote_create,
    admin_b2b_quotes,
    admin_b2b_quote_detail,
    admin_b2b_quote_convert,
)


router = DefaultRouter()

router.register(r'cart', CartViewSet, basename='cart')
router.register(r'orders', OrderViewSet, basename='orders')


urlpatterns = [
    path('b2b/quotes/', b2b_quote_create, name='b2b-quote-create'),
    path('orders/b2b/quotes/', b2b_quote_create, name='orders-b2b-quote-create'),
    path('admin/b2b/quotes/', admin_b2b_quotes, name='admin-b2b-quotes'),
    path('admin/orders/b2b/quotes/', admin_b2b_quotes, name='admin-orders-b2b-quotes'),
    path('admin/b2b/quotes/<uuid:quote_id>/', admin_b2b_quote_detail, name='admin-b2b-quote-detail'),
    path('admin/orders/b2b/quotes/<uuid:quote_id>/', admin_b2b_quote_detail, name='admin-orders-b2b-quote-detail'),
    path('admin/b2b/quotes/<uuid:quote_id>/convert/', admin_b2b_quote_convert, name='admin-b2b-quote-convert'),
    path('admin/orders/b2b/quotes/<uuid:quote_id>/convert/', admin_b2b_quote_convert, name='admin-orders-b2b-quote-convert'),
] + router.urls

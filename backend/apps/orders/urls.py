# apps/orders/urls.py
# Endpoints del carrito y pedidos

from rest_framework.routers import DefaultRouter
from .views import CartViewSet, OrderViewSet


router = DefaultRouter()

router.register(r'cart', CartViewSet, basename='cart')
router.register(r'orders', OrderViewSet, basename='orders')


urlpatterns = router.urls
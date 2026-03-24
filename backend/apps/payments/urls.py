# apps/payments/urls.py
# Endpoints de pagos

from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet


router = DefaultRouter()

router.register(r'payments', PaymentViewSet, basename='payments')


urlpatterns = router.urls
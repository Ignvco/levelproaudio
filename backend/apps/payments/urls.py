# apps/payments/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    create_payment,
    capture_paypal,
    webhook_mercadopago_cl,
    webhook_mercadopago_ar,
    payment_status,
    payment_methods,
    AdminPaymentMethodViewSet,
    AdminBankAccountViewSet,
)

router = DefaultRouter()
router.register("admin/payment-methods", AdminPaymentMethodViewSet, basename="admin-payment-method")
router.register("admin/bank-accounts",   AdminBankAccountViewSet,   basename="admin-bank-account")

urlpatterns = [
    path("payments/methods/",                   payment_methods,         name="payment-methods"),
    path("payments/create/",                    create_payment,          name="payment-create"),
    path("payments/paypal/capture/",            capture_paypal,          name="paypal-capture"),
    path("payments/webhook/mercadopago/cl/",    webhook_mercadopago_cl,  name="webhook-mp-cl"),
    path("payments/webhook/mercadopago/ar/",    webhook_mercadopago_ar,  name="webhook-mp-ar"),
    path("payments/status/<uuid:order_id>/",    payment_status,          name="payment-status"),
    path("payments/", include(router.urls)),
]
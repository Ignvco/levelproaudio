# apps/payments/urls.py

from django.urls import path
from .views import (
    create_payment,
    capture_paypal,
    webhook_mercadopago_cl,
    webhook_mercadopago_ar,
    payment_status,
)

urlpatterns = [
    path("payments/create/",                    create_payment,          name="payment-create"),
    path("payments/paypal/capture/",            capture_paypal,          name="paypal-capture"),
    path("payments/webhook/mercadopago/cl/",    webhook_mercadopago_cl,  name="webhook-mp-cl"),
    path("payments/webhook/mercadopago/ar/",    webhook_mercadopago_ar,  name="webhook-mp-ar"),
    path("payments/status/<uuid:order_id>/",    payment_status,          name="payment-status"),
]
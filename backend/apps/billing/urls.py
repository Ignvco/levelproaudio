# apps/billing/urls.py — Documentación Tributaria (registro/seguimiento)

from django.urls import path
from .views import (
    tax_dashboard,
    upsert_document,
    upload_document_pdf,
)
from .shipping_and_tax import (
    estimate_shipping_rates,
    validate_tax_id_view,
)

urlpatterns = [
    path("dashboard/",                 tax_dashboard,           name="billing-dashboard"),
    path("record/",                    upsert_document,         name="billing-record"),
    path("record/<uuid:doc_id>/pdf/",  upload_document_pdf,     name="billing-record-pdf"),
    path("shipping/estimate/",         estimate_shipping_rates, name="billing-shipping-estimate"),
    path("tax/validate/",              validate_tax_id_view,    name="billing-tax-validate"),
]

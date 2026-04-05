# apps/billing/urls.py

from django.urls import path
from .views import (
    generate_document,
    download_pdf,
    send_document_email,
    list_documents,
    void_document,
    billing_config,
)

urlpatterns = [
    path("generate/",              generate_document,    name="billing-generate"),
    path("documents/",             list_documents,       name="billing-list"),
    path("download/<uuid:doc_id>/",download_pdf,         name="billing-download"),
    path("send/<uuid:doc_id>/",    send_document_email,  name="billing-send"),
    path("void/<uuid:doc_id>/",    void_document,        name="billing-void"),
    path("config/",                billing_config,       name="billing-config"),
]
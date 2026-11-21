# apps/procurement/urls.py
from django.urls import path
from apps.procurement.views import (
    admin_suppliers_list,
    admin_supplier_detail,
    admin_supplier_reactivate,
    admin_supplier_contacts,
    admin_supplier_contact_detail,
    admin_supplier_products,
    admin_supplier_product_detail,
    admin_supplier_price_history,
    admin_supplier_price_lists_import,
    admin_supplier_price_lists_export,
    admin_supplier_price_lists_template,
    admin_product_suppliers,
    admin_product_supplier_select_preferred,
    admin_product_supplier_price_history,
)

urlpatterns = [
    path("suppliers/", admin_suppliers_list, name="admin-suppliers-list"),
    path("suppliers/price-lists/import/", admin_supplier_price_lists_import, name="admin-supplier-price-lists-import"),
    path("suppliers/price-lists/export/", admin_supplier_price_lists_export, name="admin-supplier-price-lists-export"),
    path("suppliers/price-lists/template/", admin_supplier_price_lists_template, name="admin-supplier-price-lists-template"),
    path("suppliers/<uuid:supplier_id>/", admin_supplier_detail, name="admin-supplier-detail"),
    path("suppliers/<uuid:supplier_id>/reactivate/", admin_supplier_reactivate, name="admin-supplier-reactivate"),
    path("suppliers/<uuid:supplier_id>/contacts/", admin_supplier_contacts, name="admin-supplier-contacts"),
    path("suppliers/<uuid:supplier_id>/contacts/<uuid:contact_id>/", admin_supplier_contact_detail, name="admin-supplier-contact-detail"),
    path("suppliers/<uuid:supplier_id>/products/", admin_supplier_products, name="admin-supplier-products"),
    path("suppliers/<uuid:supplier_id>/products/<uuid:link_id>/", admin_supplier_product_detail, name="admin-supplier-product-detail"),
    path("suppliers/<uuid:supplier_id>/price-history/", admin_supplier_price_history, name="admin-supplier-price-history"),
    path("products/<uuid:product_id>/suppliers/", admin_product_suppliers, name="admin-product-suppliers"),
    path("products/<uuid:product_id>/suppliers/<uuid:link_id>/select-preferred/", admin_product_supplier_select_preferred, name="admin-product-supplier-select-preferred"),
    path("products/<uuid:product_id>/supplier-price-history/", admin_product_supplier_price_history, name="admin-product-supplier-price-history"),
]

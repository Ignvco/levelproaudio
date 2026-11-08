from django.urls import path
from .views import sitemap_view, head_view, product_schema_view

urlpatterns = [
    path("head/", head_view, name="seo-head"),
    path("sitemap.xml", sitemap_view, name="sitemap"),
    path("schema/product/<slug:slug>/", product_schema_view, name="seo-product-schema"),
]

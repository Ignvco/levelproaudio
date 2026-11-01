from django.urls import path
from .views import sitemap_view, head_view

urlpatterns = [
    path("head/", head_view, name="seo-head"),
    path("sitemap.xml", sitemap_view, name="sitemap"),
]

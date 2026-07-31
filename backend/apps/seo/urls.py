from django.urls import path
from .views import sitemap_view

urlpatterns = [
    path("sitemap.xml", sitemap_view, name="sitemap"),
]

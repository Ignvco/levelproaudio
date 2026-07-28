from django.urls import path
from .views import PublicSiteSettingsView, AdminSiteSettingsView

urlpatterns = [
    path("site-settings/",       PublicSiteSettingsView.as_view(), name="site-settings-public"),
    path("admin/site-settings/", AdminSiteSettingsView.as_view(),  name="site-settings-admin"),
]

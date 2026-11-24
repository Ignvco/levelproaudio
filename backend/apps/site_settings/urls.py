from django.urls import path
from .views import PublicSiteSettingsView, AdminSiteSettingsView
from .cms_views import (
    admin_cms_announcements_view,
    admin_cms_assets_view,
    admin_cms_banners_view,
    admin_cms_events_view,
    admin_cms_hero_slides_view,
    admin_cms_version_detail_view,
    admin_cms_version_preview_view,
    admin_cms_version_publish_view,
    admin_cms_version_review_view,
    admin_cms_version_rollback_view,
    admin_cms_versions_view,
)

urlpatterns = [
    path("site-settings/",       PublicSiteSettingsView.as_view(), name="site-settings-public"),
    path("admin/site-settings/", AdminSiteSettingsView.as_view(),  name="site-settings-admin"),
    # GATE 12: Editorial CMS (BF-30, BF-31)
    path("admin/cms/versions/", admin_cms_versions_view, name="admin-cms-versions"),
    path("admin/cms/versions/<uuid:version_id>/", admin_cms_version_detail_view, name="admin-cms-version-detail"),
    path("admin/cms/versions/<uuid:version_id>/preview/", admin_cms_version_preview_view, name="admin-cms-version-preview"),
    path("admin/cms/versions/<uuid:version_id>/review/", admin_cms_version_review_view, name="admin-cms-version-review"),
    path("admin/cms/versions/<uuid:version_id>/publish/", admin_cms_version_publish_view, name="admin-cms-version-publish"),
    path("admin/cms/versions/<uuid:version_id>/rollback/", admin_cms_version_rollback_view, name="admin-cms-version-rollback"),
    path("admin/cms/assets/", admin_cms_assets_view, name="admin-cms-assets"),
    path("admin/cms/hero-slides/", admin_cms_hero_slides_view, name="admin-cms-hero-slides"),
    path("admin/cms/banners/", admin_cms_banners_view, name="admin-cms-banners"),
    path("admin/cms/announcements/", admin_cms_announcements_view, name="admin-cms-announcements"),
    path("admin/cms/events/", admin_cms_events_view, name="admin-cms-events"),
]

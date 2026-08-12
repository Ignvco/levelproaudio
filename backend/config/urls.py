# config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from core.views import MediaProxyView
from core.admin_permissions import IsAdminOrStaff

urlpatterns = [
    # Panel admin Django
    path("admin/", admin.site.urls),

    # Autenticación
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/admin/", include("apps.analytics.urls")),

    # Catálogo
    path("api/v1/", include("apps.products.urls")),

    # Carrito y pedidos
    path("api/v1/", include("apps.orders.urls")),

    # Pagos
    path("api/v1/", include("apps.payments.urls")),

    # Academia
    path("api/v1/", include("apps.academy.urls")),

    # Servicios profesionales
    path("api/v1/", include("apps.services.urls")),

    # Loyalty y Billing
    path("api/v1/loyalty/", include("apps.loyalty.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),

    # Configuración del sitio (Personalización)
    path("api/v1/", include("apps.site_settings.urls")),

    # SEO — sitemap dinámico (proxy nginx: /sitemap.xml → /api/v1/seo/sitemap.xml)
    path("api/v1/seo/", include("apps.seo.urls")),

    # LevelPro Rewards — módulo de sorteos/campañas
    path("api/v1/rewards/",       include("apps.rewards.urls_public")),
    path("api/v1/admin/rewards/", include("apps.rewards.urls_admin")),

    # API docs
    path("api/schema/", SpectacularAPIView.as_view(permission_classes=[IsAdminOrStaff]), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[IsAdminOrStaff]), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema", permission_classes=[IsAdminOrStaff]), name="redoc"),

    # Proxy de media — sirve imágenes desde GCS usando credenciales del SA
    # En producción: lee desde GCS con Compute Engine credentials
    # En desarrollo: sirve desde MEDIA_ROOT local
    path("media/<path:path>", MediaProxyView.as_view(), name="media-proxy"),
]

# En desarrollo también servimos estáticos
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

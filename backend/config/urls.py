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

    # API docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # Proxy de media — sirve imágenes desde GCS usando credenciales del SA
    # En producción: lee desde GCS con Compute Engine credentials
    # En desarrollo: sirve desde MEDIA_ROOT local
    path("media/<path:path>", MediaProxyView.as_view(), name="media-proxy"),
]

# En desarrollo también servimos estáticos
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

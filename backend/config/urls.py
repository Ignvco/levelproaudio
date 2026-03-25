# config/urls.py
# URLs raíz — todas las rutas de la API bajo /api/v1/

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [

    # Panel admin
    path('admin/', admin.site.urls),

    # Autenticación
    path('api/v1/auth/', include('apps.users.urls')),

    # Catálogo
    path('api/v1/', include('apps.products.urls')),

    # Carrito y pedidos
    path('api/v1/', include('apps.orders.urls')),

    # Pagos
    path('api/v1/', include('apps.payments.urls')),

    # Academia
    path('api/v1/', include('apps.academy.urls')),

    # Servicios profesionales
    path('api/v1/', include('apps.services.urls')),
    
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),

    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),

    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),

]


# Sirve archivos media en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
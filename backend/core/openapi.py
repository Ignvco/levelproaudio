"""
core/openapi.py — Extensiones OpenAPI (drf-spectacular) para LevelPro Audio.
Registra CookieJWTAuthentication para eliminar advertencias en generación de esquema.
"""
from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class CookieJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "apps.users.authentication.CookieJWTAuthentication"
    name = "CookieJWTAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "cookie",
            "name": getattr(settings, "AUTH_COOKIE_ACCESS", "access_token"),
            "description": "JWT almacenado en cookie HTTPOnly (con fallback Authorization: Bearer).",
        }

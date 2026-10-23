# apps/users/authentication.py
# Autenticación JWT que lee el access token desde una cookie HTTPOnly,
# con fallback al header Authorization: Bearer (retrocompatibilidad / API tools).
from django.conf import settings
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication


def enforce_csrf(request):
    """Valida token y origen con las reglas de Django, también para vistas DRF."""
    check = CSRFCheck(lambda request: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied({
            "detail": "No se pudo validar la solicitud. Recarga la página e inténtalo de nuevo.",
            "code": "csrf_failed",
        })


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)

        if not raw_token:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        if header is None:
            # Las cookies se envían automáticamente; los Bearer explícitos no.
            enforce_csrf(request)
        return user, validated_token

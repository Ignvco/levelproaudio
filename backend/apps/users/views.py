# apps/users/views.py
from django.conf import settings
from rest_framework import generics, permissions
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"


class RegisterRateThrottle(AnonRateThrottle):
    scope = "register"


class PasswordResetRateThrottle(AnonRateThrottle):
    scope = "password_reset"
from .models import User
from .serializers import (
    UserRegisterSerializer, UserProfileSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
)
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from apps.emails import send_password_reset


# ── Helpers de cookies HTTPOnly ───────────────────────────────
def _cookie_kwargs():
    return dict(
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
    )


def set_access_cookie(response, access):
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS, str(access),
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        **_cookie_kwargs(),
    )


def set_refresh_cookie(response, refresh):
    response.set_cookie(
        settings.AUTH_COOKIE_REFRESH, str(refresh),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        **_cookie_kwargs(),
    )


def clear_auth_cookies(response):
    response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path="/")
    response.delete_cookie(settings.AUTH_COOKIE_REFRESH, path="/")


# ── Login: setea cookies HTTPOnly y NO devuelve tokens en el body ──
class CookieTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access  = response.data.get("access")
            refresh = response.data.get("refresh")
            set_access_cookie(response, access)
            set_refresh_cookie(response, refresh)
            response.data = {"detail": "ok"}
        return response


# ── Refresh: lee el refresh de la cookie y renueva el access ──
class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        if not request.data.get("refresh"):
            cookie_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
            if cookie_refresh:
                request.data["refresh"] = cookie_refresh
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            set_access_cookie(response, response.data.get("access"))
            new_refresh = response.data.get("refresh")
            if new_refresh:
                set_refresh_cookie(response, new_refresh)
            response.data = {"detail": "ok"}
        return response


# ── Logout: invalida el refresh y borra las cookies ──
class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH) or request.data.get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except Exception:
                pass
        response = Response({"detail": "ok"})
        clear_auth_cookies(response)
        return response


class RegisterView(generics.CreateAPIView):
    """POST /api/v1/auth/register/ — Registro público."""
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterRateThrottle]


class ProfileView(generics.RetrieveUpdateAPIView):
    """GET/PUT/PATCH /api/v1/auth/profile/ — perfil del usuario autenticado."""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


# ── Recuperación de contraseña ────────────────────────────────
_GENERIC_RESET_MSG = {
    "detail": "Si el email está registrado, te enviamos un enlace para restablecer tu contraseña."
}


class PasswordResetRequestView(APIView):
    """POST /api/v1/auth/password/reset/ — genera token y envía email (respuesta genérica)."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        user = User.objects.filter(email__iexact=email).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            try:
                send_password_reset(user.email, reset_url)
            except Exception:
                pass
        # Respuesta idéntica exista o no el email (anti-enumeración).
        return Response(_GENERIC_RESET_MSG)


class PasswordResetConfirmView(APIView):
    """POST /api/v1/auth/password/reset/confirm/ — valida token y setea nueva contraseña."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            uid = force_str(urlsafe_base64_decode(data["uid"]))
            user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None

        if user is None or not default_token_generator.check_token(user, data["token"]):
            return Response(
                {"detail": "El enlace no es válido o expiró. Solicitá uno nuevo."},
                status=400,
            )

        user.set_password(data["password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Tu contraseña fue actualizada. Ya podés iniciar sesión."})

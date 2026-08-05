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
    ChangePasswordSerializer,
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


# ── Login con Google ────────────────────────────────────────
class GoogleAuthRateThrottle(AnonRateThrottle):
    scope = "login"  # mismo límite anti fuerza-bruta que el login normal


class GoogleAuthView(APIView):
    """
    POST /api/v1/auth/google/  { "credential": "<id_token de Google>" }

    El frontend usa Google Identity Services para obtener un ID token
    firmado por Google, y lo manda acá. Nunca confiamos en el email/nombre
    que mande el cliente directamente — se verifica la firma del token
    contra las claves públicas de Google, y los datos salen de ahí.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [GoogleAuthRateThrottle]

    def post(self, request):
        credential = request.data.get("credential")
        if not credential:
            return Response({"error": "Falta el token de Google."}, status=400)

        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        try:
            idinfo = google_id_token.verify_oauth2_token(
                credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID,
            )
        except ValueError:
            return Response({"error": "Token de Google inválido o expirado."}, status=401)

        if not idinfo.get("email_verified"):
            return Response({"error": "Tu cuenta de Google no tiene el email verificado."}, status=400)

        email = idinfo["email"]
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": f"{email.split('@')[0][:20]}{_rand_suffix()}",
                "first_name": idinfo.get("given_name", "") or "",
                "last_name": idinfo.get("family_name", "") or "",
            },
        )
        if created:
            user.set_unusable_password()  # esta cuenta solo entra por Google
            user.save(update_fields=["password"])

        refresh  = RefreshToken.for_user(user)
        response = Response({"detail": "ok"})
        set_access_cookie(response, refresh.access_token)
        set_refresh_cookie(response, refresh)
        return response


def _rand_suffix():
    import random
    return random.randint(1000, 9999)


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


class ChangePasswordView(APIView):
    """POST /api/v1/auth/password/change/ — cambiar contraseña estando logueado."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [PasswordResetRateThrottle]  # mismo límite: anti fuerza-bruta

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if not request.user.check_password(data["current_password"]):
            return Response({"error": "La contraseña actual no es correcta."}, status=400)

        request.user.set_password(data["password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Contraseña actualizada correctamente."})

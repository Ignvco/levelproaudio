# apps/users/views.py
from django.conf import settings
from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User
from .serializers import UserRegisterSerializer, UserProfileSerializer


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


class ProfileView(generics.RetrieveUpdateAPIView):
    """GET/PUT/PATCH /api/v1/auth/profile/ — perfil del usuario autenticado."""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

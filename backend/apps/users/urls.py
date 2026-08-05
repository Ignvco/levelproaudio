# apps/users/urls.py
from django.urls import path
from .views import (
    RegisterView, ProfileView, LogoutView,
    CookieTokenObtainPairView, CookieTokenRefreshView,
    PasswordResetRequestView, PasswordResetConfirmView,
    ChangePasswordView, GoogleAuthView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', CookieTokenObtainPairView.as_view(), name='auth-login'),
    path('google/', GoogleAuthView.as_view(), name='auth-google'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='auth-token-refresh'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('profile/', ProfileView.as_view(), name='auth-profile'),
    path('password/reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    path('password/change/', ChangePasswordView.as_view(), name='auth-password-change'),
]

# apps/users/views.py
from rest_framework import generics, permissions
from .models import User
from .serializers import UserRegisterSerializer, UserProfileSerializer


class RegisterView(generics.CreateAPIView):
    """
    POST /api/v1/auth/register/
    Registro público — cualquiera puede crear una cuenta.
    """
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = [permissions.AllowAny]


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/v1/auth/profile/   → Ver perfil
    PUT  /api/v1/auth/profile/   → Editar perfil completo
    PATCH /api/v1/auth/profile/  → Editar campos específicos
    Solo accesible con JWT válido.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
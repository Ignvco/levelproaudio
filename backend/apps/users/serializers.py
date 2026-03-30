# apps/users/serializers.py
# Serializers relacionados con autenticación y perfil de usuario

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class UserRegisterSerializer(serializers.ModelSerializer):
    """
    Serializer para registrar nuevos usuarios.

    POST /api/v1/auth/register/
    """

    password = serializers.CharField(
        write_only=True,
        validators=[validate_password]
    )

    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'email',
            'username',
            'first_name',
            'last_name',
            'phone',
            'password',
            'password2'
        ]

    def validate(self, attrs):
        """
        Verifica que ambas contraseñas coincidan.
        """
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({
                'password': 'Las contraseñas no coinciden.'
            })

        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            email    = validated_data["email"],
            username = validated_data.get("username", validated_data["email"]),
            password = validated_data["password"],
            first_name = validated_data.get("first_name", ""),
            last_name  = validated_data.get("last_name", ""),
            phone      = validated_data.get("phone", ""),           # ← default vacío
            address_street   = validated_data.get("address_street", ""),
            address_city     = validated_data.get("address_city", ""),
            address_province = validated_data.get("address_province", ""),
            address_zip      = validated_data.get("address_zip", ""),
        )
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer para visualizar y editar el perfil del usuario.

    GET  /api/v1/users/me/
    PATCH /api/v1/users/me/
    """
    class Meta:
        model = User
        fields = [
            "id", "email", "username", "first_name", "last_name",
            "phone", "address_street", "address_city",
            "address_province", "address_zip",
            "is_staff",  
            "is_superuser", ]
        
        read_only_fields = ["id", "email", "is_staff", "is_superuser"]


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer básico del usuario.
    Utilizado en relaciones con otros modelos.
    """

    class Meta:
        model = User

        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name'
        ]


class CustomTokenSerializer(TokenObtainPairSerializer):
    """
    Serializer personalizado para JWT.
    Permite agregar datos del usuario al token.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token['email'] = user.email
        token['username'] = user.username

        return token
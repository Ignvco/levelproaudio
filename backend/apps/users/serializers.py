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
        """
        Crea el usuario utilizando el manager de Django.
        """
        validated_data.pop('password2')

        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data.get('username'),
            first_name=validated_data.get('first_name'),
            last_name=validated_data.get('last_name'),
            phone=validated_data.get('phone'),
            password=validated_data['password']
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
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'phone',
            'address_street',
            'address_city',
            'address_province',
            'address_zip'
        ]

        read_only_fields = ['id', 'email']


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
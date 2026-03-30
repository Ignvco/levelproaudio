# apps/users/models.py
# Usuario personalizado — extiende AbstractUser para agregar campos propios

from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid


class User(AbstractUser):
    """
    Usuario personalizado de LevelPro.
    Usamos email como identificador principal en lugar de username.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone = models.CharField(
    max_length=20,
    blank=True,
    default="",    # ← agrega esto
    verbose_name="Teléfono"
)
    
    # Dirección de envío por defecto
    address_street   = models.CharField(max_length=200, blank=True, default="")
    address_city     = models.CharField(max_length=100, blank=True, default="")
    address_province = models.CharField(max_length=100, blank=True, default="")
    address_zip      = models.CharField(max_length=20,  blank=True, default="")
    USERNAME_FIELD = 'email'             # Login con email
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return self.email
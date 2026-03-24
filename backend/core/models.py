# core/models.py
# Clase base que agrega timestamps a todos los modelos del proyecto

import uuid
from django.db import models


class TimeStampedModel(models.Model):
    """
    Modelo abstracto base.
    Agrega created_at y updated_at a cualquier modelo que herede de él.
    También usa UUID como ID para mayor seguridad en la API.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True  # No crea tabla en la BD, solo sirve para heredar
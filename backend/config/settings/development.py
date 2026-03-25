# development.py — Solo para entorno local
# DEBUG activo, CORS abierto, sin HTTPS obligatorio

from .base import *

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', 'backend']

# En desarrollo permitimos requests desde el frontend React (puerto 5173)
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

# Archivos de media guardados localmente en dev
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
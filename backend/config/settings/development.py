# development.py — Solo para entorno local
# DEBUG activo, CORS abierto, sin HTTPS obligatorio
#
# El wildcard import desde base.py es la convención oficial de Django para
# environment-specific settings (https://docs.djangoproject.com/en/5.0/topics/settings/),
# por eso usamos noqa para silenciar la regla genérica del linter.

from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', 'backend']

# En desarrollo permitimos requests desde el frontend React (puerto 5173)
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

# Archivos de media guardados localmente en dev
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'  # noqa: F405 — definida en base.py
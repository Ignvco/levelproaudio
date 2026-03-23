# production.py — Para Google Cloud Run
# DEBUG desactivado, HTTPS forzado, storage en GCS

from .base import *
import environ

env = environ.Env()

DEBUG = False

ALLOWED_HOSTS = env.list('DJANGO_ALLOWED_HOSTS')

# HTTPS
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Google Cloud Storage para archivos de media (fase deploy)
# Lo completamos en el Paso 8
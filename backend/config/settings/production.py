# backend/config/settings/production.py
#
# El wildcard import desde base.py es la convención oficial de Django para
# environment-specific settings (https://docs.djangoproject.com/en/5.0/topics/settings/),
# por eso usamos noqa para silenciar la regla genérica del linter.

from .base import *  # noqa: F401, F403
import environ
import os
from datetime import timedelta  # noqa: F401 — usado por otros settings que extiendan este

env = environ.Env()

# ── Seguridad ─────────────────────────────────────────────────
DEBUG = False
# Sin fallback wildcard: si falta la variable en Secret Manager, el deploy
# debe fallar explícitamente en vez de quedar abierto a Host header injection.
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("DJANGO_SECRET_KEY")

SECURE_PROXY_SSL_HEADER        = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT            = False
SESSION_COOKIE_SECURE          = True
CSRF_COOKIE_SECURE             = True
SECURE_HSTS_SECONDS            = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# ── Middleware ────────────────────────────────────────────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ── Base de datos — Cloud SQL via Unix socket ─────────────────
CLOUD_SQL_CONNECTION_NAME = os.environ.get("CLOUD_SQL_CONNECTION_NAME", "")

DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     env("DB_NAME"),
        "USER":     env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST":     f"/cloudsql/{CLOUD_SQL_CONNECTION_NAME}",
        "PORT":     "",
        "OPTIONS":  {"connect_timeout": 10},
    }
}

# ── Archivos estáticos — WhiteNoise ───────────────────────────
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # noqa: F405 — definida en base.py

# ── Google Cloud Storage — media ──────────────────────────────
# GS_QUERYSTRING_AUTH = False: la URL que genera GCS no tiene firma.
# Como el bucket tiene acceso uniforme (no público), las imágenes se
# sirven a través del endpoint /media/ del backend de Django.
# Django lee el archivo desde GCS usando sus credenciales de Compute Engine
# y lo sirve al cliente — sin necesidad de bucket público ni URL firmada.
GS_BUCKET_NAME       = env("GCS_BUCKET_NAME")
GS_PROJECT_ID        = env("GCS_PROJECT_ID")
GS_DEFAULT_ACL       = None
GS_QUERYSTRING_AUTH  = False   # Sin URLs firmadas — Django sirve el media
GS_FILE_OVERWRITE    = False
GS_OBJECT_PARAMETERS = {"CacheControl": "public, max-age=86400"}

# CRÍTICO: DEFAULT_FILE_STORAGE y STATICFILES_STORAGE como strings sueltos
# fueron ELIMINADOS por completo en Django 5.1 (venían deprecados desde
# 4.2). Hasta Django 5.0.x, este proyecto usaba ese formato viejo y
# funcionaba — pero al subir a Django 5.2.16 (por las vulnerabilidades de
# seguridad), Django empezó a IGNORAR esos dos settings en silencio, sin
# ningún error, y cayó en su storage local por defecto para los archivos
# subidos por el admin (logo, imágenes de Configuración del sitio, etc.).
# Como el filesystem de Cloud Run es efímero, esos archivos "se guardaban"
# (200 OK, sin excepción) pero desaparecían apenas el contenedor se
# reciclaba — nunca llegaban a GCS de verdad. Migrado al diccionario
# STORAGES, la forma soportada desde Django 4.2 en adelante.
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# MEDIA_URL apunta al backend Django — que sirve /media/ como proxy
# Nginx proxea /api/ al backend, y el backend sirve las imágenes
MEDIA_URL  = "/media/"

# ── CORS ──────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[
    "https://levelproaudio.com",
    "https://www.levelproaudio.com",
])
CORS_ALLOW_CREDENTIALS = True

# Nginx usa el host interno de Cloud Run; Origin conserva el dominio público.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[
    "https://levelproaudio.com",
    "https://www.levelproaudio.com",
])

# ── Logging estructurado ──────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "structured": {
            "format": '{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
        },
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        "django": {
            "handlers":  ["console"],
            "level":     env("DJANGO_LOG_LEVEL", default="WARNING"),
            "propagate": False,
        },
        "django.request": {
            "handlers":  ["console"],
            "level":     "ERROR",
            "propagate": False,
        },
    },
}

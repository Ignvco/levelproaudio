# backend/config/settings/production.py
from .base import *
import environ
import os

env = environ.Env()

# ── Seguridad ─────────────────────────────────────────────────
DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])
SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("DJANGO_SECRET_KEY")

SECURE_PROXY_SSL_HEADER    = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT        = False
SESSION_COOKIE_SECURE      = True
CSRF_COOKIE_SECURE         = True
SECURE_HSTS_SECONDS        = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

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
    }
}

# ── Middleware con WhiteNoise para estáticos del admin ────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # ← sirve /static/ desde el contenedor
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ── Archivos estáticos — WhiteNoise sirve desde el contenedor ─
# Los estáticos del admin Django se sirven directo, sin GCS
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# ── Google Cloud Storage — solo para MEDIA (imágenes subidas) ─
GS_BUCKET_NAME       = env("GCS_BUCKET_NAME")
GS_PROJECT_ID        = env("GCS_PROJECT_ID")
GS_DEFAULT_ACL       = None
GS_QUERYSTRING_AUTH  = True   # URLs firmadas — no requiere bucket público
GS_FILE_OVERWRITE    = False
GS_OBJECT_PARAMETERS = {"CacheControl": "public, max-age=86400"}

DEFAULT_FILE_STORAGE = "storages.backends.gcloud.GoogleCloudStorage"

GS_MEDIA_BUCKET_NAME = GS_BUCKET_NAME
MEDIA_URL = f"https://storage.googleapis.com/{GS_BUCKET_NAME}/media/"

# ── CORS ──────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS   = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True

# ── Logging ───────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers":  {"console": {"class": "logging.StreamHandler"}},
    "root":      {"handlers": ["console"], "level": "WARNING"},
    "loggers":   {
        "django": {
            "handlers":  ["console"],
            "level":     env("DJANGO_LOG_LEVEL", default="WARNING"),
            "propagate": False,
        },
    },
}
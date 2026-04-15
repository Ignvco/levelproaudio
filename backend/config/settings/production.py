# backend/config/settings/production.py
# Settings para Google Cloud Run + Cloud SQL + Cloud Storage
 
from .base import *
import environ
import os
 
env = environ.Env()
# En Cloud Run las variables vienen del entorno directamente, no de .env
# No llamamos read_env() aquí
 
# ── Seguridad ─────────────────────────────────────────────────
DEBUG = False
 
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])
 
# Sobreescribir SECRET_KEY de base.py (que lee DJANGO_SECRET_KEY)
# En Cloud Run el secret se inyecta como SECRET_KEY
SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("DJANGO_SECRET_KEY")
 
SECURE_PROXY_SSL_HEADER    = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT        = False  # Cloud Run fuerza HTTPS externamente
SESSION_COOKIE_SECURE      = True
CSRF_COOKIE_SECURE         = True
SECURE_HSTS_SECONDS        = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
 
# ── Base de datos — Cloud SQL via Unix socket ─────────────────
# Cloud Run conecta a Cloud SQL por socket, no por host:port
CLOUD_SQL_CONNECTION_NAME = os.environ.get("CLOUD_SQL_CONNECTION_NAME", "")
 
DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     env("DB_NAME"),
        "USER":     env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        # Unix socket de Cloud SQL — no requiere DB_HOST ni DB_PORT
        "HOST":     f"/cloudsql/{CLOUD_SQL_CONNECTION_NAME}",
        "PORT":     "",
    }
}
 
# ── Google Cloud Storage (media y static) ────────────────────
GS_BUCKET_NAME       = env("GCS_BUCKET_NAME")
GS_PROJECT_ID        = env("GCS_PROJECT_ID")
# Sin publicRead — el bucket de Workspace no lo permite
# Las URLs firmadas se generan automáticamente con GS_QUERYSTRING_AUTH=True
GS_DEFAULT_ACL       = None
GS_QUERYSTRING_AUTH  = True
GS_FILE_OVERWRITE    = False
GS_OBJECT_PARAMETERS = {
    "CacheControl": "public, max-age=86400",
}
 
DEFAULT_FILE_STORAGE = "storages.backends.gcloud.GoogleCloudStorage"
STATICFILES_STORAGE  = "storages.backends.gcloud.GoogleCloudStorage"
 
GS_MEDIA_BUCKET_NAME = GS_BUCKET_NAME
MEDIA_URL            = f"https://storage.googleapis.com/{GS_BUCKET_NAME}/media/"
STATIC_URL           = f"https://storage.googleapis.com/{GS_BUCKET_NAME}/static/"
 
# ── CORS ──────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS   = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True
 
# ── Logging ───────────────────────────────────────────────────
LOGGING = {
    "version":                  1,
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
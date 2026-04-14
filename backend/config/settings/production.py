# backend/config/settings/production.py
# Settings para Google Cloud Run + Cloud SQL + Cloud Storage

from .base import *
import environ

env = environ.Env()

# ── Seguridad ─────────────────────────────────────────────────
DEBUG = False

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])

SECRET_KEY = env("SECRET_KEY")

# En Cloud Run viene siempre por HTTPS via load balancer
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT      = False  # Cloud Run ya fuerza HTTPS externamente
SESSION_COOKIE_SECURE    = True
CSRF_COOKIE_SECURE       = True
SECURE_HSTS_SECONDS      = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# ── Base de datos — Cloud SQL (PostgreSQL) ────────────────────
# Cloud Run usa Unix socket para conectar a Cloud SQL
DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     env("DB_NAME"),
        "USER":     env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        # En Cloud Run con Cloud SQL Proxy: unix socket
        "HOST":     env("DB_HOST", default=f'/cloudsql/{env("CLOUD_SQL_CONNECTION_NAME", default="")}'),
        "PORT":     env("DB_PORT", default="5432"),
    }
}

# ── Google Cloud Storage (media y static) ────────────────────
GS_BUCKET_NAME          = env("GCS_BUCKET_NAME")
GS_PROJECT_ID           = env("GCS_PROJECT_ID")
GS_DEFAULT_ACL          = "publicRead"
GS_QUERYSTRING_AUTH     = False
GS_FILE_OVERWRITE       = False
GS_OBJECT_PARAMETERS    = {
    "CacheControl": "public, max-age=86400",
}

# Django Storages
DEFAULT_FILE_STORAGE    = "storages.backends.gcloud.GoogleCloudStorage"
STATICFILES_STORAGE     = "storages.backends.gcloud.GoogleCloudStorage"

# URLs públicas
GS_MEDIA_BUCKET_NAME    = GS_BUCKET_NAME
MEDIA_URL               = f"https://storage.googleapis.com/{GS_BUCKET_NAME}/media/"
STATIC_URL              = f"https://storage.googleapis.com/{GS_BUCKET_NAME}/static/"

# ── CORS ──────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=[]
)
CORS_ALLOW_CREDENTIALS = True

# ── Logging ───────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level":    "WARNING",
    },
    "loggers": {
        "django": {
            "handlers":  ["console"],
            "level":     env("DJANGO_LOG_LEVEL", default="WARNING"),
            "propagate": False,
        },
    },
}

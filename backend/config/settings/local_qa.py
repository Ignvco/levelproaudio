"""Local V3.2 QA ONLY. Fails closed without the isolated Docker environment.

Not for Cloud Run. Not for production. No GCS, no payment gateways, no email.
"""
import os
from django.core.exceptions import ImproperlyConfigured
from .base import *  # noqa: F401,F403

if os.environ.get("QA_LOCAL_ONLY") != "1":
    raise ImproperlyConfigured("QA_LOCAL_ONLY=1 requerido; nunca usar este settings en producción")
if os.environ.get("DB_NAME") != "levelpro_v32_qa" or os.environ.get("DB_HOST") != "db":
    raise ImproperlyConfigured("Se requiere exclusivamente PostgreSQL local db/levelpro_v32_qa")

QA_LOCAL_ONLY = True
DEBUG = False
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "backend", "frontend", "testserver"]
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": "db", "PORT": "5432",
        "NAME": "levelpro_v32_qa",
        "USER": "levelpro_qa",
        "PASSWORD": "local-qa-password-only",
        "OPTIONS": {"connect_timeout": 5},
    }
}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
AUTH_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
AUTH_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"]
CORS_ALLOWED_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"]
CORS_ALLOW_CREDENTIALS = True
FRONTEND_URL = "http://127.0.0.1:3000"
BACKEND_URL = "http://127.0.0.1:3000"
SITE_URL = "http://127.0.0.1:3000"
PAYPAL_MODE = "sandbox"
PAYPAL_CLIENT_ID = ""
PAYPAL_CLIENT_SECRET = ""
MP_CL_ACCESS_TOKEN = ""
MP_CL_PUBLIC_KEY = ""
MP_AR_ACCESS_TOKEN = ""
MP_AR_PUBLIC_KEY = ""
MP_CL_WEBHOOK_SECRET = ""
MP_AR_WEBHOOK_SECRET = ""
RESEND_API_KEY = ""
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
# Local filesystem storage from base.py, not production GCS settings.

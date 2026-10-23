# local.py — Settings para correr el proyecto dentro del contenedor Emergent.
# Usa SQLite y media local (sin GCS) para iteración rápida sobre los fixes.
#
# El wildcard import desde base.py es la convención oficial de Django para
# environment-specific settings: https://docs.djangoproject.com/en/5.0/topics/settings/
# Por eso usamos noqa para silenciar la regla genérica del linter.

from .base import *  # noqa: F401, F403

DEBUG = True

AUTH_COOKIE_SECURE = env.bool("AUTH_COOKIE_SECURE", default=False)  # noqa: F405
CSRF_COOKIE_SECURE = AUTH_COOKIE_SECURE
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[  # noqa: F405
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173", "http://127.0.0.1:5173",
])

ALLOWED_HOSTS = ["*"]

# Base de datos local — SQLite
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME":   BASE_DIR / "db.sqlite3",  # noqa: F405 — viene de base.py
    }
}

# CORS abierto en local
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Cache simple en memoria para desarrollo (el DatabaseCache de base.py
# requiere la tabla creada con `createcachetable`, innecesario en local).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Media local
MEDIA_URL  = "/media/"
MEDIA_ROOT = BASE_DIR / "media"  # noqa: F405

# WhiteNoise para servir static del admin Django sin colectar
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

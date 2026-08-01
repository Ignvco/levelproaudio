# base.py — Configuración compartida entre todos los entornos
# django-environ lee las variables del archivo .env

import environ
from pathlib import Path
import os

# BASE_DIR apunta a la carpeta backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000")
# Inicializa environ para leer el .env
env = environ.Env()
try:
    environ.Env.read_env(BASE_DIR.parent / '.env')
except Exception:
    pass  # En producción no hay .env — las vars vienen del entorno  # Lee desde la raíz del repo

SECRET_KEY = env('DJANGO_SECRET_KEY')

# config/settings/base.py

INSTALLED_APPS = [
    'drf_spectacular',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Terceros
    'django_filters',
    'rest_framework',
    'rest_framework_simplejwt',          # ← nuevo
    'rest_framework_simplejwt.token_blacklist',   # ← agrega esta línea
    'corsheaders',                    # ← nuevo
    # Apps propias
    'core',
    'apps.users',
    'apps.products',
    'apps.orders',
    'apps.payments',
    'apps.academy',
    'apps.services',
    'apps.analytics',
    'apps.loyalty',
    'apps.billing',
    'apps.site_settings',
    'apps.rewards',
]

# DRF — ahora con JWT como autenticación por defecto
REST_FRAMEWORK = {

    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",

    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.users.authentication.CookieJWTAuthentication",
    ),

    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],

    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",

    "PAGE_SIZE": 20,

    "PAGE_SIZE_QUERY_PARAM": "page_size",
    "MAX_PAGE_SIZE": 100,
    
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],

    # Anti fuerza-bruta / anti spam en endpoints públicos de auth.
    "DEFAULT_THROTTLE_RATES": {
        "login": "10/min",
        "register": "5/min",
        "password_reset": "5/min",
    },
}

# JWT — configuración de tokens
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),   # Token expira en 1 hora
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),      # Refresh dura 7 días
    'ROTATE_REFRESH_TOKENS': True,                    # Cada refresh genera uno nuevo
    'BLACKLIST_AFTER_ROTATION': True,                 # Invalida el refresh anterior
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ── Cookies HTTPOnly para JWT ─────────────────────────────────
# El access/refresh viajan en cookies HTTPOnly (no accesibles desde JS).
# SameSite=Lax: la cookie sobrevive redirecciones top-level GET (MercadoPago/PayPal
# vuelven al sitio) y bloquea envíos cross-site en POST → protección CSRF.
AUTH_COOKIE_ACCESS   = "access_token"
AUTH_COOKIE_REFRESH  = "refresh_token"
AUTH_COOKIE_SECURE   = env.bool("AUTH_COOKIE_SECURE", default=True)
AUTH_COOKIE_SAMESITE = env("AUTH_COOKIE_SAMESITE", default="Lax")

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',  # Debe ir arriba
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Base de datos — lee las variables DB_* del .env
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT', default='5432'),
    }
}

# Contraseñas
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'es-cl'
TIME_ZONE = 'America/Santiago'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL  = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'



# Agrega esta línea al final de base.py
AUTH_USER_MODEL = 'users.User'

SPECTACULAR_SETTINGS = {
    "TITLE": "LevelPro Audio API",
    "DESCRIPTION": "API para ecommerce, academy y servicios de LevelPro Audio",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}


# Al final de config/settings/base.py



# ── Pagos ────────────────────────────────────────────────────
MP_CL_ACCESS_TOKEN  = env("MP_CL_ACCESS_TOKEN",  default="")
MP_CL_PUBLIC_KEY    = env("MP_CL_PUBLIC_KEY",    default="")
MP_AR_ACCESS_TOKEN  = env("MP_AR_ACCESS_TOKEN",  default="")
MP_AR_PUBLIC_KEY    = env("MP_AR_PUBLIC_KEY",    default="")

# Secret para validar la firma (header x-signature) de los webhooks de MP.
# Se obtiene en: Panel de MercadoPago > Tus integraciones > Webhooks > Firma secreta.
# Uno por cuenta/país si usas credenciales separadas para CL y AR.
MP_CL_WEBHOOK_SECRET = env("MP_CL_WEBHOOK_SECRET", default="")
MP_AR_WEBHOOK_SECRET = env("MP_AR_WEBHOOK_SECRET", default="")

PAYPAL_CLIENT_ID     = env("PAYPAL_CLIENT_ID",     default="")
PAYPAL_CLIENT_SECRET = env("PAYPAL_CLIENT_SECRET", default="")
PAYPAL_MODE          = env("PAYPAL_MODE",          default="sandbox")

# Tasa de conversión CLP → USD para PayPal (CLP por 1 USD). PayPal no acepta CLP.
# Ajustá según el tipo de cambio actual, o seteá USD_CLP_RATE en el entorno.
USD_CLP_RATE = env.float("USD_CLP_RATE", default=950.0)

# ── Global66 ─────────────────────────────────────────────────
GLOBAL66_ALIAS        = env("GLOBAL66_ALIAS",        default="")
GLOBAL66_ACCOUNT_NAME = env("GLOBAL66_ACCOUNT_NAME", default="LevelPro Audio")
GLOBAL66_BANK         = env("GLOBAL66_BANK",         default="Global66")
GLOBAL66_EMAIL        = env("GLOBAL66_EMAIL",        default="")

# ── URLs del sistema ─────────────────────────────────────────
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")

# Dominio canónico primario para SEO (sitemap, canonicals). Sin barra final.
SITE_URL = env("SITE_URL", default="https://levelproaudio.com")

# Vencimiento del enlace de recuperación de contraseña (1 hora)
PASSWORD_RESET_TIMEOUT = 3600
BACKEND_URL  = env("BACKEND_URL",  default="http://localhost:8000")

# ── Email ────────────────────────────────────────────────────
RESEND_API_KEY     = env("RESEND_API_KEY", default="")
RESEND_FROM_EMAIL  = env("RESEND_FROM_EMAIL", default="onboarding@resend.dev")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default=RESEND_FROM_EMAIL)
EMAIL_BACKEND      = "django.core.mail.backends.console.EmailBackend"

# ── Upload limits (video de Academia hasta 500 MB) ───────────
DATA_UPLOAD_MAX_MEMORY_SIZE = 524_288_000       # 500 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10_485_760        # 10 MB en memoria, resto a disco
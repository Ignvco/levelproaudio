# base.py — Configuración compartida entre todos los entornos
# django-environ lee las variables del archivo .env

import environ
from pathlib import Path

# BASE_DIR apunta a la carpeta backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Inicializa environ para leer el .env
env = environ.Env()
environ.Env.read_env(BASE_DIR.parent / '.env')  # Lee desde la raíz del repo

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
    'apps.services'
    
]

# DRF — ahora con JWT como autenticación por defecto
REST_FRAMEWORK = {

    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",

    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
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
        'HOST': env('DB_HOST'),
        'PORT': env('DB_PORT'),
    }
}

# Contraseñas
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'es-ar'
TIME_ZONE = 'America/Argentina/Buenos_Aires'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

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

import os

# ── Pagos ────────────────────────────────────────────────────
MP_CL_ACCESS_TOKEN  = env("MP_CL_ACCESS_TOKEN",  default="")
MP_CL_PUBLIC_KEY    = env("MP_CL_PUBLIC_KEY",    default="")
MP_AR_ACCESS_TOKEN  = env("MP_AR_ACCESS_TOKEN",  default="")
MP_AR_PUBLIC_KEY    = env("MP_AR_PUBLIC_KEY",    default="")

PAYPAL_CLIENT_ID     = env("PAYPAL_CLIENT_ID",     default="")
PAYPAL_CLIENT_SECRET = env("PAYPAL_CLIENT_SECRET", default="")
PAYPAL_MODE          = env("PAYPAL_MODE",          default="sandbox")

# ── Global66 ─────────────────────────────────────────────────
GLOBAL66_ALIAS        = env("GLOBAL66_ALIAS",        default="")
GLOBAL66_ACCOUNT_NAME = env("GLOBAL66_ACCOUNT_NAME", default="LevelPro Audio")
GLOBAL66_BANK         = env("GLOBAL66_BANK",         default="Global66")
GLOBAL66_EMAIL        = env("GLOBAL66_EMAIL",        default="")

# ── URLs del sistema ─────────────────────────────────────────
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")
BACKEND_URL  = env("BACKEND_URL",  default="http://localhost:8000")

# ── Email ────────────────────────────────────────────────────
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="ventas@levelproaudio.com")
EMAIL_BACKEND      = "django.core.mail.backends.console.EmailBackend"
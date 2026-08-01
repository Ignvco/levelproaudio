# config/settings/test.py — Settings para correr el test suite en CI (Cloud Build).
#
# Extiende base.py completo (todas las apps reales), pero:
#   - SQLite en memoria (sin Cloud SQL, sin credenciales de DB)
#   - Sin GCS (media local, no se usa en los tests)
#   - Passwords hasher rápido (los tests no necesitan bcrypt real)
#   - Providers de pago con tokens vacíos (los tests de payments no
#     deberían pegarle a la API real de MercadoPago/PayPal)

from .base import *  # noqa: F401, F403

DEBUG = False
ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",  # rápido, solo para tests
]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"  # noqa: F405

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

MP_CL_ACCESS_TOKEN = ""
MP_CL_PUBLIC_KEY = ""
MP_AR_ACCESS_TOKEN = ""
MP_AR_PUBLIC_KEY = ""
MP_CL_WEBHOOK_SECRET = ""
MP_AR_WEBHOOK_SECRET = ""

MIDDLEWARE = [m for m in MIDDLEWARE if "whitenoise" not in m.lower()]  # noqa: F405

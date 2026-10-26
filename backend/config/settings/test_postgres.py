"""Solo tests: PostgreSQL local/efímero, separado de DB_* de producción."""

import os

from .test import *  # noqa: F401, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("TEST_POSTGRES_DB", "postgres"),
        "USER": os.environ.get("TEST_POSTGRES_USER", "postgres"),
        "PASSWORD": os.environ.get("TEST_POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("TEST_POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.environ.get("TEST_POSTGRES_PORT", "5432"),
        "TEST": {"NAME": "test_levelproaudio_inventory"},
    }
}

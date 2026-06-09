"""
Wrapper ASGI para que el supervisor (uvicorn server:app) pueda servir Django.
"""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

from django.core.asgi import get_asgi_application

app = get_asgi_application()

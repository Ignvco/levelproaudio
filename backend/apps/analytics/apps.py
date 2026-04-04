# apps/analytics/apps.py
from django.apps import AppConfig

class AnalyticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.analytics"

    def ready(self):
        import apps.academy.signals    # noqa
        import apps.analytics.signals  # noqa  ← agrega esta línea
from django.apps import AppConfig


class RewardsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.rewards"
    verbose_name = "LevelPro Rewards"

    def ready(self):
        # Signals — registra escuchadores de Order.status → generar Entries
        from . import signals  # noqa: F401

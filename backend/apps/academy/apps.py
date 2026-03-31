# apps/academy/apps.py

from django.apps import AppConfig

class AcademyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.academy"
    
    def ready(self):
        import apps.academy.signals  # ← registra el signal de enrollment
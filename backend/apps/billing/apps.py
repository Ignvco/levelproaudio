from django.apps import AppConfig


class BillingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.billing"

    # Nota: ya NO se conecta ningún signal. La auto-emisión de documentos
    # al pagar fue eliminada a propósito — LevelPro ya no genera documentos
    # tributarios, solo registra los que se emiten por fuera en el SII.

import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0007_global66_payment_method"),
    ]

    operations = [
        migrations.CreateModel(
            name="PaymentWebhookEvent",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.CharField(
                        choices=[
                            ("mercadopago_cl", "MercadoPago Chile"),
                            ("mercadopago_ar", "MercadoPago Argentina"),
                            ("paypal", "PayPal"),
                            ("global66", "Transferencia Global66"),
                            ("transfer", "Transferencia bancaria"),
                            ("payoneer", "Payoneer (USD)"),
                            ("cash", "Pago manual"),
                        ],
                        max_length=30,
                    ),
                ),
                ("event_id", models.CharField(db_index=True, max_length=255)),
                ("resource_id", models.CharField(db_index=True, max_length=255)),
                ("topic", models.CharField(blank=True, max_length=50)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("received", "Recibido"),
                            ("processing", "Procesando"),
                            ("processed", "Procesado"),
                            ("ignored", "Ignorado"),
                            ("error", "Error"),
                        ],
                        default="received",
                        max_length=20,
                    ),
                ),
                ("payload_hash", models.CharField(blank=True, max_length=64)),
                ("raw_payload", models.JSONField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "Evento de Webhook",
                "verbose_name_plural": "Eventos de Webhooks",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="paymentwebhookevent",
            unique_together={("provider", "event_id")},
        ),
        migrations.AddIndex(
            model_name="paymentwebhookevent",
            index=models.Index(
                fields=["provider", "resource_id"],
                name="payments_we_provide_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="paymentwebhookevent",
            index=models.Index(
                fields=["status", "created_at"],
                name="payments_we_status_idx",
            ),
        ),
    ]

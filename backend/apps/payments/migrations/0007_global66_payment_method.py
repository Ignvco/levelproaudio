from django.db import migrations, models


def seed_global66(apps, schema_editor):
    # Existing installations may already have this method: never overwrite it.
    apps.get_model("payments", "PaymentMethodConfig").objects.get_or_create(
        method="global66",
        defaults={
            "label": "Global66",
            "description": "Transferencia bancaria Global66",
            "currencies": "CLP",
            "order": 5,
            "is_active": False,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("payments", "0006_bankaccount_payment_method")]

    operations = [
        migrations.AlterField(
            model_name="paymentmethodconfig",
            name="method",
            field=models.CharField(
                max_length=30,
                unique=True,
                choices=[
                    ("transfer", "Transferencia bancaria"),
                    ("dlocal", "dLocal Go"),
                    ("payoneer", "Payoneer (USD)"),
                    ("mercadopago_cl", "MercadoPago Chile"),
                    ("mercadopago_ar", "MercadoPago Argentina"),
                    ("paypal", "PayPal"),
                    ("global66", "Transferencia Global66"),
                ],
            ),
        ),
        migrations.RunPython(seed_global66, migrations.RunPython.noop),
    ]

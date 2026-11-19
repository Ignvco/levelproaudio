# Generated data migration for LevelPro Audio OS V3.5 (Post-Audit Remediation)
from django.db import migrations


def activate_methods(apps, schema_editor):
    PaymentMethodConfig = apps.get_model("payments", "PaymentMethodConfig")

    PaymentMethodConfig.objects.update_or_create(
        method="transfer",
        defaults={
            "is_active": True,
            "label": "Transferencia Bancaria",
            "description": "Transferencia electrónica directa sin comisión extra",
            "currencies": "CLP,ARS",
            "order": 2,
        },
    )
    PaymentMethodConfig.objects.filter(method="uala").update(is_active=True)


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0009_alter_payment_provider_and_more"),
    ]

    operations = [
        migrations.RunPython(activate_methods, migrations.RunPython.noop),
    ]

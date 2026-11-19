# Generated data migration for LevelPro Audio OS V3.5 (Post-Audit Remediation)
from django.db import migrations


def seed_bank_accounts(apps, schema_editor):
    PaymentMethodConfig = apps.get_model("payments", "PaymentMethodConfig")
    BankAccount = apps.get_model("payments", "BankAccount")

    # 1. Asegurar método 'transfer' activo para CLP y ARS, y 'uala' activo para ARS
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

    # 2. Cuentas bancarias por divisa
    accounts_data = [
        {
            "payment_method": "transfer",
            "label": "Cuenta Corriente Chile (CLP) - Banco de Chile",
            "currency": "CLP",
            "bank_name": "Banco de Chile",
            "account_type": "Cuenta Corriente",
            "account_number": "00-158-92451-03",
            "holder_name": "LevelPro Audio SpA",
            "holder_id": "77.842.190-K",
            "email": "pagos@levelproaudio.com",
            "instructions": "Favor transferir el monto exacto e indicar tu número de pedido en el asunto.",
            "is_active": True,
            "order": 1,
        },
        {
            "payment_method": "transfer",
            "label": "Transferencia Argentina (ARS) - Banco Santander / CBU",
            "currency": "ARS",
            "bank_name": "Banco Santander Río",
            "account_type": "Cuenta Corriente",
            "account_number": "072-019284/3",
            "holder_name": "LevelPro Audio",
            "holder_id": "30-71829401-8",
            "email": "pagos.ar@levelproaudio.com",
            "instructions": "Alias CBU: LEVELPRO.AUDIO.ARS - Enviar comprobante con número de pedido.",
            "is_active": True,
            "order": 2,
        },
    ]

    for acc in accounts_data:
        BankAccount.objects.update_or_create(
            currency=acc["currency"],
            account_number=acc["account_number"],
            defaults=acc,
        )


def remove_bank_accounts(apps, schema_editor):
    BankAccount = apps.get_model("payments", "BankAccount")
    BankAccount.objects.filter(account_number__in=["00-158-92451-03", "072-019284/3"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0009_alter_payment_provider_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_bank_accounts, remove_bank_accounts),
    ]

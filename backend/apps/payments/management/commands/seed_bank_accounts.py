from django.core.management.base import BaseCommand
from apps.payments.models import BankAccount, PaymentMethodConfig


class Command(BaseCommand):
    help = "Siembra cuentas bancarias para transferencias en CLP y ARS en producción."

    def handle(self, *args, **options):
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

        accounts = [
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

        for acc in accounts:
            obj, created = BankAccount.objects.update_or_create(
                currency=acc["currency"],
                account_number=acc["account_number"],
                defaults=acc,
            )
            action = "Creada" if created else "Actualizada"
            self.stdout.write(self.style.SUCCESS(f"{action} cuenta {obj.label} ({obj.currency})"))

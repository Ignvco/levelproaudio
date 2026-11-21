# apps/payments/management/commands/reconcile_payment_audit.py
"""Comando para reconciliación durable e idempotente de eventos de auditoría de pagos."""

from django.core.management.base import BaseCommand
from core.audit.services import reconcile_missing_payment_audit_events


class Command(BaseCommand):
    help = "Reconcilia de forma idempotente eventos de auditoría faltantes para pagos y webhooks registrados."

    def handle(self, *args, **options):
        self.stdout.write("Iniciando escaneo y reconciliación de auditoría de pagos...")
        res = reconcile_missing_payment_audit_events()
        self.stdout.write(
            self.style.SUCCESS(
                f"Reconciliación exitosa: {res['scanned']} pagos escaneados, "
                f"{res['reconciled']} eventos de auditoría recuperados, "
                f"{res['skipped']} pagos ya auditados (sin duplicación)."
            )
        )

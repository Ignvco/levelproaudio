# apps/loyalty/management/commands/expire_loyalty_points.py
#
# Antes, el campo puntos_expirados y la config "expiracion_dias" existían
# pero nada los usaba — los puntos nunca vencían de verdad. Este comando
# es lo que faltaba: recorre todas las cuentas y expira los puntos ganados
# hace más de `expiracion_dias` que todavía no fueron gastados.
#
# Algoritmo (FIFO — se asume que los canjes consumen primero los puntos
# más viejos, que es la convención estándar de estos programas):
#   1. Suma de puntos "earn" ganados antes del corte de expiración.
#   2. Resta lo que la cuenta ya gastó o ya expiró antes (esos puntos
#      viejos ya no existen, no hay que expirarlos de nuevo).
#   3. Lo que sobra es lo que vence ahora.
#
# Es idempotente: correrlo dos veces el mismo día no expira nada extra
# la segunda vez, porque "ya consumido" incluye lo expirado en la primera.
#
# Pensado para correr una vez por día vía Cloud Scheduler → Cloud Run Job
# (mismo patrón que ya usás para el job de superuser).

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig, LoyaltyTransaction


class Command(BaseCommand):
    help = "Expira puntos de fidelización más viejos que expiracion_dias (config del programa)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Muestra qué se expiraría sin escribir nada en la base de datos.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        config = LoyaltyConfig.get()

        if not config.expiracion_dias or config.expiracion_dias <= 0:
            self.stdout.write("expiracion_dias = 0 → los puntos no expiran. Nada que hacer.")
            return

        cutoff = timezone.now() - timedelta(days=config.expiracion_dias)
        accounts_affected = 0
        total_points_expired = 0

        for account in LoyaltyAccount.objects.all().iterator():
            with transaction.atomic():
                locked = LoyaltyAccount.objects.select_for_update().get(pk=account.pk)

                old_earned = locked.transactions.filter(
                    tipo="earn", created_at__lt=cutoff,
                ).aggregate(total=Sum("puntos"))["total"] or 0

                ya_consumido = locked.puntos_canjeados + locked.puntos_expirados
                a_expirar = max(0, old_earned - ya_consumido)

                if a_expirar <= 0:
                    continue

                accounts_affected += 1
                total_points_expired += a_expirar

                if dry_run:
                    self.stdout.write(
                        f"  [dry-run] {locked.user.email}: expirarían {a_expirar} pts"
                    )
                    continue

                locked.puntos_expirados += a_expirar
                locked.save(update_fields=["puntos_expirados"])
                LoyaltyTransaction.objects.create(
                    account     = locked,
                    tipo        = "expire",
                    puntos      = -a_expirar,
                    descripcion = f"Expiración automática (+{config.expiracion_dias} días)",
                )

        prefix = "[dry-run] " if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"{prefix}Listo. {accounts_affected} cuenta(s) afectadas, "
            f"{total_points_expired} puntos expirados en total."
        ))

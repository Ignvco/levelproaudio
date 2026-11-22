from django.core.management.base import BaseCommand
from apps.inventory.services import expire_stale_reservations


class Command(BaseCommand):
    help = "Libera reservas temporales de stock vencidas (TTL) sin afectar pedidos pagados ni reservas consolidadas."

    def handle(self, *args, **options):
        count = expire_stale_reservations()
        self.stdout.write(self.style.SUCCESS(f"Reservas temporales expiradas liberadas: {count}"))

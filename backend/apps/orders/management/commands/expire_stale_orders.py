from django.core.management.base import BaseCommand
from apps.orders.services import expire_stale_pending_orders


class Command(BaseCommand):
    help = "Cancela órdenes pendientes que superaron la ventana de pago y devuelve su stock al inventario."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=48,
            help="Horas de antigüedad mínima para considerar una orden pendiente como expirada (default: 48).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=100,
            help="Límite máximo de órdenes a cancelar por lote (default: 100).",
        )

    def handle(self, *args, **options):
        hours = options["hours"]
        limit = options["limit"]
        self.stdout.write(f"Iniciando expiración de pedidos pendientes mayores a {hours} horas...")
        count = expire_stale_pending_orders(hours=hours, max_orders=limit)
        self.stdout.write(self.style.SUCCESS(f"Expiración completada: {count} pedidos cancelados y stock reincorporado."))

# apps/orders/management/commands/reset_test_financial_data.py
#
# Borra TODAS las órdenes, pagos, boletas/facturas, registros de ingreso,
# distribuciones y retiros — y resetea a 0 las cuentas de fidelización,
# restaurando el stock que se había descontado. Pensado para limpiar
# datos de prueba antes de arrancar en serio con ventas reales.
#
# SEGURO POR DEFECTO: sin --confirm, solo muestra qué haría (dry-run).
# NO HAY VUELTA ATRÁS una vez confirmado — no hay soft-delete acá.
#
# Uso:
#   python manage.py reset_test_financial_data              # dry-run
#   python manage.py reset_test_financial_data --confirm     # ejecuta de verdad

from django.core.management.base import BaseCommand
from django.db import transaction, models


class Command(BaseCommand):
    help = "Borra TODOS los datos de prueba de órdenes/finanzas/puntos. Irreversible."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm", action="store_true",
            help="Ejecuta de verdad. Sin este flag, solo muestra qué se borraría/restauraría.",
        )

    def handle(self, *args, **options):
        confirm = options["confirm"]

        from apps.orders.models import Order, OrderItem
        from apps.payments.models import Payment
        from apps.analytics.models import (
            IncomeRecord, IncomeDistribution, Withdrawal, WithdrawalDeletionLog,
        )
        from apps.loyalty.models import LoyaltyAccount, LoyaltyTransaction
        from apps.products.models import Product

        order_count       = Order.objects.count()
        payment_count     = Payment.objects.count()
        income_count      = IncomeRecord.objects.count()
        withdrawal_count  = Withdrawal.objects.count()
        loyalty_tx_count  = LoyaltyTransaction.objects.count()
        accounts_with_pts = LoyaltyAccount.objects.exclude(
            puntos_totales=0, puntos_canjeados=0, puntos_expirados=0
        ).count()

        # Stock a restaurar: suma de cantidades de todos los OrderItem,
        # agrupado por producto (solo si el producto sigue existiendo).
        stock_to_restore = list(
            OrderItem.objects.filter(product__isnull=False)
            .values("product_id", "product__name")
            .annotate(total_qty=models.Sum("quantity"))
        )

        self.stdout.write("── Esto va a hacer lo siguiente ──")
        self.stdout.write(f"  Borrar {order_count} orden(es) (y en cascada: sus items, pagos, boletas/facturas)")
        self.stdout.write(f"  Borrar {payment_count} pago(s)")
        self.stdout.write(f"  Borrar {income_count} registro(s) de ingreso (y sus distribuciones)")
        self.stdout.write(f"  Borrar {withdrawal_count} retiro(s)")
        self.stdout.write(f"  Borrar {loyalty_tx_count} transacción(es) de puntos")
        self.stdout.write(f"  Resetear a 0 puntos en {accounts_with_pts} cuenta(s) de fidelización")
        self.stdout.write("  Restaurar stock:")
        for row in stock_to_restore:
            self.stdout.write(f"    +{row['total_qty']} → {row['product__name']}")

        if not confirm:
            self.stdout.write(self.style.WARNING(
                "\n[dry-run] Nada se modificó. Corré con --confirm para ejecutar de verdad."
            ))
            return

        with transaction.atomic():
            # 1. Restaurar stock ANTES de borrar los OrderItem
            for row in stock_to_restore:
                Product.objects.filter(id=row["product_id"]).update(
                    stock=models.F("stock") + row["total_qty"]
                )

            # 2. Financiero
            Withdrawal.objects.all().delete()
            WithdrawalDeletionLog.objects.all().delete()
            IncomeDistribution.objects.all().delete()
            IncomeRecord.objects.all().delete()

            # 3. Puntos
            LoyaltyTransaction.objects.all().delete()
            LoyaltyAccount.objects.update(
                puntos_totales=0, puntos_canjeados=0, puntos_expirados=0, nivel="bronze",
            )

            # 4. Órdenes (cascada: OrderItem, Payment, TributaryDocument)
            Order.objects.all().delete()

        self.stdout.write(self.style.SUCCESS("\n✓ Listo. Datos de prueba borrados, stock y puntos reseteados."))

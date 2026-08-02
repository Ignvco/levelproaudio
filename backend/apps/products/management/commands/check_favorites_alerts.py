# apps/products/management/commands/check_favorites_alerts.py
#
# Antes, un favorito era una lista estática — si el producto bajaba de
# precio o volvía a stock, el cliente nunca se enteraba salvo que
# volviera a mirar manualmente. Este comando (pensado para correr una
# vez al día, mismo patrón que expire_loyalty_points) revisa cada
# favorito y manda un email cuando corresponde.
#
# Reglas para no spamear:
#   - Precio: solo avisa si baja MÁS ALLÁ del mínimo ya avisado antes
#     (lowest_notified_price). Si sube y vuelve a bajar al mismo nivel,
#     no reavisa por lo mismo.
#   - Stock: solo avisa en el flanco false→true (estaba agotado, volvió).

from django.core.management.base import BaseCommand
from apps.products.models import Favorite
from apps.emails import send_price_drop_email, send_back_in_stock_email


class Command(BaseCommand):
    help = "Revisa favoritos y envía alertas de bajada de precio / vuelta a stock."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        price_alerts = 0
        stock_alerts = 0

        for fav in Favorite.objects.select_related("user", "product").all():
            product = fav.product
            changed = False

            # Primera vez que corre el comando para este favorito viejo
            # (creado antes de que existiera este sistema): solo establece
            # la línea de base, no manda alertas retroactivas.
            if fav.price_when_added is None:
                fav.price_when_added = product.price
                fav.was_in_stock = product.stock > 0
                if not dry_run:
                    fav.save(update_fields=["price_when_added", "was_in_stock"])
                continue

            # ── Bajada de precio ──
            piso_previo = fav.lowest_notified_price or fav.price_when_added
            if product.price < piso_previo:
                price_alerts += 1
                if not dry_run:
                    send_price_drop_email(fav.user, product)
                    fav.lowest_notified_price = product.price
                    changed = True
                else:
                    self.stdout.write(f"  [dry-run] {fav.user.email}: {product.name} bajó a ${product.price}")

            # ── Volvió a stock ──
            ahora_en_stock = product.stock > 0
            if ahora_en_stock and not fav.was_in_stock:
                stock_alerts += 1
                if not dry_run:
                    send_back_in_stock_email(fav.user, product)
                else:
                    self.stdout.write(f"  [dry-run] {fav.user.email}: {product.name} volvió a stock")
            if fav.was_in_stock != ahora_en_stock:
                fav.was_in_stock = ahora_en_stock
                changed = True

            if changed and not dry_run:
                fav.save(update_fields=["was_in_stock", "lowest_notified_price"])

        prefix = "[dry-run] " if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"{prefix}Listo. {price_alerts} alerta(s) de precio, {stock_alerts} de stock."
        ))

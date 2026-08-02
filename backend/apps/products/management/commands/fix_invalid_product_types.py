# apps/products/management/commands/fix_invalid_product_types.py
#
# Antes del fix del formulario de admin, crear/editar un producto podía
# guardar product_type = "physical" / "digital" / "service" — valores
# que nunca existieron en las choices reales del modelo (stock/preorder/
# on_demand). Este comando encuentra esos productos y los normaliza a
# "stock" (el comportamiento que siempre tuvieron en la práctica, ya
# que la lógica de negocio los trataba como productos con stock real
# de todas formas antes de este fix).
#
# Uso:
#   python manage.py fix_invalid_product_types              # dry-run
#   python manage.py fix_invalid_product_types --confirm     # ejecuta de verdad

from django.core.management.base import BaseCommand
from apps.products.models import Product


class Command(BaseCommand):
    help = "Normaliza productos con product_type inválido (guardado antes del fix del formulario admin)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm", action="store_true",
            help="Ejecuta de verdad. Sin este flag, solo muestra qué se corregiría.",
        )

    def handle(self, *args, **options):
        confirm = options["confirm"]
        valid_types = [choice[0] for choice in Product.ProductType.choices]

        affected = Product.objects.exclude(product_type__in=valid_types)
        count = affected.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("Nada que corregir — todos los productos ya tienen un tipo válido."))
            return

        self.stdout.write(f"── {count} producto(s) con product_type inválido ──")
        for p in affected:
            self.stdout.write(f'  "{p.name}" (slug: {p.slug}) → tenía "{p.product_type}" → pasaría a "stock"')

        if not confirm:
            self.stdout.write(self.style.WARNING(
                "\n[dry-run] Nada se modificó. Corré con --confirm para ejecutar de verdad."
            ))
            return

        updated = affected.update(product_type=Product.ProductType.STOCK)
        self.stdout.write(self.style.SUCCESS(f"\n✓ {updated} producto(s) normalizados a 'stock'."))

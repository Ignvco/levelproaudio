# apps/analytics/models.py

from django.db import models
from core.models import TimeStampedModel
from decimal import Decimal


class DistributionCategory(TimeStampedModel):
    """
    Categoría de distribución de ingresos.
    type = 'fixed'   → se toma del cost_price del producto
    type = 'percent' → % del precio de venta
    type = 'remainder' → lo que sobra después de todos los demás costos
    """
    TYPE_CHOICES = [
        ("fixed",     "Monto fijo desde costo del producto"),
        ("percent",   "Porcentaje del precio de venta"),
        ("remainder", "Resto / Utilidad neta"),
    ]

    name       = models.CharField(max_length=100)
    cat_type   = models.CharField(max_length=20, choices=TYPE_CHOICES, default="percent")
    percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Solo si cat_type = percent"
    )
    color      = models.CharField(max_length=7, default="#1aff6e")
    icon       = models.CharField(max_length=10, default="💰")
    order      = models.PositiveIntegerField(default=0)
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.name} ({self.cat_type})"


class IncomeRecord(TimeStampedModel):
    """
    Registro de ingreso por cada pago aprobado.
    Guarda el desglose por producto vendido.
    """
    order       = models.ForeignKey(
        "orders.Order", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="income_records"
    )
    payment     = models.ForeignKey(
        "payments.Payment", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="income_records"
    )
    amount      = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    source      = models.CharField(
        max_length=50,
        choices=[("payment", "Pago"), ("manual", "Manual")],
        default="payment"
    )

    class Meta:
        ordering = ["-created_at"]

    def create_distributions(self):
        """
        Distribuye el ingreso entre categorías.
        Primero los costos fijos (capital = cost_price de cada producto),
        luego los porcentajes sobre el precio de venta,
        finalmente el remainder = utilidad neta real.
        """
        categories = DistributionCategory.objects.filter(is_active=True).order_by("order")

        fixed_total   = Decimal("0.00")
        percent_total = Decimal("0.00")

        # Calcula costo capital desde los items de la orden
        capital_cost = Decimal("0.00")
        if self.order:
            for item in self.order.items.select_related("product"):
                product_cost = getattr(item.product, "cost_price", None) or Decimal("0.00")
                capital_cost += product_cost * item.quantity

        for cat in categories:
            if cat.cat_type == "fixed":
                # Costo capital = lo que realmente costaron los productos
                amount = capital_cost
                fixed_total += amount

            elif cat.cat_type == "percent":
                amount = (self.amount * cat.percentage / 100).quantize(Decimal("0.01"))
                percent_total += amount

            elif cat.cat_type == "remainder":
                # Lo que queda = precio venta - costos fijos - porcentajes
                amount = max(
                    self.amount - fixed_total - percent_total,
                    Decimal("0.00")
                )
            else:
                amount = Decimal("0.00")

            IncomeDistribution.objects.create(
                income_record = self,
                category      = cat,
                amount        = amount,
            )


class IncomeDistribution(TimeStampedModel):
    income_record = models.ForeignKey(
        IncomeRecord, on_delete=models.CASCADE,
        related_name="distributions"
    )
    category = models.ForeignKey(
        DistributionCategory, on_delete=models.PROTECT,
        related_name="distributions"
    )
    amount   = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["category__order"]


class Withdrawal(TimeStampedModel):
    category    = models.ForeignKey(
        DistributionCategory, on_delete=models.PROTECT,
        related_name="withdrawals"
    )
    amount      = models.DecimalField(max_digits=12, decimal_places=2)
    destination = models.CharField(max_length=255)
    notes       = models.TextField(blank=True)
    reference   = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["-created_at"]
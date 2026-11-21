# apps/analytics/models.py

from django.db import models
from django.conf import settings
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
    # None marks ambiguous historical records awaiting explicit reconciliation.
    currency    = models.CharField(max_length=3, default="CLP", null=True, blank=True)
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

        Importante: el remainder SIEMPRE se calcula al final, sin importar
        en qué orden se hayan creado las categorías (antes dependía del
        campo `order`, que se autoasigna por secuencia de creación y no
        se puede editar desde el admin — si alguien creaba la categoría
        "Utilidad neta" antes que las demás, el cálculo salía mal).
        """
        # Product cost_price is stored in CLP. A foreign-currency sale cannot
        # be allocated against CLP cost without an explicit documented FX rate.
        # Keep the gross sale record, but do not invent category profits.
        if (self.currency or "").upper() != "CLP":
            return
        categories = DistributionCategory.objects.filter(is_active=True).order_by("order")
        fixed_and_percent = [c for c in categories if c.cat_type in ("fixed", "percent")]
        remainder_cats    = [c for c in categories if c.cat_type == "remainder"]

        fixed_total   = Decimal("0.00")
        percent_total = Decimal("0.00")

        # Calcula costo capital desde los items de la orden
        capital_cost = Decimal("0.00")
        if self.order:
            for item in self.order.items.select_related("product"):
                product_cost = getattr(item.product, "cost_price", None) or Decimal("0.00")
                capital_cost += product_cost * item.quantity

        for cat in fixed_and_percent:
            if cat.cat_type == "fixed":
                # Costo capital = lo que realmente costaron los productos
                amount = capital_cost
                fixed_total += amount
            else:  # percent
                amount = (self.amount * cat.percentage / 100).quantize(Decimal("0.01"))
                percent_total += amount

            IncomeDistribution.objects.create(
                income_record = self,
                category      = cat,
                amount        = amount,
            )

        # Remainder al final, ya con fixed_total y percent_total completos.
        # Si hay más de una categoría "remainder" activa (caso raro), se
        # reparte todo en la primera y las demás quedan en 0 — evita
        # duplicar la utilidad neta contándola dos veces.
        restante = max(self.amount - fixed_total - percent_total, Decimal("0.00"))
        for i, cat in enumerate(remainder_cats):
            amount = restante if i == 0 else Decimal("0.00")
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
    currency    = models.CharField(max_length=3, default="CLP", null=True, blank=True)
    category    = models.ForeignKey(
        DistributionCategory, on_delete=models.PROTECT,
        related_name="withdrawals"
    )
    amount      = models.DecimalField(max_digits=12, decimal_places=2)
    destination = models.CharField(max_length=255)
    notes       = models.TextField(blank=True)
    reference   = models.CharField(max_length=100, blank=True)
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="finance_withdrawals",
        help_text="Quién registró el retiro (para trazabilidad).",
    )

    class Meta:
        ordering = ["-created_at"]


class WithdrawalDeletionLog(TimeStampedModel):
    """
    Registro de auditoría para retiros borrados. Antes, borrar un
    Withdrawal no dejaba ningún rastro — ni quién lo hizo, ni qué
    monto/categoría tenía. Esto guarda una copia mínima ANTES de que
    el borrado la elimine para siempre.
    """
    original_id        = models.UUIDField()
    currency           = models.CharField(max_length=3, null=True, blank=True)
    category_name       = models.CharField(max_length=100)
    amount               = models.DecimalField(max_digits=12, decimal_places=2)
    destination          = models.CharField(max_length=255)
    original_created_at  = models.DateTimeField()
    original_created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Retiro borrado (auditoría)"
        verbose_name_plural = "Retiros borrados (auditoría)"


# ── LEVELPRO OS V4.0 — AUDIT TRAIL CORE (Gate 1.2) ───────────────────────────
import uuid
from django.core.exceptions import PermissionDenied


class AuditEventQuerySet(models.QuerySet):
    """QuerySet inmutable: prohíbe terminantemente updates y deletes a nivel de ORM."""

    def update(self, **kwargs):
        raise PermissionDenied("Los registros de auditoría son inmutables (append-only). Operación UPDATE denegada.")

    def delete(self):
        raise PermissionDenied("Los registros de auditoría son inmutables (append-only). Operación DELETE denegada.")

    def bulk_update(self, objs, fields, **kwargs):
        raise PermissionDenied("Los registros de auditoría son inmutables (append-only). Operación BULK UPDATE denegada.")


class AuditEventManager(models.Manager.from_queryset(AuditEventQuerySet)):
    """Manager operacional con semántica append-only."""
    pass


class AuditEvent(models.Model):
    """
    Entidad central de trazabilidad, eventos de auditoría y análisis forense.
    Diseñada con semántica append-only e inmutabilidad operacional garantizada por software y base de datos.
    """
    ACTOR_TYPE_CHOICES = [
        ("user", "Usuario"),
        ("system", "Sistema"),
        ("integration", "Integración / Webhook"),
    ]

    RESULT_CHOICES = [
        ("success", "Éxito"),
        ("failed", "Fallido"),
        ("denied", "Acceso denegado"),
    ]

    SEVERITY_CHOICES = [
        ("info", "Informativo"),
        ("warning", "Advertencia"),
        ("high", "Alto"),
        ("critical", "Crítico"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    # Actor snapshot (preservado incluso si el usuario es eliminado o desactivado)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
    )
    actor_type = models.CharField(max_length=20, default="user", choices=ACTOR_TYPE_CHOICES)
    actor_email = models.CharField(max_length=254, blank=True, db_index=True)
    actor_username = models.CharField(max_length=150, blank=True)
    actor_roles = models.JSONField(default=list, blank=True)

    # Clasificación y Recurso Afectado
    module = models.CharField(max_length=50, db_index=True)
    action = models.CharField(max_length=80, db_index=True)
    event_category = models.CharField(max_length=50, db_index=True)
    resource_type = models.CharField(max_length=80, db_index=True)
    resource_id = models.CharField(max_length=80, blank=True, db_index=True)
    resource_repr = models.CharField(max_length=255, blank=True)

    # Resultado y Criticidad
    result = models.CharField(max_length=20, default="success", db_index=True, choices=RESULT_CHOICES)
    severity = models.CharField(max_length=20, default="info", db_index=True, choices=SEVERITY_CHOICES)

    # Payloads de Cambio y Estado (Sanitizados)
    previous_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    changed_fields = models.JSONField(default=list, blank=True)

    # Trazabilidad Distribuida y Contexto
    correlation_id = models.CharField(max_length=64, blank=True, db_index=True)
    source = models.CharField(max_length=50, default="api")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    schema_version = models.CharField(max_length=10, default="1.0")

    objects = AuditEventManager()

    class Meta:
        db_table = "audit_events"
        ordering = ["-created_at"]
        verbose_name = "Evento de auditoría"
        verbose_name_plural = "Registro de actividad (Auditoría)"
        indexes = [
            models.Index(fields=["-created_at", "module"], name="idx_audit_created_mod"),
            models.Index(fields=["event_category", "-created_at"], name="idx_audit_cat_created"),
            models.Index(fields=["result", "-created_at"], name="idx_audit_res_created"),
            models.Index(fields=["resource_type", "resource_id"], name="idx_audit_resource"),
            models.Index(fields=["actor_email", "-created_at"], name="idx_audit_act_created"),
            models.Index(fields=["correlation_id"], name="idx_audit_corr_id"),
        ]

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {self.module.upper()} - {self.action} ({self.result})"

    def save(self, *args, **kwargs):
        # Inmutabilidad a nivel de instancia del modelo: prohíbe UPDATE posterior a la creación.
        if not self._state.adding and self.pk:
            raise PermissionDenied("Los registros de auditoría son inmutables: no se permite su modificación.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Inmutabilidad a nivel de instancia del modelo: prohíbe DELETE.
        raise PermissionDenied("Los registros de auditoría son inmutables: no se permite su eliminación.")

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
        Distribuye el ingreso entre categorías (Gate 6 — Sección 13 + Gate 7 Preflight OMS-PF-03):
        - Preserva historial existente: si este IncomeRecord ya posee distribuciones cerradas, no recalcula.
        - Aislamiento monetario: opera en CLP, USD o ARS únicamente cuando el costo real de los ítems
          está en la misma moneda del ingreso. Prohibido mezclar CLP cost_price con ventas USD/ARS.
        - OMS-PF-03: Un ingreso o pago anterior al despacho NO congela en OrderItem costos provenientes
          del pool WAC vigente ni de CostLayer antes del despacho físico.
          Si el SKU posee contabilidad WAC/CostLayer o es serializado REQUIRED y aún no ha sido despachado
          (cost_frozen_at is None), el ingreso permanece pendiente de asignación hasta el despacho.
        - Soporta pagos parciales y previene duplicación de costo capital entre múltiples IncomeRecord de una misma orden.
        """
        from decimal import ROUND_HALF_UP
        from django.db.models import Sum

        if self.distributions.exists():
            return

        inc_curr = (self.currency or "").strip().upper()
        if inc_curr not in ("CLP", "USD", "ARS"):
            return

        categories = list(DistributionCategory.objects.filter(is_active=True).order_by("order"))
        if not categories:
            return
        fixed_and_percent = [c for c in categories if c.cat_type in ("fixed", "percent")]
        remainder_cats    = [c for c in categories if c.cat_type == "remainder"]
        has_fixed_category = any(c.cat_type == "fixed" for c in fixed_and_percent)

        order_capital_cost = Decimal("0.00")
        if self.order_id and self.order:
            from apps.procurement.models import CostLayer, SerialCostUnit, WeightedAverageCostState
            from apps.products.models import Product

            order_items = list(self.order.items.select_related("product", "variant").all())
            if inc_curr != "CLP" and not order_items:
                return

            for item in order_items:
                if item.unit_cost_snapshot is not None or item.total_cost_snapshot is not None:
                    item_curr = (item.cost_currency or "CLP").strip().upper()
                    if item_curr != inc_curr:
                        # Aislamiento monetario: no mezclar costo en otra moneda sin conversión explícita
                        return
                    item_cost = (
                        item.total_cost_snapshot
                        if item.total_cost_snapshot is not None
                        else (item.unit_cost_snapshot * Decimal(item.quantity)).quantize(
                            Decimal("0.01"), rounding=ROUND_HALF_UP
                        )
                    )
                    order_capital_cost += item_cost
                elif item.costing_method_snapshot == "pending_reconciliation":
                    # OMS-PF-02 / OMS-PF-03: Costeo pendiente de reconciliación cambiaria o documental
                    return
                else:
                    # OMS-PF-03: Ítem sin snapshot congelado todavía (pago antes de despacho o venta legacy).
                    # Si el producto tiene contabilidad de capas (WAC / CostLayer / SerialCostUnit) o es REQUIRED,
                    # o la moneda no es CLP, NO debemos congelar prematuramente el WAC en el pago antes del despacho.
                    has_wac_or_layers = False
                    is_serial_required = False
                    if item.product_id and item.product:
                        is_serial_required = (
                            item.product.serialization_mode == Product.SerializationMode.REQUIRED
                        )
                        has_wac_or_layers = (
                            WeightedAverageCostState.objects.filter(
                                product=item.product, variant=item.variant
                            ).exists()
                            or CostLayer.objects.filter(
                                product=item.product, variant=item.variant
                            ).exists()
                            or SerialCostUnit.objects.filter(
                                product=item.product, variant=item.variant
                            ).exists()
                        )

                    if inc_curr != "CLP":
                        # En USD/ARS sin snapshot congelado no existe fallback de catálogo CLP
                        return

                    if has_fixed_category and (has_wac_or_layers or is_serial_required):
                        # OMS-PF-03: Existe contabilidad WAC/Capas/Seriales pero la orden aún no fue despachada.
                        # No congelar WAC vigente durante el pago; esperar a freeze_order_cogs_on_dispatch().
                        return

                    # Caso exclusivo legacy en CLP sin capas WAC/CostLayer: usar cost_price del catálogo
                    # para el cálculo sin marcar cost_frozen_at (que pertenece exclusivamente al despacho).
                    raw_cat_cost = (
                        item.variant.effective_cost_price
                        if (item.variant_id and item.variant)
                        else getattr(item.product, "cost_price", None)
                    )
                    if raw_cat_cost is None:
                        if has_fixed_category:
                            return
                        u_cost = Decimal("0.0000")
                    else:
                        u_cost = Decimal(str(raw_cat_cost)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

                    item_cost = (u_cost * Decimal(item.quantity)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    order_capital_cost += item_cost
        elif inc_curr != "CLP":
            return

        # Control de pagos parciales y no duplicación de capital entre múltiples IncomeRecord de la misma orden
        capital_cost = order_capital_cost
        if self.order_id and self.order and order_capital_cost > Decimal("0.00"):
            already_allocated_capital = (
                IncomeDistribution.objects.filter(
                    income_record__order_id=self.order_id,
                    income_record__currency=inc_curr,
                    category__cat_type="fixed",
                )
                .exclude(income_record_id=self.id)
                .aggregate(t=Sum("amount"))["t"]
                or Decimal("0.00")
            )
            remaining_order_capital = max(Decimal("0.00"), order_capital_cost - already_allocated_capital)
            order_total = Decimal(str(self.order.total or "0.00"))
            rec_amount = Decimal(str(self.amount or "0.00"))
            if order_total > Decimal("0.00") and rec_amount < order_total:
                ratio = rec_amount / order_total
                proportional_cap = (order_capital_cost * ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                capital_cost = min(remaining_order_capital, proportional_cap)
            else:
                capital_cost = remaining_order_capital

        fixed_total   = Decimal("0.00")
        percent_total = Decimal("0.00")

        for cat in fixed_and_percent:
            if cat.cat_type == "fixed":
                amount = capital_cost
                fixed_total += amount
            else:  # percent
                amount = (Decimal(str(self.amount)) * cat.percentage / Decimal("100")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                percent_total += amount

            IncomeDistribution.objects.create(
                income_record = self,
                category      = cat,
                amount        = amount,
            )

        restante = max(Decimal(str(self.amount)) - fixed_total - percent_total, Decimal("0.00"))
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


from .finance_models import (  # noqa: E402, F401
    AccountPayable,
    AccountReceivable,
    BankReconciliation,
    BankStatementImport,
    BankTransaction,
    FinancialBankAccount,
    PayableAllocation,
    ReceivableAllocation,
)


class AdminNotificationReadState(TimeStampedModel):
    """
    GATE 13 (BF-32): Estado auditable de lectura de alertas operativas por administrador.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="admin_notification_reads",
    )
    notification_key = models.CharField(max_length=160, db_index=True)
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-read_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "notification_key"],
                name="uniq_admin_notif_read_user_key",
            )
        ]

    def __str__(self):
        return f"{self.user_id} -> {self.notification_key}"

# apps/analytics/finance_models.py
"""
LEVELPRO OS V4.0 — GATE 9: FINANCIAL MANAGEMENT MODELS
- BF-38: FinancialBankAccount, BankStatementImport, BankTransaction (Tesorería Multi-Cuenta & Cartolas)
- BF-24: BankReconciliation (Conciliación Financiera Bancaria)
- BF-36: AccountReceivable, ReceivableAllocation (Cuentas por Cobrar & Aging)
- BF-37: AccountPayable, PayableAllocation (Cuentas por Pagar a Proveedores)
"""

from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from core.models import TimeStampedModel


class FinancialBankAccount(TimeStampedModel):
    """BF-38: Cuenta bancaria financiera de tesorería (separada de payments.BankAccount de checkout)."""

    class OperationalStatus(models.TextChoices):
        ACTIVE = "active", "Activa"
        FROZEN = "frozen", "Congelada / En revisión"
        CLOSED = "closed", "Cerrada"

    code = models.CharField(max_length=40, unique=True, db_index=True)
    checkout_bank_account = models.OneToOneField(
        "payments.BankAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="treasury_account",
    )
    bank_name = models.CharField(max_length=120)
    account_holder = models.CharField(max_length=160)
    account_number_masked = models.CharField(max_length=40, help_text="Últimos dígitos o máscara segura (no exponer cuenta completa sin permiso).")
    currency = models.CharField(max_length=10, default="CLP", db_index=True)
    country = models.CharField(max_length=10, default="CL")
    operational_status = models.CharField(
        max_length=20, choices=OperationalStatus.choices, default=OperationalStatus.ACTIVE, db_index=True
    )
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    opening_balance_date = models.DateField(default=timezone.now)
    verification_source = models.CharField(max_length=160, blank=True, default="")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_treasury_accounts",
    )

    class Meta:
        verbose_name = "Cuenta Bancaria de Tesorería"
        verbose_name_plural = "Cuentas Bancarias de Tesorería"
        ordering = ["currency", "code"]

    def __str__(self):
        return f"{self.code} — {self.bank_name} [{self.currency}]"


class BankStatementImport(TimeStampedModel):
    """Registro auditable e idempotente de importación de cartolas CSV/XLSX."""

    class Status(models.TextChoices):
        SIMULATED = "simulated", "Simulación previa"
        CONFIRMED = "confirmed", "Confirmada e importada"
        REJECTED  = "rejected",  "Rechazada por inconsistencia"

    financial_account = models.ForeignKey(
        FinancialBankAccount, on_delete=models.CASCADE, related_name="statement_imports"
    )
    file_name = models.CharField(max_length=220)
    file_format = models.CharField(max_length=10, default="csv")
    file_sha256 = models.CharField(max_length=64, db_index=True)
    column_mapping = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SIMULATED)
    rows_count = models.PositiveIntegerField(default=0)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Importación de Cartola Bancaria"
        verbose_name_plural = "Importaciones de Cartolas Bancarias"
        constraints = [
            models.UniqueConstraint(
                fields=["financial_account", "file_sha256"],
                condition=Q(status="confirmed"),
                name="uniq_confirmed_statement_sha_per_acct",
            ),
        ]


class BankTransaction(TimeStampedModel):
    """Movimiento bancario real importado o ajustado bajo autorización."""

    class Direction(models.TextChoices):
        CREDIT = "credit", "Abono (+)"
        DEBIT  = "debit",  "Cargo (-)"

    class ReconciliationStatus(models.TextChoices):
        PENDING              = "pending",              "Pendiente de conciliar"
        PARTIALLY_RECONCILED = "partially_reconciled", "Parcialmente conciliado"
        RECONCILED           = "reconciled",           "Conciliado"
        INTERNAL_TRANSFER    = "internal_transfer",    "Traspaso entre cuentas propias"
        DISCREPANCY          = "discrepancy",          "Con discrepancia"

    financial_account = models.ForeignKey(
        FinancialBankAccount, on_delete=models.CASCADE, related_name="transactions"
    )
    statement_import = models.ForeignKey(
        BankStatementImport, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions"
    )
    external_row_hash = models.CharField(max_length=64, db_index=True)
    effective_date = models.DateField(db_index=True)
    posting_date = models.DateField(null=True, blank=True)
    direction = models.CharField(max_length=10, choices=Direction.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=10, db_index=True)
    reported_balance = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    reference = models.CharField(max_length=140, blank=True, default="", db_index=True)
    description = models.TextField(blank=True, default="")
    reconciliation_status = models.CharField(
        max_length=24, choices=ReconciliationStatus.choices, default=ReconciliationStatus.PENDING, db_index=True
    )
    allocated_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    is_internal_transfer = models.BooleanField(default=False)
    correlated_transaction = models.OneToOneField(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="reverse_internal_tx"
    )

    class Meta:
        verbose_name = "Movimiento Bancario"
        verbose_name_plural = "Movimientos Bancarios"
        ordering = ["-effective_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["financial_account", "external_row_hash"],
                name="uniq_bank_tx_row_hash_per_acct",
            ),
        ]

    @property
    def unallocated_amount(self) -> Decimal:
        return max(Decimal("0.00"), self.amount - self.allocated_amount)


class BankReconciliation(TimeStampedModel):
    """BF-24: Registro de conciliación bancaria por transferencia / pago."""

    class Status(models.TextChoices):
        PENDING_REVIEW          = "pending_review",          "Pendiente de revisión"
        APPROVED                = "approved",                "Conciliada y aprobada"
        REJECTED                = "rejected",                "Rechazada"
        CLARIFICATION_REQUESTED = "clarification_requested", "Aclaración solicitada"
        DISCREPANCY             = "discrepancy",             "Discrepancia detectada"
        PARTIAL                 = "partial",                 "Conciliación parcial"
        OVERPAYMENT             = "overpayment",             "Sobrepago registrado"
        REVERSED                = "reversed",                "Reversada por contracargo/reverso"

    payment = models.ForeignKey("payments.Payment", on_delete=models.CASCADE, related_name="reconciliations")
    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="bank_reconciliations")
    bank_transaction = models.ForeignKey(
        BankTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name="reconciliations"
    )
    financial_account = models.ForeignKey(
        FinancialBankAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name="reconciliations"
    )
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING_REVIEW, db_index=True)
    expected_amount = models.DecimalField(max_digits=14, decimal_places=2)
    reconciled_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=10)
    receipt_reference = models.CharField(max_length=200, blank=True, default="")
    receipt_sha256 = models.CharField(max_length=64, blank=True, default="")
    bank_reference = models.CharField(max_length=140, blank=True, default="")
    declared_payment_date = models.DateField(null=True, blank=True)
    effective_bank_date = models.DateField(null=True, blank=True)
    manual_exception_reason = models.TextField(blank=True, default="")
    idempotency_key = models.CharField(max_length=160, unique=True, null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_reconciliations"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Conciliación Bancaria"
        verbose_name_plural = "Conciliaciones Bancarias"
        ordering = ["-created_at"]


class AccountReceivable(TimeStampedModel):
    """BF-36: Cuenta por Cobrar (AR) vinculada de forma única por Order."""

    class Status(models.TextChoices):
        OPEN                   = "open",                   "Abierta"
        PARTIALLY_PAID         = "partially_paid",         "Cobrada parcialmente"
        PAID                   = "paid",                   "Cobrada 100%"
        OVERDUE                = "overdue",                "Vencida"
        IN_DISPUTE             = "in_dispute",             "En controversia"
        CANCELLED              = "cancelled",              "Anulada"
        PENDING_RECONCILIATION = "pending_reconciliation", "Pendiente de conciliación"

    ar_number = models.CharField(max_length=40, unique=True, db_index=True)
    order = models.OneToOneField("orders.Order", on_delete=models.PROTECT, related_name="account_receivable")
    organization = models.ForeignKey(
        "orders.CustomerOrganization", on_delete=models.SET_NULL, null=True, blank=True, related_name="accounts_receivable"
    )
    customer_profile = models.ForeignKey(
        "orders.CustomerProfile", on_delete=models.SET_NULL, null=True, blank=True, related_name="accounts_receivable"
    )
    credit_account = models.ForeignKey(
        "orders.CommercialCreditAccount", on_delete=models.SET_NULL, null=True, blank=True, related_name="accounts_receivable"
    )
    tributary_document = models.ForeignKey(
        "billing.TributaryDocument", on_delete=models.SET_NULL, null=True, blank=True, related_name="accounts_receivable"
    )
    currency = models.CharField(max_length=10, db_index=True)
    original_amount = models.DecimalField(max_digits=14, decimal_places=2)
    collected_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    credit_note_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    refunded_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pending_balance = models.DecimalField(max_digits=14, decimal_places=2)
    issue_date = models.DateField(default=timezone.now)
    due_date = models.DateField(db_index=True)
    status = models.CharField(max_length=28, choices=Status.choices, default=Status.OPEN, db_index=True)
    recognition_event = models.CharField(max_length=60, default="order_credit_confirmed")
    evidence_reference = models.CharField(max_length=160, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Cuenta por Cobrar (AR)"
        verbose_name_plural = "Cuentas por Cobrar (AR)"
        ordering = ["due_date", "-created_at"]


class ReceivableAllocation(TimeStampedModel):
    """Asignación de cobro, nota de crédito o ajuste sobre AccountReceivable."""

    class AllocationType(models.TextChoices):
        PAYMENT           = "payment",           "Cobro aplicado"
        CREDIT_NOTE       = "credit_note",       "Nota de crédito externa"
        REFUND_ADJUSTMENT = "refund_adjustment", "Ajuste por reembolso"
        OVERPAYMENT       = "overpayment",       "Exceso de pago"

    receivable = models.ForeignKey(AccountReceivable, on_delete=models.CASCADE, related_name="allocations")
    payment = models.ForeignKey("payments.Payment", on_delete=models.SET_NULL, null=True, blank=True)
    bank_transaction = models.ForeignKey(BankTransaction, on_delete=models.SET_NULL, null=True, blank=True)
    allocation_type = models.CharField(max_length=24, choices=AllocationType.choices, default=AllocationType.PAYMENT)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=10)
    effective_date = models.DateField(default=timezone.now)
    idempotency_key = models.CharField(max_length=160, unique=True, null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)


class AccountPayable(TimeStampedModel):
    """BF-37: Cuenta por Pagar (AP) a proveedores por factura validada."""

    class Status(models.TextChoices):
        DRAFT_PENDING_VALIDATION = "draft_pending_validation", "Borrador pendiente de validación"
        APPROVED_FOR_PAYMENT     = "approved_for_payment",     "Aprobada para pago"
        PARTIALLY_PAID           = "partially_paid",           "Pagada parcialmente"
        PAID                     = "paid",                     "Pagada 100%"
        OVERDUE                  = "overdue",                  "Vencida"
        CANCELLED                = "cancelled",                "Anulada"

    ap_number = models.CharField(max_length=40, unique=True, db_index=True)
    supplier = models.ForeignKey("procurement.Supplier", on_delete=models.PROTECT, related_name="accounts_payable")
    purchase_order = models.ForeignKey(
        "procurement.PurchaseOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="accounts_payable"
    )
    goods_receipt = models.ForeignKey(
        "procurement.GoodsReceipt", on_delete=models.SET_NULL, null=True, blank=True, related_name="accounts_payable"
    )
    supplier_invoice_number = models.CharField(max_length=80, db_index=True)
    currency = models.CharField(max_length=10, db_index=True)
    original_amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pending_balance = models.DecimalField(max_digits=14, decimal_places=2)
    issue_date = models.DateField(default=timezone.now)
    due_date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.DRAFT_PENDING_VALIDATION, db_index=True
    )
    document_sha256 = models.CharField(max_length=64, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_ap_records"
    )

    class Meta:
        verbose_name = "Cuenta por Pagar (AP)"
        verbose_name_plural = "Cuentas por Pagar (AP)"
        ordering = ["due_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["supplier", "supplier_invoice_number", "currency"],
                name="uniq_ap_supplier_invoice_currency",
            ),
        ]


class PayableAllocation(TimeStampedModel):
    """Pago realizado y respaldado sobre AccountPayable."""

    payable = models.ForeignKey(AccountPayable, on_delete=models.CASCADE, related_name="allocations")
    bank_transaction = models.ForeignKey(BankTransaction, on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=10)
    bank_reference = models.CharField(max_length=140)
    payment_date = models.DateField(default=timezone.now)
    idempotency_key = models.CharField(max_length=160, unique=True, null=True, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

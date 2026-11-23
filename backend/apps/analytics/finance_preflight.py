# apps/analytics/finance_preflight.py
"""
LEVELPRO OS V4.0 — GATE 9 PREFLIGHT (FIN9-PF-01..04)
Contratos de integridad financiera previos a Tesorería, Conciliación, AR/AP y Cash Flow:
- FIN9-PF-01: Contrato centralizado de conciliación/aprobación de pagos manuales con evidencia,
  cuenta receptora, moneda, importe, fecha efectiva, referencia bancaria, idempotencia y auditoría.
- FIN9-PF-02: Preservación del historial financiero (compensación auditable en lugar de DELETE destructivo).
- FIN9-PF-03: Separación estricta entre payments.BankAccount (configuración checkout) y saldos de tesorería.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.analytics.models import IncomeRecord
from apps.orders.models import Order, OrderStatus
from apps.payments.models import BankAccount, Payment, PaymentProvider, PaymentStatus
from core.audit.constants import (
    CATEGORY_FINANCIAL_OPERATION,
    CATEGORY_PAYMENT_OPERATION,
    SEVERITY_HIGH,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)
from core.audit.services import record_audit_event


class FinancePreflightError(ValueError):
    """Error de validación o contrato financiero en preflight Gate 9."""


MANUAL_PROVIDERS = {
    PaymentProvider.TRANSFER,
    PaymentProvider.GLOBAL66,
    PaymentProvider.PAYONEER,
    PaymentProvider.CASH,
}


@transaction.atomic
def preserve_or_compensate_income_records(
    order: Order,
    *,
    reason_source: str = "cancellation_reversal",
    actor=None,
) -> Optional[IncomeRecord]:
    """
    FIN9-PF-02: Preserva los IncomeRecord e IncomeDistribution históricos confirmados.
    En lugar de eliminarlos con .delete(), genera un IncomeRecord compensatorio negativo
    que netea el saldo sin borrar la evidencia contable ni los costos/márgenes de Gates 6 y 7.
    """
    existing = IncomeRecord.objects.filter(order=order)
    if not existing.exists():
        return None

    # Evitar doble reversión compensatoria
    if existing.filter(source=reason_source).exists():
        return existing.filter(source=reason_source).first()

    net_amount = (
        existing.aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
    )
    net_dec = Decimal(str(net_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if net_dec <= Decimal("0.00"):
        return None

    rev = IncomeRecord.objects.create(
        order=order,
        payment=existing.filter(payment__isnull=False).values_list("payment_id", flat=True).first()
        and Payment.objects.filter(
            pk=existing.filter(payment__isnull=False).values_list("payment_id", flat=True).first()
        ).first(),
        amount=-net_dec,
        currency=order.currency,
        description=f"Reversión compensatoria ({reason_source}) — Orden #{str(order.id)[:8].upper()}",
        source=reason_source,
    )
    record_audit_event(
        module="finances",
        action="INCOME_COMPENSATORY_REVERSAL",
        event_category=CATEGORY_FINANCIAL_OPERATION,
        resource_type="IncomeRecord",
        resource_id=str(rev.id),
        resource_repr=str(rev),
        actor=actor,
        new_values={
            "order_id": str(order.id),
            "reversed_amount": str(-net_dec),
            "currency": order.currency,
            "source": reason_source,
        },
        severity=SEVERITY_HIGH,
        mandatory=True,
    )
    return rev


@transaction.atomic
def reconcile_manual_payment_approval(
    payment: Payment,
    *,
    target_status: str,
    bank_account_id: Optional[str] = None,
    bank_reference: str = "",
    effective_date: Optional[str] = None,
    verified_amount: Optional[Decimal] = None,
    verified_currency: Optional[str] = None,
    manual_exception_reason: str = "",
    idempotency_key: Optional[str] = None,
    require_evidence: bool = True,
    actor=None,
) -> dict:
    """
    FIN9-PF-01: Contrato centralizado para transición y conciliación de pagos manuales.
    - Si require_evidence=True (flujo Gate 9) y target_status=='approved' para proveedores manuales,
      exige referencia bancaria verificable (o excepción manual auditada) y valida moneda/importe.
    - Un comprobante cargado por el cliente en raw_response jamás auto-confirma fondos.
    - Protege contra doble aprobación e IncomeRecord duplicado mediante bloqueo select_for_update() e idempotency_key.
    """
    valid_statuses = {
        PaymentStatus.PENDING,
        PaymentStatus.APPROVED,
        PaymentStatus.REJECTED,
        PaymentStatus.CANCELLED,
        PaymentStatus.REFUNDED,
    }
    if target_status not in valid_statuses:
        raise FinancePreflightError(f"Estado de pago inválido: '{target_status}'.")

    locked_order = Order.objects.select_for_update().get(pk=payment.order_id)
    locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
    locked_payment.order = locked_order
    old_status = locked_payment.status

    # Idempotencia si ya está en el estado objetivo con misma referencia/clave
    if old_status == target_status and target_status == PaymentStatus.APPROVED:
        if idempotency_key and (locked_payment.raw_response or {}).get("reconciliation_idempotency_key") == idempotency_key:
            return {
                "payment": locked_payment,
                "order": locked_order,
                "idempotent_replay": True,
            }

    if target_status == PaymentStatus.APPROVED and locked_payment.provider in MANUAL_PROVIDERS:
        ref_clean = (bank_reference or "").strip()
        exc_clean = (manual_exception_reason or "").strip()
        if require_evidence and not ref_clean and not exc_clean:
            raise FinancePreflightError(
                "FIN9-PF-01: La aprobación de transferencias manuales requiere referencia bancaria verificable "
                "o una excepción manual documentada y auditada."
            )

        if verified_currency and verified_currency.strip().upper() != locked_payment.currency.upper():
            raise FinancePreflightError(
                f"Moneda incompatible: pago en {locked_payment.currency}, evidencia en {verified_currency.upper()}."
            )

        if verified_amount is not None:
            v_amt = Decimal(str(verified_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if v_amt <= Decimal("0.00"):
                raise FinancePreflightError("El importe verificado debe ser mayor que cero.")
            if v_amt < locked_payment.amount:
                raise FinancePreflightError(
                    f"El importe verificado ({v_amt}) es menor al pago declarado ({locked_payment.amount}); "
                    "registre conciliación parcial explícita."
                )

        if bank_account_id:
            acct = BankAccount.objects.filter(pk=bank_account_id).first()
            if acct is None:
                raise FinancePreflightError("Cuenta bancaria receptora no encontrada.")
            if acct.currency.upper() != locked_payment.currency.upper():
                raise FinancePreflightError(
                    f"La cuenta receptora opera en {acct.currency} y el pago está en {locked_payment.currency}."
                )

        if ref_clean:
            locked_payment.provider_reference = ref_clean[:255]

        raw = dict(locked_payment.raw_response or {}) if isinstance(locked_payment.raw_response, dict) else {}
        raw.update({
            "reconciled_by": getattr(actor, "email", "system"),
            "reconciled_at": timezone.now().isoformat(),
            "bank_account_id": str(bank_account_id) if bank_account_id else None,
            "bank_reference": ref_clean,
            "effective_date": effective_date,
            "manual_exception_reason": exc_clean,
            "reconciliation_idempotency_key": idempotency_key,
            "reconciliation_mode": "verified_evidence" if (ref_clean or exc_clean) else "legacy_manual_override",
        })
        locked_payment.raw_response = raw

    locked_payment.status = target_status
    if target_status == PaymentStatus.APPROVED and old_status != PaymentStatus.APPROVED:
        locked_payment.paid_at = timezone.now()

    locked_payment.save()
    locked_order.refresh_from_db()

    if target_status in (PaymentStatus.REJECTED, PaymentStatus.CANCELLED):
        other_approved = locked_order.payments.filter(status=PaymentStatus.APPROVED).exclude(pk=locked_payment.pk).exists()
        if not other_approved and locked_order.status != OrderStatus.CANCELLED:
            locked_order.status = OrderStatus.CANCELLED
            locked_order.save(update_fields=["status"])
            preserve_or_compensate_income_records(
                locked_order, reason_source="cancellation_reversal", actor=actor
            )
    elif target_status == PaymentStatus.REFUNDED:
        if locked_order.status != OrderStatus.CANCELLED:
            locked_order.status = OrderStatus.CANCELLED
            locked_order.save(update_fields=["status"])
        preserve_or_compensate_income_records(
            locked_order, reason_source="refund_reversal", actor=actor
        )

    act = (
        "PAYMENT_APPROVED"
        if target_status == PaymentStatus.APPROVED
        else ("PAYMENT_REJECTED" if target_status == PaymentStatus.REJECTED else f"PAYMENT_STATUS_{target_status.upper()}")
    )
    sev = SEVERITY_WARNING if target_status in (PaymentStatus.REJECTED, PaymentStatus.CANCELLED) else SEVERITY_INFO
    record_audit_event(
        module="finances",
        action=act,
        event_category=CATEGORY_PAYMENT_OPERATION,
        resource_type="Payment",
        resource_id=str(locked_payment.id),
        resource_repr=f"Pago #{locked_payment.id} (${locked_payment.amount} {locked_payment.currency})",
        actor=actor,
        previous_values={"status": old_status},
        new_values={
            "status": locked_payment.status,
            "bank_reference": (bank_reference or "").strip(),
            "has_evidence": bool((bank_reference or "").strip() or (manual_exception_reason or "").strip()),
        },
        changed_fields=["status"],
        severity=sev,
        mandatory=True,
    )

    return {
        "payment": locked_payment,
        "order": locked_order,
        "idempotent_replay": False,
    }


def get_checkout_bank_account_reference(bank_account: BankAccount) -> dict:
    """
    FIN9-PF-03: Expone la configuración de BankAccount aclarando explícitamente
    que NO representa un saldo bancario real ni un libro de tesorería.
    """
    return {
        "id": str(bank_account.id),
        "label": bank_account.label,
        "currency": bank_account.currency,
        "bank_name": bank_account.bank_name,
        "is_active": bank_account.is_active,
        "balance_source": "not_a_treasury_ledger",
    }

# apps/analytics/finance_services.py
"""
LEVELPRO OS V4.0 — GATE 9: FINANCIAL MANAGEMENT SERVICES
- BF-38: Tesorería Multi-Cuenta & Importación Idempotente de Cartolas (CSV/XLSX)
- BF-24: Conciliación Financiera Bancaria (Concurrencia, Idempotencia, Parciales, Sobrepagos)
- BF-36: Cuentas por Cobrar (AR) & Aging 30/60/90
- BF-37: Cuentas por Pagar (AP) & Calendario de Vencimientos
- BF-39: Proyección de Flujo de Caja 30/60/90 por Moneda & Escenarios
- Exportación Contable CSV sanitizada contra inyección de fórmulas
"""

import csv
import hashlib
import io
import secrets
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.analytics.finance_models import (
    AccountPayable,
    AccountReceivable,
    BankReconciliation,
    BankStatementImport,
    BankTransaction,
    FinancialBankAccount,
    PayableAllocation,
    ReceivableAllocation,
)
from apps.analytics.finance_preflight import (
    FinancePreflightError,
    reconcile_manual_payment_approval,
)
from apps.orders.models import Order
from apps.payments.models import BankAccount, Payment, PaymentStatus
from apps.procurement.models import GoodsReceipt, PurchaseOrder, Supplier
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_FINANCIAL_OPERATION,
    CATEGORY_MODIFICATION,
    SEVERITY_HIGH,
    SEVERITY_INFO,
)
from core.audit.services import record_audit_event
from core.contracts.money import Money
from core.rbac.constants import (
    PERM_APPROVE_PAYMENTS,
    PERM_MANAGE_FINANCES,
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
)
from core.rbac.permissions import (
    get_user_roles,
    is_effective_super_admin,
    user_has_capability,
)


class FinanceServiceError(ValueError):
    """Error de negocio o validación en Finanzas Gate 9."""


class FinancePermissionError(PermissionError):
    """Error de autorización RBAC en Finanzas Gate 9."""


def _fmt(val, currency: str) -> str:
    dec = Decimal(str(val if val is not None else "0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return str(Money(dec, (currency or "CLP").upper()).amount)


def _next_fin_code(model_cls, field_name: str, prefix: str) -> str:
    today = timezone.now().strftime("%Y%m%d")
    base = f"{prefix}-{today}-"
    count = model_cls.objects.filter(**{f"{field_name}__startswith": base}).count()
    for i in range(count + 1, count + 50):
        candidate = f"{base}{i:04d}"
        if not model_cls.objects.filter(**{field_name: candidate}).exists():
            return candidate
    return f"{base}{secrets.token_hex(3).upper()}"


def _sanitize_csv_cell(val) -> str:
    s = str(val if val is not None else "")
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


# ═══════════════════════════════════════════════════════════════════════════
# 1. BF-38: TESORERÍA MULTI-CUENTA & IMPORTACIÓN DE CARTOLAS
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def create_treasury_account(
    *,
    code: str,
    bank_name: str,
    account_holder: str,
    account_number: str,
    currency: str = "CLP",
    country: str = "CL",
    opening_balance: Decimal = Decimal("0.00"),
    opening_balance_date: Optional[date] = None,
    verification_source: str = "",
    checkout_bank_account: Optional[BankAccount] = None,
    actor=None,
) -> FinancialBankAccount:
    curr = (currency or "CLP").strip().upper()
    if curr not in ("CLP", "USD", "ARS"):
        raise FinanceServiceError(f"Moneda '{curr}' no soportada en tesorería.")
    if not (code or "").strip() or not (bank_name or "").strip():
        raise FinanceServiceError("El código y entidad financiera son obligatorios.")

    raw_num = str(account_number or "").strip()
    masked = f"****{raw_num[-4:]}" if len(raw_num) >= 4 else "****"
    ob = Decimal(str(opening_balance or "0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    acct = FinancialBankAccount.objects.create(
        code=code.strip().upper(),
        checkout_bank_account=checkout_bank_account,
        bank_name=bank_name.strip(),
        account_holder=(account_holder or "LevelPro Audio").strip(),
        account_number_masked=masked,
        currency=curr,
        country=(country or "CL").strip().upper()[:10],
        opening_balance=ob,
        opening_balance_date=opening_balance_date or timezone.now().date(),
        verification_source=(verification_source or "Apertura verificada").strip(),
        verified_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
    record_audit_event(
        module="finances",
        action="TREASURY_ACCOUNT_CREATED",
        event_category=CATEGORY_CREATION,
        resource_type="FinancialBankAccount",
        resource_id=str(acct.id),
        resource_repr=str(acct),
        actor=actor,
        new_values={"code": acct.code, "currency": curr, "opening_balance": str(ob)},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return acct


def get_treasury_account_balances(acct: FinancialBankAccount, *, mask_sensitive: bool = False) -> dict:
    txs = acct.transactions.all()
    credits_reconciled = (
        txs.filter(
            direction=BankTransaction.Direction.CREDIT,
            reconciliation_status__in=[
                BankTransaction.ReconciliationStatus.RECONCILED,
                BankTransaction.ReconciliationStatus.PARTIALLY_RECONCILED,
                BankTransaction.ReconciliationStatus.INTERNAL_TRANSFER,
            ],
        ).aggregate(t=Sum("amount"))["t"]
        or Decimal("0.00")
    )
    debits_reconciled = (
        txs.filter(
            direction=BankTransaction.Direction.DEBIT,
            reconciliation_status__in=[
                BankTransaction.ReconciliationStatus.RECONCILED,
                BankTransaction.ReconciliationStatus.PARTIALLY_RECONCILED,
                BankTransaction.ReconciliationStatus.INTERNAL_TRANSFER,
            ],
        ).aggregate(t=Sum("amount"))["t"]
        or Decimal("0.00")
    )
    all_credits = txs.filter(direction=BankTransaction.Direction.CREDIT).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
    all_debits = txs.filter(direction=BankTransaction.Direction.DEBIT).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")

    reconciled_balance = (acct.opening_balance + credits_reconciled - debits_reconciled).quantize(Decimal("0.01"))
    book_balance = (acct.opening_balance + all_credits - all_debits).quantize(Decimal("0.01"))
    latest_tx = txs.order_by("-effective_date", "-created_at").first()
    reported_balance = latest_tx.reported_balance if (latest_tx and latest_tx.reported_balance is not None) else book_balance
    pending_count = txs.filter(reconciliation_status=BankTransaction.ReconciliationStatus.PENDING).count()
    unidentified_credits = (
        txs.filter(
            direction=BankTransaction.Direction.CREDIT,
            reconciliation_status=BankTransaction.ReconciliationStatus.PENDING,
        ).aggregate(t=Sum("amount"))["t"]
        or Decimal("0.00")
    )

    return {
        "id": str(acct.id),
        "code": acct.code,
        "bank_name": acct.bank_name,
        "account_holder": acct.account_holder,
        "account_number_masked": "****" if mask_sensitive else acct.account_number_masked,
        "currency": acct.currency,
        "country": acct.country,
        "operational_status": acct.operational_status,
        "opening_balance": _fmt(acct.opening_balance, acct.currency),
        "opening_balance_date": acct.opening_balance_date.isoformat(),
        "verification_source": acct.verification_source,
        "reconciled_balance": _fmt(reconciled_balance, acct.currency),
        "reported_balance": _fmt(reported_balance, acct.currency),
        "unidentified_credits": _fmt(unidentified_credits, acct.currency),
        "pending_movements_count": pending_count,
    }


def _parse_statement_rows_from_csv(raw_bytes: bytes, column_mapping: dict) -> list[dict]:
    text = raw_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    date_col = column_mapping.get("effective_date") or "fecha"
    ref_col = column_mapping.get("reference") or "referencia"
    desc_col = column_mapping.get("description") or "descripcion"
    credit_col = column_mapping.get("credit") or "abono"
    debit_col = column_mapping.get("debit") or "cargo"
    bal_col = column_mapping.get("reported_balance") or "saldo"

    rows = []
    for idx, row in enumerate(reader):
        eff_date_str = str(row.get(date_col) or "").strip()
        if not eff_date_str:
            continue
        credit_raw = str(row.get(credit_col) or "0").replace(",", "").strip() or "0"
        debit_raw = str(row.get(debit_col) or "0").replace(",", "").strip() or "0"
        c_dec = Decimal(credit_raw)
        d_dec = Decimal(debit_raw)
        if c_dec > Decimal("0.00"):
            direction = BankTransaction.Direction.CREDIT
            amt = c_dec
        elif d_dec > Decimal("0.00"):
            direction = BankTransaction.Direction.DEBIT
            amt = d_dec
        else:
            continue
        rep_bal = None
        if row.get(bal_col):
            try:
                rep_bal = Decimal(str(row[bal_col]).replace(",", "").strip()).quantize(Decimal("0.01"))
            except Exception:
                rep_bal = None
        rows.append({
            "row_index": idx + 1,
            "effective_date": eff_date_str,
            "direction": direction,
            "amount": amt.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "reference": str(row.get(ref_col) or "").strip(),
            "description": str(row.get(desc_col) or "").strip(),
            "reported_balance": rep_bal,
        })
    return rows


@transaction.atomic
def import_bank_statement(
    financial_account: FinancialBankAccount,
    *,
    file_name: str,
    file_bytes: bytes,
    column_mapping: Optional[dict] = None,
    confirm: bool = True,
    actor=None,
) -> dict:
    """
    BF-38: Importación idempotente de cartola CSV con simulación previa o confirmación explícita.
    - Detecta archivos duplicados mediante file_sha256 y filas duplicadas mediante external_row_hash.
    """
    acct = FinancialBankAccount.objects.select_for_update().get(pk=financial_account.pk)
    file_sha = hashlib.sha256(file_bytes).hexdigest()

    if confirm and BankStatementImport.objects.filter(
        financial_account=acct, file_sha256=file_sha, status=BankStatementImport.Status.CONFIRMED
    ).exists():
        raise FinanceServiceError("Esta cartola ya fue confirmada e importada anteriormente (checksum SHA-256 duplicado).")

    mapping = column_mapping or {}
    parsed_rows = _parse_statement_rows_from_csv(file_bytes, mapping)
    if not parsed_rows:
        raise FinanceServiceError("La cartola no contiene movimientos válidos según el mapeo configurado.")

    if not confirm:
        return {
            "simulated": True,
            "file_sha256": file_sha,
            "rows_count": len(parsed_rows),
            "preview": [
                {
                    "row_index": r["row_index"],
                    "effective_date": r["effective_date"],
                    "direction": r["direction"],
                    "amount": _fmt(r["amount"], acct.currency),
                    "reference": r["reference"],
                }
                for r in parsed_rows[:20]
            ],
        }

    stmt = BankStatementImport.objects.create(
        financial_account=acct,
        file_name=file_name[:220],
        file_format="csv",
        file_sha256=file_sha,
        column_mapping=mapping,
        status=BankStatementImport.Status.CONFIRMED,
        rows_count=len(parsed_rows),
        imported_by=actor if getattr(actor, "is_authenticated", False) else None,
        confirmed_at=timezone.now(),
    )

    created_count = 0
    skipped_duplicates = 0
    for r in parsed_rows:
        row_sig = f"{acct.id}|{r['effective_date']}|{r['direction']}|{r['amount']}|{r['reference']}|{r['description']}|{r['row_index']}"
        row_hash = hashlib.sha256(row_sig.encode("utf-8")).hexdigest()
        if BankTransaction.objects.filter(financial_account=acct, external_row_hash=row_hash).exists():
            skipped_duplicates += 1
            continue
        BankTransaction.objects.create(
            financial_account=acct,
            statement_import=stmt,
            external_row_hash=row_hash,
            effective_date=date.fromisoformat(r["effective_date"]),
            posting_date=date.fromisoformat(r["effective_date"]),
            direction=r["direction"],
            amount=r["amount"],
            currency=acct.currency,
            reported_balance=r["reported_balance"],
            reference=r["reference"][:140],
            description=r["description"],
        )
        created_count += 1

    record_audit_event(
        module="finances",
        action="BANK_STATEMENT_IMPORTED",
        event_category=CATEGORY_CREATION,
        resource_type="BankStatementImport",
        resource_id=str(stmt.id),
        resource_repr=f"Cartola {file_name} ({acct.code})",
        actor=actor,
        new_values={"created_transactions": created_count, "skipped_duplicates": skipped_duplicates, "sha256": file_sha},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return {
        "simulated": False,
        "statement_id": str(stmt.id),
        "file_sha256": file_sha,
        "created_transactions": created_count,
        "skipped_duplicates": skipped_duplicates,
    }


@transaction.atomic
def record_internal_transfer(
    *,
    source_account: FinancialBankAccount,
    target_account: FinancialBankAccount,
    amount: Decimal,
    effective_date: date,
    reference: str,
    actor=None,
) -> tuple[BankTransaction, BankTransaction]:
    """BF-38: Traspaso correlacionado entre cuentas propias de la misma moneda (sin generar ingreso comercial)."""
    if source_account.id == target_account.id:
        raise FinanceServiceError("La cuenta origen y destino deben ser distintas.")
    if source_account.currency != target_account.currency:
        raise FinanceServiceError("Los traspasos internos directos requieren la misma moneda en ambas cuentas.")
    amt = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amt <= Decimal("0.00"):
        raise FinanceServiceError("El monto del traspaso debe ser mayor que cero.")

    nonce = secrets.token_hex(4)
    out_tx = BankTransaction.objects.create(
        financial_account=source_account,
        external_row_hash=hashlib.sha256(f"INT-OUT-{source_account.id}-{reference}-{nonce}".encode()).hexdigest(),
        effective_date=effective_date,
        direction=BankTransaction.Direction.DEBIT,
        amount=amt,
        currency=source_account.currency,
        reference=reference,
        description=f"Traspaso interno hacia {target_account.code}",
        reconciliation_status=BankTransaction.ReconciliationStatus.INTERNAL_TRANSFER,
        allocated_amount=amt,
        is_internal_transfer=True,
    )
    in_tx = BankTransaction.objects.create(
        financial_account=target_account,
        external_row_hash=hashlib.sha256(f"INT-IN-{target_account.id}-{reference}-{nonce}".encode()).hexdigest(),
        effective_date=effective_date,
        direction=BankTransaction.Direction.CREDIT,
        amount=amt,
        currency=target_account.currency,
        reference=reference,
        description=f"Traspaso interno desde {source_account.code}",
        reconciliation_status=BankTransaction.ReconciliationStatus.INTERNAL_TRANSFER,
        allocated_amount=amt,
        is_internal_transfer=True,
        correlated_transaction=out_tx,
    )
    out_tx.correlated_transaction = in_tx
    out_tx.save(update_fields=["correlated_transaction", "updated_at"])
    return out_tx, in_tx


# ═══════════════════════════════════════════════════════════════════════════
# 2. BF-24: CONCILIACIÓN FINANCIERA BANCARIA
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def reconcile_payment_with_bank(
    *,
    payment: Payment,
    decision: str,
    bank_transaction: Optional[BankTransaction] = None,
    financial_account: Optional[FinancialBankAccount] = None,
    reconciled_amount: Optional[Decimal] = None,
    bank_reference: str = "",
    effective_bank_date: Optional[date] = None,
    manual_exception_reason: str = "",
    idempotency_key: Optional[str] = None,
    actor=None,
) -> BankReconciliation:
    """
    BF-24: Conciliación atómica e idempotente de transferencias y pagos.
    - Un comprobante por sí solo NO aprueba fondos: exige BankTransaction verificable
      con saldo suficiente o excepción manual autorizada.
    - Impide que un mismo movimiento bancario financie pagos por encima de su importe real.
    """
    if actor is not None and not is_effective_super_admin(actor):
        roles = set(get_user_roles(actor))
        if not (
            user_has_capability(actor, PERM_APPROVE_PAYMENTS)
            or user_has_capability(actor, PERM_MANAGE_FINANCES)
            or bool(roles & {ROLE_FINANCE, ROLE_MANAGEMENT})
        ):
            raise FinancePermissionError("No posee permiso ('approve_payments'/'manage_finances') para conciliar pagos.")

    if idempotency_key:
        existing_rec = BankReconciliation.objects.filter(idempotency_key=idempotency_key).first()
        if existing_rec is not None:
            return existing_rec

    locked_payment = Payment.objects.select_for_update().select_related("order").get(pk=payment.pk)
    locked_order = Order.objects.select_for_update().get(pk=locked_payment.order_id)

    valid_decisions = {
        BankReconciliation.Status.APPROVED,
        BankReconciliation.Status.PARTIAL,
        BankReconciliation.Status.OVERPAYMENT,
        BankReconciliation.Status.REJECTED,
        BankReconciliation.Status.CLARIFICATION_REQUESTED,
        BankReconciliation.Status.DISCREPANCY,
    }
    if decision not in valid_decisions:
        raise FinanceServiceError(f"Decisión de conciliación inválida: '{decision}'.")

    locked_tx = None
    eff_acct = financial_account
    if bank_transaction is not None:
        locked_tx = BankTransaction.objects.select_for_update().get(pk=bank_transaction.pk)
        if locked_tx.currency != locked_payment.currency:
            raise FinanceServiceError(
                f"Moneda incompatible: movimiento bancario en {locked_tx.currency}, pago en {locked_payment.currency}."
            )
        if locked_tx.direction != BankTransaction.Direction.CREDIT:
            raise FinanceServiceError("Solo abonos bancarios (credit) pueden conciliar cobros de clientes.")
        eff_acct = locked_tx.financial_account

    amt = Decimal(str(reconciled_amount if reconciled_amount is not None else locked_payment.amount)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    ref_str = (bank_reference or (locked_tx.reference if locked_tx else "")).strip()
    exc_str = (manual_exception_reason or "").strip()

    if decision in (BankReconciliation.Status.APPROVED, BankReconciliation.Status.PARTIAL, BankReconciliation.Status.OVERPAYMENT):
        if locked_tx is None and not exc_str:
            raise FinanceServiceError(
                "Regla BF-24: Un comprobante por sí solo no confirma fondos. Vincule un movimiento bancario verificado "
                "o registre una excepción manual autorizada."
            )
        if locked_tx is not None:
            if amt > locked_tx.unallocated_amount:
                raise FinanceServiceError(
                    f"El movimiento bancario solo dispone de {locked_tx.unallocated_amount} {locked_tx.currency} sin asignar "
                    f"(solicitado: {amt}). Prohibido doble uso de transferencia."
                )
            locked_tx.allocated_amount = (locked_tx.allocated_amount + amt).quantize(Decimal("0.01"))
            locked_tx.reconciliation_status = (
                BankTransaction.ReconciliationStatus.RECONCILED
                if locked_tx.unallocated_amount == Decimal("0.00")
                else BankTransaction.ReconciliationStatus.PARTIALLY_RECONCILED
            )
            locked_tx.save(update_fields=["allocated_amount", "reconciliation_status", "updated_at"])

        if decision == BankReconciliation.Status.APPROVED and amt < locked_payment.amount:
            raise FinanceServiceError("Para aprobar por monto menor al esperado utilice conciliación parcial ('partial').")

    rec = BankReconciliation.objects.create(
        payment=locked_payment,
        order=locked_order,
        bank_transaction=locked_tx,
        financial_account=eff_acct,
        status=decision,
        expected_amount=locked_payment.amount,
        reconciled_amount=amt if decision in (BankReconciliation.Status.APPROVED, BankReconciliation.Status.PARTIAL, BankReconciliation.Status.OVERPAYMENT) else Decimal("0.00"),
        currency=locked_payment.currency,
        bank_reference=ref_str[:140],
        effective_bank_date=effective_bank_date or (locked_tx.effective_date if locked_tx else None),
        manual_exception_reason=exc_str,
        idempotency_key=idempotency_key,
        reviewed_by=actor if getattr(actor, "is_authenticated", False) else None,
        reviewed_at=timezone.now(),
    )

    if decision in (BankReconciliation.Status.APPROVED, BankReconciliation.Status.OVERPAYMENT):
        try:
            reconcile_manual_payment_approval(
                locked_payment,
                target_status=PaymentStatus.APPROVED,
                bank_reference=ref_str or f"REC-{str(rec.id)[:8].upper()}",
                effective_date=(rec.effective_bank_date.isoformat() if rec.effective_bank_date else None),
                verified_amount=amt,
                verified_currency=locked_payment.currency,
                manual_exception_reason=exc_str,
                idempotency_key=idempotency_key,
                require_evidence=True,
                actor=actor,
            )
        except FinancePreflightError as exc:
            raise FinanceServiceError(str(exc)) from exc

        # Si existe AR para la orden, aplicar cobro automáticamente
        ar = AccountReceivable.objects.filter(order=locked_order).first()
        if ar is not None:
            apply_receivable_allocation(
                ar,
                amount=min(amt, ar.pending_balance),
                allocation_type=ReceivableAllocation.AllocationType.PAYMENT,
                payment=locked_payment,
                bank_transaction=locked_tx,
                idempotency_key=f"ar_rec:{rec.id}",
                actor=actor,
            )
    elif decision == BankReconciliation.Status.PARTIAL:
        ar = AccountReceivable.objects.filter(order=locked_order).first()
        if ar is not None:
            apply_receivable_allocation(
                ar,
                amount=min(amt, ar.pending_balance),
                allocation_type=ReceivableAllocation.AllocationType.PAYMENT,
                payment=locked_payment,
                bank_transaction=locked_tx,
                idempotency_key=f"ar_part:{rec.id}",
                actor=actor,
            )
    elif decision == BankReconciliation.Status.REJECTED:
        reconcile_manual_payment_approval(
            locked_payment,
            target_status=PaymentStatus.REJECTED,
            require_evidence=False,
            actor=actor,
        )

    return rec


# ═══════════════════════════════════════════════════════════════════════════
# 3. BF-36: CUENTAS POR COBRAR (AR) & AGING
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def recognize_account_receivable_for_order(
    order: Order,
    *,
    due_days: int = 15,
    organization=None,
    customer_profile=None,
    credit_account=None,
    tributary_document=None,
    recognition_event: str = "order_credit_confirmed",
    evidence_reference: str = "",
    actor=None,
) -> AccountReceivable:
    """BF-36: Reconocimiento único de Cuenta por Cobrar por Order (OneToOne)."""
    existing = AccountReceivable.objects.filter(order=order).first()
    if existing is not None:
        return existing

    issue_dt = order.created_at.date() if order.created_at else timezone.now().date()
    due_dt = issue_dt + timedelta(days=max(0, int(due_days)))
    orig_amt = Decimal(str(order.total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    ar = AccountReceivable.objects.create(
        ar_number=_next_fin_code(AccountReceivable, "ar_number", "AR"),
        order=order,
        organization=organization,
        customer_profile=customer_profile,
        credit_account=credit_account or order.credit_account,
        tributary_document=tributary_document,
        currency=order.currency,
        original_amount=orig_amt,
        pending_balance=orig_amt,
        issue_date=issue_dt,
        due_date=due_dt,
        status=AccountReceivable.Status.OPEN,
        recognition_event=recognition_event,
        evidence_reference=evidence_reference,
    )
    record_audit_event(
        module="finances",
        action="AR_RECOGNIZED",
        event_category=CATEGORY_CREATION,
        resource_type="AccountReceivable",
        resource_id=str(ar.id),
        resource_repr=str(ar.ar_number),
        actor=actor,
        new_values={"order_id": str(order.id), "amount": str(orig_amt), "currency": order.currency},
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return ar


@transaction.atomic
def apply_receivable_allocation(
    receivable: AccountReceivable,
    *,
    amount: Decimal,
    allocation_type: str = ReceivableAllocation.AllocationType.PAYMENT,
    payment: Optional[Payment] = None,
    bank_transaction: Optional[BankTransaction] = None,
    effective_date: Optional[date] = None,
    idempotency_key: Optional[str] = None,
    actor=None,
) -> AccountReceivable:
    if idempotency_key and ReceivableAllocation.objects.filter(idempotency_key=idempotency_key).exists():
        return AccountReceivable.objects.get(pk=receivable.pk)

    ar = AccountReceivable.objects.select_for_update().get(pk=receivable.pk)
    amt = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amt <= Decimal("0.00"):
        raise FinanceServiceError("El monto de asignación AR debe ser mayor que cero.")

    ReceivableAllocation.objects.create(
        receivable=ar,
        payment=payment,
        bank_transaction=bank_transaction,
        allocation_type=allocation_type,
        amount=amt,
        currency=ar.currency,
        effective_date=effective_date or timezone.now().date(),
        idempotency_key=idempotency_key,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )

    if allocation_type == ReceivableAllocation.AllocationType.CREDIT_NOTE:
        ar.credit_note_amount = (ar.credit_note_amount + amt).quantize(Decimal("0.01"))
    elif allocation_type == ReceivableAllocation.AllocationType.REFUND_ADJUSTMENT:
        ar.refunded_amount = (ar.refunded_amount + amt).quantize(Decimal("0.01"))
    else:
        ar.collected_amount = (ar.collected_amount + amt).quantize(Decimal("0.01"))

    settled = ar.collected_amount + ar.credit_note_amount
    ar.pending_balance = max(Decimal("0.00"), (ar.original_amount - settled).quantize(Decimal("0.01")))
    if ar.pending_balance == Decimal("0.00"):
        ar.status = AccountReceivable.Status.PAID
    elif settled > Decimal("0.00"):
        ar.status = AccountReceivable.Status.PARTIALLY_PAID
    ar.save()
    return ar


def get_ar_aging_report(currency: str = "CLP") -> dict:
    curr = (currency or "CLP").strip().upper()
    today = timezone.now().date()
    buckets = {
        "upcoming": Decimal("0.00"),
        "due_today": Decimal("0.00"),
        "days_1_30": Decimal("0.00"),
        "days_31_60": Decimal("0.00"),
        "days_61_90": Decimal("0.00"),
        "days_90_plus": Decimal("0.00"),
    }
    open_qs = AccountReceivable.objects.filter(currency=curr).exclude(
        status__in=[AccountReceivable.Status.PAID, AccountReceivable.Status.CANCELLED]
    )
    for ar in open_qs:
        bal = ar.pending_balance
        diff = (today - ar.due_date).days
        if diff < 0:
            buckets["upcoming"] += bal
        elif diff == 0:
            buckets["due_today"] += bal
        elif diff <= 30:
            buckets["days_1_30"] += bal
        elif diff <= 60:
            buckets["days_31_60"] += bal
        elif diff <= 90:
            buckets["days_61_90"] += bal
        else:
            buckets["days_90_plus"] += bal

    return {
        "currency": curr,
        "as_of": today.isoformat(),
        "buckets": {k: _fmt(v, curr) for k, v in buckets.items()},
        "total_pending": _fmt(sum(buckets.values()), curr),
    }


# ═══════════════════════════════════════════════════════════════════════════
# 4. BF-37: CUENTAS POR PAGAR (AP) & CALENDARIO
# ═══════════════════════════════════════════════════════════════════════════

@transaction.atomic
def register_account_payable(
    *,
    supplier: Supplier,
    supplier_invoice_number: str,
    currency: str,
    original_amount: Decimal,
    issue_date: date,
    due_date: date,
    purchase_order: Optional[PurchaseOrder] = None,
    goods_receipt: Optional[GoodsReceipt] = None,
    document_sha256: str = "",
    notes: str = "",
    approve_immediately: bool = False,
    actor=None,
) -> AccountPayable:
    curr = (currency or "CLP").strip().upper()
    inv = (supplier_invoice_number or "").strip()
    if not inv:
        raise FinanceServiceError("El número de factura del proveedor es obligatorio.")
    if AccountPayable.objects.filter(supplier=supplier, supplier_invoice_number=inv, currency=curr).exists():
        raise FinanceServiceError(f"La factura '{inv}' ({curr}) de '{supplier.legal_name}' ya fue registrada.")

    amt = Decimal(str(original_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amt <= Decimal("0.00"):
        raise FinanceServiceError("El importe de la factura AP debe ser mayor que cero.")

    ap = AccountPayable.objects.create(
        ap_number=_next_fin_code(AccountPayable, "ap_number", "AP"),
        supplier=supplier,
        purchase_order=purchase_order,
        goods_receipt=goods_receipt,
        supplier_invoice_number=inv,
        currency=curr,
        original_amount=amt,
        pending_balance=amt,
        issue_date=issue_date,
        due_date=due_date,
        status=AccountPayable.Status.APPROVED_FOR_PAYMENT if approve_immediately else AccountPayable.Status.DRAFT_PENDING_VALIDATION,
        document_sha256=document_sha256,
        notes=notes,
        approved_by=actor if (approve_immediately and getattr(actor, "is_authenticated", False)) else None,
    )
    return ap


@transaction.atomic
def record_payable_payment(
    payable: AccountPayable,
    *,
    amount: Decimal,
    bank_reference: str,
    payment_date: Optional[date] = None,
    bank_transaction: Optional[BankTransaction] = None,
    idempotency_key: Optional[str] = None,
    actor=None,
) -> AccountPayable:
    if idempotency_key and PayableAllocation.objects.filter(idempotency_key=idempotency_key).exists():
        return AccountPayable.objects.get(pk=payable.pk)

    ap = AccountPayable.objects.select_for_update().get(pk=payable.pk)
    if not (bank_reference or "").strip():
        raise FinanceServiceError("Se requiere referencia bancaria verificable para registrar un pago a proveedor.")
    amt = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amt <= Decimal("0.00") or amt > ap.pending_balance:
        raise FinanceServiceError(f"El monto de pago ({amt}) debe estar entre 0.01 y el saldo pendiente ({ap.pending_balance}).")

    PayableAllocation.objects.create(
        payable=ap,
        bank_transaction=bank_transaction,
        amount=amt,
        currency=ap.currency,
        bank_reference=bank_reference.strip()[:140],
        payment_date=payment_date or timezone.now().date(),
        idempotency_key=idempotency_key,
        recorded_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
    ap.paid_amount = (ap.paid_amount + amt).quantize(Decimal("0.01"))
    ap.pending_balance = max(Decimal("0.00"), (ap.original_amount - ap.paid_amount).quantize(Decimal("0.01")))
    ap.status = AccountPayable.Status.PAID if ap.pending_balance == Decimal("0.00") else AccountPayable.Status.PARTIALLY_PAID
    ap.save()
    return ap


# ═══════════════════════════════════════════════════════════════════════════
# 5. BF-39: PROYECCIÓN DE FLUJO DE CAJA 30/60/90 & EXPORTACIÓN CONTABLE
# ═══════════════════════════════════════════════════════════════════════════

SCENARIO_FACTORS = {
    "base": {"inflow": Decimal("1.00"), "outflow": Decimal("1.00"), "label": "Escenario Base (100% AR / 100% AP)"},
    "conservative": {"inflow": Decimal("0.80"), "outflow": Decimal("1.10"), "label": "Escenario Conservador (80% AR / 110% AP)"},
    "optimistic": {"inflow": Decimal("1.05"), "outflow": Decimal("0.95"), "label": "Escenario Optimista (105% AR / 95% AP)"},
}


def compute_cash_flow_projection(currency: str = "CLP", scenario: str = "base") -> dict:
    """
    BF-39: Proyección determinista a 30, 60 y 90 días aislada por moneda.
    - Saldo proyectado = Saldo inicial verificado + Entradas previstas - Salidas previstas.
    - No duplica AR con Orders ni AP con PurchaseOrders.
    """
    curr = (currency or "CLP").strip().upper()
    sc = scenario if scenario in SCENARIO_FACTORS else "base"
    factors = SCENARIO_FACTORS[sc]
    today = timezone.now().date()

    accounts = FinancialBankAccount.objects.filter(
        currency=curr, operational_status=FinancialBankAccount.OperationalStatus.ACTIVE
    )
    opening_total = Decimal("0.00")
    for acct in accounts:
        bal_info = get_treasury_account_balances(acct)
        opening_total += Decimal(bal_info["reconciled_balance"])

    open_ar = AccountReceivable.objects.filter(currency=curr).exclude(
        status__in=[AccountReceivable.Status.PAID, AccountReceivable.Status.CANCELLED]
    )
    open_ap = AccountPayable.objects.filter(currency=curr).exclude(
        status__in=[AccountPayable.Status.PAID, AccountPayable.Status.CANCELLED]
    )

    horizons = {}
    for days in (30, 60, 90):
        cutoff = today + timedelta(days=days)
        raw_in = open_ar.filter(due_date__lte=cutoff).aggregate(t=Sum("pending_balance"))["t"] or Decimal("0.00")
        raw_out = open_ap.filter(due_date__lte=cutoff).aggregate(t=Sum("pending_balance"))["t"] or Decimal("0.00")

        adj_in = (Decimal(str(raw_in)) * factors["inflow"]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        adj_out = (Decimal(str(raw_out)) * factors["outflow"]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        proj = (opening_total + adj_in - adj_out).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        horizons[f"days_{days}"] = {
            "horizon_days": days,
            "cutoff_date": cutoff.isoformat(),
            "expected_inflows": _fmt(adj_in, curr),
            "expected_outflows": _fmt(adj_out, curr),
            "projected_balance": _fmt(proj, curr),
            "deficit_alert": proj < Decimal("0.00"),
        }

    return {
        "currency": curr,
        "scenario": sc,
        "scenario_label": factors["label"],
        "is_projection": True,
        "has_opening_accounts": accounts.exists(),
        "verified_opening_balance": _fmt(opening_total, curr),
        "horizons": horizons,
    }


def export_accounting_ledger_csv(currency: str = "CLP") -> str:
    """Exportación contable CSV sanitizada contra inyección de fórmulas."""
    curr = (currency or "CLP").strip().upper()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Currency", "Account", "EffectiveDate", "Direction", "Amount",
        "Reference", "ReconciliationStatus", "SourceID",
    ])
    txs = BankTransaction.objects.select_related("financial_account").filter(currency=curr).order_by("-effective_date")[:1000]
    for tx in txs:
        writer.writerow([
            _sanitize_csv_cell(tx.currency),
            _sanitize_csv_cell(tx.financial_account.code),
            _sanitize_csv_cell(tx.effective_date.isoformat()),
            _sanitize_csv_cell(tx.direction),
            _sanitize_csv_cell(_fmt(tx.amount, tx.currency)),
            _sanitize_csv_cell(tx.reference),
            _sanitize_csv_cell(tx.reconciliation_status),
            _sanitize_csv_cell(str(tx.id)),
        ])
    return buf.getvalue()

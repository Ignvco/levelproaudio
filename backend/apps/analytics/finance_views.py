# apps/analytics/finance_views.py
"""
LEVELPRO OS V4.0 — GATE 9: FINANCIAL MANAGEMENT REST API VIEWS
Rutas rectoras:
- /api/v1/admin/finance/reconciliation/
- /api/v1/admin/finance/cash-flow/
Además de Tesorería Multi-Cuenta, Importación de Cartolas, AR/Aging, AP/Calendario y Exportación Contable.
"""

from decimal import Decimal
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.analytics.finance_models import (
    AccountPayable,
    AccountReceivable,
    BankReconciliation,
    BankTransaction,
    FinancialBankAccount,
    ReceivableAllocation,
)
from apps.analytics.finance_services import (
    FinancePermissionError,
    FinanceServiceError,
    apply_receivable_allocation,
    compute_cash_flow_projection,
    create_treasury_account,
    export_accounting_ledger_csv,
    get_ar_aging_report,
    get_treasury_account_balances,
    import_bank_statement,
    reconcile_payment_with_bank,
    recognize_account_receivable_for_order,
    record_internal_transfer,
    record_payable_payment,
    register_account_payable,
)
from apps.orders.models import Order
from apps.payments.models import BankAccount, Payment, PaymentProvider, PaymentStatus
from apps.procurement.models import GoodsReceipt, PurchaseOrder, Supplier
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    MODULE_FINANCES,
    PERM_APPROVE_PAYMENTS,
    PERM_EXPORT_DATA,
    PERM_MANAGE_FINANCES,
    PERM_VIEW_FINANCES,
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
    ROLE_SUPER_ADMIN,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability


# ═══════════════════════════════════════════════════════════════════════════
# 1. BF-24: BANDEJA DE CONCILIACIÓN FINANCIERA
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_VIEW_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
    capability_by_method={"POST": PERM_APPROVE_PAYMENTS},
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_finance_reconciliation_view(request):
    """
    GET /api/v1/admin/finance/reconciliation/ -> Lista transferencias pendientes/en revisión y historial.
    POST /api/v1/admin/finance/reconciliation/ -> Ejecuta conciliación bancaria atómica e idempotente.
    """
    if request.method == "GET":
        curr = (request.query_params.get("currency") or "").strip().upper()
        pending_qs = (
            Payment.objects.select_related("order")
            .filter(
                provider__in=[
                    PaymentProvider.TRANSFER,
                    PaymentProvider.GLOBAL66,
                    PaymentProvider.PAYONEER,
                    PaymentProvider.CASH,
                ],
                status__in=[PaymentStatus.PENDING, PaymentStatus.IN_REVIEW],
            )
            .order_by("-created_at")
        )
        if curr in ("CLP", "USD", "ARS"):
            pending_qs = pending_qs.filter(currency=curr)

        pending_list = [
            {
                "payment_id": str(p.id),
                "order_id": str(p.order_id),
                "order_short": str(p.order_id)[:8].upper(),
                "customer_email": p.order.email,
                "provider": p.provider,
                "expected_amount": str(p.amount),
                "currency": p.currency,
                "status": p.status,
                "provider_reference": p.provider_reference,
                "declared_at": p.created_at.isoformat(),
                "has_receipt": bool((p.raw_response or {}).get("receipt_url") or (p.raw_response or {}).get("receipt_reference")),
            }
            for p in pending_qs[:100]
        ]

        recs_qs = BankReconciliation.objects.select_related("payment", "financial_account", "reviewed_by").all()[:50]
        history_list = [
            {
                "id": str(r.id),
                "payment_id": str(r.payment_id),
                "order_id": str(r.order_id),
                "status": r.status,
                "expected_amount": str(r.expected_amount),
                "reconciled_amount": str(r.reconciled_amount),
                "currency": r.currency,
                "bank_reference": r.bank_reference,
                "effective_bank_date": r.effective_bank_date.isoformat() if r.effective_bank_date else None,
                "reviewed_by_email": r.reviewed_by.email if r.reviewed_by_id else None,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            }
            for r in recs_qs
        ]
        return Response({"pending_payments": pending_list, "reconciliations": history_list})

    data = request.data or {}
    payment = Payment.objects.filter(pk=data.get("payment_id")).first()
    if payment is None:
        return Response({"error": "Pago no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    tx = BankTransaction.objects.filter(pk=data["bank_transaction_id"]).first() if data.get("bank_transaction_id") else None
    acct = FinancialBankAccount.objects.filter(pk=data["financial_account_id"]).first() if data.get("financial_account_id") else None
    idem = data.get("idempotency_key") or request.headers.get("Idempotency-Key")

    try:
        rec = reconcile_payment_with_bank(
            payment=payment,
            decision=data.get("decision", ""),
            bank_transaction=tx,
            financial_account=acct,
            reconciled_amount=Decimal(str(data["reconciled_amount"])) if data.get("reconciled_amount") is not None else None,
            bank_reference=data.get("bank_reference", ""),
            effective_bank_date=parse_date(data["effective_bank_date"]) if data.get("effective_bank_date") else None,
            manual_exception_reason=data.get("manual_exception_reason", ""),
            idempotency_key=idem,
            actor=request.user,
        )
    except FinancePermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except FinanceServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "id": str(rec.id),
        "payment_id": str(rec.payment_id),
        "status": rec.status,
        "reconciled_amount": str(rec.reconciled_amount),
        "currency": rec.currency,
        "bank_reference": rec.bank_reference,
    })


# ═══════════════════════════════════════════════════════════════════════════
# 2. BF-38: TESORERÍA MULTICUENTA, CARTOLAS Y MOVIMIENTOS
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_VIEW_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
    capability_by_method={"POST": PERM_MANAGE_FINANCES},
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_finance_treasury_accounts_view(request):
    if request.method == "GET":
        curr = (request.query_params.get("currency") or "").strip().upper()
        qs = FinancialBankAccount.objects.all()
        if curr in ("CLP", "USD", "ARS"):
            qs = qs.filter(currency=curr)
        mask = not (is_effective_super_admin(request.user) or user_has_capability(request.user, PERM_MANAGE_FINANCES))
        return Response({"results": [get_treasury_account_balances(a, mask_sensitive=mask) for a in qs]})

    data = request.data or {}
    chk = BankAccount.objects.filter(pk=data["checkout_bank_account_id"]).first() if data.get("checkout_bank_account_id") else None
    try:
        acct = create_treasury_account(
            code=data.get("code", ""),
            bank_name=data.get("bank_name", ""),
            account_holder=data.get("account_holder", ""),
            account_number=data.get("account_number", ""),
            currency=data.get("currency", "CLP"),
            country=data.get("country", "CL"),
            opening_balance=Decimal(str(data.get("opening_balance") or "0.00")),
            opening_balance_date=parse_date(data["opening_balance_date"]) if data.get("opening_balance_date") else None,
            verification_source=data.get("verification_source", ""),
            checkout_bank_account=chk,
            actor=request.user,
        )
    except FinanceServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(get_treasury_account_balances(acct), status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_MANAGE_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_finance_internal_transfer_view(request):
    data = request.data or {}
    src = FinancialBankAccount.objects.filter(pk=data.get("source_account_id")).first()
    tgt = FinancialBankAccount.objects.filter(pk=data.get("target_account_id")).first()
    if src is None or tgt is None:
        return Response({"error": "Cuenta origen o destino no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    try:
        out_tx, in_tx = record_internal_transfer(
            source_account=src,
            target_account=tgt,
            amount=Decimal(str(data.get("amount") or "0")),
            effective_date=parse_date(data["effective_date"]) if data.get("effective_date") else src.opening_balance_date,
            reference=data.get("reference", "TRASPASO-INTERNO"),
            actor=request.user,
        )
    except FinanceServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"debit_tx_id": str(out_tx.id), "credit_tx_id": str(in_tx.id)}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_MANAGE_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_finance_statement_import_view(request):
    data = request.data or {}
    acct = FinancialBankAccount.objects.filter(pk=data.get("financial_account_id")).first()
    if acct is None:
        return Response({"error": "Cuenta de tesorería no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    csv_text = data.get("csv_content") or ""
    if not csv_text and request.FILES.get("file"):
        csv_bytes = request.FILES["file"].read()
        fname = request.FILES["file"].name
    else:
        csv_bytes = str(csv_text).encode("utf-8")
        fname = data.get("file_name") or "cartola.csv"
    try:
        res = import_bank_statement(
            acct,
            file_name=fname,
            file_bytes=csv_bytes,
            column_mapping=data.get("column_mapping") or {},
            confirm=bool(data.get("confirm", True)),
            actor=request.user,
        )
    except FinanceServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(res, status=status.HTTP_200_OK)


@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_VIEW_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_finance_bank_transactions_view(request):
    curr = (request.query_params.get("currency") or "").strip().upper()
    qs = BankTransaction.objects.select_related("financial_account").all()
    if curr in ("CLP", "USD", "ARS"):
        qs = qs.filter(currency=curr)
    if request.query_params.get("status"):
        qs = qs.filter(reconciliation_status=request.query_params["status"])
    results = [
        {
            "id": str(tx.id),
            "account_code": tx.financial_account.code,
            "effective_date": tx.effective_date.isoformat(),
            "direction": tx.direction,
            "amount": str(tx.amount),
            "unallocated_amount": str(tx.unallocated_amount),
            "currency": tx.currency,
            "reference": tx.reference,
            "description": tx.description,
            "reconciliation_status": tx.reconciliation_status,
        }
        for tx in qs[:100]
    ]
    return Response({"results": results, "count": len(results)})


# ═══════════════════════════════════════════════════════════════════════════
# 3. BF-36 & BF-37: CUENTAS POR COBRAR (AR) & CUENTAS POR PAGAR (AP)
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_VIEW_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
    capability_by_method={"POST": PERM_MANAGE_FINANCES},
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_finance_ar_view(request):
    if request.method == "GET":
        curr = (request.query_params.get("currency") or "").strip().upper()
        qs = AccountReceivable.objects.select_related("order", "organization").all()
        if curr in ("CLP", "USD", "ARS"):
            qs = qs.filter(currency=curr)
        return Response({
            "results": [
                {
                    "id": str(ar.id),
                    "ar_number": ar.ar_number,
                    "order_id": str(ar.order_id),
                    "customer_email": ar.order.email,
                    "organization_name": ar.organization.legal_name if ar.organization_id else None,
                    "currency": ar.currency,
                    "original_amount": str(ar.original_amount),
                    "collected_amount": str(ar.collected_amount),
                    "pending_balance": str(ar.pending_balance),
                    "due_date": ar.due_date.isoformat(),
                    "status": ar.status,
                }
                for ar in qs[:100]
            ]
        })

    data = request.data or {}
    order = Order.objects.filter(pk=data.get("order_id")).first()
    if order is None:
        return Response({"error": "Orden no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    ar = recognize_account_receivable_for_order(
        order,
        due_days=int(data.get("due_days") or 15),
        evidence_reference=data.get("evidence_reference", ""),
        actor=request.user,
    )
    return Response({"id": str(ar.id), "ar_number": ar.ar_number, "pending_balance": str(ar.pending_balance)}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_VIEW_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_finance_ar_aging_view(request):
    curr = (request.query_params.get("currency") or "CLP").strip().upper()
    return Response(get_ar_aging_report(currency=curr))


@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_MANAGE_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_finance_ar_allocate_view(request, ar_id):
    ar = AccountReceivable.objects.filter(pk=ar_id).first()
    if ar is None:
        return Response({"error": "AR no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    try:
        updated = apply_receivable_allocation(
            ar,
            amount=Decimal(str(data.get("amount") or "0")),
            allocation_type=data.get("allocation_type", ReceivableAllocation.AllocationType.PAYMENT),
            idempotency_key=data.get("idempotency_key") or request.headers.get("Idempotency-Key"),
            actor=request.user,
        )
    except FinanceServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(updated.id), "pending_balance": str(updated.pending_balance), "status": updated.status})


@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_VIEW_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
    capability_by_method={"POST": PERM_MANAGE_FINANCES},
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_finance_ap_view(request):
    if request.method == "GET":
        curr = (request.query_params.get("currency") or "").strip().upper()
        qs = AccountPayable.objects.select_related("supplier", "purchase_order").all()
        if curr in ("CLP", "USD", "ARS"):
            qs = qs.filter(currency=curr)
        return Response({
            "results": [
                {
                    "id": str(ap.id),
                    "ap_number": ap.ap_number,
                    "supplier_name": ap.supplier.legal_name,
                    "supplier_invoice_number": ap.supplier_invoice_number,
                    "po_number": ap.purchase_order.po_number if ap.purchase_order_id else None,
                    "currency": ap.currency,
                    "original_amount": str(ap.original_amount),
                    "paid_amount": str(ap.paid_amount),
                    "pending_balance": str(ap.pending_balance),
                    "due_date": ap.due_date.isoformat(),
                    "status": ap.status,
                }
                for ap in qs[:100]
            ]
        })

    data = request.data or {}
    sup = Supplier.objects.filter(pk=data.get("supplier_id")).first()
    if sup is None:
        return Response({"error": "Proveedor no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    po = PurchaseOrder.objects.filter(pk=data["purchase_order_id"]).first() if data.get("purchase_order_id") else None
    gr = GoodsReceipt.objects.filter(pk=data["goods_receipt_id"]).first() if data.get("goods_receipt_id") else None
    try:
        ap = register_account_payable(
            supplier=sup,
            supplier_invoice_number=data.get("supplier_invoice_number", ""),
            currency=data.get("currency", "CLP"),
            original_amount=Decimal(str(data.get("original_amount") or "0")),
            issue_date=parse_date(data["issue_date"]) if data.get("issue_date") else sup.created_at.date(),
            due_date=parse_date(data["due_date"]) if data.get("due_date") else sup.created_at.date(),
            purchase_order=po,
            goods_receipt=gr,
            approve_immediately=bool(data.get("approve_immediately", True)),
            notes=data.get("notes", ""),
            actor=request.user,
        )
    except FinanceServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(ap.id), "ap_number": ap.ap_number, "pending_balance": str(ap.pending_balance)}, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_MANAGE_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_finance_ap_pay_view(request, ap_id):
    ap = AccountPayable.objects.filter(pk=ap_id).first()
    if ap is None:
        return Response({"error": "AP no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    data = request.data or {}
    try:
        updated = record_payable_payment(
            ap,
            amount=Decimal(str(data.get("amount") or "0")),
            bank_reference=data.get("bank_reference", ""),
            idempotency_key=data.get("idempotency_key") or request.headers.get("Idempotency-Key"),
            actor=request.user,
        )
    except FinanceServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"id": str(updated.id), "pending_balance": str(updated.pending_balance), "status": updated.status})


# ═══════════════════════════════════════════════════════════════════════════
# 4. BF-39: PROYECCIÓN FLUJO DE CAJA 30/60/90 & EXPORTACIÓN CONTABLE
# ═══════════════════════════════════════════════════════════════════════════

@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_VIEW_FINANCES,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_finance_cash_flow_view(request):
    """GET /api/v1/admin/finance/cash-flow/?currency=CLP&scenario=base"""
    curr = (request.query_params.get("currency") or "CLP").strip().upper()
    scenario = (request.query_params.get("scenario") or "base").strip().lower()
    return Response(compute_cash_flow_projection(currency=curr, scenario=scenario))


@rbac_endpoint(
    module=MODULE_FINANCES,
    capability=PERM_EXPORT_DATA,
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_FINANCE],
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_finance_accounting_export_view(request):
    """GET /api/v1/admin/finance/accounting-export/?currency=CLP"""
    curr = (request.query_params.get("currency") or "CLP").strip().upper()
    csv_data = export_accounting_ledger_csv(currency=curr)
    resp = HttpResponse(csv_data, content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="levelpro-ledger-{curr}.csv"'
    return resp

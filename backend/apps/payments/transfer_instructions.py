"""Read-only instructions for an existing manual payment.

Bank details are selected by provider AND currency. A read never creates a
payment or assumes that an old payment intent is still payable.
"""
from django.conf import settings

from .models import BankAccount, PaymentStatus


ACCOUNT_FIELDS = (
    "id", "label", "payment_method", "currency", "bank_name", "account_type",
    "account_number", "holder_name", "holder_id", "email", "instructions",
)


def bank_accounts_for(currency, methods):
    return list(BankAccount.objects.filter(
        is_active=True, currency__iexact=currency, payment_method__in=methods,
    ).values(*ACCOUNT_FIELDS))


def instructions_for(order):
    result = {
        "order_id": str(order.pk), "order_status": order.status,
        "amount": str(order.total), "currency": order.currency,
        "reference": f"LEVELPRO-{str(order.pk)[:8].upper()}",
        "provider": None, "state": "unavailable", "bank_accounts": [],
    }
    payments = list(order.payments.order_by("-created_at", "-id"))
    statuses = {p.status for p in payments}
    if order.status == "cancelled":
        result["state"] = "cancelled"
    elif PaymentStatus.REFUNDED in statuses and PaymentStatus.APPROVED not in statuses:
        result["state"] = "refunded"
    elif order.status in ("paid", "shipped", "completed"):
        result["state"] = "confirmed"
    elif statuses & {PaymentStatus.IN_REVIEW, PaymentStatus.APPROVED}:
        result["state"] = "review"
    elif order.status == "pending" and payments:
        payment = payments[0]
        result["provider"] = payment.provider
        if payment.status != PaymentStatus.PENDING:
            return result
        # Do not mix an outdated amount/currency with current order details.
        if payment.amount != order.total or payment.currency.upper() != order.currency.upper():
            return result
        if payment.provider in ("transfer", "payoneer"):
            result["bank_accounts"] = bank_accounts_for(order.currency, [payment.provider])
            if result["bank_accounts"]:
                result["state"] = "ready"
        elif payment.provider == "global66" and order.currency.upper() == "CLP":
            alias = getattr(settings, "GLOBAL66_ALIAS", "").strip()
            if alias:
                result["state"] = "ready"
                result["bank_accounts"] = [{
                    "id": "global66", "label": "Global66", "currency": "CLP",
                    "payment_method": "global66", "account_number": alias,
                    "bank_name": settings.GLOBAL66_BANK,
                    "holder_name": settings.GLOBAL66_ACCOUNT_NAME,
                    "email": settings.GLOBAL66_EMAIL,
                }]
    return result

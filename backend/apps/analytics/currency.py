"""Currency isolation for reporting and internal accounting.

Order totals represent original checkout currency; Payment amounts represent
the actual gateway currency. Never add them together without a conversion.
"""
from decimal import Decimal
from django.db.models import Sum

CURRENCIES = ("CLP", "USD", "ARS")


def requested_currency(request):
    code = (request.query_params.get("currency") or "CLP").strip().upper()
    return code if code in CURRENCIES else None


def currency_error():
    from rest_framework.response import Response
    return Response({"error": "Moneda inválida. Utiliza CLP, USD o ARS."}, status=400)


def amount(qs, field="amount"):
    return qs.aggregate(value=Sum(field))["value"] or Decimal("0.00")


def summarize_by_currency(qs, field="total"):
    return {
        currency: float(amount(qs.filter(currency=currency), field))
        for currency in CURRENCIES
    }

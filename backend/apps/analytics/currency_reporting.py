"""Currency-scoped reporting primitives.

Never aggregate native order/payment amounts across CLP, USD and ARS.
Amounts are reported in the currency in which the transaction was recorded.
Currency conversion is deliberately outside the scope of these helpers.
"""
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

SUPPORTED_CURRENCIES = ("CLP", "USD", "ARS")


def reporting_currency(request):
    requested = (request.query_params.get("currency", "CLP") or "").strip().upper()
    if requested not in SUPPORTED_CURRENCIES:
        raise ValidationError({"currency": "Moneda no válida. Usa CLP, USD o ARS."})
    return requested


def grouped_currency_totals(queryset, amount_field="total"):
    rows = (
        queryset.values("currency")
        .annotate(total=Sum(amount_field))
        .order_by("currency")
    )
    result = {currency: 0.0 for currency in SUPPORTED_CURRENCIES}
    unknown = []
    for row in rows:
        code = (row.get("currency") or "").upper()
        if code in result:
            result[code] += float(row["total"] or 0)
        else:
            unknown.append({"currency": code or None, "total": float(row["total"] or 0)})
    return result, unknown

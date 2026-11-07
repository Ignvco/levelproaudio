"""LevelPro V3.2: conciliación preliminar READ ONLY. NUNCA reclasifica divisas.

Ejemplo desde backend/:
 python manage.py audit_currency_history --output /ruta/privada/currency-report.json

Para producción: usar credenciales de base de datos SOLO LECTURA y un backup.
"""
import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import connections, transaction
from django.db.models import Count, Q, Sum

from apps.analytics.models import IncomeDistribution, IncomeRecord, Withdrawal
from apps.loyalty.models import LoyaltyTransaction
from apps.orders.models import Order
from apps.payments.models import Payment

CURRENCIES = ("CLP", "USD", "ARS")


def unknown_currency():
    return Q(currency__isnull=True) | Q(currency="") | ~Q(currency__in=CURRENCIES)


def money_groups(model, using, *, filter_kwargs=None, value_field="amount"):
    """Importes agrupados EXCLUSIVAMENTE por moneda; nunca sumar distintas monedas."""
    qs = model.objects.using(using).filter(currency__in=CURRENCIES)
    if filter_kwargs:
        qs = qs.filter(**filter_kwargs)
    result = qs.values("currency").annotate(rows=Count("id"), total=Sum(value_field))
    return {
        item["currency"]: {"rows": item["rows"], "total": str(item["total"] or Decimal("0"))}
        for item in result
    }


def sample_rows(qs, limit, fields):
    return [
        {field: str(row.get(field)) if row.get(field) is not None else None for field in fields}
        for row in qs.values(*fields).order_by("pk")[:limit]
    ]


class Command(BaseCommand):
    help = "Inventario histórico de monedas y anomalías. Solo SELECT; no crea ni modifica datos."

    def add_arguments(self, parser):
        parser.add_argument("--database", default="default", help="Alias de conexión DB de Django")
        parser.add_argument("--output", help="Ruta PRIVADA de informe JSON (IDs y montos comerciales)")
        parser.add_argument("--samples", type=int, default=50, help="Muestras por categoría; max. 500")
        parser.add_argument("--fail-on-ambiguous", action="store_true", help="Exit code 2 si hay históricos que conciliar")

    def handle(self, *args, **opts):
        using = opts["database"]
        if using not in connections:
            raise ValueError(f"Conexión DB inexistente: {using}")
        limit = max(0, min(opts["samples"], 500))
        conn = connections[using]
        report = {
            "report_version": 1,
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "database_alias": using,
            "source": "Django ORM / transacción de solo lectura",
            "currency_policy": "CLP/USD/ARS separados; NULL es ambiguo; no se asigna FX",
            "read_only": True,
            "amounts_by_currency": {},
            "exceptions": {},
            "action_required": [],
        }
        # PostgreSQL impide escrituras a nivel de esta transacción. En SQLite,
        # el comando no contiene operaciones ORM de escritura por diseño.
        with transaction.atomic(using=using):
            if conn.vendor == "postgresql":
                with conn.cursor() as cursor:
                    cursor.execute("SET TRANSACTION READ ONLY")

            report["amounts_by_currency"] = {
                "paid_orders": money_groups(Order, using, filter_kwargs={"status__in": ["paid", "shipped", "completed"]}, value_field="total"),
                "approved_payments_gateway_currency": money_groups(Payment, using, filter_kwargs={"status": "approved"}),
                "income_records": money_groups(IncomeRecord, using),
                "withdrawals": money_groups(Withdrawal, using),
            }

            income_unknown = IncomeRecord.objects.using(using).filter(unknown_currency())
            withdrawals_unknown = Withdrawal.objects.using(using).filter(unknown_currency())
            income_mismatch = IncomeRecord.objects.using(using).filter(
                order__isnull=False, currency__in=CURRENCIES
            ).exclude(currency=models_F_order_currency())
            # Un ingreso de orden podría tener pagos parciales legítimos. Diferencias
            # de importe son casos PARA REVISAR, no errores automáticamente.
            income_amount_diff = IncomeRecord.objects.using(using).filter(order__isnull=False).exclude(amount=models_F_order_total())
            foreign_distributions = IncomeDistribution.objects.using(using).exclude(income_record__currency="CLP")
            foreign_points = Order.objects.using(using).exclude(currency="CLP").filter(
                Q(loyalty_points_redeemed__gt=0) | Q(loyalty_discount__gt=0)
            )
            foreign_earns = LoyaltyTransaction.objects.using(using).filter(tipo="earn", orden__isnull=False).exclude(orden__currency="CLP")
            approved_cancelled = Payment.objects.using(using).filter(status="approved", order__status="cancelled")
            order_bad_currency = Order.objects.using(using).filter(unknown_currency())
            payment_bad_currency = Payment.objects.using(using).filter(unknown_currency())

            categories = {
                "income_currency_unknown": (income_unknown, ["id", "created_at", "amount", "currency", "source", "order_id", "payment_id"]),
                "withdrawals_currency_unknown": (withdrawals_unknown, ["id", "created_at", "amount", "currency", "category_id", "reference"]),
                "income_vs_order_currency_mismatch": (income_mismatch, ["id", "created_at", "amount", "currency", "order_id", "payment_id"]),
                "income_vs_order_amount_difference": (income_amount_diff, ["id", "created_at", "amount", "currency", "order_id", "payment_id"]),
                "distributions_from_non_clp_income": (foreign_distributions, ["id", "income_record_id", "category_id", "amount"]),
                "orders_with_foreign_currency_loyalty": (foreign_points, ["id", "created_at", "currency", "total", "loyalty_points_redeemed", "loyalty_discount"]),
                "loyalty_earn_from_foreign_order": (foreign_earns, ["id", "created_at", "orden_id", "puntos"]),
                "approved_payment_on_cancelled_order": (approved_cancelled, ["id", "order_id", "status", "currency", "amount"]),
                "orders_currency_unknown": (order_bad_currency, ["id", "created_at", "currency", "total"]),
                "payments_currency_unknown": (payment_bad_currency, ["id", "created_at", "currency", "amount"]),
            }
            for key, (qs, fields) in categories.items():
                report["exceptions"][key] = {"count": qs.count(), "samples": sample_rows(qs, limit, fields)}

        critical = [k for k, v in report["exceptions"].items() if v["count"] > 0]
        report["action_required"] = critical
        report["production_reconciliation_status"] = (
            "PENDING_DOCUMENTARY_REVIEW" if critical else "NO_EXCEPTIONS_IN_THE_CHECKS_PERFORMED"
        )
        payload = json.dumps(report, ensure_ascii=False, indent=2)
        if opts["output"]:
            dest = Path(opts["output"]).expanduser()
            if dest.exists():
                raise ValueError("Informe ya existe; no sobrescribir evidencias anteriores")
            dest.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            with dest.open("x", encoding="utf-8") as handle:
                handle.write(payload + "\n")
            dest.chmod(0o600)
            self.stdout.write(f"Reporte privado guardado: {dest}")
        else:
            # No imprimir IDs e importes en logs de Cloud Build por defecto.
            self.stdout.write(json.dumps({
                "read_only": True,
                "production_reconciliation_status": report["production_reconciliation_status"],
                "exception_counts": {k:v["count"] for k,v in report["exceptions"].items()},
            }, ensure_ascii=False, indent=2))
        if critical and opts["fail_on_ambiguous"]:
            raise SystemExit(2)


def models_F_order_currency():
    from django.db.models import F
    return F("order__currency")


def models_F_order_total():
    from django.db.models import F
    return F("order__total")

"""Contratos: el inventario de conciliación NO cambia registros comerciales."""
import json
import tempfile
from decimal import Decimal
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from apps.analytics.models import DistributionCategory, IncomeRecord, Withdrawal
from apps.orders.models import Order, OrderStatus


class AuditCurrencyHistoryTests(TestCase):
    def test_report_detects_null_without_auto_classifying(self):
        order = Order.objects.create(
            currency="USD", total=Decimal("120"), status=OrderStatus.PENDING,
            email="audit-fixture@example.test", shipping_address="Test",
        )
        income = IncomeRecord.objects.create(
            order=order, source="manual", amount=Decimal("120"), currency=None,
        )
        category = DistributionCategory.objects.create(name="Auditoría", cat_type="percent")
        withdrawal = Withdrawal.objects.create(
            category=category, amount=Decimal("50"), currency=None,
            destination="Banco de prueba",
        )
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "audit.json"
            call_command("audit_currency_history", output=str(output), samples=5)
            data = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(data["exceptions"]["income_currency_unknown"]["count"], 1)
            self.assertEqual(data["exceptions"]["withdrawals_currency_unknown"]["count"], 1)
            self.assertEqual(data["production_reconciliation_status"], "PENDING_DOCUMENTARY_REVIEW")
            self.assertEqual(data["amounts_by_currency"]["paid_orders"], {})
        income.refresh_from_db()
        withdrawal.refresh_from_db()
        self.assertIsNone(income.currency)
        self.assertIsNone(withdrawal.currency)

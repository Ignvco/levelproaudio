"""V3.2 contract tests: monetary totals never combine denominations."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.analytics.models import DistributionCategory, IncomeDistribution, IncomeRecord, Withdrawal
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.products.models import Product, Category


class CurrencyIsolationTest(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser(
            email="v32-admin@example.test", username="v32-admin", password="x"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def order(self, currency, amount, status=OrderStatus.PAID):
        return Order.objects.create(
            currency=currency, total=Decimal(str(amount)), status=status,
            email="buyer@example.test", shipping_address="Test",
        )

    def get_report(self, url, currency="CLP"):
        response = self.client.get(url, {"currency": currency})
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.assertEqual(response.data["currency"], currency)
        return response.data

    def test_commerce_reporting_does_not_sum_clp_usd_ars(self):
        self.order("CLP", "100000")
        self.order("USD", "100")
        self.order("ARS", "20000")

        for currency, expected in (("CLP", 100000), ("USD", 100), ("ARS", 20000)):
            dash = self.get_report("/api/v1/admin/dashboard/", currency)
            self.assertEqual(dash["revenue"]["total"], expected)
            analytics = self.get_report("/api/v1/admin/analytics/", currency)
            self.assertEqual(analytics["kpis"]["total_revenue"], expected)
            self.assertEqual(dash["revenue_by_currency"][currency], expected)
            finance = self.get_report("/api/v1/admin/finance/summary/", currency)
            self.assertEqual(finance["total_income"], expected)
            self.assertFalse(finance["reconciliation_required"])
            self.assertEqual(finance["net_balance"], expected)
        self.assertEqual(IncomeRecord.objects.count(), 3)

    def test_gateway_usd_is_not_misclassified_as_clp_commercial_income(self):
        order = self.order("CLP", "85000", status=OrderStatus.PENDING)
        pay = Payment.objects.create(
            order=order, provider=PaymentProvider.PAYPAL,
            currency="USD", amount=Decimal("90.00"),
            status=PaymentStatus.APPROVED,
        )
        record = IncomeRecord.objects.get(order=order)
        self.assertEqual(record.currency, "CLP")
        self.assertEqual(record.amount, order.total)
        self.assertNotEqual(record.amount, pay.amount)

        usd = self.get_report("/api/v1/admin/payments/", "USD")
        self.assertEqual(usd["total_approved"], 90)
        self.assertEqual(len(usd["results"]), 1)
        clp = self.get_report("/api/v1/admin/payments/", "CLP")
        self.assertEqual(clp["total_approved"], 0)
        self.assertEqual(len(clp["results"]), 0)

    def test_foreign_revenue_does_not_use_clp_product_cost_for_distribution(self):
        fixed = DistributionCategory.objects.create(name="Costo", cat_type="fixed")
        remainder = DistributionCategory.objects.create(name="Utilidad", cat_type="remainder")
        usd = self.order("USD", "42.50")
        record = IncomeRecord.objects.get(order=usd)
        self.assertEqual(record.currency, "USD")
        self.assertFalse(IncomeDistribution.objects.filter(income_record=record).exists())
        self.assertTrue(DistributionCategory.objects.filter(pk=fixed.pk).exists())
        self.assertTrue(DistributionCategory.objects.filter(pk=remainder.pk).exists())

    def test_historical_unclassified_withdrawal_blocks_reuse_of_category_funds(self):
        cat = DistributionCategory.objects.create(name="Reserva", cat_type="percent", percentage=10)
        clp_order = self.order("CLP", "100000")
        record = IncomeRecord.objects.get(order=clp_order)
        # This distribution is now auto-generated for CLP; simulate a legacy
        # withdrawal where currency cannot be inferred.
        Withdrawal.objects.create(
            category=cat, amount=Decimal("1000"), currency=None,
            destination="Legacy bank",
        )
        response = self.client.post("/api/v1/admin/finance/withdrawals/", {
            "category_id": str(cat.id), "amount": "500",
            "currency": "CLP", "destination": "Bank",
        }, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Withdrawal.objects.filter(category=cat).count(), 1)
        overview = self.get_report("/api/v1/admin/finance/summary/")
        balance = next(row for row in overview["summary"] if row["id"] == str(cat.id))
        self.assertTrue(balance["reconciliation_required"])
        self.assertIsNone(balance["balance"])
        self.assertTrue(overview["reconciliation_required"])
        self.assertIsNone(overview["net_balance"])
        self.assertEqual(overview["net_balance_identified_only"], 100000)

    def test_reject_unsupported_currency(self):
        for route in (
            "/api/v1/admin/dashboard/", "/api/v1/admin/analytics/",
            "/api/v1/admin/payments/", "/api/v1/admin/finance/summary/",
            "/api/v1/admin/finance/by-product/", "/api/v1/admin/executive/",
            "/api/v1/admin/finance/withdrawals/",
        ):
            response = self.client.get(route, {"currency": "EUR"})
            self.assertEqual(response.status_code, 400, route)

    def test_category_sales_sum_unit_prices_with_quantity_in_selected_currency(self):
        category = Category.objects.create(name="Test V3.2", slug="v32-products")
        product = Product.objects.create(
            name="Test Mic V3.2", slug="v32-test-mic", category=category,
            price=Decimal("15000"), cost_price=Decimal("5000"),
            stock=5, is_active=True,
        )
        clp_order = self.order("CLP", "30000")
        OrderItem.objects.create(
            order=clp_order, product=product,
            product_name=product.name, price=Decimal("15000"), quantity=2,
        )
        usd_order = self.order("USD", "10")
        OrderItem.objects.create(
            order=usd_order, product=product,
            product_name=product.name, price=Decimal("10"), quantity=1,
        )
        clp = self.get_report("/api/v1/admin/analytics/", "CLP")
        usd = self.get_report("/api/v1/admin/analytics/", "USD")
        self.assertEqual(clp["revenue_by_category"][0]["total"], 30000)
        self.assertEqual(usd["revenue_by_category"][0]["total"], 10)
        usd_products = self.get_report("/api/v1/admin/finance/by-product/", "USD")
        self.assertIsNone(usd_products["results"][0]["total_cost"])
        self.assertIsNone(usd_products["results"][0]["profit"])
        self.assertIsNone(usd_products["results"][0]["margin"])

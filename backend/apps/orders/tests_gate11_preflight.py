# apps/orders/tests_gate11_preflight.py
"""
LEVELPRO OS V4.0 — GATE 11 PREFLIGHT TESTS (MKT11-PF-01..05)
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig, LoyaltyTransaction
from apps.orders.marketing_preflight import (
    COMMUNICATION_CHANNEL_CLASSES,
    PRICING_PRECEDENCE_POLICY,
    REWARDS_DOMAIN_SEPARATION_CONTRACT,
    compute_decimal_cart_totals,
)
from apps.orders.models import Order, OrderStatus
from apps.products.models import Category, Product

User = get_user_model()


class Gate11PreflightTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="g11pf_u", email="g11pf@levelpro.cl", password="pw")
        self.cat = Category.objects.create(name="Synths G11PF", slug="synths-g11pf")
        self.product = Product.objects.create(
            name="Synth Pro G11PF",
            slug="synth-pro-g11pf",
            sku="SYN-G11PF-01",
            category=self.cat,
            price=Decimal("100000.00"),
            price_usd=Decimal("120.00"),
            price_ars=Decimal("150000.00"),
            stock=5,
        )

    def test_mkt11_pf_01_decimal_precision_currency_isolation_and_clamping(self):
        """MKT11-PF-01: Precisión Decimal sin float(), aislamiento CLP/USD/ARS y clamping >= 0."""
        res_usd = compute_decimal_cart_totals(
            line_items=[{"unit_price": "19.99", "quantity": 3, "currency": "USD"}],
            currency="USD",
            discount_amount=Decimal("100.00"),
        )
        self.assertEqual(res_usd["subtotal"], Decimal("59.97"))
        self.assertEqual(res_usd["discount"], Decimal("59.97"))
        self.assertEqual(res_usd["total"], Decimal("0.00"))

        with self.assertRaises(ValueError):
            compute_decimal_cart_totals(
                line_items=[{"unit_price": "100.00", "quantity": 1, "currency": "USD"}],
                currency="CLP",
            )

    def test_mkt11_pf_02_loyalty_decimal_clp_only_and_no_double_award(self):
        """MKT11-PF-02: Loyalty solo CLP en canje monetario, sin float() ni doble otorgamiento."""
        cfg = LoyaltyConfig.get()
        cfg.is_active = True
        cfg.minimo_canje = 10
        cfg.peso_por_punto = Decimal("10.00")
        cfg.puntos_por_peso = Decimal("0.01")
        cfg.save()
        acc, _ = LoyaltyAccount.objects.get_or_create(user=self.user)
        acc.agregar_puntos(puntos=500, descripcion="Seed QA")

        # Canje en USD rechazado
        client = APIClient()
        client.force_authenticate(user=self.user)
        resp_usd = client.post(
            "/api/v1/orders/",
            {
                "items": [{"product_id": str(self.product.id), "quantity": 1}],
                "currency": "USD",
                "loyalty_points_redeemed": 100,
                "shipping_address": "Av. Demo 123",
            },
            format="json",
        )
        self.assertEqual(resp_usd.status_code, 400)

        # Otorgamiento de puntos sin duplicado
        order_clp = Order.objects.create(
            user=self.user,
            email=self.user.email,
            status=OrderStatus.PAID,
            total=Decimal("100000.00"),
            currency="CLP",
            shipping_address="Av. Demo 123",
        )
        order_clp.save()
        self.assertEqual(LoyaltyTransaction.objects.filter(orden=order_clp, tipo="earn").count(), 1)

    def test_mkt11_pf_03_04_05_contracts(self):
        """MKT11-PF-03, 04, 05: Separación Rewards, canales de comunicación y precedencia."""
        self.assertFalse(REWARDS_DOMAIN_SEPARATION_CONTRACT["auto_grant_entries_on_discount"])
        self.assertTrue(COMMUNICATION_CHANNEL_CLASSES["commercial_cart_recovery"]["requires_marketing_consent"])
        self.assertFalse(COMMUNICATION_CHANNEL_CLASSES["transactional_order_confirmation"]["requires_marketing_consent"])
        self.assertEqual(PRICING_PRECEDENCE_POLICY[0], "b2b_negotiated_price")

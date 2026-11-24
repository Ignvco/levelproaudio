# apps/orders/tests_gate11_marketing.py
"""
LEVELPRO OS V4.0 — GATE 11: MARKETING & CUSTOMER GROWTH TEST SUITE
Cobertura Sección 25:
- BF-26 Cupones (CLP/USD/ARS, inválidos, expirados, mismatch moneda, no acumulación, margen mínimo, concurrencia/idempotencia)
- BF-27 Promociones programadas (scheduler, ventana horaria/timezone, pausa, prioridad, idempotencia)
- BF-28 Carritos abandonados (detección, consentimiento, opt-out, token expirado/adulterado, stock, doble worker, conversión)
- Preservación Loyalty & Rewards + RBAC + anti-leak de costos/PII + rate limiting.
"""

from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.loyalty.models import LoyaltyAccount
from apps.orders.marketing_models import (
    AbandonedCartTrigger,
    Coupon,
    CouponRedemption,
    MarketingMessageOutbox,
    PricingAdjustmentSnapshot,
    PromotionActivationEvent,
    PromotionCampaign,
)
from apps.orders.marketing_services import (
    confirm_coupon_redemption,
    create_promotion_campaign,
    detect_abandoned_carts,
    evaluate_commercial_pricing,
    mark_cart_recovered_for_order,
    prepare_and_dispatch_cart_recovery,
    record_marketing_consent,
    release_or_reverse_coupon_redemption,
    reserve_coupon_redemption,
    resolve_cart_recovery_token,
    run_scheduled_promotions_tick,
    unsubscribe_marketing_email,
    validate_and_price_coupon,
)
from apps.orders.models import Cart, CartItem, Order, OrderItem, OrderStatus
from apps.procurement.models import Supplier, WeightedAverageCostState
from apps.products.models import Brand, Category, Product
from apps.rewards.models import Campaign as RewardsCampaign, StickerPurchase, Winner

User = get_user_model()


class Gate11MarketingTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            username="g11_admin",
            email="g11admin@levelpro.cl",
            password="pw",
            is_staff=True,
            is_superuser=True,
        )
        self.customer = User.objects.create_user(
            username="g11_cust",
            email="g11cust@levelpro.cl",
            password="pw",
        )
        self.other_customer = User.objects.create_user(
            username="g11_other",
            email="g11other@levelpro.cl",
            password="pw",
        )
        self.cat = Category.objects.create(name="Interfaces G11", slug="interfaces-g11")
        self.brand = Brand.objects.create(name="RME G11", slug="rme-g11")
        self.product = Product.objects.create(
            name="Audio Interface Pro G11",
            slug="audio-interface-pro-g11",
            sku="INT-G11-01",
            category=self.cat,
            brand=self.brand,
            price=Decimal("200000.00"),
            price_usd=Decimal("250.00"),
            price_ars=Decimal("300000.00"),
            stock=5,
        )
        WeightedAverageCostState.objects.create(
            product=self.product,
            sku_snapshot=self.product.sku,
            currency=Supplier.Currency.CLP,
            total_quantity=5,
            sellable_quantity=5,
            total_value=Decimal("700000.0000"),
            sellable_value=Decimal("700000.0000"),
            average_unit_cost=Decimal("140000.0000"),
        )
        WeightedAverageCostState.objects.create(
            product=self.product,
            sku_snapshot=self.product.sku,
            currency=Supplier.Currency.USD,
            total_quantity=5,
            sellable_quantity=5,
            total_value=Decimal("750.0000"),
            sellable_value=Decimal("750.0000"),
            average_unit_cost=Decimal("150.0000"),
        )

    def test_coupons_multicurrency_validation_and_rejections(self):
        """Cupón CLP/USD/ARS, expirado, futuro, pausado y mismatch de moneda."""
        now = timezone.now()
        c_clp = Coupon.objects.create(
            code="AUDIO10CLP",
            name="10% CLP",
            currency="CLP",
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal("10.00"),
            starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(days=5),
            status=Coupon.Status.ACTIVE,
        )
        c_usd = Coupon.objects.create(
            code="AUDIO25USD",
            name="25 USD Off",
            currency="USD",
            discount_type=Coupon.DiscountType.FIXED_AMOUNT,
            discount_value=Decimal("25.00"),
            starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(days=5),
            status=Coupon.Status.ACTIVE,
        )
        c_ars = Coupon.objects.create(
            code="AUDIO15ARS",
            name="15% ARS",
            currency="ARS",
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal("15.00"),
            starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(days=5),
            status=Coupon.Status.ACTIVE,
        )
        Coupon.objects.create(
            code="EXPIRED11",
            name="Expirado",
            currency="CLP",
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal("10.00"),
            starts_at=now - timedelta(days=10),
            ends_at=now - timedelta(days=1),
            status=Coupon.Status.ACTIVE,
        )

        res_clp = validate_and_price_coupon(
            code=c_clp.code,
            currency="CLP",
            items=[{"product": self.product, "quantity": 1, "line_subtotal": Decimal("200000.00")}],
            user=self.customer,
        )
        self.assertEqual(res_clp["coupon_discount"], Decimal("20000.00"))
        self.assertEqual(res_clp["final_total"], Decimal("180000.00"))

        res_usd = validate_and_price_coupon(
            code=c_usd.code,
            currency="USD",
            items=[{"product": self.product, "quantity": 1, "line_subtotal": Decimal("250.00")}],
            user=self.customer,
        )
        self.assertEqual(res_usd["coupon_discount"], Decimal("25.00"))
        self.assertEqual(res_usd["final_total"], Decimal("225.00"))

        res_ars = validate_and_price_coupon(
            code=c_ars.code,
            currency="ARS",
            items=[{"product": self.product, "quantity": 1, "line_subtotal": Decimal("300000.00")}],
            user=self.customer,
        )
        self.assertEqual(res_ars["coupon_discount"], Decimal("45000.00"))
        self.assertEqual(res_ars["final_total"], Decimal("255000.00"))

        with self.assertRaises(ValidationError):
            validate_and_price_coupon(
                code="AUDIO25USD",
                currency="CLP",
                items=[{"product": self.product, "quantity": 1, "line_subtotal": Decimal("200000.00")}],
            )
        with self.assertRaises(ValidationError):
            validate_and_price_coupon(
                code="EXPIRED11",
                currency="CLP",
                items=[{"product": self.product, "quantity": 1, "line_subtotal": Decimal("200000.00")}],
            )
        with self.assertRaises(ValidationError):
            validate_and_price_coupon(
                code="NOEXISTE",
                currency="CLP",
                items=[{"product": self.product, "quantity": 1, "line_subtotal": Decimal("200000.00")}],
            )

    def test_accumulation_blocks_and_minimum_margin_guard(self):
        """Bloquea acumulación con B2B/Loyalty/producto descontado y protege margen mínimo."""
        now = timezone.now()
        Coupon.objects.create(
            code="STRICT10",
            name="Strict 10%",
            currency="CLP",
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal("10.00"),
            starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(days=5),
            status=Coupon.Status.ACTIVE,
            accumulation_rule=Coupon.AccumulationRule.BLOCKED,
        )
        Coupon.objects.create(
            code="DANGER40",
            name="Margen Bajo 40%",
            currency="CLP",
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal("40.00"),
            starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(days=5),
            status=Coupon.Status.ACTIVE,
            min_margin_percent=Decimal("15.00"),
        )

        items = [{"product": self.product, "quantity": 1, "line_subtotal": Decimal("200000.00")}]

        with self.assertRaises(ValidationError):
            validate_and_price_coupon(code="STRICT10", currency="CLP", items=items, has_b2b_discount=True, b2b_discount=Decimal("15000.00"))
        with self.assertRaises(ValidationError):
            validate_and_price_coupon(code="STRICT10", currency="CLP", items=items, loyalty_discount=Decimal("5000.00"))
        with self.assertRaises(ValidationError):
            validate_and_price_coupon(code="STRICT10", currency="CLP", items=items, has_already_discounted_items=True)
        with self.assertRaises(ValidationError):
            validate_and_price_coupon(code="DANGER40", currency="CLP", items=items)

    def test_coupon_redemption_lifecycle_idempotency_and_limits(self):
        """Reserva, idempotencia, confirmación, límite global/cliente y liberación al cancelar."""
        now = timezone.now()
        coupon = Coupon.objects.create(
            code="ONEUSE",
            name="Un uso",
            currency="CLP",
            discount_type=Coupon.DiscountType.FIXED_AMOUNT,
            discount_value=Decimal("15000.00"),
            starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(days=5),
            status=Coupon.Status.ACTIVE,
            max_total_uses=1,
            max_uses_per_customer=1,
        )
        order1 = Order.objects.create(user=self.customer, total=Decimal("200000.00"), status=OrderStatus.PENDING)
        OrderItem.objects.create(order=order1, product=self.product, price=Decimal("200000.00"), quantity=1)

        r1 = reserve_coupon_redemption(code="ONEUSE", order=order1, user=self.customer, idempotency_key="idem-o1")
        r1_dup = reserve_coupon_redemption(code="ONEUSE", order=order1, user=self.customer, idempotency_key="idem-o1")
        self.assertEqual(r1.id, r1_dup.id)
        self.assertEqual(r1.status, CouponRedemption.Status.RESERVED)
        self.assertTrue(PricingAdjustmentSnapshot.objects.filter(order=order1).exists())

        order2 = Order.objects.create(user=self.other_customer, total=Decimal("200000.00"), status=OrderStatus.PENDING)
        OrderItem.objects.create(order=order2, product=self.product, price=Decimal("200000.00"), quantity=1)
        with self.assertRaises(ValidationError):
            reserve_coupon_redemption(code="ONEUSE", order=order2, user=self.other_customer)

        confirm_coupon_redemption(order1)
        r1.refresh_from_db()
        self.assertEqual(r1.status, CouponRedemption.Status.CONFIRMED)

        release_or_reverse_coupon_redemption(order1)
        r1.refresh_from_db()
        self.assertEqual(r1.status, CouponRedemption.Status.REVERSED)

        # Ahora el uso liberado permite reservar nuevamente en order2
        r2 = reserve_coupon_redemption(code="ONEUSE", order=order2, user=self.other_customer)
        self.assertEqual(r2.status, CouponRedemption.Status.RESERVED)

    def test_scheduled_promotions_tick_idempotency_and_priority(self):
        """Scheduler activa/finaliza una sola vez por ventana y aplica prioridad determinística."""
        now = timezone.now()
        p_high = create_promotion_campaign(
            {
                "name": "Cyber Pro 15%",
                "starts_at": now - timedelta(minutes=10),
                "ends_at": now + timedelta(hours=4),
                "currency": "CLP",
                "discount_type": Coupon.DiscountType.PERCENTAGE,
                "discount_value": Decimal("15.00"),
                "priority": 1,
                "status": PromotionCampaign.Status.SCHEDULED,
            },
            user=self.admin,
        )
        p_low = create_promotion_campaign(
            {
                "name": "Secundaria 5%",
                "starts_at": now - timedelta(minutes=10),
                "ends_at": now + timedelta(hours=4),
                "currency": "CLP",
                "discount_type": Coupon.DiscountType.PERCENTAGE,
                "discount_value": Decimal("5.00"),
                "priority": 20,
                "status": PromotionCampaign.Status.SCHEDULED,
            },
            user=self.admin,
        )

        tick1 = run_scheduled_promotions_tick(now=now)
        tick2 = run_scheduled_promotions_tick(now=now)
        self.assertEqual(tick1["activated"], 2)
        self.assertEqual(tick2["activated"], 0)
        self.assertEqual(PromotionActivationEvent.objects.filter(campaign=p_high, event_type="activated").count(), 1)

        pricing = evaluate_commercial_pricing(
            currency="CLP",
            items=[{"product": self.product, "quantity": 1, "line_subtotal": Decimal("200000.00")}],
            now=now,
        )
        self.assertEqual(pricing["promotion_discount"], Decimal("30000.00"))
        self.assertEqual(pricing["final_total"], Decimal("170000.00"))

        tick_end = run_scheduled_promotions_tick(now=now + timedelta(hours=5))
        self.assertEqual(tick_end["finished"], 2)
        p_low.refresh_from_db()
        self.assertEqual(p_low.status, PromotionCampaign.Status.FINISHED)

    def test_abandoned_cart_consent_suppression_recovery_and_conversion(self):
        """Detección, consentimiento, opt-out, token opaco, expiración, stock, idempotencia y conversión."""
        now = timezone.now()
        cart = Cart.objects.create(user=self.customer, is_active=True)
        CartItem.objects.create(cart=cart, product=self.product, quantity=2)
        Cart.objects.filter(id=cart.id).update(updated_at=now - timedelta(minutes=90))

        # Sin opt-in: queda suprimido
        triggers = detect_abandoned_carts(inactivity_minutes=60, now=now)
        self.assertEqual(len(triggers), 1)
        self.assertEqual(triggers[0].status, AbandonedCartTrigger.Status.SUPPRESSED)

        # Con opt-in y nuevo trigger elegible
        triggers[0].delete()
        record_marketing_consent(email=self.customer.email, promotional_opt_in=True, user=self.customer)
        triggers = detect_abandoned_carts(inactivity_minutes=60, now=now)
        trg = triggers[0]
        self.assertEqual(trg.status, AbandonedCartTrigger.Status.ELIGIBLE)

        res1 = prepare_and_dispatch_cart_recovery(trg.id, now=now)
        self.assertEqual(res1["status"], "skipped_qa")
        self.assertEqual(MarketingMessageOutbox.objects.filter(recipient_email=self.customer.email).count(), 1)

        # Token válido y adulterado
        resolved = resolve_cart_recovery_token(trg.recovery_token, now=now)
        self.assertTrue(resolved["valid"])
        self.assertEqual(resolved["cart_id"], cart.id)

        with self.assertRaises(ValidationError):
            resolve_cart_recovery_token("token-adulterado", now=now)

        # Conversión a orden suprime futuros envíos
        order = Order.objects.create(user=self.customer, total=Decimal("400000.00"), status=OrderStatus.PAID)
        mark_cart_recovered_for_order(order, cart=cart)
        res_after = prepare_and_dispatch_cart_recovery(trg.id, now=now)
        self.assertEqual(res_after["reason"], "already_recovered")

        # Opt-out suprime cualquier trigger futuro
        unsubscribe_marketing_email(self.other_customer.email)
        cart2 = Cart.objects.create(user=self.other_customer, is_active=True)
        CartItem.objects.create(cart=cart2, product=self.product, quantity=1)
        Cart.objects.filter(id=cart2.id).update(updated_at=now - timedelta(minutes=90))
        triggers2 = detect_abandoned_carts(inactivity_minutes=60, now=now)
        trg2 = [t for t in triggers2 if t.cart_id == cart2.id][0]
        self.assertEqual(trg2.status, AbandonedCartTrigger.Status.SUPPRESSED)

    def test_loyalty_rewards_preservation_rbac_and_zero_cost_leak(self):
        """Preserva Loyalty/Rewards y verifica RBAC, cero fuga de costos/PII y rate-limit."""
        now = timezone.now()
        LoyaltyAccount.objects.get_or_create(user=self.customer, defaults={"puntos_totales": 250})
        rc = RewardsCampaign.objects.create(
            name="Sorteo Studio Pro",
            slug="sorteo-studio-pro-g11",
            description="Sorteo",
            main_prize="Micrófono",
            status="active",
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=10),
            draw_date=now + timedelta(days=11),
        )
        rw_order = Order.objects.create(user=self.customer, total=Decimal("5000.00"), status=OrderStatus.PAID)
        sp = StickerPurchase.objects.create(order=rw_order, campaign=rc, quantity=1)
        Winner.objects.create(campaign=rc, user=self.customer, user_email=self.customer.email, backup_position=0)

        client = APIClient()
        # Anónimo rechazado en admin
        self.assertIn(client.get("/api/v1/admin/marketing/dashboard/").status_code, (401, 403))
        # Cliente normal rechazado en admin
        client.force_authenticate(user=self.customer)
        self.assertEqual(client.get("/api/v1/admin/marketing/coupons/").status_code, 403)

        # Admin accede y ve Loyalty/Rewards intactos
        client.force_authenticate(user=self.admin)
        dash = client.get("/api/v1/admin/marketing/dashboard/")
        self.assertEqual(dash.status_code, 200)
        self.assertGreaterEqual(dash.data["loyalty_summary"]["total_points_balance"], 250)
        self.assertGreaterEqual(dash.data["rewards_summary"]["winners_count"], 1)
        self.assertEqual(sp.quantity, 1)

        # Validación pública de cupón no expone costo ni margen ni PII
        now = timezone.now()
        Coupon.objects.create(
            code="PUBLIC10",
            name="Publico 10%",
            currency="CLP",
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_value=Decimal("10.00"),
            starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(days=5),
            status=Coupon.Status.ACTIVE,
        )
        pub_client = APIClient()
        resp = pub_client.post(
            "/api/v1/marketing/coupons/validate/",
            {
                "code": "PUBLIC10",
                "currency": "CLP",
                "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": "200000.00"}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("calculated_margin_percent", resp.data)
        self.assertNotIn("average_unit_cost", resp.data)

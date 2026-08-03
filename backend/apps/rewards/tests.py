"""
apps/rewards/tests.py — tests unitarios básicos.

Ejecutar:
    cd /app/backend
    DJANGO_SETTINGS_MODULE=config.settings.local python manage.py test apps.rewards -v 2
"""
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model

from apps.products.models import Product, Category
from apps.orders.models   import Order, OrderItem, OrderStatus
from apps.rewards.models  import Campaign, RewardProduct, Entry, Winner, CampaignStatus
from apps.rewards.services import generate_entries_for_order, run_draw, DrawError


User = get_user_model()


class RewardsFlowTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@lp.com", username="test", password="x"
        )
        self.admin = User.objects.create_user(
            email="admin@lp.com", username="admin", password="x", is_staff=True
        )
        cat = Category.objects.create(name="Mics", slug="mics")
        self.product = Product.objects.create(
            name="SM58", slug="sm58", price=Decimal("100000"), stock=10, category=cat
        )
        self.other = Product.objects.create(
            name="Cable XLR", slug="cable-xlr", price=Decimal("15000"), stock=50, category=cat
        )

        now = timezone.now()
        self.campaign = Campaign.objects.create(
            name="Sorteo Test",
            main_prize="Un premio épico",
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=30),
            draw_date=now + timedelta(days=31),
            status=CampaignStatus.ACTIVE,
            backup_winners_count=2,
        )
        self.rp = RewardProduct.objects.create(
            campaign=self.campaign, product=self.product,
            entries_per_purchase=5,
        )

    def _make_paid_order(self, user, product, qty=1):
        order = Order.objects.create(
            user=user, email=user.email,
            shipping_address="dir", total=product.price * qty,
            status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order, product=product, product_name=product.name,
            price=product.price, quantity=qty,
        )
        order.status = OrderStatus.PAID
        order.save()  # dispara signal
        return order

    def test_entries_generated_on_payment(self):
        order = self._make_paid_order(self.user, self.product, qty=2)
        # 5 tickets × 2 unidades = 10 entries
        self.assertEqual(Entry.objects.filter(order=order).count(), 10)

    def test_entries_idempotent(self):
        order = self._make_paid_order(self.user, self.product, qty=1)
        # Simular signal disparado dos veces
        generate_entries_for_order(order)
        generate_entries_for_order(order)
        self.assertEqual(Entry.objects.filter(order=order).count(), 5)

    def test_non_participating_product_no_entries(self):
        order = self._make_paid_order(self.user, self.other, qty=3)
        self.assertEqual(Entry.objects.filter(order=order).count(), 0)

    def test_unique_codes(self):
        self._make_paid_order(self.user, self.product, qty=3)
        codes = list(Entry.objects.values_list("unique_code", flat=True))
        self.assertEqual(len(codes), len(set(codes)))
        for c in codes:
            self.assertTrue(c.startswith("LPR-"))

    def test_draw_generates_winner_and_backups(self):
        # Crear varios usuarios y participaciones
        users = [self.user]
        for i in range(4):
            u = User.objects.create_user(
                email=f"u{i}@lp.com", username=f"u{i}", password="x"
            )
            users.append(u)
            self._make_paid_order(u, self.product, qty=1)
        self._make_paid_order(self.user, self.product, qty=1)

        winners = run_draw(self.campaign, self.admin)
        # 1 principal + 2 suplentes = 3
        self.assertEqual(len(winners), 3)
        self.assertFalse(winners[0].is_backup)
        self.assertTrue(winners[1].is_backup)
        self.assertEqual(winners[1].backup_position, 1)
        self.assertEqual(winners[2].backup_position, 2)

        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, CampaignStatus.FINISHED)
        self.assertIsNotNone(self.campaign.drawn_at)
        self.assertEqual(self.campaign.drawn_by, self.admin)

    def test_draw_cannot_repeat(self):
        self._make_paid_order(self.user, self.product, qty=1)
        run_draw(self.campaign, self.admin)
        with self.assertRaises(DrawError):
            run_draw(self.campaign, self.admin)

    def test_draw_requires_entries(self):
        with self.assertRaises(DrawError):
            run_draw(self.campaign, self.admin)


class RewardEntriesMixedFlowTest(TestCase):
    """
    Cobertura del fix: antes, comprar un producto participante NUNCA
    generaba entries — solo la compra de stickers funcionaba, a pesar
    de que el modelo, el admin y hasta un endpoint de preview para el
    carrito ya existían para "productos participantes". Estos tests
    cubren el camino que antes estaba completamente roto, más el caso
    de una orden que dispara ambos caminos a la vez.
    """
    def setUp(self):
        self.user = User.objects.create_user(email="mixed@lp.com", username="mixed", password="x")
        cat = Category.objects.create(name="Mics", slug="mics-mixed")
        self.product = Product.objects.create(
            name="SM7B", slug="sm7b-mixed", price=Decimal("100000"), stock=10, category=cat
        )
        now = timezone.now()
        self.campaign = Campaign.objects.create(
            name="Sorteo Mixto", main_prize="Premio",
            start_date=now - timedelta(days=1), end_date=now + timedelta(days=30),
            draw_date=now + timedelta(days=31), status=CampaignStatus.ACTIVE,
        )
        self.rp = RewardProduct.objects.create(
            campaign=self.campaign, product=self.product, entries_per_purchase=3,
        )

    def test_order_with_both_sticker_and_product_generates_both(self):
        from apps.rewards.models import StickerPurchase

        order = Order.objects.create(
            user=self.user, email=self.user.email, shipping_address="dir",
            total=Decimal("100000") + self.campaign.sticker_price,
            status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order, product=self.product, product_name=self.product.name,
            price=self.product.price, quantity=1,
        )
        StickerPurchase.objects.create(order=order, campaign=self.campaign, quantity=2)

        order.status = OrderStatus.PAID
        order.save()

        # 3 (producto participante) + 2 (stickers) = 5
        self.assertEqual(Entry.objects.filter(order=order).count(), 5)
        self.assertEqual(Entry.objects.filter(order=order, product=self.product).count(), 3)
        self.assertEqual(Entry.objects.filter(order=order, product__isnull=True).count(), 2)

    def test_expired_campaign_does_not_generate_entries(self):
        """El producto participa en una campaña cuyo end_date ya pasó —
        no debería generar entries aunque status siga en 'active'."""
        now = timezone.now()
        self.campaign.end_date = now - timedelta(days=1)
        self.campaign.save(update_fields=["end_date"])

        order = Order.objects.create(
            user=self.user, email=self.user.email, shipping_address="dir",
            total=self.product.price, status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order, product=self.product, product_name=self.product.name,
            price=self.product.price, quantity=1,
        )
        order.status = OrderStatus.PAID
        order.save()

        self.assertEqual(Entry.objects.filter(order=order).count(), 0)

    def test_inactive_reward_product_does_not_generate_entries(self):
        self.rp.is_active = False
        self.rp.save(update_fields=["is_active"])

        order = Order.objects.create(
            user=self.user, email=self.user.email, shipping_address="dir",
            total=self.product.price, status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order, product=self.product, product_name=self.product.name,
            price=self.product.price, quantity=1,
        )
        order.status = OrderStatus.PAID
        order.save()

        self.assertEqual(Entry.objects.filter(order=order).count(), 0)

    def test_product_in_two_active_campaigns_generates_entries_for_both(self):
        now = timezone.now()
        campaign2 = Campaign.objects.create(
            name="Sorteo Mixto 2", main_prize="Otro premio",
            start_date=now - timedelta(days=1), end_date=now + timedelta(days=30),
            draw_date=now + timedelta(days=31), status=CampaignStatus.ACTIVE,
        )
        RewardProduct.objects.create(
            campaign=campaign2, product=self.product, entries_per_purchase=2,
        )

        order = Order.objects.create(
            user=self.user, email=self.user.email, shipping_address="dir",
            total=self.product.price, status=OrderStatus.PENDING,
        )
        OrderItem.objects.create(
            order=order, product=self.product, product_name=self.product.name,
            price=self.product.price, quantity=1,
        )
        order.status = OrderStatus.PAID
        order.save()

        self.assertEqual(Entry.objects.filter(order=order, campaign=self.campaign).count(), 3)
        self.assertEqual(Entry.objects.filter(order=order, campaign=campaign2).count(), 2)

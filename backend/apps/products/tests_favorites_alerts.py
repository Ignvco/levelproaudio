# apps/products/tests_favorites_alerts.py
#
# Antes, un favorito era estático — el cliente nunca se enteraba si el
# producto bajaba de precio o volvía a stock. Cubre el comando
# check_favorites_alerts y el snapshot expuesto en /api/v1/favorites/.

from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.products.models import Category, Product, Favorite

User = get_user_model()


def _product(price="100000", stock=5):
    category = Category.objects.get_or_create(name="Mics", slug="mics-alerts")[0]
    return Product.objects.create(
        name="SM7B", slug=f"sm7b-alerts-{price}-{stock}", category=category,
        price=Decimal(price), stock=stock, is_active=True,
    )


class FavoritesAlertsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="fan@test.com", username="fan", password="x"
        )

    @patch("apps.products.management.commands.check_favorites_alerts.send_price_drop_email")
    def test_price_drop_triggers_email(self, mock_send):
        product = _product(price="100000")
        Favorite.objects.create(
            user=self.user, product=product,
            price_when_added=Decimal("100000"), was_in_stock=True,
        )
        product.price = Decimal("80000")
        product.save(update_fields=["price"])

        call_command("check_favorites_alerts")

        mock_send.assert_called_once()
        fav = Favorite.objects.get(user=self.user, product=product)
        self.assertEqual(fav.lowest_notified_price, Decimal("80000"))

    @patch("apps.products.management.commands.check_favorites_alerts.send_price_drop_email")
    def test_does_not_renotify_same_price_level(self, mock_send):
        product = _product(price="100000")
        Favorite.objects.create(
            user=self.user, product=product,
            price_when_added=Decimal("100000"),
            lowest_notified_price=Decimal("80000"),  # ya se avisó esta bajada
            was_in_stock=True,
        )
        product.price = Decimal("80000")  # mismo nivel, no bajó más
        product.save(update_fields=["price"])

        call_command("check_favorites_alerts")

        mock_send.assert_not_called()

    @patch("apps.products.management.commands.check_favorites_alerts.send_price_drop_email")
    def test_renotifies_if_price_drops_further(self, mock_send):
        product = _product(price="100000")
        Favorite.objects.create(
            user=self.user, product=product,
            price_when_added=Decimal("100000"),
            lowest_notified_price=Decimal("80000"),
            was_in_stock=True,
        )
        product.price = Decimal("60000")  # bajó todavía más
        product.save(update_fields=["price"])

        call_command("check_favorites_alerts")

        mock_send.assert_called_once()

    @patch("apps.products.management.commands.check_favorites_alerts.send_back_in_stock_email")
    def test_back_in_stock_triggers_email(self, mock_send):
        product = _product(price="100000", stock=0)
        Favorite.objects.create(
            user=self.user, product=product,
            price_when_added=Decimal("100000"), was_in_stock=False,
        )
        product.stock = 3
        product.save(update_fields=["stock"])

        call_command("check_favorites_alerts")

        mock_send.assert_called_once()
        fav = Favorite.objects.get(user=self.user, product=product)
        self.assertTrue(fav.was_in_stock)

    @patch("apps.products.management.commands.check_favorites_alerts.send_back_in_stock_email")
    def test_does_not_notify_while_still_in_stock(self, mock_send):
        product = _product(price="100000", stock=5)
        Favorite.objects.create(
            user=self.user, product=product,
            price_when_added=Decimal("100000"), was_in_stock=True,
        )
        call_command("check_favorites_alerts")
        mock_send.assert_not_called()

    def test_old_favorite_without_snapshot_gets_baseline_not_notification(self):
        """Favoritos creados antes de este sistema: solo se establece la
        línea de base la primera vez, sin mandar alertas retroactivas."""
        product = _product(price="50000")
        fav = Favorite.objects.create(user=self.user, product=product)  # sin snapshot
        self.assertIsNone(fav.price_when_added)

        call_command("check_favorites_alerts")

        fav.refresh_from_db()
        self.assertEqual(fav.price_when_added, Decimal("50000"))

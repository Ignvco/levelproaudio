# apps/loyalty/tests_expiration.py
#
# Tests del comando expire_loyalty_points: antes no existía ningún
# mecanismo que hiciera vencer puntos de verdad, aunque la config lo
# prometía. Estos tests cubren el algoritmo FIFO y su idempotencia.

from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.loyalty.models import LoyaltyAccount, LoyaltyConfig, LoyaltyTransaction

User = get_user_model()


class ExpireLoyaltyPointsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="exp@test.com", username="exp", password="x"
        )
        self.account = LoyaltyAccount.objects.create(user=self.user)
        config = LoyaltyConfig.get()
        config.expiracion_dias = 365
        config.save(update_fields=["expiracion_dias"])

    def _earn(self, puntos, days_ago):
        """Crea una transacción 'earn' con fecha en el pasado (bypassea auto_now_add)."""
        tx = LoyaltyTransaction.objects.create(
            account=self.account, tipo="earn", puntos=puntos, descripcion="test",
        )
        LoyaltyTransaction.objects.filter(pk=tx.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )
        self.account.puntos_totales += puntos
        self.account.save(update_fields=["puntos_totales"])

    def test_expires_old_unredeemed_points(self):
        self._earn(1000, days_ago=400)  # más viejo que expiracion_dias=365
        call_command("expire_loyalty_points")
        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_expirados, 1000)
        self.assertEqual(self.account.puntos_disponibles, 0)

    def test_does_not_expire_recent_points(self):
        self._earn(1000, days_ago=10)  # reciente, no debería vencer
        call_command("expire_loyalty_points")
        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_expirados, 0)
        self.assertEqual(self.account.puntos_disponibles, 1000)

    def test_already_redeemed_points_are_not_double_counted(self):
        """Si ya canjeó los puntos viejos, no deben expirar de nuevo (ya no existen)."""
        self._earn(1000, days_ago=400)
        self.account.canjear_puntos(600, descripcion="test redeem")
        call_command("expire_loyalty_points")
        self.account.refresh_from_db()
        # Solo deberían expirar los 400 puntos viejos que quedaban sin gastar.
        self.assertEqual(self.account.puntos_expirados, 400)
        self.assertEqual(self.account.puntos_disponibles, 0)

    def test_idempotent_running_twice_does_not_double_expire(self):
        self._earn(1000, days_ago=400)
        call_command("expire_loyalty_points")
        call_command("expire_loyalty_points")  # correrlo de nuevo no debe restar más
        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_expirados, 1000)

    def test_dry_run_does_not_modify_data(self):
        self._earn(1000, days_ago=400)
        out = StringIO()
        call_command("expire_loyalty_points", "--dry-run", stdout=out)
        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_expirados, 0)
        self.assertIn("dry-run", out.getvalue())

    def test_zero_expiracion_dias_disables_expiration(self):
        config = LoyaltyConfig.get()
        config.expiracion_dias = 0
        config.save(update_fields=["expiracion_dias"])
        self._earn(1000, days_ago=5000)
        call_command("expire_loyalty_points")
        self.account.refresh_from_db()
        self.assertEqual(self.account.puntos_expirados, 0)

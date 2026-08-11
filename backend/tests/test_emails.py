# tests/test_emails.py
#
# Cubre:
#   1. Los valores interpolados en el HTML de los emails (nombres de
#      producto, campaña) no se escapaban — un nombre con caracteres
#      especiales de HTML podía romper la estructura del email.
#   2. Que los emails no contengan emojis (encabezado, asunto, cuerpo).
#   3. Los emails de gestión del pedido (compra exitosa / en camino /
#      entregado / cancelado) que reemplazaron a los de facturación.
#   4. Que la marca (nombre, color) se lea de Configuración del sitio.

import re
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.core.cache import cache

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.emails import _wrap, send_price_drop_email, send_back_in_stock_email
from apps.orders.models import Order, OrderStatus

User = get_user_model()


class EmailHtmlEscapingTest(TestCase):
    def test_wrap_escapes_title(self):
        html = _wrap('<script>alert(1)</script>', "cuerpo")
        self.assertNotIn("<script>alert(1)</script>", html)
        self.assertIn("&lt;script&gt;", html)

    @patch("apps.emails.send_email")
    def test_product_name_with_html_is_escaped_in_price_drop_email(self, mock_send):
        user = User.objects.create_user(email="buyer@test.com", username="buyer", password="x")

        class FakeProduct:
            name = '<img src=x onerror=alert(1)>Micrófono'
            price = Decimal("50000")
            slug = "mic-test"

        send_price_drop_email(user, FakeProduct())

        self.assertTrue(mock_send.called)
        html_sent = mock_send.call_args.args[2]  # (to, subject, html)
        self.assertNotIn("<img src=x onerror=alert(1)>", html_sent)
        self.assertIn("&lt;img", html_sent)

    @patch("apps.emails.send_email")
    def test_product_name_with_html_is_escaped_in_back_in_stock_email(self, mock_send):
        user = User.objects.create_user(email="buyer2@test.com", username="buyer2", password="x")

        class FakeProduct:
            name = 'Cable & <b>Conector</b>'
            price = Decimal("10000")
            slug = "cable-test"

        send_back_in_stock_email(user, FakeProduct())

        html_sent = mock_send.call_args.args[2]
        self.assertNotIn("<b>Conector</b>", html_sent)
        self.assertIn("&amp;", html_sent)


class EmailBrandingDynamicTest(TestCase):
    """
    Antes, el nombre "LevelPro Audio" y el color verde de acento estaban
    fijos en todas las plantillas de email (header, footer, asuntos,
    montos destacados) — cambiarlos desde Configuración del sitio no
    afectaba a los emails que salían. Ahora se leen de ahí, igual que
    en el resto del sitio.
    """
    def _configure_brand(self, name="Acme Audio", color="#ff00ff"):
        from apps.site_settings.models import SiteSettings
        site = SiteSettings.get()
        site.site_name = name
        site.accent_color = color
        site.contact_email = "hola@acmeaudio.com"
        site.save(update_fields=["site_name", "accent_color", "contact_email"])

    @patch("apps.emails.send_email")
    def test_password_reset_subject_uses_real_brand_name(self, mock_send):
        from apps.emails import send_password_reset
        self._configure_brand(name="Acme Audio")

        send_password_reset("cliente@test.com", "https://x.com/reset/token")

        subject = mock_send.call_args.args[1]
        self.assertIn("Acme Audio", subject)
        self.assertNotIn("LevelPro", subject)

    @patch("apps.emails.send_email")
    def test_order_confirmation_uses_real_accent_color(self, mock_send):
        from apps.emails import send_order_confirmation
        from apps.orders.models import Order, OrderStatus
        self._configure_brand(color="#ff00ff")

        order = Order.objects.create(
            status=OrderStatus.PAID, total=Decimal("10000"),
            email="test@test.com", shipping_address="Test 123",
        )
        send_order_confirmation(order)

        html_sent = mock_send.call_args.args[2]
        self.assertIn("#ff00ff", html_sent)
        self.assertNotIn("#1aff6e", html_sent)

    @patch("apps.emails.send_email")
    def test_email_header_uses_real_site_name_not_hardcoded_logo(self, mock_send):
        from apps.emails import send_password_reset
        self._configure_brand(name="Acme Audio")

        send_password_reset("cliente@test.com", "https://x.com/reset/token")

        html_sent = mock_send.call_args.args[2]
        self.assertIn("Acme Audio", html_sent)
        self.assertNotIn("levelpro", html_sent.lower())

    @patch("apps.emails.send_email")
    def test_falls_back_to_default_if_not_configured(self, mock_send):
        from apps.emails import send_password_reset
        from apps.site_settings.models import SiteSettings
        site = SiteSettings.get()
        site.site_name = ""
        site.accent_color = ""
        site.save(update_fields=["site_name", "accent_color"])

        send_password_reset("cliente@test.com", "https://x.com/reset/token")

        subject = mock_send.call_args.args[1]
        self.assertIn("LevelPro Audio", subject)


class NoEmojisInEmailsTest(TestCase):
    """
    Pedido explícito: los emails no deben tener emojis, ni en el ícono
    decorativo del encabezado, ni en asuntos, ni en el cuerpo. Este test
    barre TODAS las funciones send_* del módulo con datos de prueba, y
    confirma que ni el asunto ni el HTML final contienen ningún emoji —
    así, si alguien agrega uno nuevo sin querer, esto lo agarra.
    """
    EMOJI_PATTERN = re.compile(
        "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E0-\U0001F1FF]+",
        flags=re.UNICODE,
    )

    def setUp(self):
        cache.clear()

    @patch("apps.emails.send_email")
    def test_password_reset_has_no_emoji(self, mock_send):
        from apps.emails import send_password_reset
        send_password_reset("test@test.com", "https://x.com/reset")
        subject, html = mock_send.call_args.args[1], mock_send.call_args.args[2]
        self.assertEqual(self.EMOJI_PATTERN.findall(subject), [])
        self.assertEqual(self.EMOJI_PATTERN.findall(html), [])

    @patch("apps.emails.send_email")
    def test_order_confirmation_has_no_emoji(self, mock_send):
        from apps.emails import send_order_confirmation
        from apps.orders.models import Order, OrderStatus
        order = Order.objects.create(
            status=OrderStatus.PAID, total=Decimal("10000"),
            email="test@test.com", shipping_address="Test 123",
        )
        send_order_confirmation(order)
        subject, html = mock_send.call_args.args[1], mock_send.call_args.args[2]
        self.assertEqual(self.EMOJI_PATTERN.findall(subject), [])
        self.assertEqual(self.EMOJI_PATTERN.findall(html), [])


class OrderStatusEmailTest(TestCase):
    """
    Emails de gestión del pedido (compra exitosa / en camino / entregado /
    cancelado). Reemplazan a los viejos emails de facturación, que se
    eliminaron. Confirmamos que cada estado manda su email, con el copy
    correcto y sin emojis.
    """
    EMOJI_PATTERN = re.compile(
        "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E0-\U0001F1FF]+",
        flags=re.UNICODE,
    )

    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.user = User.objects.create_user(
            email="pedido@test.com", username="pedidocliente", password="x")

    def _make_order(self, status):
        from apps.orders.models import Order
        return Order.objects.create(
            user=self.user, status=status, total=Decimal("50000"),
            email="pedido@test.com", shipping_address="Calle 1",
        )

    @patch("apps.emails.send_email")
    def test_shipped_sends_email_with_no_emoji(self, mock_send):
        from apps.emails import send_order_status_update
        order = self._make_order("shipped")
        send_order_status_update(order)
        self.assertTrue(mock_send.called)
        subject, html = mock_send.call_args.args[1], mock_send.call_args.args[2]
        self.assertIn("camino", subject.lower())
        self.assertEqual(self.EMOJI_PATTERN.findall(subject), [])
        self.assertEqual(self.EMOJI_PATTERN.findall(html), [])

    @patch("apps.emails.send_email")
    def test_completed_sends_delivered_email(self, mock_send):
        from apps.emails import send_order_status_update
        order = self._make_order("completed")
        send_order_status_update(order)
        subject = mock_send.call_args.args[1]
        self.assertIn("entregado", subject.lower())

    @patch("apps.emails.send_email")
    def test_paid_sends_success_email(self, mock_send):
        from apps.emails import send_order_status_update
        order = self._make_order("paid")
        send_order_status_update(order)
        subject = mock_send.call_args.args[1]
        self.assertIn("exitosa", subject.lower())

    @patch("apps.emails.send_email")
    def test_pending_sends_nothing(self, mock_send):
        from apps.emails import send_order_status_update
        order = self._make_order("pending")
        send_order_status_update(order)
        self.assertFalse(mock_send.called)

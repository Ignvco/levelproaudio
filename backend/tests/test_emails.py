# tests/test_emails.py
#
# Cubre dos hallazgos de la auditoría de apps/emails.py:
#   1. Los valores interpolados en el HTML de los emails (nombres de
#      producto, campaña) no se escapaban — un nombre con caracteres
#      especiales de HTML podía romper la estructura del email.
#   2. send_document_email (boletas/facturas) usaba django.core.mail
#      directo, que SIEMPRE usa el backend de consola en este proyecto
#      (nunca se sobreescribe a un backend real en producción) — el
#      admin veía "enviado" pero el cliente nunca recibía nada. Ahora
#      pasa por el mismo canal (Resend) que el resto de los emails.

from decimal import Decimal
from unittest.mock import patch, MagicMock

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


class DocumentEmailUsesRealChannelTest(TestCase):
    """
    Antes, send_document_email (boletas/facturas) usaba
    django.core.mail.EmailMessage directo — bypaseando por completo el
    helper apps.emails.send_email (el que sí usa Resend). Como
    EMAIL_BACKEND nunca se sobreescribe a un backend real en producción,
    ese email nunca llegaba, pero el documento igual quedaba marcado
    como ENVIADO.
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(email="billingadmin@test.com", username="billingadmin", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _make_doc(self):
        from apps.billing.models import TributaryDocument
        order = Order.objects.create(
            status=OrderStatus.PAID, total=Decimal("50000"),
            email="cliente@test.com", shipping_address="Test 123",
        )
        return TributaryDocument.objects.create(
            order=order, tipo="boleta", numero=1001, folio="1001",
            neto=Decimal("42017"), iva=Decimal("7983"), total=Decimal("50000"),
            receptor_email="cliente@test.com",
        )

    @patch("apps.emails.send_email")
    def test_send_document_email_uses_centralized_send_email_helper(self, mock_send):
        """Confirma que ahora pasa por apps.emails.send_email (Resend),
        no por django.core.mail directo."""
        mock_send.return_value = True
        doc = self._make_doc()

        resp = self.client.post(f"/api/v1/billing/send/{doc.id}/")

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(mock_send.called)
        doc.refresh_from_db()
        self.assertEqual(doc.estado, "enviado")

    @patch("apps.emails.send_email")
    def test_document_not_marked_sent_if_email_actually_fails(self, mock_send):
        """El bug real: antes se marcaba ENVIADO sin importar si el envío
        funcionó de verdad. Ahora, si send_email devuelve False (falló),
        el documento NO se marca como enviado."""
        mock_send.return_value = False
        doc = self._make_doc()

        resp = self.client.post(f"/api/v1/billing/send/{doc.id}/")

        self.assertEqual(resp.status_code, 502)
        doc.refresh_from_db()
        self.assertNotEqual(doc.estado, "enviado")


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
        site.save(update_fields=["site_name", "accent_color"])

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

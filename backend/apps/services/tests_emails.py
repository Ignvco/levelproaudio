# apps/services/tests_emails.py
#
# Antes, agendar un servicio, reservar un turno, y que te lo confirmen
# solo se veía dentro de la plataforma — nunca se mandaba ningún email,
# a diferencia de las compras de productos. Confirma que ahora sí, en
# cada uno de los 5 eventos del ciclo de vida.

from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.services.models import Service, ServiceCategory, Booking, ServiceRequest

User = get_user_model()


class ServiceEmailsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="cliente@test.com", username="clienteemail", password="x")
        self.admin = User.objects.create_superuser(email="svcadmin2@test.com", username="svcadmin2", password="x")
        self.client = APIClient()
        cat = ServiceCategory.objects.create(name="Mezcla", slug="mezcla-email")
        self.service = Service.objects.create(
            name="Mezcla y mastering", slug="mezcla-mastering-email", category=cat,
            description="Test", price_type=Service.PriceType.FIXED, price=50000,
        )

    # ── Reserva ──────────────────────────────────────────────
    @patch("apps.emails.send_email")
    def test_booking_created_sends_email(self, mock_send):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/v1/bookings/", {
            "service": str(self.service.id),
            "scheduled_date": (timezone.now() + timedelta(days=3)).isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        mock_send.assert_called_once()
        self.assertEqual(mock_send.call_args.args[0], "cliente@test.com")
        self.assertIn("reserva", mock_send.call_args.args[1].lower())

    @patch("apps.emails.send_email")
    def test_booking_confirmed_sends_email(self, mock_send):
        booking = Booking.objects.create(
            user=self.user, service=self.service,
            scheduled_date=timezone.now() + timedelta(days=3),
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(f"/api/v1/admin/bookings/{booking.id}/status/", {"status": "confirmed"}, format="json")
        self.assertEqual(resp.status_code, 200)
        mock_send.assert_called_once()
        self.assertIn("confirmada", mock_send.call_args.args[1].lower())

    @patch("apps.emails.send_email")
    def test_booking_confirmed_twice_does_not_duplicate_email(self, mock_send):
        """Si el admin re-guarda el mismo estado, no debería repetir el email."""
        booking = Booking.objects.create(
            user=self.user, service=self.service,
            scheduled_date=timezone.now() + timedelta(days=3),
            status="confirmed",
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(f"/api/v1/admin/bookings/{booking.id}/status/", {"status": "confirmed"}, format="json")
        self.assertEqual(resp.status_code, 200)
        mock_send.assert_not_called()

    @patch("apps.emails.send_email")
    def test_booking_cancelled_sends_email(self, mock_send):
        booking = Booking.objects.create(
            user=self.user, service=self.service,
            scheduled_date=timezone.now() + timedelta(days=3),
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(f"/api/v1/admin/bookings/{booking.id}/status/", {"status": "cancelled"}, format="json")
        self.assertEqual(resp.status_code, 200)
        mock_send.assert_called_once()
        self.assertIn("cancelada", mock_send.call_args.args[1].lower())

    # ── Solicitud ────────────────────────────────────────────
    @patch("apps.emails.send_email")
    def test_service_request_created_sends_email(self, mock_send):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/v1/service-requests/", {
            "service": str(self.service.id),
            "message": "Quisiera cotizar una mezcla completa.",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        mock_send.assert_called_once()
        self.assertIn("solicitud", mock_send.call_args.args[1].lower())

    @patch("apps.emails.send_email")
    def test_service_request_accepted_sends_email(self, mock_send):
        sr = ServiceRequest.objects.create(
            user=self.user, service=self.service, message="Test",
            email="cliente@test.com",
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(f"/api/v1/admin/requests/{sr.id}/status/", {"status": "accepted"}, format="json")
        self.assertEqual(resp.status_code, 200)
        mock_send.assert_called_once()
        self.assertIn("aceptada", mock_send.call_args.args[1].lower())

    @patch("apps.emails.send_email")
    def test_service_request_same_status_does_not_duplicate_email(self, mock_send):
        sr = ServiceRequest.objects.create(
            user=self.user, service=self.service, message="Test",
            email="cliente@test.com", status="contacted",
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(f"/api/v1/admin/requests/{sr.id}/status/", {"status": "contacted"}, format="json")
        self.assertEqual(resp.status_code, 200)
        mock_send.assert_not_called()

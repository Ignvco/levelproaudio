# apps/services/tests.py
#
# Antes: price_type se guardaba sin validar (mismo tipo de riesgo que
# rompió Productos con product_type), y duration_hours con basura tiraba
# un 500 crudo en vez de un 400 con mensaje claro.

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.services.models import Service

User = get_user_model()


class AdminServiceValidationTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(email="svcadmin@test.com", username="svcadmin", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_create_service_with_valid_price_type_succeeds(self):
        for ptype in ["fixed", "quote", "hourly", "project"]:
            resp = self.client.post("/api/v1/admin/services/list/", {
                "name": f"Servicio {ptype}", "price_type": ptype, "price": "50000",
            }, format="json")
            self.assertEqual(resp.status_code, 201, resp.data)

    def test_create_service_with_invalid_price_type_rejected(self):
        resp = self.client.post("/api/v1/admin/services/list/", {
            "name": "Servicio roto", "price_type": "invalido",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Service.objects.filter(name="Servicio roto").exists())

    def test_update_service_with_invalid_price_type_rejected(self):
        service = Service.objects.create(name="Original", price_type="quote", description="x")
        resp = self.client.patch(f"/api/v1/admin/services/{service.id}/", {
            "price_type": "invalido",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        service.refresh_from_db()
        self.assertEqual(service.price_type, "quote")  # no cambió

    def test_create_service_with_garbage_duration_hours_returns_clean_400(self):
        resp = self.client.post("/api/v1/admin/services/list/", {
            "name": "Servicio duración rota", "price_type": "quote",
            "duration_hours": "no-es-un-numero",
        }, format="json")
        self.assertEqual(resp.status_code, 400)  # no un 500 crudo
        self.assertIn("error", resp.data)

    def test_update_service_with_garbage_duration_hours_returns_clean_400(self):
        service = Service.objects.create(name="Original2", price_type="quote", description="x")
        resp = self.client.patch(f"/api/v1/admin/services/{service.id}/", {
            "duration_hours": "abc",
        }, format="json")
        self.assertEqual(resp.status_code, 400)


class AdminBookingsTest(TestCase):
    """
    Antes no existía ningún endpoint para que el admin viera TODAS las
    reservas (solo podía actualizar el estado si ya conocía el ID).
    Cubre el listado nuevo, la validación de estado, y que confirmar/
    cancelar registre confirmed_at/cancelled_at (antes no lo hacía).
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(email="bkadmin@test.com", username="bkadmin", password="x")
        self.customer = User.objects.create_user(email="bkcustomer@test.com", username="bkcustomer", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.service = Service.objects.create(name="Mezcla en vivo", price_type="hourly", description="x")

    def _booking(self, status="pending"):
        from apps.services.models import Booking
        from django.utils import timezone
        return Booking.objects.create(
            user=self.customer, service=self.service,
            scheduled_date=timezone.now(), status=status,
        )

    def test_admin_can_list_all_bookings(self):
        self._booking()
        self._booking()
        resp = self.client.get("/api/v1/admin/bookings/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 2)

    def test_admin_can_filter_bookings_by_status(self):
        self._booking(status="pending")
        self._booking(status="confirmed")
        resp = self.client.get("/api/v1/admin/bookings/?status=confirmed")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_confirming_booking_sets_confirmed_at(self):
        booking = self._booking()
        self.assertIsNone(booking.confirmed_at)
        resp = self.client.patch(f"/api/v1/admin/bookings/{booking.id}/status/", {
            "status": "confirmed",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        booking.refresh_from_db()
        self.assertIsNotNone(booking.confirmed_at)

    def test_cancelling_booking_sets_cancelled_at(self):
        booking = self._booking()
        resp = self.client.patch(f"/api/v1/admin/bookings/{booking.id}/status/", {
            "status": "cancelled",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        booking.refresh_from_db()
        self.assertIsNotNone(booking.cancelled_at)

    def test_invalid_status_rejected(self):
        booking = self._booking()
        resp = self.client.patch(f"/api/v1/admin/bookings/{booking.id}/status/", {
            "status": "no-existe",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        booking.refresh_from_db()
        self.assertEqual(booking.status, "pending")  # no cambió

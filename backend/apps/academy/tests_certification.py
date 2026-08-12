# apps/academy/tests_certification.py
#
# Ruta de certificación LevelPro: un conjunto de cursos que, al
# completarse TODOS, otorgan el sello "Profesional Certificado". El
# corazón de la lógica es "todos o nada" — completar 2 de 3 cursos NO
# da la certificación.

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academy.models import Course, Enrollment, CertificationPath

User = get_user_model()


class CertificationPathTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="cert@test.com", username="certuser", password="x")
        self.c1 = Course.objects.create(title="Fundamentos PA", slug="fund-pa", is_published=True)
        self.c2 = Course.objects.create(title="Line Arrays", slug="line-arrays", is_published=True)
        self.c3 = Course.objects.create(title="Sistemas en Vivo", slug="sist-vivo", is_published=True)

        self.path = CertificationPath.objects.create(
            title="Certificación en Sonido en Vivo",
            seal_label="Profesional Certificado en Sonido en Vivo",
            is_published=True,
        )
        self.path.courses.set([self.c1, self.c2, self.c3])
        self.client = APIClient()

    def _complete(self, course):
        Enrollment.objects.create(
            user=self.user, course=course, completed_at=timezone.now())

    def test_not_completed_with_zero_courses_done(self):
        self.assertFalse(self.path.is_completed_by(self.user))

    def test_not_completed_with_partial_courses(self):
        self._complete(self.c1)
        self._complete(self.c2)
        self.assertFalse(self.path.is_completed_by(self.user))  # falta c3

    def test_completed_with_all_courses(self):
        self._complete(self.c1)
        self._complete(self.c2)
        self._complete(self.c3)
        self.assertTrue(self.path.is_completed_by(self.user))

    def test_enrollment_without_completed_at_does_not_count(self):
        """Estar inscrito no basta — tiene que estar completado."""
        Enrollment.objects.create(user=self.user, course=self.c1)  # sin completed_at
        self._complete(self.c2)
        self._complete(self.c3)
        self.assertFalse(self.path.is_completed_by(self.user))

    def test_completion_for_returns_progress(self):
        self._complete(self.c1)
        self.assertEqual(self.path.completion_for(self.user), (1, 3))

    def test_empty_path_never_completed(self):
        empty = CertificationPath.objects.create(title="Vacía", slug="vacia", is_published=True)
        self.assertFalse(empty.is_completed_by(self.user))

    def test_certificate_endpoint_blocks_incomplete(self):
        self.client.force_authenticate(user=self.user)
        self._complete(self.c1)  # solo 1 de 3
        resp = self.client.get(f"/api/v1/certifications/{self.path.slug}/certificate/")
        self.assertEqual(resp.status_code, 400)

    def test_certificate_endpoint_returns_pdf_when_complete(self):
        self.client.force_authenticate(user=self.user)
        self._complete(self.c1)
        self._complete(self.c2)
        self._complete(self.c3)
        resp = self.client.get(f"/api/v1/certifications/{self.path.slug}/certificate/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")

    def test_certificate_endpoint_requires_auth(self):
        resp = self.client.get(f"/api/v1/certifications/{self.path.slug}/certificate/")
        self.assertIn(resp.status_code, (401, 403))

    def test_list_only_shows_published(self):
        CertificationPath.objects.create(title="Borrador", slug="borrador", is_published=False)
        resp = self.client.get("/api/v1/certifications/")
        self.assertEqual(resp.status_code, 200)
        slugs = [p["slug"] for p in resp.data["results"]] if "results" in resp.data else [p["slug"] for p in resp.data]
        self.assertIn("certificacion-en-sonido-en-vivo", slugs)
        self.assertNotIn("borrador", slugs)

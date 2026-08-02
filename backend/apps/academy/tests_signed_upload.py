# apps/academy/tests_signed_upload.py
#
# El endpoint que genera la URL firmada para subir video directo a GCS
# (sin pasar por Cloud Run, que tiene un límite duro de 32MB). No se
# puede probar contra GCS real desde tests unitarios, así que se
# mockean google.cloud.storage y google.auth — lo que sí se valida de
# verdad es: la validación de extensión, el formato de la respuesta,
# y que un usuario no-admin no pueda pedir la URL.

from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

User = get_user_model()


class LessonVideoUploadUrlTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(email="videoadmin@test.com", username="videoadmin", password="x")
        self.regular = User.objects.create_user(email="regular@test.com", username="regular", password="x")
        self.client = APIClient()

    @override_settings(GS_BUCKET_NAME="fake-bucket-test")
    @patch("google.auth.default")
    @patch("google.cloud.storage.Client")
    def test_admin_gets_signed_upload_url(self, mock_client_cls, mock_auth_default):
        mock_blob = MagicMock()
        mock_blob.generate_signed_url.return_value = "https://storage.googleapis.com/fake-signed-url"
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_client_cls.return_value.bucket.return_value = mock_bucket

        mock_creds = MagicMock()
        mock_creds.service_account_email = "test@project.iam.gserviceaccount.com"
        mock_creds.token = "fake-token"
        mock_auth_default.return_value = (mock_creds, "fake-project")

        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/v1/admin/academy/lessons/upload-url/", {
            "filename": "leccion-1.mp4", "content_type": "video/mp4",
        }, format="json")

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["upload_url"], "https://storage.googleapis.com/fake-signed-url")
        self.assertTrue(resp.data["object_path"].startswith("academy/videos/"))
        self.assertTrue(resp.data["object_path"].endswith(".mp4"))

        # El PUT firmado debe pedirse con method="PUT" — si esto se
        # rompe, el navegador no podría subir el archivo con esa URL.
        call_kwargs = mock_blob.generate_signed_url.call_args.kwargs
        self.assertEqual(call_kwargs["method"], "PUT")

    def test_regular_user_cannot_request_upload_url(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.post("/api/v1/admin/academy/lessons/upload-url/", {
            "filename": "leccion-1.mp4",
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_anonymous_cannot_request_upload_url(self):
        resp = self.client.post("/api/v1/admin/academy/lessons/upload-url/", {
            "filename": "leccion-1.mp4",
        }, format="json")
        self.assertIn(resp.status_code, (401, 403))

    @override_settings(GS_BUCKET_NAME="fake-bucket-test")
    @patch("google.auth.default")
    @patch("google.cloud.storage.Client")
    def test_rejects_unsupported_extension(self, mock_client_cls, mock_auth_default):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/v1/admin/academy/lessons/upload-url/", {
            "filename": "documento.pdf", "content_type": "application/pdf",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        mock_client_cls.assert_not_called()  # ni siquiera debería intentar generar la URL


class LessonVideoFilePathTest(TestCase):
    """
    Una vez que el video ya está en GCS (subido directo con la URL
    firmada), el frontend crea/edita la lección mandando la RUTA
    (video_file_path), no el archivo. Confirma que eso deja el campo
    video_file del modelo apuntando correctamente, sin necesidad de
    volver a subir nada por Django.
    """
    def setUp(self):
        self.admin = User.objects.create_superuser(email="lessonadmin@test.com", username="lessonadmin", password="x")
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        from decimal import Decimal
        from apps.academy.models import Course, Module
        course = Course.objects.create(title="Curso Test", price=Decimal("1000"))
        self.module = Module.objects.create(course=course, title="Módulo 1")

    def test_creating_lesson_with_video_file_path_sets_video_file(self):
        resp = self.client.post("/api/v1/admin/academy/lessons/", {
            "title": "Lección con video directo",
            "module": str(self.module.id),
            "video_file_path": "academy/videos/abc123.mp4",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)

        from apps.academy.models import Lesson
        lesson = Lesson.objects.get(id=resp.data["id"])
        self.assertEqual(lesson.video_file.name, "academy/videos/abc123.mp4")
        self.assertEqual(lesson.video_source, "/media/academy/videos/abc123.mp4")

    def test_updating_lesson_with_video_file_path_replaces_video(self):
        from apps.academy.models import Lesson
        lesson = Lesson.objects.create(
            module=self.module, title="Lección vieja",
            video_file="academy/videos/viejo.mp4",
        )
        resp = self.client.patch(f"/api/v1/admin/academy/lessons/{lesson.id}/", {
            "video_file_path": "academy/videos/nuevo.mp4",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)

        lesson.refresh_from_db()
        self.assertEqual(lesson.video_file.name, "academy/videos/nuevo.mp4")

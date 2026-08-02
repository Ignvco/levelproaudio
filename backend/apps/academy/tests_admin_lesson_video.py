# apps/academy/tests_admin_lesson_video.py
#
# El FileField auto-generado por el ModelSerializer llamaba .url
# internamente al leer — con el bucket privado da 403. Confirma que
# ahora no expone esa URL rota, y que video_source (el que sí usa el
# frontend para reproducir) sigue funcionando bien.

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from apps.academy.models import Course, Module, Lesson

User = get_user_model()


class AdminLessonVideoFieldTest(TestCase):
    def test_video_file_does_not_expose_broken_gcs_url(self):
        from apps.analytics.views import AdminLessonSerializer

        course = Course.objects.create(title="Curso Test", price=Decimal("1000"))
        module = Module.objects.create(course=course, title="Módulo 1")
        lesson = Lesson.objects.create(
            module=module, title="Lección 1",
            video_file="academy/videos/test-video.mp4",
        )

        data = AdminLessonSerializer(lesson).data

        # Nunca debe ser una URL absoluta de GCS (eso es lo que rompía)
        assert "storage.googleapis.com" not in str(data["video_file"])
        # video_source sí debe seguir siendo la ruta proxeada correcta
        assert data["video_source"] == "/media/academy/videos/test-video.mp4"

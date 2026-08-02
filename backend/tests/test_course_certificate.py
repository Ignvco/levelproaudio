# tests/test_course_certificate.py
#
# Antes, Enrollment.completed_at existía en el modelo pero nada lo
# seteaba nunca, y no había forma de descargar un certificado. Cubre:
#   - completed_at se marca automáticamente al llegar al 100%
#   - el PDF se genera de verdad (no solo el endpoint responde 200)
#   - no se puede pedir el certificado antes de completar el curso
#   - no se puede pedir el certificado de la inscripción de otro usuario

import pytest
from apps.users.models import User
from apps.academy.models import Course, Module, Lesson, Enrollment, LessonProgress
from rest_framework.test import APIClient


def _course_with_one_lesson():
    course = Course.objects.create(title="Mezcla Básica", is_published=True)
    module = Module.objects.create(course=course, title="Módulo 1")
    lesson = Lesson.objects.create(module=module, title="Lección 1", is_free=True)
    return course, lesson


@pytest.mark.django_db
def test_completing_last_lesson_sets_completed_at():
    user = User.objects.create_user(email="student@test.com", username="student", password="x")
    course, lesson = _course_with_one_lesson()
    enrollment = Enrollment.objects.create(user=user, course=course)

    client = APIClient()
    client.force_authenticate(user=user)

    assert enrollment.completed_at is None

    resp = client.post("/api/v1/progress/", {"lesson_id": str(lesson.id), "completed": True}, format="json")
    assert resp.status_code == 200

    enrollment.refresh_from_db()
    assert enrollment.completed_at is not None


@pytest.mark.django_db
def test_certificate_download_generates_real_pdf():
    user = User.objects.create_user(
        email="cert@test.com", username="cert", password="x",
        first_name="Ignacio", last_name="Zamorano",
    )
    course, lesson = _course_with_one_lesson()
    enrollment = Enrollment.objects.create(user=user, course=course)
    LessonProgress.objects.create(user=user, lesson=lesson, completed=True)

    from django.utils import timezone
    enrollment.completed_at = timezone.now()
    enrollment.save(update_fields=["completed_at"])

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.get(f"/api/v1/enrollments/{enrollment.id}/certificate/")
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"  # es un PDF real, no un placeholder
    assert len(resp.content) > 500


@pytest.mark.django_db
def test_certificate_blocked_if_course_not_completed():
    user = User.objects.create_user(email="incomplete@test.com", username="incomplete", password="x")
    course, lesson = _course_with_one_lesson()
    enrollment = Enrollment.objects.create(user=user, course=course)  # sin completar

    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.get(f"/api/v1/enrollments/{enrollment.id}/certificate/")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_certificate_not_accessible_by_other_user():
    owner   = User.objects.create_user(email="owner2@test.com", username="owner2", password="x")
    other   = User.objects.create_user(email="other2@test.com", username="other2", password="x")
    course, lesson = _course_with_one_lesson()
    enrollment = Enrollment.objects.create(user=owner, course=course)
    from django.utils import timezone
    enrollment.completed_at = timezone.now()
    enrollment.save(update_fields=["completed_at"])

    client = APIClient()
    client.force_authenticate(user=other)

    resp = client.get(f"/api/v1/enrollments/{enrollment.id}/certificate/")
    assert resp.status_code == 404  # ReadOnlyModelViewSet ya filtra por user

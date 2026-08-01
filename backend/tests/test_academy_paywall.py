# tests/test_academy_paywall.py
#
# Regresión para el bug de fuga de video pago: video_url/video_file NUNCA
# deben viajar en la respuesta del API para una lección bloqueada
# (is_locked=True), sin importar lo que diga ese mismo flag.

import pytest
from decimal import Decimal
from apps.users.models import User
from apps.academy.models import Course, Module, Lesson, Enrollment
from apps.academy.serializers import LessonSerializer


@pytest.mark.django_db
def test_locked_lesson_hides_video_for_anonymous_user():
    course = Course.objects.create(
        title="Mezcla y Masterización", price=Decimal("50000"), is_published=True
    )
    module = Module.objects.create(course=course, title="Módulo 1")
    lesson = Lesson.objects.create(
        module=module, title="Lección paga", is_free=False,
        video_url="https://videos.example.com/paga.mp4",
    )

    data = LessonSerializer(lesson, context={"request": None}).data

    assert data["is_locked"] is True
    assert data["video_url"] is None
    assert data["video_file"] is None


@pytest.mark.django_db
def test_enrolled_user_sees_video():
    user = User.objects.create_user(
        email="alumno@test.com", username="alumno", password="x"
    )
    course = Course.objects.create(
        title="Mezcla y Masterización", price=Decimal("50000"), is_published=True
    )
    module = Module.objects.create(course=course, title="Módulo 1")
    lesson = Lesson.objects.create(
        module=module, title="Lección paga", is_free=False,
        video_url="https://videos.example.com/paga.mp4",
    )
    Enrollment.objects.create(user=user, course=course)

    class FakeRequest:
        pass

    req = FakeRequest()
    req.user = user

    data = LessonSerializer(lesson, context={"request": req}).data

    assert data["is_locked"] is False
    assert data["video_url"] == "https://videos.example.com/paga.mp4"


@pytest.mark.django_db
def test_free_lesson_always_visible():
    course = Course.objects.create(title="Curso demo", is_published=True)
    module = Module.objects.create(course=course, title="Intro")
    lesson = Lesson.objects.create(
        module=module, title="Lección gratis", is_free=True,
        video_url="https://videos.example.com/gratis.mp4",
    )

    data = LessonSerializer(lesson, context={"request": None}).data

    assert data["is_locked"] is False
    assert data["video_url"] == "https://videos.example.com/gratis.mp4"

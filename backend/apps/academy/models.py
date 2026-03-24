# apps/academy/models.py

from django.db import models
from django.conf import settings
from core.models import TimeStampedModel


class Course(TimeStampedModel):

    title = models.CharField(max_length=300)

    slug = models.SlugField(unique=True)

    description = models.TextField()

    thumbnail = models.ImageField(
        upload_to="courses/",
        blank=True,
        null=True
    )

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    is_published = models.BooleanField(default=False)

    def __str__(self):
        return self.title


class Module(TimeStampedModel):

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="modules"
    )

    title = models.CharField(max_length=300)

    order = models.PositiveIntegerField(default=0)


class Lesson(TimeStampedModel):

    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name="lessons"
    )

    title = models.CharField(max_length=300)

    video_url = models.URLField()

    description = models.TextField(blank=True)

    order = models.PositiveIntegerField(default=0)

    is_free = models.BooleanField(default=False)


class Enrollment(TimeStampedModel):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE
    )


class LessonProgress(TimeStampedModel):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE
    )

    completed = models.BooleanField(default=False)
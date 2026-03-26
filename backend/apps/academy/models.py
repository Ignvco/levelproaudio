# apps/academy/models.py

from django.db import models
from django.conf import settings
from django.utils.text import slugify
from core.models import TimeStampedModel


class Course(TimeStampedModel):

    class Level(models.TextChoices):
        BEGINNER     = "beginner",     "Principiante"
        INTERMEDIATE = "intermediate", "Intermedio"
        ADVANCED     = "advanced",     "Avanzado"

    title        = models.CharField(max_length=300)
    slug         = models.SlugField(unique=True, blank=True)
    description  = models.TextField()
    short_description = models.CharField(max_length=500, blank=True)
    thumbnail    = models.ImageField(upload_to="courses/", blank=True, null=True)
    preview_url  = models.URLField(blank=True, help_text="Video de preview público")
    price        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    level        = models.CharField(
        max_length=20, choices=Level.choices, default=Level.BEGINNER
    )
    is_published = models.BooleanField(default=False)
    is_free      = models.BooleanField(default=False)
    order        = models.PositiveIntegerField(default=0)

    # SEO
    seo_title       = models.CharField(max_length=255, blank=True)
    seo_description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name = "Curso"
        verbose_name_plural = "Cursos"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    @property
    def total_lessons(self):
        return Lesson.objects.filter(module__course=self).count()

    @property
    def total_duration(self):
        """Suma total de duraciones de todas las lecciones en minutos."""
        return Lesson.objects.filter(
            module__course=self
        ).aggregate(
            total=models.Sum("duration_minutes")
        )["total"] or 0

    @property
    def enrolled_count(self):
        return self.enrollments.count()


class Module(TimeStampedModel):
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="modules"
    )
    title = models.CharField(max_length=300)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        verbose_name = "Módulo"
        verbose_name_plural = "Módulos"

    def __str__(self):
        return f"{self.course.title} — {self.title}"


class Lesson(TimeStampedModel):
    module           = models.ForeignKey(
        Module, on_delete=models.CASCADE, related_name="lessons"
    )
    title            = models.CharField(max_length=300)
    video_url        = models.URLField()
    description      = models.TextField(blank=True)
    order            = models.PositiveIntegerField(default=0)
    is_free          = models.BooleanField(default=False)
    duration_minutes = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        verbose_name = "Lección"
        verbose_name_plural = "Lecciones"

    def __str__(self):
        return f"{self.module.title} — {self.title}"


class Enrollment(TimeStampedModel):
    user   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments"
    )
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="enrollments"
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "course")
        verbose_name = "Inscripción"
        verbose_name_plural = "Inscripciones"

    def __str__(self):
        return f"{self.user.email} → {self.course.title}"

    @property
    def progress_percentage(self):
        total = self.course.total_lessons
        if not total:
            return 0
        completed = LessonProgress.objects.filter(
            user=self.user,
            lesson__module__course=self.course,
            completed=True
        ).count()
        return round((completed / total) * 100)


class LessonProgress(TimeStampedModel):
    user      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    lesson    = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)

    class Meta:
        unique_together = ("user", "lesson")
        verbose_name = "Progreso de Lección"
        verbose_name_plural = "Progreso de Lecciones"

    def __str__(self):
        return f"{self.user.email} — {self.lesson.title} ({'✓' if self.completed else '○'})"
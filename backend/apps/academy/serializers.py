# apps/academy/serializers.py
from rest_framework import serializers
from .models import Course, Module, Lesson, Enrollment, LessonProgress


def _safe_image_url(image_field):
    if not image_field:
        return None
    try:
        return image_field.url
    except Exception:
        return None


class LessonSerializer(serializers.ModelSerializer):
    is_locked = serializers.SerializerMethodField()

    class Meta:
        model  = Lesson
        fields = [
            "id", "title", "video_url", "description",
            "order", "is_free", "duration_minutes", "is_locked",
        ]

    def get_is_locked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return not obj.is_free
        enrolled = Enrollment.objects.filter(
            user=request.user, course=obj.module.course
        ).exists()
        return not enrolled and not obj.is_free


class ModuleSerializer(serializers.ModelSerializer):
    lessons       = LessonSerializer(many=True, read_only=True)
    lessons_count = serializers.SerializerMethodField()

    class Meta:
        model  = Module
        fields = ["id", "title", "order", "lessons", "lessons_count"]

    def get_lessons_count(self, obj):
        return obj.lessons.count()


class CourseListSerializer(serializers.ModelSerializer):
    total_lessons  = serializers.IntegerField(read_only=True)
    total_duration = serializers.IntegerField(read_only=True)
    enrolled_count = serializers.IntegerField(read_only=True)
    level_display  = serializers.CharField(source="get_level_display", read_only=True)
    is_enrolled    = serializers.SerializerMethodField()
    thumbnail      = serializers.SerializerMethodField()

    class Meta:
        model  = Course
        fields = [
            "id", "title", "slug", "short_description",
            "thumbnail", "price", "level", "level_display",
            "is_free", "total_lessons", "total_duration",
            "enrolled_count", "is_enrolled",
        ]

    def get_thumbnail(self, obj):
        return _safe_image_url(obj.thumbnail)

    def get_is_enrolled(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return Enrollment.objects.filter(user=request.user, course=obj).exists()


class CourseDetailSerializer(serializers.ModelSerializer):
    modules        = ModuleSerializer(many=True, read_only=True)
    total_lessons  = serializers.IntegerField(read_only=True)
    total_duration = serializers.IntegerField(read_only=True)
    enrolled_count = serializers.IntegerField(read_only=True)
    level_display  = serializers.CharField(source="get_level_display", read_only=True)
    is_enrolled    = serializers.SerializerMethodField()
    progress       = serializers.SerializerMethodField()
    thumbnail      = serializers.SerializerMethodField()

    class Meta:
        model  = Course
        fields = [
            "id", "title", "slug", "description", "short_description",
            "thumbnail", "preview_url", "price", "level", "level_display",
            "is_free", "total_lessons", "total_duration",
            "enrolled_count", "is_enrolled", "progress", "modules",
        ]

    def get_thumbnail(self, obj):
        return _safe_image_url(obj.thumbnail)

    def get_is_enrolled(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return Enrollment.objects.filter(user=request.user, course=obj).exists()

    def get_progress(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        try:
            enrollment = Enrollment.objects.get(user=request.user, course=obj)
            return enrollment.progress_percentage
        except Enrollment.DoesNotExist:
            return 0


class EnrollmentSerializer(serializers.ModelSerializer):
    course              = CourseListSerializer(read_only=True)
    progress_percentage = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Enrollment
        fields = ["id", "course", "progress_percentage", "completed_at", "created_at"]


class LessonProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model  = LessonProgress
        fields = ["id", "lesson", "completed", "updated_at"]

# apps/academy/serializers.py
from rest_framework import serializers
from .models import Course, Module, Lesson, Enrollment, LessonProgress
from core.media import media_url as _media_url


class LessonSerializer(serializers.ModelSerializer):
    is_locked    = serializers.SerializerMethodField()
    video_source = serializers.SerializerMethodField()
    video_url    = serializers.SerializerMethodField()
    video_file   = serializers.SerializerMethodField()

    class Meta:
        model  = Lesson
        fields = ["id", "title", "video_url", "video_file", "video_source",
                  "description", "order", "is_free", "duration_minutes", "is_locked"]

    def _is_locked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return not obj.is_free
        # Staff/admin siempre pueden previsualizar
        if request.user.is_staff or request.user.is_superuser:
            return False
        enrolled = Enrollment.objects.filter(user=request.user, course=obj.module.course).exists()
        return not enrolled and not obj.is_free

    def get_is_locked(self, obj):
        return self._is_locked(obj)

    # video_url, video_file y video_source solo se exponen si la lección
    # NO está bloqueada. is_locked es un flag informativo para el
    # frontend, pero el control de acceso real tiene que vivir acá — de
    # lo contrario cualquiera puede leer la URL del video pago directo
    # desde la respuesta del API.
    #
    # video_source ANTES era un CharField de solo lectura que reflejaba
    # directo la property del modelo, sin pasar por _is_locked() — eso
    # filtraba el video pago igual, por una puerta distinta a la que ya
    # habíamos tapado en video_url/video_file. Ahora las tres pasan por
    # el mismo chequeo.
    def get_video_url(self, obj):
        if self._is_locked(obj):
            return None
        return obj.video_url

    def get_video_file(self, obj):
        if self._is_locked(obj):
            return None
        return _media_url(obj.video_file)

    def get_video_source(self, obj):
        if self._is_locked(obj):
            return None
        return obj.video_source


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
        fields = ["id", "title", "slug", "short_description", "thumbnail", "price",
                  "level", "level_display", "is_free", "total_lessons", "total_duration",
                  "enrolled_count", "is_enrolled"]

    def get_thumbnail(self, obj):
        return _media_url(obj.thumbnail)

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
        fields = ["id", "title", "slug", "description", "short_description", "thumbnail",
                  "preview_url", "price", "level", "level_display", "is_free",
                  "total_lessons", "total_duration", "enrolled_count", "is_enrolled",
                  "progress", "modules"]

    def get_thumbnail(self, obj):
        return _media_url(obj.thumbnail)

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
            return Enrollment.objects.get(user=request.user, course=obj).progress_percentage
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

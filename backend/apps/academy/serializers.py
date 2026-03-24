# apps/academy/serializers.py
# Serializers del sistema de cursos

from rest_framework import serializers
from .models import Course, Module, Lesson


class LessonSerializer(serializers.ModelSerializer):
    """
    Serializer de lecciones.
    """

    class Meta:
        model = Lesson
        fields = [
            'id',
            'title',
            'video_url',
            'description',
            'order',
            'is_free'
        ]


class ModuleSerializer(serializers.ModelSerializer):
    """
    Serializer de módulos dentro de un curso.
    """

    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = [
            'id',
            'title',
            'order',
            'lessons'
        ]


class CourseListSerializer(serializers.ModelSerializer):
    """
    Serializer liviano para listado de cursos.
    """

    class Meta:
        model = Course
        fields = [
            'id',
            'title',
            'slug',
            'thumbnail',
            'price'
        ]


class CourseDetailSerializer(serializers.ModelSerializer):
    """
    Serializer completo de un curso.
    """

    modules = ModuleSerializer(many=True, read_only=True)

    class Meta:
        model = Course

        fields = [
            'id',
            'title',
            'slug',
            'description',
            'thumbnail',
            'price',
            'modules'
        ]
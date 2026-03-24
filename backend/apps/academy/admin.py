# apps/academy/admin.py
# Administración de cursos de LevelPro Audio Academy

from django.contrib import admin
from .models import Course, Module, Lesson, Enrollment


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 1


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):

    list_display = [
        'title',
        'price',
        'is_published',
        'created_at'
    ]

    list_filter = ['is_published']

    search_fields = ['title']

    prepopulated_fields = {'slug': ('title',)}

    readonly_fields = ['created_at', 'updated_at']

    inlines = [ModuleInline]


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):

    list_display = ['title', 'course', 'order']
    list_filter = ['course']
    search_fields = ['title']


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):

    list_display = ['title', 'module', 'order', 'is_free']
    list_filter = ['module', 'is_free']
    search_fields = ['title']


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):

    list_display = ['user', 'course', 'created_at']
    list_filter = ['course']
    search_fields = ['user__email']
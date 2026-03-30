# apps/academy/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import Course, Module, Lesson, Enrollment, LessonProgress


class LessonInline(admin.TabularInline):
    model   = Lesson
    extra   = 2
    fields  = ["title", "video_url", "duration_minutes", "order", "is_free"]
    ordering = ["order"]


class ModuleInline(admin.StackedInline):
    model        = Module
    extra        = 1
    fields       = ["title", "order"]
    show_change_link = True
    ordering     = ["order"]


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display  = [
        "title", "level", "price_display", "is_free",
        "is_published", "enrolled_count_display", "total_lessons_display"
    ]
    list_filter   = ["is_published", "is_free", "level"]
    search_fields = ["title", "description"]
    prepopulated_fields = {"slug": ("title",)}
    inlines       = [ModuleInline]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        ("Información principal", {
            "fields": ("title", "slug", "short_description",
                       "description", "thumbnail", "preview_url")
        }),
        ("Configuración", {
            "fields": ("level", "price", "is_free", "is_published", "order")
        }),
        ("SEO", {
            "fields": ("seo_title", "seo_description"),
            "classes": ("collapse",)
        }),
        ("Auditoría", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

    def price_display(self, obj):
        return f"${obj.price:,.0f}" if not obj.is_free else "Gratis"
    price_display.short_description = "Precio"

    def enrolled_count_display(self, obj):
        count = obj.enrollments.count()
        return format_html(
            '<span style="color:#00e676;font-weight:bold;">{}</span>', count
        )
    enrolled_count_display.short_description = "Inscritos"

    def total_lessons_display(self, obj):
        return obj.total_lessons
    total_lessons_display.short_description = "Lecciones"


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display  = ["title", "course", "order"]
    list_filter   = ["course"]
    ordering      = ["course", "order"]
    inlines       = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display  = ["title", "module", "duration_minutes", "is_free", "order"]
    list_filter   = ["is_free", "module__course"]
    search_fields = ["title"]
    ordering      = ["module__course", "module__order", "order"]


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display    = ["user", "course", "progress_display", "created_at"]
    list_filter     = ["course"]
    search_fields   = ["user__email", "course__title"]
    readonly_fields = ["created_at"]

    def progress_display(self, obj):
        pct   = obj.progress_percentage
        color = "#00e676" if pct == 100 else "#f59e0b" if pct > 0 else "#888"
        return format_html(
            '<span style="color:{};font-weight:bold;">{}%</span>', color, pct
        )
    progress_display.short_description = "Progreso"

# apps/academy/views.py

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from apps.orders.models import Order, OrderItem

from .models import Course, Lesson, Enrollment, LessonProgress
from .serializers import (
    CourseListSerializer,
    CourseDetailSerializer,
    EnrollmentSerializer,
    LessonProgressSerializer,
)


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/v1/courses/              → catálogo
    GET /api/v1/courses/{slug}/       → detalle
    POST /api/v1/courses/{slug}/enroll/   → inscribirse
    DELETE /api/v1/courses/{slug}/unenroll/ → desinscribirse
    """
    queryset = Course.objects.filter(is_published=True)
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "level":   ["exact"],
        "is_free": ["exact"],
        "price":   ["lte", "gte"],
    }
    search_fields  = ["title", "description", "short_description"]
    ordering_fields = ["price", "created_at", "order"]
    ordering = ["order", "-created_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CourseDetailSerializer
        return CourseListSerializer

    def get_permissions(self):
        if self.action in ["enroll", "unenroll"]:
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    @action(detail=True, methods=["post"])
    def enroll(self, request, slug=None):
        """POST /api/v1/courses/{slug}/enroll/"""
        course = self.get_object()

        if Enrollment.objects.filter(user=request.user, course=course).exists():
            return Response(
                {"detail": "Ya estás inscrito en este curso."},
                status=status.HTTP_400_BAD_REQUEST
            )

        enrollment = Enrollment.objects.create(user=request.user, course=course)
        return Response(
            EnrollmentSerializer(enrollment).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["delete"])
    def unenroll(self, request, slug=None):
        """DELETE /api/v1/courses/{slug}/unenroll/"""
        course = self.get_object()
        deleted, _ = Enrollment.objects.filter(
            user=request.user, course=course
        ).delete()

        if not deleted:
            return Response(
                {"detail": "No estás inscrito en este curso."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def purchase(self, request, slug=None):
        """
        POST /api/v1/courses/{slug}/purchase/
        Crea una orden para comprar un curso de pago.
        """
        course = self.get_object()

        if course.is_free:
            return Response(
                {"error": "Este curso es gratuito. Usa /enroll/ en su lugar."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if Enrollment.objects.filter(user=request.user, course=course).exists():
            return Response(
                {"error": "Ya estás inscrito en este curso."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Crea la orden
        order = Order.objects.create(
            user=request.user,
            email=request.user.email,
            shipping_address="Curso digital — sin envío",
            total=course.price,
        )

        OrderItem.objects.create(
            order=order,
            product=None,
            product_name=f"Curso: {course.title}",
            price=course.price,
            quantity=1,
        )

        return Response({
            "order_id": str(order.id),
            "course_slug": course.slug,
            "amount": float(course.price),
        }, status=status.HTTP_201_CREATED)

class EnrollmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/v1/enrollments/     → mis cursos
    GET /api/v1/enrollments/{id}/ → detalle
    """
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Enrollment.objects.filter(
            user=self.request.user
        ).select_related("course").order_by("-created_at")


class LessonProgressViewSet(viewsets.ViewSet):
    """
    POST /api/v1/progress/          → marcar lección como completa/incompleta
    GET  /api/v1/progress/?course=  → progreso de un curso
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """GET /api/v1/progress/?course={slug}"""
        course_slug = request.query_params.get("course")
        qs = LessonProgress.objects.filter(user=request.user)
        if course_slug:
            qs = qs.filter(lesson__module__course__slug=course_slug)
        serializer = LessonProgressSerializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request):
        """
        POST /api/v1/progress/
        Body: { lesson_id, completed }
        """
        lesson_id = request.data.get("lesson_id")
        completed = request.data.get("completed", True)

        lesson = get_object_or_404(Lesson, id=lesson_id)

        # Verifica que el usuario esté inscrito (a menos que sea lección free)
        if not lesson.is_free:
            enrolled = Enrollment.objects.filter(
                user=request.user,
                course=lesson.module.course
            ).exists()
            if not enrolled:
                return Response(
                    {"detail": "Debes estar inscrito para marcar progreso."},
                    status=status.HTTP_403_FORBIDDEN
                )

        progress, _ = LessonProgress.objects.update_or_create(
            user=request.user,
            lesson=lesson,
            defaults={"completed": completed}
        )

        return Response(
            LessonProgressSerializer(progress).data,
            status=status.HTTP_200_OK
        )
        
@action(detail=False, methods=["post"])
def enroll_manual(self, request):
    """
    POST /api/v1/enrollments/enroll_manual/
    Body: { course_slug }
    Permite al admin crear una inscripción manualmente.
    """
    from .models import Course
    slug   = request.data.get("course_slug")
    try:
        course = Course.objects.get(slug=slug)
    except Course.DoesNotExist:
        return Response({"error": "Curso no encontrado."}, status=404)

    enrollment, created = Enrollment.objects.get_or_create(
        user=request.user, course=course
    )
    return Response(EnrollmentSerializer(enrollment).data,
        status=201 if created else 200)       
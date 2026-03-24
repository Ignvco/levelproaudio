# apps/academy/views.py
# API de cursos

from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import Course
from .serializers import CourseListSerializer, CourseDetailSerializer


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Cursos disponibles en la academia.

    GET /api/v1/courses/
    GET /api/v1/courses/{slug}/
    """

    queryset = Course.objects.filter(is_published=True)

    permission_classes = [AllowAny]

    lookup_field = "slug"

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]

    search_fields = ["title"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CourseDetailSerializer
        return CourseListSerializer
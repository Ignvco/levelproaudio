# apps/academy/urls.py
# Endpoints de cursos de la academia

from rest_framework.routers import DefaultRouter
from .views import CourseViewSet


router = DefaultRouter()

router.register(r'courses', CourseViewSet, basename='courses')


urlpatterns = router.urls
# apps/academy/urls.py

from rest_framework.routers import DefaultRouter
from .views import CourseViewSet, EnrollmentViewSet, LessonProgressViewSet

router = DefaultRouter()
router.register("courses",     CourseViewSet,        basename="course")
router.register("enrollments", EnrollmentViewSet,    basename="enrollment")
router.register("progress",    LessonProgressViewSet, basename="progress")

urlpatterns = router.urls
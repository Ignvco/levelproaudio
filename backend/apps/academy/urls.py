# apps/academy/urls.py

from rest_framework.routers import DefaultRouter
from .views import CourseViewSet, EnrollmentViewSet, LessonProgressViewSet, CertificationPathViewSet

router = DefaultRouter()
router.register("courses",        CourseViewSet,            basename="course")
router.register("enrollments",    EnrollmentViewSet,        basename="enrollment")
router.register("progress",       LessonProgressViewSet,    basename="progress")
router.register("certifications", CertificationPathViewSet, basename="certification")

urlpatterns = router.urls
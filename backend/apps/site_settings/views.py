from rest_framework import views, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.analytics.views import IsAdminOrStaff
from .models        import SiteSettings
from .serializers   import SiteSettingsSerializer, SiteSettingsWriteSerializer


class PublicSiteSettingsView(views.APIView):
    """GET /api/v1/site-settings/ — público, para toda la web."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        obj = SiteSettings.get()
        return Response(SiteSettingsSerializer(obj).data)


class AdminSiteSettingsView(views.APIView):
    """GET/PATCH /api/v1/admin/site-settings/ — sólo staff."""
    permission_classes = [IsAdminOrStaff]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        obj = SiteSettings.get()
        return Response(SiteSettingsSerializer(obj).data)

    def patch(self, request):
        obj = SiteSettings.get()
        ser = SiteSettingsWriteSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(SiteSettingsSerializer(obj).data, status=status.HTTP_200_OK)

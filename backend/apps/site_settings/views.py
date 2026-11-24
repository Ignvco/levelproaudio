from django.db import transaction
from rest_framework import views, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.admin_permissions import IsAdminOrStaff
from core.rbac.constants import MODULE_SETTINGS, PERM_MANAGE_SETTINGS
from core.rbac.permissions import is_effective_super_admin, user_has_capability
from core.audit.services import record_audit_event
from core.audit.constants import (
    CATEGORY_CONFIG_CHANGE,
    SEVERITY_WARNING,
    RESULT_SUCCESS,
)
from core.audit.sanitizer import sanitize_audit_payload
from .models        import SiteSettings
from .serializers   import SiteSettingsSerializer, SiteSettingsWriteSerializer
from .cms_preflight import VERSIONED_EDITORIAL_FIELDS
from .cms_services  import get_public_cms_payload


class PublicSiteSettingsView(views.APIView):
    """GET /api/v1/site-settings/ — público, devuelve SiteSettings + versión CMS publicada vigente."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        obj = SiteSettings.get()
        data = SiteSettingsSerializer(obj).data
        data["cms"] = get_public_cms_payload()
        return Response(data)


class AdminSiteSettingsView(views.APIView):
    """GET/PATCH /api/v1/admin/site-settings/ — protegido por RBAC (MODULE_SETTINGS + PERM_MANAGE_SETTINGS)."""
    permission_classes = [IsAdminOrStaff]
    rbac_module        = MODULE_SETTINGS
    rbac_capability    = PERM_MANAGE_SETTINGS
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    RESTRICTED_SYSTEM_FIELDS = {"usd_to_clp", "usd_to_ars"}

    def get(self, request):
        obj = SiteSettings.get()
        resp = Response(SiteSettingsSerializer(obj).data)
        resp["Cache-Control"] = "private, no-store"
        return resp

    def patch(self, request):
        versioned_hit = VERSIONED_EDITORIAL_FIELDS.intersection(request.data.keys())
        if versioned_hit:
            return Response(
                {
                    "error": (
                        "Los campos editoriales sujetos a versionado deben actualizarse "
                        "mediante borradores y publicación CMS (/api/v1/admin/cms/versions/)."
                    ),
                    "fields": sorted(versioned_hit),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if any(f in request.data for f in self.RESTRICTED_SYSTEM_FIELDS):
            if not is_effective_super_admin(request.user) and not user_has_capability(request.user, PERM_MANAGE_SETTINGS):
                return Response(
                    {"error": "No posee la capacidad 'manage_settings' para modificar tasas de cambio o configuración crítica del sistema."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        with transaction.atomic():
            obj = SiteSettings.get()
            ser = SiteSettingsWriteSerializer(obj, data=request.data, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()

            # Registro de auditoría obligatorio, transaccional y fail-closed (Clase 1)
            record_audit_event(
                module=MODULE_SETTINGS,
                action="CONFIG_CHANGED",
                event_category=CATEGORY_CONFIG_CHANGE,
                resource_type="SiteSettings",
                resource_id=str(obj.id),
                resource_repr="Configuración General del Sitio",
                actor=request.user,
                result=RESULT_SUCCESS,
                severity=SEVERITY_WARNING,
                new_values=sanitize_audit_payload(request.data),
                mandatory=True,
            )

        resp = Response(SiteSettingsSerializer(obj).data, status=status.HTTP_200_OK)
        resp["Cache-Control"] = "private, no-store"
        return resp

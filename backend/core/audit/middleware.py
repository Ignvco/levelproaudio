# core/audit/middleware.py
"""Middleware de correlación de auditoría, propagación de contexto y captura de accesos denegados (403)."""

import uuid
from .context import set_current_audit_context
from .constants import (
    CATEGORY_SECURITY_DENIED,
    RESULT_DENIED,
    SEVERITY_HIGH,
    SOURCE_API,
)


class AuditCorrelationMiddleware:
    """
    Asigna y propaga un X-Correlation-ID para cada solicitud HTTP.
    Inyecta IP, User-Agent y usuario autenticado en el contexto seguro de ejecución.
    Captura de forma fuera de banda intentos no autorizados (HTTP 403) en endpoints protegidos.
    """

    PROTECTED_PREFIXES = (
        "/api/v1/admin/",
        "/api/v1/billing/",
        "/api/v1/rewards/admin/",
        "/api/v1/loyalty/admin/",
        "/media/billing/",
        "/media/receipts/",
        "/media/private/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip

    def __call__(self, request):
        # 1. Obtener o generar Correlation ID
        correlation_id = request.headers.get("X-Correlation-ID") or request.META.get("HTTP_X_CORRELATION_ID")
        if not correlation_id:
            correlation_id = str(uuid.uuid4())
        request.correlation_id = correlation_id

        # 2. Extraer IP y User Agent
        ip_address = self._get_client_ip(request)
        user_agent = request.META.get("HTTP_USER_AGENT", "")

        # 3. Extraer usuario (si ya está autenticado)
        user = getattr(request, "user", None)
        if not (user and getattr(user, "is_authenticated", False)):
            # Intentar resolver vía JWT si el middleware de auth estándar de Django aún no lo hizo
            force_user = getattr(request, "_force_auth_user", None)
            if force_user and getattr(force_user, "is_authenticated", False):
                user = force_user
            else:
                try:
                    from apps.users.authentication import CookieJWTAuthentication
                    auth_res = CookieJWTAuthentication().authenticate(request)
                    if auth_res:
                        user = auth_res[0]
                except Exception:
                    user = None

        # 4. Establecer en variables de contexto seguro
        set_current_audit_context(
            correlation_id=correlation_id,
            ip_address=ip_address,
            user_agent=user_agent,
            user=user,
        )

        response = self.get_response(request)

        # 5. Inyectar header de correlación en la respuesta
        response["X-Correlation-ID"] = correlation_id

        # 6. Captura automática de accesos denegados en endpoints administrativos o protegidos
        if response.status_code == 403 and any(request.path.startswith(prefix) for prefix in self.PROTECTED_PREFIXES):
            try:
                from .services import record_out_of_band_audit_event
                record_out_of_band_audit_event(
                    module="security",
                    action="ACCESS_DENIED",
                    event_category=CATEGORY_SECURITY_DENIED,
                    resource_type="HTTP_ENDPOINT",
                    resource_id=request.path,
                    resource_repr=f"{request.method} {request.path}",
                    actor=user,
                    result=RESULT_DENIED,
                    severity=SEVERITY_HIGH,
                    metadata={
                        "method": request.method,
                        "path": request.path,
                        "status_code": 403,
                    },
                    correlation_id=correlation_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    source=SOURCE_API,
                )
            except Exception:
                pass

        return response

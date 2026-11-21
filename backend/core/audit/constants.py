# core/audit/constants.py
"""Taxonomía, categorías, severidades y sanitización para LEVELPRO OS V4.0 Audit Trail."""

# ── Categorías de Eventos (Taxonomía Oficial Gate 1.2) ──────────────────────────
CATEGORY_CREATION             = "creation"
CATEGORY_MODIFICATION         = "modification"
CATEGORY_DELETION             = "deletion"
CATEGORY_PRICE_CHANGE         = "price_change"
CATEGORY_COST_CHANGE          = "cost_change"
CATEGORY_STOCK_ADJUSTMENT     = "stock_adjustment"
CATEGORY_ORDER_STATUS         = "order_status"
CATEGORY_PAYMENT_OPERATION    = "payment_operation"
CATEGORY_FINANCIAL_OPERATION  = "financial_operation"
CATEGORY_CONFIG_CHANGE        = "config_change"
CATEGORY_ROLE_PERMISSION      = "role_permission"
CATEGORY_BULK_OPERATION       = "bulk_operation"
CATEGORY_EXPORT               = "export"
CATEGORY_SECURITY_DENIED      = "security_denied"
CATEGORY_PRIVILEGE_ESCALATION = "privilege_escalation"

ALL_CATEGORIES = [
    CATEGORY_CREATION,
    CATEGORY_MODIFICATION,
    CATEGORY_DELETION,
    CATEGORY_PRICE_CHANGE,
    CATEGORY_COST_CHANGE,
    CATEGORY_STOCK_ADJUSTMENT,
    CATEGORY_ORDER_STATUS,
    CATEGORY_PAYMENT_OPERATION,
    CATEGORY_FINANCIAL_OPERATION,
    CATEGORY_CONFIG_CHANGE,
    CATEGORY_ROLE_PERMISSION,
    CATEGORY_BULK_OPERATION,
    CATEGORY_EXPORT,
    CATEGORY_SECURITY_DENIED,
    CATEGORY_PRIVILEGE_ESCALATION,
]

CATEGORY_LABELS = {
    CATEGORY_CREATION: "Creación de recurso",
    CATEGORY_MODIFICATION: "Modificación general",
    CATEGORY_DELETION: "Eliminación de recurso",
    CATEGORY_PRICE_CHANGE: "Cambio de precio de venta",
    CATEGORY_COST_CHANGE: "Cambio de costo de adquisición",
    CATEGORY_STOCK_ADJUSTMENT: "Ajuste físico de stock",
    CATEGORY_ORDER_STATUS: "Transición de estado de orden",
    CATEGORY_PAYMENT_OPERATION: "Operación de pago / conciliación",
    CATEGORY_FINANCIAL_OPERATION: "Operación financiera / retiro",
    CATEGORY_CONFIG_CHANGE: "Cambio de configuración global",
    CATEGORY_ROLE_PERMISSION: "Gestión de roles y permisos",
    CATEGORY_BULK_OPERATION: "Operación masiva / importación",
    CATEGORY_EXPORT: "Exportación de datos sensibles",
    CATEGORY_SECURITY_DENIED: "Acceso denegado / intento no autorizado",
    CATEGORY_PRIVILEGE_ESCALATION: "Intento de escalamiento de privilegios",
}

# ── Niveles de Severidad ────────────────────────────────────────────────────────
SEVERITY_INFO     = "info"
SEVERITY_WARNING  = "warning"
SEVERITY_HIGH     = "high"
SEVERITY_CRITICAL = "critical"

ALL_SEVERITIES = [
    SEVERITY_INFO,
    SEVERITY_WARNING,
    SEVERITY_HIGH,
    SEVERITY_CRITICAL,
]

SEVERITY_LABELS = {
    SEVERITY_INFO: "Informativo",
    SEVERITY_WARNING: "Advertencia",
    SEVERITY_HIGH: "Alto",
    SEVERITY_CRITICAL: "Crítico",
}

# ── Resultados Operacionales ───────────────────────────────────────────────────
RESULT_SUCCESS = "success"
RESULT_FAILED  = "failed"
RESULT_DENIED  = "denied"

ALL_RESULTS = [
    RESULT_SUCCESS,
    RESULT_FAILED,
    RESULT_DENIED,
]

RESULT_LABELS = {
    RESULT_SUCCESS: "Éxito",
    RESULT_FAILED: "Fallido",
    RESULT_DENIED: "Acceso denegado",
}

# ── Fuentes de Ejecución ────────────────────────────────────────────────────────
SOURCE_API                = "api"
SOURCE_ADMIN_UI           = "admin_ui"
SOURCE_DJANGO_ADMIN       = "django_admin"
SOURCE_MANAGEMENT_COMMAND = "management_command"
SOURCE_WEBHOOK            = "webhook"
SOURCE_SYSTEM_SIGNAL      = "system_signal"

ALL_SOURCES = [
    SOURCE_API,
    SOURCE_ADMIN_UI,
    SOURCE_DJANGO_ADMIN,
    SOURCE_MANAGEMENT_COMMAND,
    SOURCE_WEBHOOK,
    SOURCE_SYSTEM_SIGNAL,
]

# ── Tipos de Actores ────────────────────────────────────────────────────────────
ACTOR_USER        = "user"
ACTOR_SYSTEM      = "system"
ACTOR_INTEGRATION = "integration"

# ── Sanitización Recursiva: Llaves Sensibles Prohibidas (Blacklist) ────────────
# Ningún valor bajo estas claves debe guardarse jamás en texto plano en la base de datos.
SENSITIVE_FIELD_NAMES = {
    "password",
    "password1",
    "password2",
    "current_password",
    "new_password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "secret_key",
    "api_key",
    "authorization",
    "cookie",
    "cookies",
    "sessionid",
    "csrftoken",
    "credential",
    "credentials",
    "private_key",
    "card",
    "card_number",
    "cvv",
    "cvc",
    "raw_response",
    "signature",
    "webhook_secret",
}

# ── Enmascaramiento Dinámico de Datos Financieros ───────────────────────────────
# Claves cuyos valores deben ocultarse si el usuario carece de capacidades financieras/costos.
FINANCIAL_MASK_KEYS = {
    "cost_price",
    "cost",
    "costo",
    "total_cost",
    "costo_total",
    "capital_cost",
    "valor_inventario",
    "cost_missing_count",
    "margin",
    "margen",
    "profit",
    "ganancia",
    "utilidad",
    "net_profit",
    "utilidad_neta",
    "withdrawal_amount",
    "distributions",
}

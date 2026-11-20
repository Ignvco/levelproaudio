# core/rbac/constants.py
"""Constantes maestras de módulos, roles y permisos sensibles para LEVELPRO OS V4.0."""

# ── Módulos Operativos del Sistema ──────────────────────────────────────────
MODULE_DASHBOARD = "dashboard"
MODULE_CATALOG   = "catalog"
MODULE_ORDERS    = "orders"
MODULE_INVENTORY = "inventory"
MODULE_PURCHASES = "purchases"
MODULE_LOGISTICS = "logistics"
MODULE_FINANCES  = "finances"
MODULE_MARKETING = "marketing"
MODULE_ACADEMY   = "academy"
MODULE_SERVICES  = "services"
MODULE_ROLES     = "roles"
MODULE_SETTINGS  = "settings"

ALL_MODULES = [
    MODULE_DASHBOARD,
    MODULE_CATALOG,
    MODULE_ORDERS,
    MODULE_INVENTORY,
    MODULE_PURCHASES,
    MODULE_LOGISTICS,
    MODULE_FINANCES,
    MODULE_MARKETING,
    MODULE_ACADEMY,
    MODULE_SERVICES,
    MODULE_ROLES,
    MODULE_SETTINGS,
]

# ── Capacidades y Permisos Sensibles ───────────────────────────────────────
PERM_VIEW_COSTS       = "view_costs"
PERM_EDIT_COSTS       = "edit_costs"
PERM_VIEW_MARGINS     = "view_margins"
PERM_VIEW_FINANCES    = "view_finances"
PERM_APPROVE_PAYMENTS = "approve_payments"
PERM_EDIT_PRICES      = "edit_prices"
PERM_APPLY_DISCOUNTS  = "apply_discounts"
PERM_ADJUST_INVENTORY = "adjust_inventory"
PERM_EXPORT_DATA      = "export_data"
PERM_MANAGE_ROLES     = "manage_roles"
PERM_MANAGE_SETTINGS  = "manage_settings"

ALL_SENSITIVE_PERMISSIONS = [
    PERM_VIEW_COSTS,
    PERM_EDIT_COSTS,
    PERM_VIEW_MARGINS,
    PERM_VIEW_FINANCES,
    PERM_APPROVE_PAYMENTS,
    PERM_EDIT_PRICES,
    PERM_APPLY_DISCOUNTS,
    PERM_ADJUST_INVENTORY,
    PERM_EXPORT_DATA,
    PERM_MANAGE_ROLES,
    PERM_MANAGE_SETTINGS,
]

# ── Roles Empresariales Oficiales (10 Roles) ───────────────────────────────
ROLE_SUPER_ADMIN = "Super Admin"
ROLE_MANAGEMENT  = "Gerencia / Administración"
ROLE_SALES       = "Ventas"
ROLE_PURCHASING  = "Compras"
ROLE_WAREHOUSE   = "Bodega"
ROLE_LOGISTICS   = "Logística"
ROLE_FINANCE     = "Finanzas / Contabilidad"
ROLE_MARKETING   = "Marketing"
ROLE_ACADEMY     = "Academia"
ROLE_SUPPORT     = "Soporte Técnico"

ALL_ROLES = [
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_PURCHASING,
    ROLE_WAREHOUSE,
    ROLE_LOGISTICS,
    ROLE_FINANCE,
    ROLE_MARKETING,
    ROLE_ACADEMY,
    ROLE_SUPPORT,
]

ROLE_DESCRIPTIONS = {
    ROLE_SUPER_ADMIN: "Control técnico e institucional irrestricto de toda la plataforma.",
    ROLE_MANAGEMENT: "Dirección operativa, comercial y financiera integral del negocio.",
    ROLE_SALES: "Atención comercial, gestión de órdenes de venta, clientes y cotizaciones B2B.",
    ROLE_PURCHASING: "Gestión de proveedores, órdenes de compra y control de costos de adquisición.",
    ROLE_WAREHOUSE: "Control físico de bodegas, existencias, trazabilidad de seriales y empaque.",
    ROLE_LOGISTICS: "Coordinación de transportistas, emisión de guías de despacho y seguimiento.",
    ROLE_FINANCE: "Conciliación bancaria, documentos tributarios (SII), tesorería y estados de flujo.",
    ROLE_MARKETING: "Campañas de fidelización, cupones, sorteos Rewards y contenido del sitio web.",
    ROLE_ACADEMY: "Administración integral de cursos técnicos, módulos, lecciones y certificaciones.",
    ROLE_SUPPORT: "Atención de posventa, seguimiento de incidencias, notas técnicas y garantías.",
}

# ── Matriz de Módulos y Capacidades por Defecto ────────────────────────────
DEFAULT_ROLE_MATRIX = {
    ROLE_SUPER_ADMIN: {
        "modules": ALL_MODULES,
        "capabilities": ALL_SENSITIVE_PERMISSIONS,
    },
    ROLE_MANAGEMENT: {
        "modules": [
            MODULE_DASHBOARD, MODULE_CATALOG, MODULE_ORDERS, MODULE_INVENTORY,
            MODULE_PURCHASES, MODULE_LOGISTICS, MODULE_FINANCES, MODULE_MARKETING,
            MODULE_ACADEMY, MODULE_SERVICES, MODULE_SETTINGS,
        ],
        "capabilities": [
            PERM_VIEW_COSTS, PERM_EDIT_COSTS, PERM_VIEW_MARGINS, PERM_VIEW_FINANCES,
            PERM_APPROVE_PAYMENTS, PERM_EDIT_PRICES, PERM_APPLY_DISCOUNTS,
            PERM_ADJUST_INVENTORY, PERM_EXPORT_DATA, PERM_MANAGE_SETTINGS,
        ],
    },
    ROLE_SALES: {
        "modules": [MODULE_DASHBOARD, MODULE_CATALOG, MODULE_ORDERS, MODULE_MARKETING],
        "capabilities": [PERM_APPLY_DISCOUNTS],
    },
    ROLE_PURCHASING: {
        "modules": [MODULE_DASHBOARD, MODULE_CATALOG, MODULE_PURCHASES, MODULE_INVENTORY],
        "capabilities": [PERM_VIEW_COSTS, PERM_EDIT_COSTS, PERM_EXPORT_DATA],
    },
    ROLE_WAREHOUSE: {
        "modules": [MODULE_INVENTORY, MODULE_LOGISTICS],
        "capabilities": [PERM_ADJUST_INVENTORY],
    },
    ROLE_LOGISTICS: {
        "modules": [MODULE_LOGISTICS, MODULE_ORDERS],
        "capabilities": [],
    },
    ROLE_FINANCE: {
        "modules": [MODULE_DASHBOARD, MODULE_CATALOG, MODULE_FINANCES, MODULE_ORDERS, MODULE_PURCHASES],
        "capabilities": [
            PERM_VIEW_FINANCES, PERM_VIEW_COSTS, PERM_VIEW_MARGINS,
            PERM_APPROVE_PAYMENTS, PERM_EXPORT_DATA,
        ],
    },
    ROLE_MARKETING: {
        "modules": [MODULE_DASHBOARD, MODULE_MARKETING, MODULE_CATALOG, MODULE_SETTINGS],
        "capabilities": [PERM_APPLY_DISCOUNTS, PERM_MANAGE_SETTINGS],
    },
    ROLE_ACADEMY: {
        "modules": [MODULE_DASHBOARD, MODULE_ACADEMY],
        "capabilities": [],
    },
    ROLE_SUPPORT: {
        "modules": [MODULE_ORDERS, MODULE_SERVICES, MODULE_LOGISTICS],
        "capabilities": [],
    },
}

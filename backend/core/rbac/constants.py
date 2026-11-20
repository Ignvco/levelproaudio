# core/rbac/constants.py
"""Constantes maestras de módulos, roles, acciones y permisos sensibles para LEVELPRO OS V4.0."""

from decimal import Decimal

# ── Módulos Operativos del Sistema (12 Dominios) ────────────────────────────
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

# Estado de implementación real de cada módulo en Gate 1.1
MODULE_IMPLEMENTATION_STATUS = {
    MODULE_DASHBOARD: {
        "status": "implemented",
        "gate": "Gate 0 / Gate 1.1",
        "description": "Dashboard operativo, analítica y dashboard ejecutivo.",
    },
    MODULE_CATALOG: {
        "status": "implemented",
        "gate": "Gate 0 / Gate 2 (PIM)",
        "description": "Productos, categorías, marcas, imágenes e importadores.",
    },
    MODULE_ORDERS: {
        "status": "implemented",
        "gate": "Gate 0 / Gate 7 (OMS) / Gate 8 (B2B)",
        "description": "Órdenes de venta, cotizaciones B2B y solicitudes bajo pedido.",
    },
    MODULE_INVENTORY: {
        "status": "implemented",
        "gate": "Gate 0 / Gate 4 (WMS)",
        "description": "Resumen de inventario, alertas de stock, rotación y valorización.",
    },
    MODULE_PURCHASES: {
        "status": "partial_reserved",
        "gate": "Gate 3 (Suppliers) & Gate 5 (Procurement)",
        "description": "Cubre solicitudes bajo pedido y gestión de costos de catálogo; proveedores y OC reservados para Gates 3 y 5.",
    },
    MODULE_LOGISTICS: {
        "status": "partial_reserved",
        "gate": "Gate 10 (Logistics & After-Sales)",
        "description": "Cubre actualización de despacho en órdenes; transportistas y guías dedicadas reservados para Gate 10.",
    },
    MODULE_FINANCES: {
        "status": "implemented",
        "gate": "Gate 0 / Gate 9 (Financial Management)",
        "description": "Resumen financiero, categorías de distribución, retiros, rentabilidad por SKU, métodos de pago, cuentas bancarias y doc. tributaria SII.",
    },
    MODULE_MARKETING: {
        "status": "implemented",
        "gate": "Gate 0 / Gate 14 (Loyalty & Rewards)",
        "description": "Campañas Rewards, sorteos, participaciones, ganadores y programa de fidelización Loyalty.",
    },
    MODULE_ACADEMY: {
        "status": "implemented",
        "gate": "Gate 0 / Gate 14 (Academy)",
        "description": "Cursos, rutas de certificación, módulos, lecciones, subida firmada de videos e inscripciones.",
    },
    MODULE_SERVICES: {
        "status": "implemented",
        "gate": "Gate 0 / Gate 14 (Professional Services)",
        "description": "Catálogo de servicios profesionales, solicitudes de cotización y reservas.",
    },
    MODULE_ROLES: {
        "status": "implemented",
        "gate": "Gate 1.1 (Security Core & RBAC)",
        "description": "Gestión de roles empresariales, asignación de permisos y administración de cuentas de usuario.",
    },
    MODULE_SETTINGS: {
        "status": "implemented",
        "gate": "Gate 0 / Gate 11 & 12",
        "description": "Configuración global y personalización editorial del sitio web.",
    },
}

# ── Capacidades y Permisos Sensibles (12 Capacidades) ──────────────────────
PERM_VIEW_COSTS       = "view_costs"
PERM_EDIT_COSTS       = "edit_costs"
PERM_VIEW_MARGINS     = "view_margins"
PERM_VIEW_FINANCES    = "view_finances"
PERM_MANAGE_FINANCES  = "manage_finances"
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
    PERM_MANAGE_FINANCES,
    PERM_APPROVE_PAYMENTS,
    PERM_EDIT_PRICES,
    PERM_APPLY_DISCOUNTS,
    PERM_ADJUST_INVENTORY,
    PERM_EXPORT_DATA,
    PERM_MANAGE_ROLES,
    PERM_MANAGE_SETTINGS,
]

# ── Acciones Granulares por Recurso ────────────────────────────────────────
ACTION_READ    = "read"
ACTION_CREATE  = "create"
ACTION_UPDATE  = "update"
ACTION_DELETE  = "delete"
ACTION_EXPORT  = "export"
ACTION_IMPORT  = "import"
ACTION_APPROVE = "approve"

ALL_ACTIONS = [
    ACTION_READ,
    ACTION_CREATE,
    ACTION_UPDATE,
    ACTION_DELETE,
    ACTION_EXPORT,
    ACTION_IMPORT,
    ACTION_APPROVE,
]

# ── Políticas Comerciales y Segregación de Funciones (SoD) ─────────────────
MAX_UNAPPROVED_DISCOUNT_PERCENT = Decimal("15.00")

# Roles empresariales oficiales (10 Roles)
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

# Pares de roles operativos incompatibles por Segregación de Funciones (SoD)
INCOMPATIBLE_ROLE_PAIRS = [
    (ROLE_SALES, ROLE_FINANCE),
    (ROLE_PURCHASING, ROLE_FINANCE),
    (ROLE_WAREHOUSE, ROLE_FINANCE),
]

ROLE_DESCRIPTIONS = {
    ROLE_SUPER_ADMIN: "Control técnico e institucional irrestricto de toda la plataforma.",
    ROLE_MANAGEMENT: "Dirección operativa, comercial y financiera integral del negocio.",
    ROLE_SALES: "Atención comercial, consulta de catálogo, gestión de órdenes y cotizaciones B2B (descuentos hasta 15%).",
    ROLE_PURCHASING: "Gestión de abastecimiento, solicitudes bajo pedido y actualización de costos de adquisición.",
    ROLE_WAREHOUSE: "Control físico de existencias, ajuste de stock y alertas de inventario sin visibilidad de costos.",
    ROLE_LOGISTICS: "Coordinación de despachos y transición de estados de envío en órdenes pagadas.",
    ROLE_FINANCE: "Conciliación financiera, aprobación de pagos, retiros, documentos tributarios (SII) y auditoría de márgenes.",
    ROLE_MARKETING: "Campañas Rewards, fidelización y contenido editorial del sitio sin acceso a cuentas bancarias ni tasas de cambio.",
    ROLE_ACADEMY: "Administración de cursos técnicos, módulos, lecciones, certificaciones e inscripciones.",
    ROLE_SUPPORT: "Atención de posventa, consulta de pedidos y gestión de solicitudes de servicios profesionales.",
}

# ── Matriz Maestra de Módulos, Capacidades y Acciones por Rol ──────────────
DEFAULT_ROLE_MATRIX = {
    ROLE_SUPER_ADMIN: {
        "modules": list(ALL_MODULES),
        "capabilities": list(ALL_SENSITIVE_PERMISSIONS),
        "module_actions": {m: list(ALL_ACTIONS) for m in ALL_MODULES},
    },
    ROLE_MANAGEMENT: {
        "modules": [
            MODULE_DASHBOARD, MODULE_CATALOG, MODULE_ORDERS, MODULE_INVENTORY,
            MODULE_PURCHASES, MODULE_LOGISTICS, MODULE_FINANCES, MODULE_MARKETING,
            MODULE_ACADEMY, MODULE_SERVICES, MODULE_SETTINGS,
        ],
        "capabilities": [
            PERM_VIEW_COSTS, PERM_EDIT_COSTS, PERM_VIEW_MARGINS, PERM_VIEW_FINANCES,
            PERM_MANAGE_FINANCES, PERM_APPROVE_PAYMENTS, PERM_EDIT_PRICES,
            PERM_APPLY_DISCOUNTS, PERM_ADJUST_INVENTORY, PERM_EXPORT_DATA,
            PERM_MANAGE_SETTINGS,
        ],
        "module_actions": {
            MODULE_DASHBOARD: [ACTION_READ, ACTION_EXPORT],
            MODULE_CATALOG:   list(ALL_ACTIONS),
            MODULE_ORDERS:    list(ALL_ACTIONS),
            MODULE_INVENTORY: list(ALL_ACTIONS),
            MODULE_PURCHASES: list(ALL_ACTIONS),
            MODULE_LOGISTICS: list(ALL_ACTIONS),
            MODULE_FINANCES:  list(ALL_ACTIONS),
            MODULE_MARKETING: list(ALL_ACTIONS),
            MODULE_ACADEMY:   list(ALL_ACTIONS),
            MODULE_SERVICES:  list(ALL_ACTIONS),
            MODULE_SETTINGS:  [ACTION_READ, ACTION_UPDATE],
        },
    },
    ROLE_SALES: {
        "modules": [MODULE_DASHBOARD, MODULE_CATALOG, MODULE_ORDERS, MODULE_MARKETING],
        "capabilities": [PERM_APPLY_DISCOUNTS],
        "module_actions": {
            MODULE_DASHBOARD: [ACTION_READ],
            MODULE_CATALOG:   [ACTION_READ],
            MODULE_ORDERS:    [ACTION_READ, ACTION_UPDATE],
            MODULE_MARKETING: [ACTION_READ],
        },
    },
    ROLE_PURCHASING: {
        "modules": [MODULE_DASHBOARD, MODULE_CATALOG, MODULE_PURCHASES, MODULE_INVENTORY],
        "capabilities": [PERM_VIEW_COSTS, PERM_EDIT_COSTS, PERM_EXPORT_DATA],
        "module_actions": {
            MODULE_DASHBOARD: [ACTION_READ],
            MODULE_CATALOG:   [ACTION_READ, ACTION_UPDATE],  # Update limitado exclusivamente a cost_price
            MODULE_PURCHASES: [ACTION_READ, ACTION_CREATE, ACTION_UPDATE, ACTION_EXPORT],
            MODULE_INVENTORY: [ACTION_READ, ACTION_EXPORT],
        },
    },
    ROLE_WAREHOUSE: {
        "modules": [MODULE_INVENTORY, MODULE_LOGISTICS],
        "capabilities": [PERM_ADJUST_INVENTORY],
        "module_actions": {
            MODULE_INVENTORY: [ACTION_READ, ACTION_UPDATE],  # Update limitado exclusivamente a stock / stock_min
            MODULE_LOGISTICS: [ACTION_READ, ACTION_UPDATE],
        },
    },
    ROLE_LOGISTICS: {
        "modules": [MODULE_LOGISTICS, MODULE_ORDERS],
        "capabilities": [],
        "module_actions": {
            MODULE_LOGISTICS: [ACTION_READ, ACTION_UPDATE],
            MODULE_ORDERS:    [ACTION_READ, ACTION_UPDATE],  # Update limitado a despacho/envío (shipped/completed)
        },
    },
    ROLE_FINANCE: {
        "modules": [MODULE_DASHBOARD, MODULE_CATALOG, MODULE_INVENTORY, MODULE_FINANCES, MODULE_ORDERS, MODULE_PURCHASES],
        "capabilities": [
            PERM_VIEW_FINANCES, PERM_MANAGE_FINANCES, PERM_VIEW_COSTS,
            PERM_VIEW_MARGINS, PERM_APPROVE_PAYMENTS, PERM_EXPORT_DATA,
        ],
        "module_actions": {
            MODULE_DASHBOARD: [ACTION_READ, ACTION_EXPORT],
            MODULE_CATALOG:   [ACTION_READ],
            MODULE_INVENTORY: [ACTION_READ, ACTION_EXPORT],
            MODULE_FINANCES:  [ACTION_READ, ACTION_CREATE, ACTION_UPDATE, ACTION_DELETE, ACTION_APPROVE, ACTION_EXPORT],
            MODULE_ORDERS:    [ACTION_READ, ACTION_APPROVE, ACTION_EXPORT],
            MODULE_PURCHASES: [ACTION_READ],
        },
    },
    ROLE_MARKETING: {
        "modules": [MODULE_DASHBOARD, MODULE_MARKETING, MODULE_CATALOG],
        "capabilities": [PERM_APPLY_DISCOUNTS],
        "module_actions": {
            MODULE_DASHBOARD: [ACTION_READ],
            MODULE_MARKETING: [ACTION_READ, ACTION_CREATE, ACTION_UPDATE],
            MODULE_CATALOG:   [ACTION_READ, ACTION_UPDATE],  # Update limitado a campos editoriales/SEO/imágenes
        },
    },
    ROLE_ACADEMY: {
        "modules": [MODULE_DASHBOARD, MODULE_ACADEMY],
        "capabilities": [],
        "module_actions": {
            MODULE_DASHBOARD: [ACTION_READ],
            MODULE_ACADEMY:   [ACTION_READ, ACTION_CREATE, ACTION_UPDATE, ACTION_IMPORT],
        },
    },
    ROLE_SUPPORT: {
        "modules": [MODULE_ORDERS, MODULE_SERVICES, MODULE_LOGISTICS],
        "capabilities": [],
        "module_actions": {
            MODULE_ORDERS:    [ACTION_READ],
            MODULE_SERVICES:  [ACTION_READ, ACTION_UPDATE],  # Update limitado a estados/notas de reservas y solicitudes
            MODULE_LOGISTICS: [ACTION_READ],
        },
    },
}

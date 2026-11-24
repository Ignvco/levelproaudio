# apps/analytics/admin_experience_views.py
"""
LEVELPRO OS V4.0 — GATE 13: ADMIN EXPERIENCE
- Command Palette / Global Search: GET /api/v1/admin/search/global/?q=<term>&limit=<n>
- BF-32 Notification Center: GET /api/v1/admin/notifications/
- BF-32 Notification Read State: POST /api/v1/admin/notifications/read/
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    ALL_MODULES,
    ALL_ROLES,
    MODULE_CATALOG,
    MODULE_INVENTORY,
    MODULE_LOGISTICS,
    MODULE_ORDERS,
    MODULE_ROLES,
    MODULE_SERVICES,
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
    ROLE_SALES,
    ROLE_SUPER_ADMIN,
    ROLE_SUPPORT,
)
from core.rbac.permissions import (
    get_user_roles,
    is_effective_super_admin,
    user_has_module_access,
)
from apps.analytics.models import AdminNotificationReadState
from apps.inventory.models import SerialNumberTrack
from apps.orders.logistics_models import DeliveryIncident, WarrantyClaim
from apps.orders.models import Order, OrderStatus
from apps.products.models import Product, ProductVariant
from apps.services.models import ServiceRequest

User = get_user_model()


def _can_access_customers(user) -> bool:
    if is_effective_super_admin(user):
        return True
    if user_has_module_access(user, MODULE_ROLES) or user_has_module_access(user, MODULE_ORDERS):
        return True
    roles = set(get_user_roles(user))
    return bool(roles & {ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_SALES, ROLE_FINANCE, ROLE_SUPPORT})


@rbac_endpoint(allowed_modules=ALL_MODULES, allowed_roles=ALL_ROLES)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_global_search_view(request):
    """
    Command Palette (Cmd+K / Ctrl+K) — Global Enterprise Search.
    Enforces RBAC per module, requires minimum query length >= 2,
    preserves original currency (CLP/USD/ARS) without implicit conversion,
    and never exposes cost_clp / cost_usd / average_unit_cost.
    """
    raw_q = (request.query_params.get("q") or "").strip()
    try:
        limit = max(1, min(15, int(request.query_params.get("limit") or 6)))
    except (ValueError, TypeError):
        limit = 6

    user = request.user
    can_catalog = user_has_module_access(user, MODULE_CATALOG)
    can_inventory = user_has_module_access(user, MODULE_INVENTORY)
    can_orders = user_has_module_access(user, MODULE_ORDERS)
    can_logistics = user_has_module_access(user, MODULE_LOGISTICS)
    can_customers = _can_access_customers(user)

    allowed_categories = []
    if can_catalog or can_inventory:
        allowed_categories.extend(["products", "variants"])
    if can_inventory or can_logistics:
        allowed_categories.append("serials")
    if can_orders:
        allowed_categories.append("orders")
    if can_customers:
        allowed_categories.append("customers")

    if len(raw_q) < 2:
        return Response(
            {
                "query": raw_q,
                "min_length_met": False,
                "allowed_categories": allowed_categories,
                "results": {
                    "products": [],
                    "variants": [],
                    "serials": [],
                    "orders": [],
                    "customers": [],
                },
                "total_count": 0,
            },
            status=status.HTTP_200_OK,
        )

    results = {
        "products": [],
        "variants": [],
        "serials": [],
        "orders": [],
        "customers": [],
    }

    # 1. PRODUCTS (PIM / Catalog / Inventory)
    if can_catalog or can_inventory:
        products_qs = (
            Product.objects.select_related("brand", "category")
            .filter(
                Q(name__icontains=raw_q)
                | Q(sku__icontains=raw_q)
                | Q(slug__icontains=raw_q)
                | Q(brand__name__icontains=raw_q)
            )
            .order_by("-is_active", "name")[:limit]
        )
        for p in products_qs:
            results["products"].append(
                {
                    "id": str(p.id),
                    "type": "product",
                    "name": p.name,
                    "sku": p.sku or "",
                    "slug": p.slug,
                    "brand_name": p.brand.name if p.brand_id else "",
                    "category_name": p.category.name if p.category_id else "",
                    "price": str(p.price or Decimal("0.00")),
                    "currency": "CLP",
                    "price_usd": str(p.price_usd) if p.price_usd is not None else None,
                    "price_ars": str(p.price_ars) if p.price_ars is not None else None,
                    "stock": p.stock,
                    "is_active": p.is_active,
                    "target_route": f"/admin/products?highlight={p.id}",
                }
            )

        # 2. VARIANTS / SKUs
        variants_qs = (
            ProductVariant.objects.select_related("product")
            .filter(
                Q(sku__icontains=raw_q)
                | Q(name__icontains=raw_q)
                | Q(product__name__icontains=raw_q)
            )
            .order_by("-is_active", "sku")[:limit]
        )
        for v in variants_qs:
            effective_clp = v.price if v.price is not None else (v.product.price if v.product_id else Decimal("0.00"))
            results["variants"].append(
                {
                    "id": str(v.id),
                    "type": "variant",
                    "sku": v.sku,
                    "name": v.name,
                    "product_id": str(v.product_id),
                    "product_name": v.product.name if v.product_id else "",
                    "price": str(effective_clp or Decimal("0.00")),
                    "currency": "CLP",
                    "price_usd": str(v.price_usd) if v.price_usd is not None else None,
                    "price_ars": str(v.price_ars) if v.price_ars is not None else None,
                    "stock": v.stock,
                    "is_active": v.is_active,
                    "target_route": f"/admin/products?highlight={v.product_id}",
                }
            )

    # 3. SERIAL NUMBERS (WMS / Logistics / After-Sales)
    if can_inventory or can_logistics:
        serials_qs = (
            SerialNumberTrack.objects.select_related("product", "variant", "warehouse", "order")
            .filter(
                Q(serial_number__icontains=raw_q)
                | Q(product__name__icontains=raw_q)
                | Q(product__sku__icontains=raw_q)
                | Q(variant__sku__icontains=raw_q)
            )
            .order_by("-created_at")[:limit]
        )
        target_serial_route = "/admin/inventory" if can_inventory else "/admin/logistics"
        for s in serials_qs:
            results["serials"].append(
                {
                    "id": str(s.id),
                    "type": "serial",
                    "serial_number": s.serial_number,
                    "status": s.status,
                    "product_name": s.product.name if s.product_id else "",
                    "sku": s.variant.sku if s.variant_id else (s.product.sku if s.product_id else ""),
                    "warehouse_code": s.warehouse.code if s.warehouse_id else "",
                    "order_id": str(s.order_id) if s.order_id else None,
                    "target_route": target_serial_route,
                }
            )

    # 4. ORDERS (OMS) — Preserves original order currency (CLP / USD / ARS)
    if can_orders:
        orders_qs = (
            Order.objects.select_related("user")
            .filter(
                Q(id__icontains=raw_q)
                | Q(email__icontains=raw_q)
                | Q(tracking_number__icontains=raw_q)
                | Q(user__first_name__icontains=raw_q)
                | Q(user__last_name__icontains=raw_q)
            )
            .order_by("-created_at")[:limit]
        )
        for o in orders_qs:
            results["orders"].append(
                {
                    "id": str(o.id),
                    "short_id": str(o.id)[:8].upper(),
                    "type": "order",
                    "email": o.email,
                    "status": o.status,
                    "total": str(o.total),
                    "currency": (o.currency or "CLP").upper(),
                    "tracking_code": o.tracking_number or "",
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                    "target_route": f"/admin/orders?id={o.id}",
                }
            )

    # 5. CUSTOMERS (Users / CRM)
    if can_customers:
        customers_qs = (
            User.objects.filter(
                Q(email__icontains=raw_q)
                | Q(first_name__icontains=raw_q)
                | Q(last_name__icontains=raw_q)
            )
            .order_by("-date_joined", "-id")[:limit]
        )
        for u in customers_qs:
            full_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email
            results["customers"].append(
                {
                    "id": str(u.id),
                    "type": "customer",
                    "email": u.email,
                    "full_name": full_name,
                    "role": "staff" if u.is_staff else "customer",
                    "is_active": u.is_active,
                    "target_route": "/admin/users",
                }
            )

    total_count = sum(len(items) for items in results.values())
    return Response(
        {
            "query": raw_q,
            "min_length_met": True,
            "allowed_categories": allowed_categories,
            "results": results,
            "total_count": total_count,
        },
        status=status.HTTP_200_OK,
    )


def _build_verifiable_admin_notifications(user):
    """
    Constructs verifiable operational notifications from real database records,
    strictly filtered by the authenticated user's RBAC module permissions.
    """
    items = []
    now_iso = timezone.now().isoformat()

    can_orders = user_has_module_access(user, MODULE_ORDERS)
    can_catalog = user_has_module_access(user, MODULE_CATALOG)
    can_inventory = user_has_module_access(user, MODULE_INVENTORY)
    can_services = user_has_module_access(user, MODULE_SERVICES)
    can_logistics = user_has_module_access(user, MODULE_LOGISTICS)

    # 1. Pending Orders (OMS)
    if can_orders:
        pending_orders_qs = Order.objects.filter(status=OrderStatus.PENDING).order_by("-created_at")
        pending_count = pending_orders_qs.count()
        if pending_count > 0:
            latest_order = pending_orders_qs.first()
            items.append(
                {
                    "key": f"orders:pending:{pending_count}:{str(latest_order.id)[:8]}",
                    "category": "orders",
                    "priority": "high",
                    "title": f"{pending_count} {'pedido pendiente' if pending_count == 1 else 'pedidos pendientes'} de validación",
                    "description": f"Último ingreso #{str(latest_order.id)[:8].upper()} ({latest_order.email}) por {latest_order.total} {(latest_order.currency or 'CLP').upper()}.",
                    "target_route": "/admin/orders",
                    "entity_count": pending_count,
                    "created_at": latest_order.created_at.isoformat() if latest_order.created_at else now_iso,
                }
            )

    # 2. Out-of-stock & Critical Stock (Catalog / Inventory)
    if can_catalog or can_inventory:
        active_stock_products = Product.objects.filter(
            is_active=True,
            product_type=Product.ProductType.STOCK,
        )
        out_of_stock_qs = active_stock_products.filter(stock=0).order_by("name")
        out_count = out_of_stock_qs.count()
        target_inv_route = "/admin/inventory" if can_inventory else "/admin/products"
        if out_count > 0:
            sample_names = ", ".join(p.name for p in out_of_stock_qs[:2])
            items.append(
                {
                    "key": f"inventory:out_of_stock:{out_count}",
                    "category": "inventory",
                    "priority": "critical",
                    "title": f"{out_count} {'producto agotado' if out_count == 1 else 'productos agotados'} en catálogo activo",
                    "description": f"Sin unidades disponibles: {sample_names}{'...' if out_count > 2 else ''}.",
                    "target_route": target_inv_route,
                    "entity_count": out_count,
                    "created_at": now_iso,
                }
            )

        low_stock_qs = active_stock_products.filter(stock__gt=0, stock__lte=3).order_by("stock", "name")
        low_count = low_stock_qs.count()
        if low_count > 0:
            sample_names = ", ".join(f"{p.name} ({p.stock})" for p in low_stock_qs[:2])
            items.append(
                {
                    "key": f"inventory:low_stock:{low_count}",
                    "category": "inventory",
                    "priority": "warning",
                    "title": f"{low_count} {'producto con stock crítico' if low_count == 1 else 'productos con stock crítico'} (≤ 3 uds)",
                    "description": f"Reposición recomendada: {sample_names}{'...' if low_count > 2 else ''}.",
                    "target_route": target_inv_route,
                    "entity_count": low_count,
                    "created_at": now_iso,
                }
            )

    # 3. Pending Service Requests (Services)
    if can_services:
        pending_srv_qs = ServiceRequest.objects.filter(status="pending").order_by("-created_at")
        srv_count = pending_srv_qs.count()
        if srv_count > 0:
            latest_srv = pending_srv_qs.first()
            items.append(
                {
                    "key": f"services:pending:{srv_count}:{latest_srv.id}",
                    "category": "services",
                    "priority": "medium",
                    "title": f"{srv_count} {'solicitud de servicio pendiente' if srv_count == 1 else 'solicitudes de servicio pendientes'}",
                    "description": f"Cliente {latest_srv.name} ({latest_srv.email}) aguarda contacto comercial.",
                    "target_route": "/admin/services",
                    "entity_count": srv_count,
                    "created_at": latest_srv.created_at.isoformat() if latest_srv.created_at else now_iso,
                }
            )

    # 4. Logistics Incidents & Warranty Claims (Logistics & After-Sales)
    if can_logistics:
        open_incidents_qs = DeliveryIncident.objects.exclude(
            status=DeliveryIncident.Status.RESOLVED
        ).order_by("-created_at")
        inc_count = open_incidents_qs.count()
        if inc_count > 0:
            latest_inc = open_incidents_qs.first()
            items.append(
                {
                    "key": f"logistics:incidents:{inc_count}:{latest_inc.id}",
                    "category": "logistics",
                    "priority": "high",
                    "title": f"{inc_count} {'incidencia de transporte abierta' if inc_count == 1 else 'incidencias de transporte abiertas'}",
                    "description": f"Tipo: {latest_inc.incident_type} — {latest_inc.description[:80]}",
                    "target_route": "/admin/logistics",
                    "entity_count": inc_count,
                    "created_at": latest_inc.created_at.isoformat() if latest_inc.created_at else now_iso,
                }
            )

        open_warranties_qs = WarrantyClaim.objects.filter(
            status__in=[
                WarrantyClaim.Status.RECEIVED,
                WarrantyClaim.Status.PRELIMINARY_EVALUATION,
                WarrantyClaim.Status.PENDING_VERIFICATION,
                WarrantyClaim.Status.IN_TECHNICAL_REVIEW,
            ]
        ).order_by("-created_at")
        war_count = open_warranties_qs.count()
        if war_count > 0:
            latest_war = open_warranties_qs.first()
            items.append(
                {
                    "key": f"logistics:warranty:{war_count}:{latest_war.claim_number}",
                    "category": "warranty",
                    "priority": "medium",
                    "title": f"{war_count} {'reclamo de garantía activo' if war_count == 1 else 'reclamos de garantía activos'}",
                    "description": f"Caso {latest_war.claim_number} en estado {latest_war.get_status_display()}.",
                    "target_route": "/admin/logistics",
                    "entity_count": war_count,
                    "created_at": latest_war.created_at.isoformat() if latest_war.created_at else now_iso,
                }
            )

    return items


@rbac_endpoint(allowed_modules=ALL_MODULES, allowed_roles=ALL_ROLES)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_notifications_center_view(request):
    """
    BF-32 Notification Center — Returns verifiable operational alerts
    joined with per-user read/unread persistence.
    Honest delivery disclosure: controlled polling (60s) + manual refresh.
    """
    user = request.user
    raw_items = _build_verifiable_admin_notifications(user)
    keys = [item["key"] for item in raw_items]

    read_map = {}
    if keys:
        read_states = AdminNotificationReadState.objects.filter(
            user=user,
            notification_key__in=keys,
        )
        read_map = {rs.notification_key: rs.read_at.isoformat() for rs in read_states}

    category_filter = (request.query_params.get("category") or "").strip().lower()
    unread_only = (request.query_params.get("unread_only") or "").strip().lower() in ("1", "true", "yes")

    enriched = []
    unread_count = 0
    for item in raw_items:
        read_at = read_map.get(item["key"])
        is_read = bool(read_at)
        if not is_read:
            unread_count += 1
        record = {
            **item,
            "is_read": is_read,
            "read_at": read_at,
        }
        if category_filter and category_filter != "all" and record["category"] != category_filter:
            continue
        if unread_only and is_read:
            continue
        enriched.append(record)

    return Response(
        {
            "notifications": enriched,
            "unread_count": unread_count,
            "total_count": len(raw_items),
            "delivery_mode": "controlled_polling",
            "polling_interval_seconds": 60,
            "delivery_disclosure": "Actualización por polling controlado (60s) y refresco manual.",
        },
        status=status.HTTP_200_OK,
    )


@rbac_endpoint(allowed_modules=ALL_MODULES, allowed_roles=ALL_ROLES, action="read")
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_notifications_mark_read_view(request):
    """
    BF-32 Notification Center — Marks one, several, or all current verifiable
    notifications as read for the authenticated operator.
    """
    user = request.user
    data = request.data or {}
    mark_all = bool(data.get("mark_all"))
    keys = data.get("keys") or []
    single_key = data.get("key")
    if single_key and isinstance(single_key, str):
        keys = list(keys) + [single_key]

    current_items = _build_verifiable_admin_notifications(user)
    valid_keys = {item["key"] for item in current_items}

    if mark_all:
        target_keys = list(valid_keys)
    else:
        target_keys = [
            str(k).strip()
            for k in keys
            if isinstance(k, str) and str(k).strip()
        ]

    marked = []
    for k in target_keys:
        if len(k) > 160:
            continue
        obj, _ = AdminNotificationReadState.objects.update_or_create(
            user=user,
            notification_key=k,
            defaults={"read_at": timezone.now()},
        )
        marked.append(obj.notification_key)

    remaining_unread = sum(
        1
        for item in current_items
        if not AdminNotificationReadState.objects.filter(
            user=user, notification_key=item["key"]
        ).exists()
    )

    return Response(
        {
            "marked_keys": marked,
            "marked_count": len(marked),
            "unread_count": remaining_unread,
        },
        status=status.HTTP_200_OK,
    )

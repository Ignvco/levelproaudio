# apps/products/bulk_operations.py
"""
LEVELPRO OS V4.0 — GATE 2 (BF-15)
Motor de Edición Masiva de Catálogo con previsualización de diffs,
aislamiento monetario Decimal/Money, RBAC granular, política de errores explícita,
idempotencia y Audit Trail obligatorio.
"""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Q
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied

from apps.products.models import Product, ProductVariant, Category, Brand
from core.contracts.money import Money, SUPPORTED_CURRENCIES
from core.contracts.idempotency import IdempotencyContractService
from core.rbac.constants import (
    MODULE_CATALOG,
    PERM_EDIT_PRICES,
    PERM_ADJUST_INVENTORY,
    PERM_VIEW_COSTS,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability
from core.audit.services import record_audit_event
from core.audit.constants import (
    CATEGORY_BULK_OPERATION,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)


ALLOWED_OPERATIONS = {
    "price_adjust_percent",
    "price_set",
    "stock_set",
    "stock_delta",
    "set_active",
    "set_fields",
}

ALLOWED_COMMERCIAL_FIELDS = {
    "brand_id",
    "category_id",
    "badge",
    "is_featured",
    "product_type",
    "stock_min",
}


class BulkOperationError(ValueError):
    pass


def _quantize_for_currency(amount: Decimal, currency: str) -> Decimal:
    if currency == "CLP":
        return amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if currency == "ARS":
        return amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _to_decimal(raw_val, field_name="valor") -> Decimal:
    if isinstance(raw_val, bool) or raw_val is None or raw_val == "":
        raise BulkOperationError(f"El {field_name} numérico es requerido.")
    if isinstance(raw_val, float):
        raw_val = str(raw_val)
    try:
        return Decimal(str(raw_val).strip())
    except (InvalidOperation, ValueError):
        raise BulkOperationError(f"Valor numérico inválido para {field_name}: '{raw_val}'.")


def validate_bulk_permissions(user, operation: str, fields_payload: dict = None):
    """Valida RBAC granular por tipo de operación masiva antes de ejecutar o previsualizar."""
    if is_effective_super_admin(user):
        return

    if operation in ("price_adjust_percent", "price_set"):
        if not user_has_capability(user, PERM_EDIT_PRICES):
            raise DjangoPermissionDenied("No posee autorización ('edit_prices') para modificar precios masivamente.")
    elif operation in ("stock_set", "stock_delta"):
        if not user_has_capability(user, PERM_ADJUST_INVENTORY):
            raise DjangoPermissionDenied("No posee autorización ('adjust_inventory') para ajustar stock masivamente.")
    elif operation in ("set_active", "set_fields"):
        if not user_has_capability(user, PERM_EDIT_PRICES):
            raise DjangoPermissionDenied("No posee autorización ('edit_prices') para editar campos comerciales.")


def resolve_bulk_targets(payload: dict):
    """
    Resuelve la lista de productos y/o variantes objetivo a partir de IDs explícitos
    o filtros de catálogo.
    """
    target_scope = (payload.get("target_scope") or "products").lower()
    product_ids = payload.get("product_ids") or []
    variant_ids = payload.get("variant_ids") or []
    filters = payload.get("filters") or {}

    if target_scope == "variants" or variant_ids:
        qs = ProductVariant.objects.select_related("product", "product__category", "product__brand").order_by("product__name", "order")
        if variant_ids:
            qs = qs.filter(id__in=variant_ids)
        elif product_ids:
            qs = qs.filter(product_id__in=product_ids)
        else:
            if filters.get("search"):
                s = filters["search"].strip()
                qs = qs.filter(Q(name__icontains=s) | Q(sku__icontains=s) | Q(product__name__icontains=s))
            if filters.get("category_slug"):
                qs = qs.filter(product__category__slug=filters["category_slug"])
            if filters.get("brand_id"):
                qs = qs.filter(product__brand_id=filters["brand_id"])
            if filters.get("is_active") is not None:
                val = str(filters["is_active"]).lower() in ("true", "1", "yes")
                qs = qs.filter(is_active=val)
        return "variants", list(qs)

    qs = Product.objects.select_related("category", "brand").order_by("name")
    if product_ids:
        qs = qs.filter(id__in=product_ids)
    else:
        if filters.get("search"):
            s = filters["search"].strip()
            qs = qs.filter(Q(name__icontains=s) | Q(sku__icontains=s))
        if filters.get("category_slug"):
            qs = qs.filter(category__slug=filters["category_slug"])
        if filters.get("brand_id"):
            qs = qs.filter(brand_id=filters["brand_id"])
        if filters.get("product_type"):
            qs = qs.filter(product_type=filters["product_type"])
        if filters.get("is_active") is not None:
            val = str(filters["is_active"]).lower() in ("true", "1", "yes")
            qs = qs.filter(is_active=val)

    return "products", list(qs)


def _compute_item_change(scope: str, obj, operation: str, params: dict, can_view_costs: bool):
    """
    Calcula los valores actuales vs propuestos para un Product o ProductVariant.
    Retorna (before_dict, after_dict, update_fields, warnings, error_msg).
    """
    warnings = []
    if scope == "variants":
        label = f"{obj.product.name} — {obj.name}"
        sku = obj.sku
        cur_clp = obj.effective_price
        cur_usd = obj.price_usd
        cur_ars = obj.price_ars
        cur_cost = obj.effective_cost_price
    else:
        label = obj.name
        sku = obj.sku or "—"
        cur_clp = obj.price
        cur_usd = obj.price_usd
        cur_ars = obj.price_ars
        cur_cost = obj.cost_price

    before = {}
    after = {}
    updates = {}

    if operation == "price_adjust_percent":
        pct = _to_decimal(params.get("percent"), "porcentaje")
        if pct <= Decimal("-100"):
            return None, None, {}, warnings, "El porcentaje de reducción no puede ser <= -100%."
        currency = str(params.get("currency") or "CLP").upper()
        if currency not in SUPPORTED_CURRENCIES:
            raise BulkOperationError(f"Moneda no soportada: {currency}.")

        factor = Decimal("1") + (pct / Decimal("100"))
        field_name = {"CLP": "price", "USD": "price_usd", "ARS": "price_ars"}[currency]
        cur_val = {"CLP": cur_clp, "USD": cur_usd, "ARS": cur_ars}[currency]

        if cur_val is None:
            return None, None, {}, warnings, f"No tiene precio explícito en {currency} para ajustar porcentualmente."

        new_val = _quantize_for_currency(cur_val * factor, currency)
        if new_val < Decimal("0"):
            return None, None, {}, warnings, "El precio resultante no puede ser negativo."

        # Validar contrato Money para la divisa
        Money(new_val, currency)
        before[field_name] = str(cur_val)
        after[field_name] = str(new_val)
        updates[field_name] = new_val

        if can_view_costs and cur_cost is not None and currency == "CLP" and new_val < cur_cost:
            warnings.append(f"Precio propuesto ({new_val}) queda bajo costo ({cur_cost}).")

    elif operation == "price_set":
        currency = str(params.get("currency") or "CLP").upper()
        if currency not in SUPPORTED_CURRENCIES:
            raise BulkOperationError(f"Moneda no soportada: {currency}.")
        new_val = _quantize_for_currency(_to_decimal(params.get("amount"), "monto"), currency)
        if new_val < Decimal("0"):
            return None, None, {}, warnings, "El precio no puede ser negativo."
        Money(new_val, currency)
        field_name = {"CLP": "price", "USD": "price_usd", "ARS": "price_ars"}[currency]
        cur_val = getattr(obj, field_name)
        before[field_name] = str(cur_val) if cur_val is not None else None
        after[field_name] = str(new_val)
        updates[field_name] = new_val
        if can_view_costs and cur_cost is not None and currency == "CLP" and new_val < cur_cost:
            warnings.append(f"Precio propuesto ({new_val}) queda bajo costo ({cur_cost}).")

    elif operation == "stock_set":
        try:
            new_stock = int(params.get("stock"))
        except (TypeError, ValueError):
            raise BulkOperationError("El stock debe ser un número entero.")
        if new_stock < 0:
            return None, None, {}, warnings, "El stock no puede ser negativo."
        before["stock"] = obj.stock
        after["stock"] = new_stock
        updates["stock"] = new_stock

    elif operation == "stock_delta":
        try:
            delta = int(params.get("delta"))
        except (TypeError, ValueError):
            raise BulkOperationError("El delta de stock debe ser un número entero.")
        new_stock = obj.stock + delta
        if new_stock < 0:
            return None, None, {}, warnings, f"Stock resultante negativo ({obj.stock} + {delta} = {new_stock})."
        before["stock"] = obj.stock
        after["stock"] = new_stock
        updates["stock"] = new_stock

    elif operation == "set_active":
        is_active = bool(params.get("is_active"))
        before["is_active"] = obj.is_active
        after["is_active"] = is_active
        updates["is_active"] = is_active

    elif operation == "set_fields":
        if scope == "variants":
            return None, None, {}, warnings, "La edición de campos comerciales de catálogo aplica sobre productos maestros."
        fields = params.get("fields") or {}
        for k, v in fields.items():
            if k not in ALLOWED_COMMERCIAL_FIELDS:
                raise BulkOperationError(f"Campo '{k}' no autorizado para edición masiva.")
            if k == "badge":
                valid_badges = dict(Product.Badge.choices)
                if v and v not in valid_badges:
                    return None, None, {}, warnings, f"Etiqueta inválida: '{v}'."
                before["badge"] = obj.badge
                after["badge"] = v or ""
                updates["badge"] = v or ""
            elif k == "product_type":
                valid_types = dict(Product.ProductType.choices)
                if v not in valid_types:
                    return None, None, {}, warnings, f"Tipo inválido: '{v}'."
                before["product_type"] = obj.product_type
                after["product_type"] = v
                updates["product_type"] = v
            elif k == "is_featured":
                before["is_featured"] = obj.is_featured
                after["is_featured"] = bool(v)
                updates["is_featured"] = bool(v)
            elif k == "stock_min":
                try:
                    sm = int(v)
                    if sm < 0:
                        raise ValueError
                except (TypeError, ValueError):
                    return None, None, {}, warnings, "stock_min debe ser entero >= 0."
                before["stock_min"] = obj.stock_min
                after["stock_min"] = sm
                updates["stock_min"] = sm
            elif k == "brand_id":
                if v and not Brand.objects.filter(id=v).exists():
                    return None, None, {}, warnings, "Marca indicada no existe."
                before["brand_id"] = str(obj.brand_id) if obj.brand_id else None
                after["brand_id"] = str(v) if v else None
                updates["brand_id"] = v or None
            elif k == "category_id":
                if v and not Category.objects.filter(id=v).exists():
                    return None, None, {}, warnings, "Categoría indicada no existe."
                before["category_id"] = str(obj.category_id) if obj.category_id else None
                after["category_id"] = str(v) if v else None
                updates["category_id"] = v or None

    return {
        "id": str(obj.id),
        "name": label,
        "sku": sku,
        "before": before,
        "after": after,
        "warnings": warnings,
    }, updates, warnings, None


def preview_bulk_update(user, payload: dict) -> dict:
    """Genera previsualización completa (sin mutar base de datos) de cambios propuestos."""
    operation = payload.get("operation")
    if operation not in ALLOWED_OPERATIONS:
        raise BulkOperationError(f"Operación '{operation}' no soportada.")

    params = payload.get("params") or {}
    validate_bulk_permissions(user, operation, params.get("fields"))

    scope, targets = resolve_bulk_targets(payload)
    can_view_costs = is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_COSTS)

    items = []
    errors = []
    warnings_count = 0

    for obj in targets:
        res = _compute_item_change(scope, obj, operation, params, can_view_costs)
        if len(res) == 5:
            _, _, _, warns, err_msg = res
            preview_item = None
        else:
            preview_item, _, warns, err_msg = res

        if err_msg:
            errors.append({
                "id": str(obj.id),
                "name": obj.name if scope == "products" else f"{obj.product.name} — {obj.name}",
                "sku": obj.sku or "—",
                "error": err_msg,
            })
        elif preview_item is not None:
            warnings_count += len(warns)
            items.append(preview_item)

    return {
        "target_scope": scope,
        "operation": operation,
        "total_matched": len(targets),
        "valid_count": len(items),
        "error_count": len(errors),
        "warnings_count": warnings_count,
        "items": items,
        "errors": errors,
    }


def apply_bulk_update(user, payload: dict, idempotency_key: str = "") -> dict:
    """
    Aplica la edición masiva con política explícita ('all_or_nothing' o 'best_effort'),
    bloqueo select_for_update en orden determinístico e idempotencia.
    """
    operation = payload.get("operation")
    if operation not in ALLOWED_OPERATIONS:
        raise BulkOperationError(f"Operación '{operation}' no soportada.")

    atomic_mode = (payload.get("atomic_mode") or "all_or_nothing").lower()
    if atomic_mode not in ("all_or_nothing", "best_effort"):
        raise BulkOperationError("atomic_mode debe ser 'all_or_nothing' o 'best_effort'.")

    params = payload.get("params") or {}
    validate_bulk_permissions(user, operation, params.get("fields"))

    def _run():
        scope, targets = resolve_bulk_targets(payload)
        if not targets:
            raise BulkOperationError("No se encontraron registros que coincidan con la selección.")

        can_view_costs = is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_COSTS)
        model_cls = ProductVariant if scope == "variants" else Product
        target_ids = sorted([obj.pk for obj in targets], key=str)

        applied = []
        failed = []

        with transaction.atomic():
            locked_map = {
                o.pk: o
                for o in model_cls.objects.select_for_update().filter(pk__in=target_ids).order_by("pk")
            }

            for pk in target_ids:
                obj = locked_map[pk]
                res = _compute_item_change(scope, obj, operation, params, can_view_costs)
                if len(res) == 5:
                    _, _, _, _, err_msg = res
                    preview_item, updates = None, {}
                else:
                    preview_item, updates, _, err_msg = res

                if err_msg:
                    failed.append({
                        "id": str(obj.id),
                        "name": obj.name if scope == "products" else f"{obj.product.name} — {obj.name}",
                        "error": err_msg,
                    })
                    continue

                if atomic_mode == "best_effort":
                    try:
                        with transaction.atomic():
                            for k, v in updates.items():
                                setattr(obj, k, v)
                            if updates:
                                obj.save(update_fields=list(updates.keys()) + ["updated_at"])
                            applied.append(preview_item)
                    except Exception as exc:
                        failed.append({
                            "id": str(obj.id),
                            "name": preview_item["name"],
                            "error": str(exc),
                        })
                else:
                    for k, v in updates.items():
                        setattr(obj, k, v)
                    if updates:
                        obj.save(update_fields=list(updates.keys()) + ["updated_at"])
                    applied.append(preview_item)

            if atomic_mode == "all_or_nothing" and failed:
                transaction.set_rollback(True)
                return {
                    "status": "rolled_back",
                    "atomic_mode": atomic_mode,
                    "applied_count": 0,
                    "failed_count": len(failed),
                    "applied": [],
                    "failed": failed,
                }

            record_audit_event(
                module=MODULE_CATALOG,
                action="BULK_PRODUCTS_UPDATED",
                event_category=CATEGORY_BULK_OPERATION,
                resource_type="ProductVariant" if scope == "variants" else "Product",
                resource_repr=f"Edición masiva ({operation}): {len(applied)} actualizados",
                actor=user,
                severity=SEVERITY_WARNING if len(applied) >= 10 else SEVERITY_INFO,
                metadata={
                    "operation": operation,
                    "target_scope": scope,
                    "atomic_mode": atomic_mode,
                    "applied_count": len(applied),
                    "failed_count": len(failed),
                    "sample_changes": applied[:25],
                },
                mandatory=True,
            )

            return {
                "status": "completed" if not failed else "partial",
                "atomic_mode": atomic_mode,
                "applied_count": len(applied),
                "failed_count": len(failed),
                "applied": applied,
                "failed": failed,
            }

    if idempotency_key:
        idem_res = IdempotencyContractService.execute(
            scope="admin_bulk_products",
            idempotency_key=idempotency_key,
            operation=_run,
        )
        result = dict(idem_res.result)
        result["idempotent_replay"] = idem_res.replayed
        return result

    result = _run()
    result["idempotent_replay"] = False
    return result

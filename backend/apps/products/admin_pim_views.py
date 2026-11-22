# apps/products/admin_pim_views.py
"""
LEVELPRO OS V4.0 — GATE 2: Endpoints administrativos PIM
- CRUD de Variantes por producto (BF-14)
- Editor de Especificaciones Técnicas y Plantillas por categoría (BF-44)
- Edición Masiva con Preview y Apply (BF-15)
- Exportación Segura Excel/CSV con RBAC y anti-formula-injection (BF-16)
"""

from decimal import Decimal, InvalidOperation
from django.db import transaction, IntegrityError
from django.db.models import Q
from django.http import HttpResponse
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied, ValidationError as DjangoValidationError
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, renderer_classes
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response


class _XlsxRenderer(BaseRenderer):
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    format = "xlsx"
    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class _CsvRenderer(BaseRenderer):
    media_type = "text/csv"
    format = "csv"
    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data

from apps.products.models import (
    Product,
    ProductVariant,
    Category,
    TechnicalAttributeDefinition,
    CategoryTechnicalTemplate,
    ProductTechnicalSpec,
)
from apps.products.serializers import (
    TechnicalAttributeDefinitionSerializer,
    ProductTechnicalSpecSerializer,
)
from apps.products.specs_catalog import (
    CATEGORY_FAMILY_TEMPLATES,
    infer_family_for_category_name,
    validate_and_normalize_spec_value,
)
from apps.products.bulk_operations import (
    BulkOperationError,
    preview_bulk_update,
    apply_bulk_update,
)
from apps.products.pim_io import export_catalog
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.mixins import SensitiveDataSerializerMixin
from core.rbac.constants import (
    MODULE_CATALOG,
    MODULE_INVENTORY,
    PERM_EDIT_PRICES,
    PERM_EDIT_COSTS,
    PERM_ADJUST_INVENTORY,
    PERM_EXPORT_DATA,
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
    ROLE_PURCHASING,
    ROLE_WAREHOUSE,
    ROLE_MARKETING,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability
from core.audit.services import record_audit_event
from core.audit.sanitizer import compute_state_diff
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_MODIFICATION,
    CATEGORY_DELETION,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)


class AdminProductVariantSerializer(SensitiveDataSerializerMixin, serializers.ModelSerializer):
    effective_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    prices = serializers.SerializerMethodField()
    in_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            "id", "product", "sku", "barcode", "name", "attributes",
            "price", "effective_price", "compare_price", "price_usd", "price_ars",
            "prices", "cost_price", "stock", "stock_min", "weight", "image",
            "is_active", "is_default", "in_stock", "order",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "product", "created_at", "updated_at"]

    def get_prices(self, obj):
        from apps.products.serializers import _get_exchange_rates
        rates = _get_exchange_rates(self.context)
        p = obj.prices_by_currency(rates["usd_to_clp"], rates["usd_to_ars"])
        return {k: str(v) for k, v in p.items()}


def _validate_variant_write_permissions(user, data):
    if is_effective_super_admin(user):
        return
    if "cost_price" in data and not user_has_capability(user, PERM_EDIT_COSTS):
        raise DjangoPermissionDenied("No posee autorización ('edit_costs') para modificar costos de variante.")
    if any(k in data for k in ("price", "compare_price", "price_usd", "price_ars")):
        if not user_has_capability(user, PERM_EDIT_PRICES):
            raise DjangoPermissionDenied("No posee autorización ('edit_prices') para modificar precios de variante.")
    if any(k in data for k in ("stock", "stock_min")):
        if not user_has_capability(user, PERM_ADJUST_INVENTORY):
            raise DjangoPermissionDenied("No posee autorización ('adjust_inventory') para modificar stock de variante.")
    if any(k in data for k in ("sku", "barcode", "name", "attributes", "is_active", "is_default", "weight", "image", "order")):
        if not user_has_capability(user, PERM_EDIT_PRICES):
            raise DjangoPermissionDenied("No posee autorización ('edit_prices') para modificar estructura de variantes.")


@rbac_endpoint(
    module=MODULE_CATALOG,
    allowed_modules=[MODULE_CATALOG, MODULE_INVENTORY],
    allowed_roles_by_method={
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_product_variants(request, product_id):
    """GET/POST /api/v1/admin/products/<product_id>/variants/"""
    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        variants = product.variants.all().order_by("order", "created_at")
        ser = AdminProductVariantSerializer(variants, many=True, context={"request": request})
        return Response({"results": ser.data, "count": len(ser.data)})

    # POST
    if product.product_type == Product.ProductType.BUNDLE:
        return Response(
            {"error": "Un kit/bundle no admite variantes directas."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        _validate_variant_write_permissions(request.user, request.data)
        ser = AdminProductVariantSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        variant = ProductVariant(product=product, **ser.validated_data)
        variant.full_clean()
        variant.save()

        if product.product_type == Product.ProductType.STOCK and int(variant.stock or 0) > 0:
            from apps.inventory.models import InventoryMovement
            from apps.inventory.services import adjust_stock, get_default_warehouse
            adjust_stock(
                warehouse=get_default_warehouse(),
                product=product,
                variant=variant,
                delta_physical=int(variant.stock),
                movement_type=InventoryMovement.MovementType.OPENING,
                reason="Apertura de stock al crear variante",
                source_document_type="ADMIN_VARIANT",
                source_document_id=str(variant.id),
                actor=request.user,
            )

        record_audit_event(
            module=MODULE_CATALOG,
            action="PRODUCT_VARIANT_CREATED",
            event_category=CATEGORY_CREATION,
            resource_type="ProductVariant",
            resource_id=str(variant.id),
            resource_repr=f"{product.name} — {variant.name} ({variant.sku})",
            new_values={"sku": variant.sku, "name": variant.name, "stock": variant.stock},
            actor=request.user,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
        out = AdminProductVariantSerializer(variant, context={"request": request}).data
        return Response(out, status=status.HTTP_201_CREATED)
    except DjangoPermissionDenied as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (DjangoValidationError, IntegrityError, serializers.ValidationError) as exc:
        transaction.set_rollback(True)
        detail = getattr(exc, "message_dict", None) or getattr(exc, "detail", None) or str(exc)
        return Response({"error": detail}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_CATALOG,
    allowed_modules=[MODULE_CATALOG, MODULE_INVENTORY],
    allowed_roles_by_method={
        "PATCH": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE],
        "DELETE": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT],
    },
)
@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_product_variant_detail(request, product_id, variant_id):
    """PATCH/DELETE /api/v1/admin/products/<product_id>/variants/<variant_id>/"""
    try:
        variant = ProductVariant.objects.select_for_update().select_related("product").get(
            pk=variant_id, product_id=product_id
        )
    except ProductVariant.DoesNotExist:
        return Response({"error": "Variante no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        vid = str(variant.id)
        vsku = variant.sku
        vname = f"{variant.product.name} — {variant.name}"
        before_active = variant.is_active
        variant.is_active = False
        variant.is_default = False
        variant.save(update_fields=["is_active", "is_default", "updated_at"])
        record_audit_event(
            module=MODULE_CATALOG,
            action="PRODUCT_VARIANT_DEACTIVATED",
            event_category=CATEGORY_DELETION,
            resource_type="ProductVariant",
            resource_id=vid,
            resource_repr=vname,
            previous_values={"sku": vsku, "name": vname, "is_active": before_active},
            new_values={"is_active": False},
            changed_fields=["is_active"],
            actor=request.user,
            severity=SEVERITY_WARNING,
            mandatory=True,
        )
        return Response(
            {
                "id": vid,
                "sku": vsku,
                "is_active": False,
                "deactivated": True,
                "detail": "Variante desactivada lógicamente para preservar referencias y reservas.",
            },
            status=status.HTTP_200_OK,
        )

    before_state = {
        "sku": variant.sku,
        "name": variant.name,
        "price": str(variant.price) if variant.price is not None else None,
        "stock": variant.stock,
        "is_active": variant.is_active,
    }
    try:
        _validate_variant_write_permissions(request.user, request.data)
        ser = AdminProductVariantSerializer(
            variant, data=request.data, partial=True, context={"request": request}
        )
        ser.is_valid(raise_exception=True)
        for k, v in ser.validated_data.items():
            setattr(variant, k, v)
        variant.full_clean()
        variant.save()

        if "stock" in ser.validated_data and variant.product.product_type == Product.ProductType.STOCK:
            from apps.inventory.models import InventoryMovement, WarehouseStock
            from apps.inventory.services import adjust_stock, get_default_warehouse
            default_wh = get_default_warehouse()
            ws = WarehouseStock.objects.filter(warehouse=default_wh, product=variant.product, variant=variant).first()
            cur_avail = ws.available_quantity if ws else 0
            delta = int(variant.stock or 0) - cur_avail
            if delta != 0:
                adjust_stock(
                    warehouse=default_wh,
                    product=variant.product,
                    variant=variant,
                    delta_physical=delta,
                    movement_type=(
                        InventoryMovement.MovementType.OPENING
                        if ws is None and delta > 0
                        else None
                    ),
                    reason="Ajuste de stock en variante desde PIM",
                    source_document_type="ADMIN_VARIANT",
                    source_document_id=str(variant.id),
                    actor=request.user,
                )

        after_state = {
            "sku": variant.sku,
            "name": variant.name,
            "price": str(variant.price) if variant.price is not None else None,
            "stock": variant.stock,
            "is_active": variant.is_active,
        }
        prev_vals, new_vals, changed = compute_state_diff(before_state, after_state)
        record_audit_event(
            module=MODULE_CATALOG,
            action="PRODUCT_VARIANT_UPDATED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="ProductVariant",
            resource_id=str(variant.id),
            resource_repr=f"{variant.product.name} — {variant.name}",
            previous_values=prev_vals,
            new_values=new_vals,
            changed_fields=changed,
            actor=request.user,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
        out = AdminProductVariantSerializer(variant, context={"request": request}).data
        return Response(out)
    except DjangoPermissionDenied as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (DjangoValidationError, IntegrityError, serializers.ValidationError) as exc:
        transaction.set_rollback(True)
        detail = getattr(exc, "message_dict", None) or getattr(exc, "detail", None) or str(exc)
        return Response({"error": detail}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(module=MODULE_CATALOG)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_technical_attributes_catalog(request):
    """
    GET /api/v1/admin/products/technical-attributes/?category_id=...
    Devuelve todas las definiciones de atributos técnicos y las claves recomendadas
    para la categoría indicada (o por inferencia de familia).
    """
    defs = TechnicalAttributeDefinition.objects.filter(is_active=True).order_by("order", "label")
    recommended_keys = []
    category_id = request.query_params.get("category_id")
    if category_id:
        tpl_keys = list(
            CategoryTechnicalTemplate.objects.filter(category_id=category_id)
            .order_by("order", "attribute__order")
            .values_list("attribute__key", flat=True)
        )
        if tpl_keys:
            recommended_keys = tpl_keys
        else:
            cat = Category.objects.filter(pk=category_id).first()
            if cat:
                fam = infer_family_for_category_name(f"{cat.slug} {cat.name}")
                recommended_keys = CATEGORY_FAMILY_TEMPLATES.get(fam, [])

    return Response({
        "attributes": TechnicalAttributeDefinitionSerializer(defs, many=True).data,
        "recommended_keys": recommended_keys,
        "family_templates": CATEGORY_FAMILY_TEMPLATES,
    })


@rbac_endpoint(
    module=MODULE_CATALOG,
    allowed_roles_by_method={
        "PUT": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_MARKETING],
    },
)
@api_view(["GET", "PUT"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_product_technical_specs(request, product_id):
    """
    GET/PUT /api/v1/admin/products/<product_id>/technical-specs/
    PUT recibe: {"specs": [{"key": "frequency_response", "value": "20 Hz - 20 kHz", "notes": "..."}, ...]}
    """
    try:
        product = Product.objects.select_related("category").get(pk=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        specs = product.technical_specs.select_related("attribute").order_by("attribute__order", "attribute__label")
        return Response({
            "product_id": str(product.id),
            "specs": ProductTechnicalSpecSerializer(specs, many=True).data,
        })

    if not is_effective_super_admin(request.user):
        from core.rbac.permissions import get_user_roles
        roles = get_user_roles(request.user)
        if not user_has_capability(request.user, PERM_EDIT_PRICES) and ROLE_MARKETING not in roles:
            return Response(
                {"error": "No posee autorización para editar especificaciones técnicas."},
                status=status.HTTP_403_FORBIDDEN,
            )

    specs_payload = request.data.get("specs")
    if not isinstance(specs_payload, list):
        return Response({"error": "'specs' debe ser una lista."}, status=status.HTTP_400_BAD_REQUEST)

    defs_by_key = {a.key: a for a in TechnicalAttributeDefinition.objects.filter(is_active=True)}
    defs_by_id = {str(a.id): a for a in defs_by_key.values()}

    saved_keys = set()
    try:
        for item in specs_payload:
            if not isinstance(item, dict):
                raise ValueError("Cada especificación debe ser un objeto.")
            adef = defs_by_key.get(item.get("key")) or defs_by_id.get(str(item.get("attribute") or ""))
            if not adef:
                raise ValueError(f"Atributo técnico no reconocido: '{item.get('key') or item.get('attribute')}'.")

            raw_val = item.get("value")
            if raw_val is None or raw_val == "" or (isinstance(raw_val, list) and len(raw_val) == 0):
                ProductTechnicalSpec.objects.filter(product=product, attribute=adef).delete()
                continue

            vtext, vnum, vjson = validate_and_normalize_spec_value(adef, raw_val)
            ProductTechnicalSpec.objects.update_or_create(
                product=product,
                attribute=adef,
                defaults={
                    "value_text": vtext,
                    "value_number": vnum,
                    "value_json": vjson,
                    "notes": str(item.get("notes") or "")[:255],
                },
            )
            saved_keys.add(adef.key)

        record_audit_event(
            module=MODULE_CATALOG,
            action="PRODUCT_SPECS_UPDATED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="Product",
            resource_id=str(product.id),
            resource_repr=f"Especificaciones técnicas de {product.name}",
            new_values={"updated_keys": sorted(saved_keys)},
            actor=request.user,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
    except ValueError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    specs = product.technical_specs.select_related("attribute").order_by("attribute__order", "attribute__label")
    return Response({
        "product_id": str(product.id),
        "specs": ProductTechnicalSpecSerializer(specs, many=True).data,
    })


@rbac_endpoint(
    module=MODULE_CATALOG,
    allowed_modules=[MODULE_CATALOG, MODULE_INVENTORY],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_products_bulk_preview(request):
    """POST /api/v1/admin/products/bulk-preview/"""
    try:
        result = preview_bulk_update(request.user, request.data or {})
        return Response(result)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except BulkOperationError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_CATALOG,
    allowed_modules=[MODULE_CATALOG, MODULE_INVENTORY],
    allowed_roles=[ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE],
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_products_bulk_apply(request):
    """POST /api/v1/admin/products/bulk-apply/"""
    idem_key = (
        request.headers.get("Idempotency-Key")
        or (request.data or {}).get("idempotency_key")
        or ""
    )
    try:
        result = apply_bulk_update(request.user, request.data or {}, idempotency_key=idem_key)
        code = status.HTTP_400_BAD_REQUEST if result.get("status") == "rolled_back" else status.HTTP_200_OK
        return Response(result, status=code)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except BulkOperationError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(module=MODULE_CATALOG, capability=PERM_EXPORT_DATA)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
@renderer_classes([JSONRenderer, _XlsxRenderer, _CsvRenderer])
def admin_products_export(request):
    """GET /api/v1/admin/products/export/?format=xlsx|csv"""
    fmt = (
        request.query_params.get("export_format")
        or request.query_params.get("format")
        or "xlsx"
    ).lower()
    if fmt not in ("xlsx", "csv"):
        return Response({"error": "Formato inválido. Usa 'xlsx' o 'csv'."}, status=status.HTTP_400_BAD_REQUEST)

    qs = Product.objects.select_related("category", "brand").prefetch_related(
        "variants", "technical_specs__attribute"
    ).order_by("name")

    is_active = request.query_params.get("is_active")
    if is_active is not None:
        qs = qs.filter(is_active=is_active.lower() in ("true", "1", "yes"))
    cat_slug = request.query_params.get("category__slug")
    if cat_slug:
        qs = qs.filter(category__slug=cat_slug)
    search = request.query_params.get("search")
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(sku__icontains=search))

    try:
        content, content_type, filename = export_catalog(request.user, fmt=fmt, queryset=qs)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    resp = HttpResponse(content, content_type=content_type)
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp

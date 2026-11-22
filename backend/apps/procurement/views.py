# apps/procurement/views.py
"""
LEVELPRO OS V4.0 — GATE 3: Endpoints Administrativos de Proveedores (BF-01 & BF-02)
"""

from decimal import Decimal, InvalidOperation
import datetime
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied, ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, renderer_classes
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response

from apps.products.models import Product, ProductVariant
from apps.procurement.models import (
    Supplier,
    SupplierContact,
    ProductSupplier,
    SupplierPriceHistory,
)
from apps.procurement.serializers import (
    SupplierSerializer,
    SupplierContactSerializer,
    ProductSupplierSerializer,
    SupplierPriceHistorySerializer,
)
from apps.procurement.services import (
    generate_supplier_internal_code,
    deactivate_supplier,
    reactivate_supplier,
    upsert_product_supplier,
    select_preferred_supplier,
    compare_suppliers_for_sku,
)
from apps.procurement.price_list_io import (
    process_price_list_import,
    export_price_lists,
    build_price_list_template_bytes,
)
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.constants import (
    MODULE_PURCHASES,
    PERM_VIEW_COSTS,
    PERM_EDIT_COSTS,
    PERM_EXPORT_DATA,
    ROLE_SUPER_ADMIN,
    ROLE_MANAGEMENT,
    ROLE_PURCHASING,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability
from core.audit.services import record_audit_event
from core.audit.sanitizer import compute_state_diff
from core.audit.constants import (
    CATEGORY_CREATION,
    CATEGORY_DELETION,
    CATEGORY_MODIFICATION,
    SEVERITY_INFO,
    SEVERITY_WARNING,
)


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


def _require_cost_edit_permission(user):
    if is_effective_super_admin(user):
        return
    if not user_has_capability(user, PERM_EDIT_COSTS):
        raise DjangoPermissionDenied("No posee permiso ('edit_costs') para modificar costos o relaciones comerciales de proveedores.")


def _can_view_costs(user) -> bool:
    return is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_COSTS)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_suppliers_list(request):
    """GET/POST /api/v1/admin/suppliers/"""
    if request.method == "GET":
        today = timezone.localdate()
        qs = (
            Supplier.objects.prefetch_related("brands", "contacts")
            .annotate(
                linked_products_count=Count("product_links", filter=Q(product_links__is_active=True), distinct=True),
                expired_lists_count=Count(
                    "product_links",
                    filter=Q(product_links__is_active=True, product_links__cost_valid_until__lt=today),
                    distinct=True,
                ),
            )
            .order_by("legal_name", "internal_code")
        )

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(internal_code__icontains=search)
                | Q(legal_name__icontains=search)
                | Q(trade_name__icontains=search)
                | Q(tax_id__icontains=search)
                | Q(country__icontains=search)
            )
        if request.query_params.get("country"):
            qs = qs.filter(country__iexact=request.query_params["country"].strip())
        if request.query_params.get("supplier_type"):
            qs = qs.filter(supplier_type=request.query_params["supplier_type"].strip())
        if request.query_params.get("currency"):
            qs = qs.filter(currency=request.query_params["currency"].strip().upper())
        if request.query_params.get("brand_id"):
            qs = qs.filter(brands__id=request.query_params["brand_id"])
        is_active_param = request.query_params.get("is_active")
        if is_active_param is not None and is_active_param != "":
            qs = qs.filter(is_active=str(is_active_param).lower() in ("true", "1", "yes"))

        results = list(qs)
        ser = SupplierSerializer(results, many=True, context={"request": request})
        total_active = sum(1 for s in results if s.is_active)
        national_count = sum(1 for s in results if s.is_active and s.country.strip().lower() == "chile")
        intl_count = total_active - national_count
        total_links = sum(getattr(s, "linked_products_count", 0) for s in results)
        total_expired = sum(getattr(s, "expired_lists_count", 0) for s in results)

        return Response({
            "count": len(results),
            "results": ser.data,
            "summary": {
                "total": len(results),
                "active": total_active,
                "national": national_count,
                "international": intl_count,
                "linked_skus": total_links,
                "expired_lists": total_expired,
            },
        })

    # POST
    data = dict(request.data)
    if not str(data.get("internal_code") or "").strip():
        data["internal_code"] = generate_supplier_internal_code()
    else:
        data["internal_code"] = str(data["internal_code"]).strip().upper()

    contacts_payload = data.pop("contacts", None) or []

    try:
        ser = SupplierSerializer(data=data, context={"request": request})
        ser.is_valid(raise_exception=True)
        supplier = ser.save()

        for c in contacts_payload:
            if not isinstance(c, dict) or not str(c.get("full_name") or "").strip():
                continue
            SupplierContact.objects.create(
                supplier=supplier,
                full_name=str(c["full_name"]).strip(),
                role_title=str(c.get("role_title") or "").strip(),
                email=str(c.get("email") or "").strip(),
                phone=str(c.get("phone") or "").strip(),
                is_primary=bool(c.get("is_primary", False)),
                notes=str(c.get("notes") or "").strip(),
            )

        record_audit_event(
            module=MODULE_PURCHASES,
            action="SUPPLIER_CREATED",
            event_category=CATEGORY_CREATION,
            resource_type="Supplier",
            resource_id=str(supplier.id),
            resource_repr=str(supplier),
            new_values={
                "internal_code": supplier.internal_code,
                "legal_name": supplier.legal_name,
                "country": supplier.country,
                "currency": supplier.currency,
            },
            actor=request.user,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
        out = SupplierSerializer(supplier, context={"request": request}).data
        return Response(out, status=status.HTTP_201_CREATED)
    except (DjangoValidationError, IntegrityError, serializers.ValidationError) as exc:
        transaction.set_rollback(True)
        detail = getattr(exc, "message_dict", None) or getattr(exc, "detail", None) or str(exc)
        return Response({"error": detail}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
        "PATCH": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
        "DELETE": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT],
    },
)
@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_supplier_detail(request, supplier_id):
    """GET/PATCH/DELETE /api/v1/admin/suppliers/<supplier_id>/"""
    today = timezone.localdate()
    try:
        supplier = (
            Supplier.objects.prefetch_related("brands", "contacts")
            .annotate(
                linked_products_count=Count("product_links", filter=Q(product_links__is_active=True), distinct=True),
                expired_lists_count=Count(
                    "product_links",
                    filter=Q(product_links__is_active=True, product_links__cost_valid_until__lt=today),
                    distinct=True,
                ),
            )
            .get(pk=supplier_id)
        )
    except Supplier.DoesNotExist:
        return Response({"error": "Proveedor no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(SupplierSerializer(supplier, context={"request": request}).data)

    if request.method == "DELETE":
        # Desactivación lógica obligatoria para preservar trazabilidad e historial
        deactivated = deactivate_supplier(supplier, request.user)
        return Response({
            "id": str(deactivated.id),
            "internal_code": deactivated.internal_code,
            "is_active": deactivated.is_active,
            "deactivated": True,
            "detail": "Proveedor desactivado lógicamente preservando relaciones e historial.",
        })

    # PATCH
    def _supplier_audit_snapshot(sup):
        return {
            "legal_name": sup.legal_name,
            "trade_name": sup.trade_name,
            "tax_id": sup.tax_id,
            "country": sup.country,
            "address": sup.address,
            "website": sup.website,
            "primary_email": sup.primary_email,
            "primary_phone": sup.primary_phone,
            "supplier_type": sup.supplier_type,
            "currency": sup.currency,
            "default_min_order_qty": sup.default_min_order_qty,
            "default_lead_time_days": sup.default_lead_time_days,
            "is_active": sup.is_active,
            "brands": sorted(str(b) for b in sup.brands.values_list("id", flat=True)),
            "has_payment_terms": bool(sup.payment_terms),
            "has_internal_notes": bool(sup.internal_notes),
        }

    Supplier.objects.select_for_update().filter(pk=supplier.pk).exists()
    before = _supplier_audit_snapshot(supplier)
    was_active = supplier.is_active
    try:
        ser = SupplierSerializer(supplier, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        updated = ser.save()
        if was_active and not updated.is_active:
            ProductSupplier.objects.filter(supplier=updated, is_preferred=True).update(is_preferred=False)

        after = _supplier_audit_snapshot(updated)
        if "payment_terms" in request.data and request.data.get("payment_terms") != before.get("has_payment_terms"):
            after["payment_terms_modified"] = True
        if "internal_notes" in request.data:
            after["internal_notes_modified"] = True
        prev_vals, new_vals, changed = compute_state_diff(before, after)
        if changed:
            record_audit_event(
                module=MODULE_PURCHASES,
                action="SUPPLIER_UPDATED",
                event_category=CATEGORY_MODIFICATION,
                resource_type="Supplier",
                resource_id=str(updated.id),
                resource_repr=str(updated),
                previous_values=prev_vals,
                new_values=new_vals,
                changed_fields=changed,
                actor=request.user,
                severity=SEVERITY_INFO,
                mandatory=True,
            )
        return Response(SupplierSerializer(updated, context={"request": request}).data)
    except (DjangoValidationError, IntegrityError, serializers.ValidationError) as exc:
        transaction.set_rollback(True)
        detail = getattr(exc, "message_dict", None) or getattr(exc, "detail", None) or str(exc)
        return Response({"error": detail}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_supplier_reactivate(request, supplier_id):
    """POST /api/v1/admin/suppliers/<supplier_id>/reactivate/"""
    try:
        supplier = Supplier.objects.get(pk=supplier_id)
    except Supplier.DoesNotExist:
        return Response({"error": "Proveedor no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    reactivated = reactivate_supplier(supplier, request.user)
    return Response(SupplierSerializer(reactivated, context={"request": request}).data)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_supplier_contacts(request, supplier_id):
    """GET/POST /api/v1/admin/suppliers/<supplier_id>/contacts/"""
    try:
        supplier = Supplier.objects.get(pk=supplier_id)
    except Supplier.DoesNotExist:
        return Response({"error": "Proveedor no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        ser = SupplierContactSerializer(supplier.contacts.all(), many=True)
        return Response({"results": ser.data, "count": len(ser.data)})

    ser = SupplierContactSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    contact = SupplierContact.objects.create(supplier=supplier, **ser.validated_data)
    record_audit_event(
        module=MODULE_PURCHASES,
        action="SUPPLIER_CONTACT_CREATED",
        event_category=CATEGORY_CREATION,
        resource_type="SupplierContact",
        resource_id=str(contact.id),
        resource_repr=f"{supplier.internal_code} · {contact.full_name}",
        new_values={
            "supplier": supplier.internal_code,
            "full_name": contact.full_name,
            "role_title": contact.role_title,
            "is_primary": contact.is_primary,
        },
        actor=request.user,
        severity=SEVERITY_INFO,
        mandatory=True,
    )
    return Response(SupplierContactSerializer(contact).data, status=status.HTTP_201_CREATED)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "PATCH": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
        "DELETE": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
    },
)
@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_supplier_contact_detail(request, supplier_id, contact_id):
    """PATCH/DELETE /api/v1/admin/suppliers/<supplier_id>/contacts/<contact_id>/"""
    try:
        contact = SupplierContact.objects.select_related("supplier").get(pk=contact_id, supplier_id=supplier_id)
    except SupplierContact.DoesNotExist:
        return Response({"error": "Contacto no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        cid = str(contact.id)
        sup_code = contact.supplier.internal_code
        cname = contact.full_name
        contact.delete()
        record_audit_event(
            module=MODULE_PURCHASES,
            action="SUPPLIER_CONTACT_DELETED",
            event_category=CATEGORY_DELETION,
            resource_type="SupplierContact",
            resource_id=cid,
            resource_repr=f"{sup_code} · {cname}",
            previous_values={"supplier": sup_code, "full_name": cname},
            actor=request.user,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    before_c = {
        "full_name": contact.full_name,
        "role_title": contact.role_title,
        "is_primary": contact.is_primary,
        "has_email": bool(contact.email),
        "has_phone": bool(contact.phone),
    }
    ser = SupplierContactSerializer(contact, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    updated_c = ser.save()
    after_c = {
        "full_name": updated_c.full_name,
        "role_title": updated_c.role_title,
        "is_primary": updated_c.is_primary,
        "has_email": bool(updated_c.email),
        "has_phone": bool(updated_c.phone),
    }
    prev_vals, new_vals, changed = compute_state_diff(before_c, after_c)
    if changed:
        record_audit_event(
            module=MODULE_PURCHASES,
            action="SUPPLIER_CONTACT_UPDATED",
            event_category=CATEGORY_MODIFICATION,
            resource_type="SupplierContact",
            resource_id=str(updated_c.id),
            resource_repr=f"{updated_c.supplier.internal_code} · {updated_c.full_name}",
            previous_values=prev_vals,
            new_values=new_vals,
            changed_fields=changed,
            actor=request.user,
            severity=SEVERITY_INFO,
            mandatory=True,
        )
    return Response(ser.data)


def _parse_product_supplier_payload(data, default_currency="USD"):
    raw_cost = data.get("unit_cost")
    if raw_cost is None or raw_cost == "":
        raise ValueError("unit_cost es obligatorio.")
    try:
        unit_cost = Decimal(str(raw_cost).strip())
    except (InvalidOperation, ValueError):
        raise ValueError("unit_cost inválido.")

    currency = str(data.get("currency") or default_currency).strip().upper()
    tax_basis = str(data.get("tax_basis") or ProductSupplier.TaxBasis.NET).strip().lower()
    moq = int(data.get("moq") or 1)
    lead_time_days = int(data.get("lead_time_days") if data.get("lead_time_days") is not None else 7)
    avail = str(data.get("reported_availability") or ProductSupplier.AvailabilityStatus.UNKNOWN).strip().lower()
    avail_qty = data.get("reported_available_qty")
    avail_qty = int(avail_qty) if avail_qty not in (None, "") else None

    def _d(val):
        if not val:
            return None
        return datetime.date.fromisoformat(str(val).strip())

    return {
        "supplier_sku": str(data.get("supplier_sku") or "").strip(),
        "unit_cost": unit_cost,
        "currency": currency,
        "tax_basis": tax_basis,
        "moq": moq,
        "lead_time_days": lead_time_days,
        "reported_availability": avail,
        "reported_available_qty": avail_qty,
        "cost_valid_from": _d(data.get("cost_valid_from")),
        "cost_valid_until": _d(data.get("cost_valid_until")),
        "is_active": bool(data.get("is_active", True)),
        "commercial_notes": str(data.get("commercial_notes") or "").strip(),
    }


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_supplier_products(request, supplier_id):
    """GET/POST /api/v1/admin/suppliers/<supplier_id>/products/"""
    try:
        supplier = Supplier.objects.get(pk=supplier_id)
    except Supplier.DoesNotExist:
        return Response({"error": "Proveedor no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        links = (
            ProductSupplier.objects.select_related("supplier", "product", "variant")
            .filter(supplier=supplier)
            .order_by("-is_active", "-is_preferred", "product__name")
        )
        ser = ProductSupplierSerializer(links, many=True, context={"request": request})
        return Response({"results": ser.data, "count": len(ser.data)})

    # POST
    try:
        _require_cost_edit_permission(request.user)
        product_id = request.data.get("product") or request.data.get("product_id")
        variant_id = request.data.get("variant") or request.data.get("variant_id") or None
        if not product_id:
            return Response({"error": "Debe especificar 'product'."}, status=status.HTTP_400_BAD_REQUEST)
        product = Product.objects.get(pk=product_id)
        variant = ProductVariant.objects.get(pk=variant_id, product=product) if variant_id else None
        parsed = _parse_product_supplier_payload(request.data, default_currency=supplier.currency)
        link, created = upsert_product_supplier(
            supplier=supplier,
            product=product,
            variant=variant,
            actor=request.user,
            source=SupplierPriceHistory.Source.MANUAL,
            **parsed,
        )
        out = ProductSupplierSerializer(link, context={"request": request}).data
        return Response(out, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (Product.DoesNotExist, ProductVariant.DoesNotExist):
        return Response({"error": "Producto o variante no encontrados."}, status=status.HTTP_404_NOT_FOUND)
    except (DjangoValidationError, ValueError, IntegrityError) as exc:
        detail = getattr(exc, "message_dict", None) or str(exc)
        return Response({"error": detail}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "PATCH": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
        "DELETE": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
    },
)
@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_supplier_product_detail(request, supplier_id, link_id):
    """PATCH/DELETE /api/v1/admin/suppliers/<supplier_id>/products/<link_id>/"""
    try:
        link = ProductSupplier.objects.select_for_update(of=("self",)).select_related("supplier", "product", "variant").get(
            pk=link_id, supplier_id=supplier_id
        )
    except ProductSupplier.DoesNotExist:
        return Response({"error": "Relación producto-proveedor no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        was_preferred = link.is_preferred
        link.is_active = False
        link.is_preferred = False
        link.save(update_fields=["is_active", "is_preferred", "updated_at"])
        record_audit_event(
            module=MODULE_PURCHASES,
            action="PRODUCT_SUPPLIER_DEACTIVATED",
            event_category=CATEGORY_DELETION,
            resource_type="ProductSupplier",
            resource_id=str(link.id),
            resource_repr=str(link),
            previous_values={"is_active": True, "is_preferred": was_preferred},
            new_values={"is_active": False, "is_preferred": False},
            changed_fields=["is_active", "is_preferred"] if was_preferred else ["is_active"],
            actor=request.user,
            severity=SEVERITY_WARNING,
            mandatory=True,
        )
        return Response({"id": str(link.id), "is_active": False, "deactivated": True})

    try:
        _require_cost_edit_permission(request.user)
        merged = {
            "supplier_sku": request.data.get("supplier_sku", link.supplier_sku),
            "unit_cost": request.data.get("unit_cost", str(link.unit_cost)),
            "currency": request.data.get("currency", link.currency),
            "tax_basis": request.data.get("tax_basis", link.tax_basis),
            "moq": request.data.get("moq", link.moq),
            "lead_time_days": request.data.get("lead_time_days", link.lead_time_days),
            "reported_availability": request.data.get("reported_availability", link.reported_availability),
            "reported_available_qty": request.data.get("reported_available_qty", link.reported_available_qty),
            "cost_valid_from": request.data.get("cost_valid_from", link.cost_valid_from.isoformat() if link.cost_valid_from else None),
            "cost_valid_until": request.data.get("cost_valid_until", link.cost_valid_until.isoformat() if link.cost_valid_until else None),
            "is_active": request.data.get("is_active", link.is_active),
            "commercial_notes": request.data.get("commercial_notes", link.commercial_notes),
        }
        parsed = _parse_product_supplier_payload(merged, default_currency=link.currency)
        updated, _ = upsert_product_supplier(
            supplier=link.supplier,
            product=link.product,
            variant=link.variant,
            actor=request.user,
            source=SupplierPriceHistory.Source.MANUAL,
            **parsed,
        )
        return Response(ProductSupplierSerializer(updated, context={"request": request}).data)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (DjangoValidationError, ValueError, IntegrityError) as exc:
        detail = getattr(exc, "message_dict", None) or str(exc)
        return Response({"error": detail}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_supplier_price_history(request, supplier_id):
    """GET /api/v1/admin/suppliers/<supplier_id>/price-history/"""
    qs = (
        SupplierPriceHistory.objects.select_related("supplier", "product", "variant", "changed_by")
        .filter(supplier_id=supplier_id)
        .order_by("-recorded_at", "-created_at")[:200]
    )
    ser = SupplierPriceHistorySerializer(qs, many=True, context={"request": request})
    return Response({"results": ser.data, "count": len(ser.data)})


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
    capability=PERM_EDIT_COSTS,
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_supplier_price_lists_import(request):
    """POST /api/v1/admin/suppliers/price-lists/import/?dry_run=true|false"""
    upload = request.FILES.get("file")
    if upload is None:
        return Response({"error": "Debe adjuntar un archivo .xlsx o .csv en el campo 'file'."}, status=status.HTTP_400_BAD_REQUEST)

    dry_run_q = request.query_params.get("dry_run")
    confirm_q = request.query_params.get("confirm")
    if confirm_q is not None and str(confirm_q).lower() in ("true", "1", "yes"):
        dry_run = False
    elif dry_run_q is not None:
        dry_run = str(dry_run_q).lower() in ("true", "1", "yes")
    else:
        dry_run = True

    allow_expired = str(request.query_params.get("allow_expired") or "false").lower() in ("true", "1", "yes")
    idem_key = request.headers.get("Idempotency-Key") or request.data.get("idempotency_key") or ""

    try:
        res = process_price_list_import(
            user=request.user,
            file_bytes=upload.read(),
            filename=upload.name,
            dry_run=dry_run,
            allow_expired=allow_expired,
            idempotency_key=str(idem_key),
        )
        return Response(res)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
    capability=PERM_EXPORT_DATA,
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
@renderer_classes([JSONRenderer, _XlsxRenderer, _CsvRenderer])
def admin_supplier_price_lists_export(request):
    """GET /api/v1/admin/suppliers/price-lists/export/?format=xlsx|csv"""
    fmt = request.query_params.get("export_format") or request.query_params.get("format") or "xlsx"
    supplier_id = request.query_params.get("supplier_id") or None
    try:
        content, content_type, filename = export_price_lists(request.user, fmt=fmt, supplier_id=supplier_id)
        resp = HttpResponse(content, content_type=content_type)
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
@renderer_classes([JSONRenderer, _XlsxRenderer, _CsvRenderer])
def admin_supplier_price_lists_template(request):
    """GET /api/v1/admin/suppliers/price-lists/template/?format=xlsx|csv"""
    fmt = request.query_params.get("export_format") or request.query_params.get("format") or "xlsx"
    content, content_type, filename = build_price_list_template_bytes(fmt=fmt)
    resp = HttpResponse(content, content_type=content_type)
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
def admin_product_suppliers(request, product_id):
    """
    GET /api/v1/admin/products/<product_id>/suppliers/?variant_id=...&sort=cost|lead_time|moq|preferred&include_referential=false&target_currency=CLP
    POST /api/v1/admin/products/<product_id>/suppliers/
    """
    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        variant_id = request.query_params.get("variant_id") or None
        variant = None
        if variant_id:
            try:
                variant = ProductVariant.objects.get(pk=variant_id, product=product)
            except ProductVariant.DoesNotExist:
                return Response({"error": "Variante no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        sort_by = request.query_params.get("sort") or "cost"
        include_ref = str(request.query_params.get("include_referential") or "false").lower() in ("true", "1", "yes")
        target_curr = (request.query_params.get("target_currency") or "CLP").upper()

        comparison = compare_suppliers_for_sku(
            product,
            variant=variant,
            sort_by=sort_by,
            include_referential=include_ref,
            target_currency=target_curr,
            include_costs=_can_view_costs(request.user),
        )
        return Response(comparison)

    # POST
    try:
        _require_cost_edit_permission(request.user)
        supplier_id = request.data.get("supplier") or request.data.get("supplier_id")
        if not supplier_id:
            return Response({"error": "Debe seleccionar un proveedor."}, status=status.HTTP_400_BAD_REQUEST)
        supplier = Supplier.objects.get(pk=supplier_id)
        variant_id = request.data.get("variant") or request.data.get("variant_id") or None
        variant = ProductVariant.objects.get(pk=variant_id, product=product) if variant_id else None
        parsed = _parse_product_supplier_payload(request.data, default_currency=supplier.currency)
        link, created = upsert_product_supplier(
            supplier=supplier,
            product=product,
            variant=variant,
            actor=request.user,
            source=SupplierPriceHistory.Source.MANUAL,
            **parsed,
        )
        out = ProductSupplierSerializer(link, context={"request": request}).data
        return Response(out, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except (Supplier.DoesNotExist, ProductVariant.DoesNotExist):
        return Response({"error": "Proveedor o variante no encontrados."}, status=status.HTTP_404_NOT_FOUND)
    except (DjangoValidationError, ValueError, IntegrityError) as exc:
        detail = getattr(exc, "message_dict", None) or str(exc)
        return Response({"error": detail}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def admin_product_supplier_select_preferred(request, product_id, link_id):
    """POST /api/v1/admin/products/<product_id>/suppliers/<link_id>/select-preferred/"""
    try:
        _require_cost_edit_permission(request.user)
        link = ProductSupplier.objects.get(pk=link_id, product_id=product_id)
        updated = select_preferred_supplier(link.id, request.user)
        return Response(ProductSupplierSerializer(updated, context={"request": request}).data)
    except DjangoPermissionDenied as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except ProductSupplier.DoesNotExist:
        return Response({"error": "Relación producto-proveedor no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except DjangoValidationError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_product_supplier_price_history(request, product_id):
    """GET /api/v1/admin/products/<product_id>/supplier-price-history/?variant_id=..."""
    qs = SupplierPriceHistory.objects.select_related("supplier", "product", "variant", "changed_by").filter(product_id=product_id)
    variant_id = request.query_params.get("variant_id")
    if variant_id:
        qs = qs.filter(variant_id=variant_id)
    qs = qs.order_by("-recorded_at", "-created_at")[:200]
    ser = SupplierPriceHistorySerializer(qs, many=True, context={"request": request})
    return Response({"results": ser.data, "count": len(ser.data)})

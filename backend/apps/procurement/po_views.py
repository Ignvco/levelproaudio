"""Vistas API administrativas para PurchaseOrder (BF-03), GoodsReceipt (BF-04) y CustomsDocument (BF-42)."""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.inventory.models import Warehouse
from apps.procurement.models import CustomsDocument, GoodsReceipt, PurchaseOrder, Supplier
from apps.procurement.po_pdf_generator import generate_purchase_order_pdf
from apps.procurement.po_serializers import (
    CustomsDocumentSerializer,
    GoodsReceiptSerializer,
    PurchaseOrderSerializer,
)
from apps.procurement.po_services import (
    ProcurementServiceError,
    approve_purchase_order,
    cancel_purchase_order,
    close_purchase_order,
    confirm_goods_receipt,
    create_goods_receipt,
    create_purchase_order,
    issue_purchase_order,
    update_purchase_order,
    upload_customs_document,
)
from apps.products.models import SpecialOrderRequest
from core.rbac.constants import (
    MODULE_PURCHASES,
    PERM_ADJUST_INVENTORY,
    PERM_VIEW_COSTS,
    ROLE_FINANCE,
    ROLE_MANAGEMENT,
    ROLE_PURCHASING,
    ROLE_SUPER_ADMIN,
    ROLE_WAREHOUSE,
)
from core.admin_permissions import IsAdminOrStaff, rbac_endpoint
from core.rbac.permissions import is_effective_super_admin, user_has_capability


def _can_view_costs(user) -> bool:
    return is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_COSTS)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE, ROLE_FINANCE],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_purchase_orders_list(request):
    """GET/POST /api/v1/admin/purchase-orders/"""
    include_costs = _can_view_costs(request.user)
    if request.method == "GET":
        qs = PurchaseOrder.objects.select_related("supplier", "destination_warehouse").prefetch_related(
            "items", "items__product", "items__variant", "customs_documents"
        )
        st = (request.query_params.get("status") or "").strip()
        if st:
            qs = qs.filter(status=st)
        sup_id = (request.query_params.get("supplier") or "").strip()
        if sup_id:
            qs = qs.filter(supplier_id=sup_id)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(po_number__icontains=search)
                | Q(supplier__legal_name__icontains=search)
                | Q(supplier__trade_name__icontains=search)
            )
        ser = PurchaseOrderSerializer(qs[:200], many=True, context={"include_costs": include_costs})
        return Response({"results": ser.data, "count": len(ser.data)})

    try:
        supplier = Supplier.objects.get(pk=request.data.get("supplier_id") or request.data.get("supplier"))
        wh_id = request.data.get("destination_warehouse_id") or request.data.get("destination_warehouse")
        wh = Warehouse.objects.get(pk=wh_id) if wh_id else None
        po = create_purchase_order(
            supplier=supplier,
            destination_warehouse=wh,
            items=request.data.get("items") or [],
            po_number=request.data.get("po_number") or "",
            currency=request.data.get("currency"),
            payment_terms=request.data.get("payment_terms_snapshot"),
            incoterm=request.data.get("incoterm_snapshot") or "",
            tax_basis=request.data.get("tax_basis_snapshot") or "net",
            delivery_address=request.data.get("delivery_address_snapshot") or "",
            expected_delivery_date=request.data.get("expected_delivery_date") or None,
            internal_notes=request.data.get("internal_notes") or "",
            external_notes=request.data.get("external_notes") or "",
            special_order_request_ids=request.data.get("special_order_request_ids") or None,
            actor=request.user,
        )
        return Response(
            PurchaseOrderSerializer(po, context={"include_costs": include_costs}).data,
            status=status.HTTP_201_CREATED,
        )
    except (Supplier.DoesNotExist, Warehouse.DoesNotExist):
        return Response({"error": "Proveedor o bodega no encontrados."}, status=status.HTTP_404_NOT_FOUND)
    except (ProcurementServiceError, ValueError, KeyError) as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE, ROLE_FINANCE],
        "PATCH": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
    },
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_purchase_order_detail(request, po_id):
    """GET/PATCH /api/v1/admin/purchase-orders/<po_id>/"""
    try:
        po = PurchaseOrder.objects.select_related("supplier", "destination_warehouse").prefetch_related(
            "items", "items__product", "items__variant", "customs_documents"
        ).get(pk=po_id)
    except PurchaseOrder.DoesNotExist:
        return Response({"error": "Orden de compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    include_costs = _can_view_costs(request.user)
    if request.method == "GET":
        return Response(PurchaseOrderSerializer(po, context={"include_costs": include_costs}).data)

    try:
        po = update_purchase_order(po, payload=request.data, actor=request.user)
        return Response(PurchaseOrderSerializer(po, context={"include_costs": include_costs}).data)
    except ProcurementServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_purchase_order_approve(request, po_id):
    try:
        po = PurchaseOrder.objects.get(pk=po_id)
        po = approve_purchase_order(po, actor=request.user)
        return Response(PurchaseOrderSerializer(po, context={"include_costs": _can_view_costs(request.user)}).data)
    except PurchaseOrder.DoesNotExist:
        return Response({"error": "Orden de compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except ProcurementServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_purchase_order_issue(request, po_id):
    try:
        po = PurchaseOrder.objects.get(pk=po_id)
        po = issue_purchase_order(po, actor=request.user)
        return Response(PurchaseOrderSerializer(po, context={"include_costs": _can_view_costs(request.user)}).data)
    except PurchaseOrder.DoesNotExist:
        return Response({"error": "Orden de compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except ProcurementServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_purchase_order_cancel(request, po_id):
    try:
        po = PurchaseOrder.objects.get(pk=po_id)
        po = cancel_purchase_order(po, reason=request.data.get("reason") or "", actor=request.user)
        return Response(PurchaseOrderSerializer(po, context={"include_costs": _can_view_costs(request.user)}).data)
    except PurchaseOrder.DoesNotExist:
        return Response({"error": "Orden de compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except ProcurementServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_purchase_order_close(request, po_id):
    try:
        po = PurchaseOrder.objects.get(pk=po_id)
        po = close_purchase_order(po, reason=request.data.get("reason") or "", actor=request.user)
        return Response(PurchaseOrderSerializer(po, context={"include_costs": _can_view_costs(request.user)}).data)
    except PurchaseOrder.DoesNotExist:
        return Response({"error": "Orden de compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except ProcurementServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_FINANCE]},
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_purchase_order_pdf(request, po_id):
    """GET /api/v1/admin/purchase-orders/<po_id>/pdf/"""
    if not _can_view_costs(request.user):
        return Response({"error": "No posee permiso 'view_costs' para descargar el PDF con costos."}, status=status.HTTP_403_FORBIDDEN)
    try:
        po = PurchaseOrder.objects.select_related("supplier", "destination_warehouse").prefetch_related("items").get(pk=po_id)
    except PurchaseOrder.DoesNotExist:
        return Response({"error": "Orden de compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    pdf_bytes = bytes(po.issued_pdf_bytes) if po.issued_pdf_bytes else generate_purchase_order_pdf(po, include_costs=True)
    filename = po.issued_pdf_filename or f"{po.po_number}.pdf"
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="{filename}"'
    return resp


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_purchase_order_link_special_orders(request, po_id):
    try:
        po = PurchaseOrder.objects.get(pk=po_id)
        ids = request.data.get("special_order_request_ids") or []
        reqs = SpecialOrderRequest.objects.filter(pk__in=ids)
        po.special_order_requests.set(reqs)
        return Response({"po_id": str(po.id), "special_order_request_ids": [str(r.id) for r in reqs]})
    except PurchaseOrder.DoesNotExist:
        return Response({"error": "Orden de compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE, ROLE_FINANCE],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_goods_receipts_list(request):
    """GET/POST /api/v1/admin/goods-receipts/"""
    if request.method == "GET":
        qs = GoodsReceipt.objects.select_related("purchase_order", "purchase_order__supplier", "warehouse").prefetch_related(
            "items", "items__purchase_order_item", "items__inventory_movement"
        )
        po_id = (request.query_params.get("purchase_order") or "").strip()
        if po_id:
            qs = qs.filter(purchase_order_id=po_id)
        st = (request.query_params.get("status") or "").strip()
        if st:
            qs = qs.filter(status=st)
        ser = GoodsReceiptSerializer(qs[:200], many=True)
        return Response({"results": ser.data, "count": len(ser.data)})

    if not (is_effective_super_admin(request.user) or user_has_capability(request.user, PERM_ADJUST_INVENTORY)):
        return Response({"error": "Requiere capacidad 'adjust_inventory' para crear recepciones."}, status=status.HTTP_403_FORBIDDEN)

    try:
        po = PurchaseOrder.objects.get(pk=request.data.get("purchase_order_id") or request.data.get("purchase_order"))
        wh = Warehouse.objects.get(pk=request.data.get("warehouse_id") or request.data.get("warehouse"))
        gr = create_goods_receipt(
            purchase_order=po,
            warehouse=wh,
            items=request.data.get("items") or [],
            delivery_note_number=request.data.get("delivery_note_number") or "",
            notes=request.data.get("notes") or "",
            discrepancy_notes=request.data.get("discrepancy_notes") or "",
            actor=request.user,
        )
        if request.data.get("confirm"):
            idem = request.headers.get("Idempotency-Key") or request.data.get("idempotency_key") or None
            gr = confirm_goods_receipt(gr, idempotency_key=idem, actor=request.user)
        return Response(GoodsReceiptSerializer(gr).data, status=status.HTTP_201_CREATED)
    except (PurchaseOrder.DoesNotExist, Warehouse.DoesNotExist):
        return Response({"error": "Orden de compra o bodega no encontrados."}, status=status.HTTP_404_NOT_FOUND)
    except (ProcurementServiceError, ValueError, KeyError) as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE, ROLE_FINANCE]},
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_goods_receipt_detail(request, gr_id):
    try:
        gr = GoodsReceipt.objects.select_related("purchase_order", "purchase_order__supplier", "warehouse").prefetch_related(
            "items", "items__purchase_order_item", "items__inventory_movement"
        ).get(pk=gr_id)
        return Response(GoodsReceiptSerializer(gr).data)
    except GoodsReceipt.DoesNotExist:
        return Response({"error": "Recepción no encontrada."}, status=status.HTTP_404_NOT_FOUND)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_WAREHOUSE]},
)
@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@transaction.atomic
def admin_goods_receipt_confirm(request, gr_id):
    if not (is_effective_super_admin(request.user) or user_has_capability(request.user, PERM_ADJUST_INVENTORY)):
        return Response({"error": "Requiere capacidad 'adjust_inventory' para confirmar recepciones."}, status=status.HTTP_403_FORBIDDEN)
    try:
        gr = GoodsReceipt.objects.get(pk=gr_id)
        idem = request.headers.get("Idempotency-Key") or request.data.get("idempotency_key") or None
        gr = confirm_goods_receipt(gr, idempotency_key=idem, actor=request.user)
        return Response(GoodsReceiptSerializer(gr).data)
    except GoodsReceipt.DoesNotExist:
        return Response({"error": "Recepción no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    except ProcurementServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={
        "GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE, ROLE_FINANCE],
        "POST": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING],
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminOrStaff])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@transaction.atomic
def admin_purchase_order_documents(request, po_id):
    """GET/POST /api/v1/admin/purchase-orders/<po_id>/documents/"""
    try:
        po = PurchaseOrder.objects.get(pk=po_id)
    except PurchaseOrder.DoesNotExist:
        return Response({"error": "Orden de compra no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        docs = CustomsDocument.objects.filter(purchase_order=po).select_related("uploaded_by")
        return Response({"results": CustomsDocumentSerializer(docs, many=True).data})

    file_obj = request.FILES.get("file")
    if file_obj is None:
        return Response({"error": "Debe adjuntar un archivo en el campo 'file'."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        doc = upload_customs_document(
            purchase_order=po,
            document_type=request.data.get("document_type") or "",
            document_identifier=request.data.get("document_identifier") or "",
            filename=file_obj.name,
            content_type=getattr(file_obj, "content_type", "application/octet-stream"),
            file_bytes=file_obj.read(),
            document_date=request.data.get("document_date") or None,
            notes=request.data.get("notes") or "",
            actor=request.user,
        )
        return Response(CustomsDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)
    except ProcurementServiceError as exc:
        transaction.set_rollback(True)
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@rbac_endpoint(
    module=MODULE_PURCHASES,
    allowed_roles_by_method={"GET": [ROLE_SUPER_ADMIN, ROLE_MANAGEMENT, ROLE_PURCHASING, ROLE_WAREHOUSE, ROLE_FINANCE]},
)
@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_customs_document_download(request, po_id, doc_id):
    try:
        doc = CustomsDocument.objects.get(pk=doc_id, purchase_order_id=po_id)
    except CustomsDocument.DoesNotExist:
        return Response({"error": "Documento no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    resp = HttpResponse(bytes(doc.file_bytes), content_type=doc.content_type or "application/octet-stream")
    resp["Content-Disposition"] = f'attachment; filename="{doc.filename}"'
    return resp

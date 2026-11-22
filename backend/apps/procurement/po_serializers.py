"""Serializadores DRF para PurchaseOrder, GoodsReceipt y CustomsDocument (Gate 5)."""

from rest_framework import serializers
from apps.procurement.models import (
    CustomsDocument,
    GoodsReceipt,
    GoodsReceiptItem,
    PurchaseOrder,
    PurchaseOrderItem,
)


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    quantity_pending = serializers.IntegerField(read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, default="")
    serialization_mode = serializers.CharField(source="product.serialization_mode", read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id",
            "product",
            "product_name",
            "variant",
            "variant_name",
            "serialization_mode",
            "internal_sku_snapshot",
            "supplier_sku_snapshot",
            "description_snapshot",
            "quantity_ordered",
            "quantity_received",
            "quantity_pending",
            "unit_cost_snapshot",
            "currency",
            "original_currency_snapshot",
            "original_unit_cost_snapshot",
            "fx_rate_snapshot",
            "fx_rate_source",
            "fx_effective_date",
            "tax_basis_snapshot",
            "line_subtotal",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get("include_costs", True):
            data["unit_cost_snapshot"] = None
            data["original_unit_cost_snapshot"] = None
            data["fx_rate_snapshot"] = None
            data["line_subtotal"] = None
        return data


class CustomsDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True, default="")
    document_type_display = serializers.CharField(source="get_document_type_display", read_only=True)
    is_financial_sensitive = serializers.BooleanField(read_only=True)
    download_allowed = serializers.SerializerMethodField()

    class Meta:
        model = CustomsDocument
        fields = [
            "id",
            "purchase_order",
            "document_type",
            "document_type_display",
            "sensitivity_level",
            "is_financial_sensitive",
            "download_allowed",
            "document_identifier",
            "document_date",
            "filename",
            "content_type",
            "file_size",
            "file_sha256",
            "version",
            "status",
            "notes",
            "uploaded_by_email",
            "created_at",
        ]

    def get_download_allowed(self, obj) -> bool:
        include_costs = self.context.get("include_costs", True)
        if obj.is_financial_sensitive and not include_costs:
            return False
        return True

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_financial_sensitive and not self.context.get("include_costs", True):
            data["notes"] = ""
        return data


class GoodsReceiptItemSerializer(serializers.ModelSerializer):
    internal_sku = serializers.CharField(source="purchase_order_item.internal_sku_snapshot", read_only=True)
    description = serializers.CharField(source="purchase_order_item.description_snapshot", read_only=True)
    quantity_physical_received = serializers.IntegerField(read_only=True)
    inventory_movement_id = serializers.UUIDField(source="inventory_movement.id", read_only=True, allow_null=True)

    class Meta:
        model = GoodsReceiptItem
        fields = [
            "id",
            "purchase_order_item",
            "internal_sku",
            "description",
            "quantity_arrived",
            "quantity_accepted",
            "quantity_damaged",
            "quantity_rejected",
            "quantity_physical_received",
            "serial_numbers",
            "damaged_serial_numbers",
            "discrepancy_reason",
            "inventory_movement_id",
        ]


class GoodsReceiptSerializer(serializers.ModelSerializer):
    po_number = serializers.CharField(source="purchase_order.po_number", read_only=True)
    supplier_name = serializers.SerializerMethodField()
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    items = GoodsReceiptItemSerializer(many=True, read_only=True)

    class Meta:
        model = GoodsReceipt
        fields = [
            "id",
            "receipt_number",
            "purchase_order",
            "po_number",
            "supplier_name",
            "warehouse",
            "warehouse_code",
            "warehouse_name",
            "status",
            "received_at",
            "confirmed_at",
            "delivery_note_number",
            "notes",
            "discrepancy_notes",
            "items",
            "created_at",
        ]

    def get_supplier_name(self, obj):
        sup = obj.purchase_order.supplier
        return sup.trade_name or sup.legal_name


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.SerializerMethodField()
    supplier_code = serializers.CharField(source="supplier.internal_code", read_only=True)
    warehouse_code = serializers.CharField(source="destination_warehouse.code", read_only=True, default="")
    warehouse_name = serializers.CharField(source="destination_warehouse.name", read_only=True, default="")
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    customs_documents = CustomsDocumentSerializer(many=True, read_only=True)
    goods_receipts_count = serializers.SerializerMethodField()
    special_order_request_ids = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "po_number",
            "supplier",
            "supplier_code",
            "supplier_name",
            "destination_warehouse",
            "warehouse_code",
            "warehouse_name",
            "status",
            "status_display",
            "currency",
            "payment_terms_snapshot",
            "incoterm_snapshot",
            "tax_basis_snapshot",
            "delivery_address_snapshot",
            "expected_delivery_date",
            "approved_at",
            "issued_at",
            "internal_notes",
            "external_notes",
            "subtotal_amount",
            "total_amount",
            "revision_number",
            "issued_pdf_version",
            "issued_pdf_filename",
            "items",
            "customs_documents",
            "goods_receipts_count",
            "special_order_request_ids",
            "created_at",
            "updated_at",
        ]

    def get_supplier_name(self, obj):
        return obj.supplier.trade_name or obj.supplier.legal_name

    def get_goods_receipts_count(self, obj):
        return obj.goods_receipts.count()

    def get_special_order_request_ids(self, obj):
        return [str(x) for x in obj.special_order_requests.values_list("id", flat=True)]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get("include_costs", True):
            data["subtotal_amount"] = None
            data["total_amount"] = None
        return data

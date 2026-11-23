# apps/orders/oms_serializers.py
"""
LEVELPRO OS V4.0 — GATE 7: OMS SERIALIZERS
Serializers con enmascaramiento RBAC de costos internos y snapshots comerciales:
- DraftOrderItemSerializer & DraftOrderSerializer (BF-11 & BF-12)
- RMAItemSerializer & RMASerializer (BF-23)
"""

from rest_framework import serializers

from apps.orders.models import (
    DraftOrder,
    DraftOrderItem,
    ReturnMerchandiseAuthorization,
    RMAItem,
)
from core.rbac.constants import PERM_VIEW_COSTS
from core.rbac.permissions import is_effective_super_admin, user_has_capability


def _can_view_internal_costs(context) -> bool:
    request = (context or {}).get("request")
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return is_effective_super_admin(user) or user_has_capability(user, PERM_VIEW_COSTS)


class DraftOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DraftOrderItem
        fields = [
            "id",
            "product",
            "variant",
            "sku_snapshot",
            "product_name_snapshot",
            "variant_name_snapshot",
            "product_type_snapshot",
            "quantity",
            "catalog_unit_price_snapshot",
            "authorized_unit_price",
            "currency",
            "discount_percent",
            "subtotal",
            "notes",
            "created_at",
        ]


class DraftOrderSerializer(serializers.ModelSerializer):
    items = DraftOrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    channel_display = serializers.CharField(source="get_channel_display", read_only=True)
    sales_rep_email = serializers.SerializerMethodField()
    warehouse_code = serializers.SerializerMethodField()
    converted_order_id = serializers.SerializerMethodField()

    def get_sales_rep_email(self, obj):
        return obj.sales_rep.email if obj.sales_rep_id and obj.sales_rep else None

    def get_warehouse_code(self, obj):
        return obj.warehouse.code if obj.warehouse_id and obj.warehouse else None

    def get_converted_order_id(self, obj):
        return str(obj.converted_order_id) if obj.converted_order_id else None

    class Meta:
        model = DraftOrder
        fields = [
            "id",
            "draft_number",
            "status",
            "status_display",
            "channel",
            "channel_display",
            "customer",
            "customer_name",
            "customer_email",
            "customer_phone",
            "customer_tax_id",
            "shipping_address",
            "currency",
            "subtotal",
            "discount_percent",
            "discount_amount",
            "tax_amount",
            "total",
            "valid_until",
            "reserve_inventory",
            "reservation_expires_at",
            "warehouse",
            "warehouse_code",
            "notes",
            "internal_notes",
            "terms_snapshot",
            "checkout_token",
            "checkout_token_expires_at",
            "whatsapp_shared_at",
            "converted_order_id",
            "sales_rep",
            "sales_rep_email",
            "items",
            "created_at",
            "updated_at",
        ]


class RMAItemSerializer(serializers.ModelSerializer):
    condition_status_display = serializers.CharField(source="get_condition_status_display", read_only=True)
    restock_decision_display = serializers.CharField(source="get_restock_decision_display", read_only=True)
    product_name = serializers.SerializerMethodField()

    def get_product_name(self, obj):
        return obj.order_item.product_name if obj.order_item_id and obj.order_item else (obj.product.name if obj.product_id else "")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Regla de Seguridad (Sección 14): No permitir que un ejecutivo sin view_costs acceda a costos internos
        if not _can_view_internal_costs(self.context):
            data.pop("original_unit_cost_snapshot", None)
            data.pop("cost_currency", None)
            data.pop("compensatory_cost_layer", None)
        return data

    class Meta:
        model = RMAItem
        fields = [
            "id",
            "order_item",
            "product",
            "variant",
            "product_name",
            "sku_snapshot",
            "serial_number",
            "quantity_requested",
            "quantity_received",
            "quantity_accepted_sellable",
            "quantity_damaged_non_sellable",
            "condition_status",
            "condition_status_display",
            "restock_decision",
            "restock_decision_display",
            "inspection_notes",
            "original_unit_cost_snapshot",
            "cost_currency",
            "return_inventory_movement",
            "compensatory_cost_layer",
            "is_restocked",
            "created_at",
        ]


class RMASerializer(serializers.ModelSerializer):
    items = RMAItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    reason_code_display = serializers.CharField(source="get_reason_code_display", read_only=True)
    refund_status_display = serializers.CharField(source="get_refund_status_display", read_only=True)
    warehouse_code = serializers.SerializerMethodField()
    order_email = serializers.SerializerMethodField()

    def get_warehouse_code(self, obj):
        return obj.warehouse.code if obj.warehouse_id and obj.warehouse else None

    def get_order_email(self, obj):
        return obj.order.email if obj.order_id and obj.order else None

    class Meta:
        model = ReturnMerchandiseAuthorization
        fields = [
            "id",
            "rma_number",
            "order",
            "order_email",
            "status",
            "status_display",
            "reason_code",
            "reason_code_display",
            "reason_details",
            "warehouse",
            "warehouse_code",
            "commercial_resolution",
            "refund_status",
            "refund_status_display",
            "refund_amount",
            "refund_currency",
            "refund_provider",
            "refund_reference",
            "requested_by",
            "authorized_by",
            "received_by",
            "inspected_by",
            "refund_resolved_by",
            "authorized_at",
            "received_at",
            "inspected_at",
            "restocked_at",
            "refunded_at",
            "notes",
            "items",
            "created_at",
            "updated_at",
        ]

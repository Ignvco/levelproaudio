# apps/inventory/serializers.py
from rest_framework import serializers
from apps.inventory.models import (
    InventoryMovement,
    SerialNumberTrack,
    StockReservation,
    Warehouse,
    WarehouseStock,
    WarehouseTransfer,
    WarehouseTransferItem,
)
from core.rbac.constants import MODULE_ORDERS, ROLE_MANAGEMENT, ROLE_SUPER_ADMIN
from core.rbac.permissions import is_effective_super_admin, user_has_module_access


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = [
            "id", "code", "name", "warehouse_type", "address",
            "internal_locations", "is_active", "is_sellable_online",
            "fulfillment_priority", "can_receive", "can_store",
            "can_transfer", "can_dispatch", "is_default",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class WarehouseStockSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_type = serializers.CharField(source="warehouse.warehouse_type", read_only=True)
    is_sellable_online = serializers.BooleanField(source="warehouse.is_sellable_online", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, allow_null=True)
    internal_sku = serializers.CharField(read_only=True)
    barcode = serializers.CharField(source="variant.barcode", read_only=True, allow_null=True)
    serialization_mode = serializers.CharField(source="product.serialization_mode", read_only=True)
    stock_min = serializers.SerializerMethodField()
    available_quantity = serializers.IntegerField(read_only=True)
    eligible_physical_quantity = serializers.IntegerField(read_only=True)
    serialized_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = WarehouseStock
        fields = [
            "id", "warehouse", "warehouse_code", "warehouse_name", "warehouse_type",
            "is_sellable_online", "product", "product_name", "variant", "variant_name",
            "internal_sku", "barcode", "serialization_mode", "location_code",
            "physical_quantity", "reserved_quantity", "non_sellable_quantity",
            "eligible_physical_quantity", "available_quantity", "stock_min",
            "serialized_count", "updated_at",
        ]

    def get_stock_min(self, obj):
        return obj.variant.stock_min if obj.variant_id else obj.product.stock_min


class InventoryMovementSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, allow_null=True)
    actor_email = serializers.EmailField(source="actor.email", read_only=True, allow_null=True)

    class Meta:
        model = InventoryMovement
        fields = [
            "id", "warehouse", "warehouse_code", "warehouse_name",
            "product", "product_name", "variant", "variant_name",
            "sku_snapshot", "movement_type", "quantity", "affected_dimensions",
            "physical_before", "physical_after",
            "reserved_before", "reserved_after",
            "available_before", "available_after",
            "reason", "source_document_type", "source_document_id",
            "actor", "actor_email", "correlation_id", "serial_numbers", "recorded_at",
        ]


class StockReservationSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, allow_null=True)
    internal_sku = serializers.SerializerMethodField()
    order_status = serializers.CharField(source="order.status", read_only=True, allow_null=True)

    class Meta:
        model = StockReservation
        fields = [
            "id", "order", "order_status", "session_key",
            "warehouse", "warehouse_code", "product", "product_name",
            "variant", "variant_name", "internal_sku",
            "quantity", "status", "expires_at", "created_at",
        ]

    def get_internal_sku(self, obj):
        return obj.variant.sku if obj.variant_id else (obj.product.sku or "")


class SerialNumberTrackSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True, allow_null=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, allow_null=True)
    internal_sku = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()

    class Meta:
        model = SerialNumberTrack
        fields = [
            "id", "serial_number", "product", "product_name",
            "variant", "variant_name", "internal_sku",
            "warehouse", "warehouse_code", "status",
            "reservation", "order", "customer_email",
            "received_at", "dispatched_at", "notes", "created_at",
        ]

    def get_internal_sku(self, obj):
        return obj.variant.sku if obj.variant_id else (obj.product.sku or "")

    def get_customer_email(self, obj):
        if not obj.customer_id:
            return None
        request = self.context.get("request") if self.context else None
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        if is_effective_super_admin(user) or user_has_module_access(user, MODULE_ORDERS):
            return obj.customer.email
        return None


class WarehouseTransferItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, allow_null=True)
    internal_sku = serializers.SerializerMethodField()

    class Meta:
        model = WarehouseTransferItem
        fields = ["id", "product", "product_name", "variant", "variant_name", "internal_sku", "quantity", "serial_numbers"]

    def get_internal_sku(self, obj):
        return obj.variant.sku if obj.variant_id else (obj.product.sku or "")


class WarehouseTransferSerializer(serializers.ModelSerializer):
    source_code = serializers.CharField(source="source_warehouse.code", read_only=True)
    destination_code = serializers.CharField(source="destination_warehouse.code", read_only=True)
    items = WarehouseTransferItemSerializer(many=True, read_only=True)

    class Meta:
        model = WarehouseTransfer
        fields = [
            "id", "code", "source_warehouse", "source_code",
            "destination_warehouse", "destination_code", "status",
            "correlation_id", "dispatched_at", "received_at",
            "notes", "items", "created_at",
        ]

"""
LEVELPRO OS V4.0 — GATE 6: Serializadores DRF para Cost & Pricing Intelligence (BF-09 & BF-18).
"""

from rest_framework import serializers

from apps.procurement.models import (
    CostAdjustmentEntry,
    CostConsumptionRecord,
    CostLayer,
    ExchangeRateSnapshot,
    LandedCostAllocation,
    LandedCostExpense,
    LandedCostLineAllocation,
    MarginPolicy,
    PricingSimulationProposal,
    SerialCostUnit,
    WeightedAverageCostState,
)


class ExchangeRateSnapshotSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True, default="")

    class Meta:
        model = ExchangeRateSnapshot
        fields = [
            "id",
            "source_currency",
            "target_currency",
            "rate",
            "rate_source",
            "effective_date",
            "rounding_policy",
            "original_amount",
            "converted_amount",
            "created_by_email",
            "created_at",
        ]


class SerialCostUnitSerializer(serializers.ModelSerializer):
    serial_status = serializers.CharField(source="serial_track.status", read_only=True, default="")
    warehouse_code = serializers.CharField(source="serial_track.warehouse.code", read_only=True, default="")
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, default="")
    layer_code = serializers.CharField(source="cost_layer.layer_code", read_only=True)
    po_number = serializers.CharField(source="purchase_order.po_number", read_only=True, default="")
    receipt_number = serializers.CharField(source="goods_receipt.receipt_number", read_only=True, default="")

    class Meta:
        model = SerialCostUnit
        fields = [
            "id",
            "serial_number_snapshot",
            "serial_status",
            "warehouse_code",
            "product",
            "product_name",
            "variant",
            "variant_name",
            "cost_layer",
            "layer_code",
            "po_number",
            "receipt_number",
            "acquisition_currency",
            "valuation_currency",
            "original_unit_cost",
            "base_unit_cost",
            "allocated_expense",
            "landed_unit_cost",
            "is_damaged",
            "is_finalized",
            "is_consumed",
            "consumed_by_order",
            "consumed_by_order_item",
            "consumed_at",
        ]


class CostLayerSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, default="")
    brand_name = serializers.CharField(source="product.brand.name", read_only=True, default="")
    supplier_name = serializers.SerializerMethodField()
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    po_number = serializers.CharField(source="purchase_order.po_number", read_only=True, default="")
    receipt_number = serializers.CharField(source="goods_receipt.receipt_number", read_only=True, default="")
    costing_method_display = serializers.CharField(source="get_costing_method_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    fx_snapshot_detail = ExchangeRateSnapshotSerializer(source="fx_snapshot", read_only=True)

    class Meta:
        model = CostLayer
        fields = [
            "id",
            "layer_code",
            "costing_method",
            "costing_method_display",
            "status",
            "status_display",
            "purchase_order",
            "po_number",
            "goods_receipt",
            "receipt_number",
            "supplier",
            "supplier_name",
            "product",
            "product_name",
            "variant",
            "variant_name",
            "brand_name",
            "sku_snapshot",
            "warehouse",
            "warehouse_code",
            "source_document_type",
            "source_document_id",
            "effective_date",
            "acquisition_currency",
            "valuation_currency",
            "fx_snapshot",
            "fx_snapshot_detail",
            "quantity_received",
            "quantity_damaged",
            "quantity_available",
            "quantity_consumed",
            "original_unit_cost",
            "base_unit_cost",
            "allocated_expenses_total",
            "unit_allocated_expense",
            "landed_unit_cost",
            "total_layer_cost",
            "remaining_layer_value",
            "serial_numbers",
            "is_finalized",
            "finalized_at",
            "version",
            "notes",
            "created_at",
        ]

    def get_supplier_name(self, obj):
        if not obj.supplier_id or not obj.supplier:
            return ""
        return obj.supplier.trade_name or obj.supplier.legal_name


class WeightedAverageCostStateSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, default="")
    brand_name = serializers.CharField(source="product.brand.name", read_only=True, default="")

    class Meta:
        model = WeightedAverageCostState
        fields = [
            "id",
            "product",
            "product_name",
            "variant",
            "variant_name",
            "brand_name",
            "sku_snapshot",
            "currency",
            "total_quantity",
            "sellable_quantity",
            "damaged_quantity",
            "total_value",
            "sellable_value",
            "damaged_value",
            "average_unit_cost",
            "updated_at",
        ]


class LandedCostExpenseSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    proration_method_display = serializers.CharField(source="get_proration_method_display", read_only=True)
    fx_snapshot_detail = ExchangeRateSnapshotSerializer(source="fx_snapshot", read_only=True)
    responsible_email = serializers.EmailField(source="responsible.email", read_only=True, default="")

    class Meta:
        model = LandedCostExpense
        fields = [
            "id",
            "category",
            "category_display",
            "proration_method",
            "proration_method_display",
            "source_document_type",
            "source_document_number",
            "expense_date",
            "amount",
            "currency",
            "fx_snapshot",
            "fx_snapshot_detail",
            "converted_amount",
            "is_capitalizable",
            "is_recoverable_tax",
            "validation_status",
            "responsible_email",
            "notes",
        ]


class LandedCostLineAllocationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, default="")
    layer_code = serializers.CharField(source="cost_layer.layer_code", read_only=True, default="")

    class Meta:
        model = LandedCostLineAllocation
        fields = [
            "id",
            "purchase_order_item",
            "goods_receipt_item",
            "cost_layer",
            "layer_code",
            "product",
            "product_name",
            "variant",
            "variant_name",
            "sku_snapshot",
            "quantity_allocated",
            "unit_weight_snapshot",
            "total_weight_snapshot",
            "cif_base_unit",
            "cif_base_total",
            "allocated_expenses_total",
            "allocated_expense_unit",
            "rounding_adjustment",
            "landed_total_cost",
            "landed_unit_cost",
            "expense_breakdown",
        ]


class LandedCostAllocationSerializer(serializers.ModelSerializer):
    po_number = serializers.CharField(source="purchase_order.po_number", read_only=True)
    supplier_name = serializers.SerializerMethodField()
    receipt_number = serializers.CharField(source="goods_receipt.receipt_number", read_only=True, default="")
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    expenses = LandedCostExpenseSerializer(many=True, read_only=True)
    line_allocations = LandedCostLineAllocationSerializer(many=True, read_only=True)
    po_to_valuation_fx_detail = ExchangeRateSnapshotSerializer(source="po_to_valuation_fx", read_only=True)

    class Meta:
        model = LandedCostAllocation
        fields = [
            "id",
            "allocation_code",
            "purchase_order",
            "po_number",
            "supplier_name",
            "goods_receipt",
            "receipt_number",
            "status",
            "status_display",
            "valuation_currency",
            "po_to_valuation_fx",
            "po_to_valuation_fx_detail",
            "total_cif_base",
            "total_capitalizable_expenses",
            "total_non_capitalizable_taxes",
            "total_landed_cost",
            "rounding_policy",
            "calculation_snapshot",
            "version",
            "is_late_adjustment",
            "validated_at",
            "finalized_at",
            "notes",
            "expenses",
            "line_allocations",
            "created_at",
        ]

    def get_supplier_name(self, obj):
        sup = obj.purchase_order.supplier
        return sup.trade_name or sup.legal_name


class CostConsumptionRecordSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    layer_code = serializers.CharField(source="cost_layer.layer_code", read_only=True, default="")

    class Meta:
        model = CostConsumptionRecord
        fields = [
            "id",
            "order",
            "order_item",
            "cost_layer",
            "layer_code",
            "product",
            "product_name",
            "variant",
            "warehouse",
            "warehouse_code",
            "quantity",
            "unit_cost",
            "total_cost",
            "currency",
            "costing_method",
            "serial_number",
            "recorded_at",
        ]


class CostAdjustmentEntrySerializer(serializers.ModelSerializer):
    layer_code = serializers.CharField(source="cost_layer.layer_code", read_only=True)
    sku_snapshot = serializers.CharField(source="cost_layer.sku_snapshot", read_only=True)
    allocation_code = serializers.CharField(source="allocation.allocation_code", read_only=True, default="")

    class Meta:
        model = CostAdjustmentEntry
        fields = [
            "id",
            "adjustment_code",
            "cost_layer",
            "layer_code",
            "sku_snapshot",
            "allocation",
            "allocation_code",
            "version",
            "currency",
            "total_adjustment_amount",
            "quantity_on_hand_at_adjustment",
            "quantity_already_consumed",
            "capitalized_to_inventory_amount",
            "variance_on_consumed_amount",
            "previous_unit_cost",
            "new_unit_cost",
            "reason",
            "recorded_at",
        ]


class MarginPolicySerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True, default="")
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    product_name = serializers.CharField(source="product.name", read_only=True, default="")

    class Meta:
        model = MarginPolicy
        fields = [
            "id",
            "name",
            "brand",
            "brand_name",
            "category",
            "category_name",
            "product",
            "product_name",
            "min_margin_percent",
            "target_margin_percent",
            "is_active",
            "created_at",
        ]


class PricingSimulationProposalSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, default="")
    sku = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PricingSimulationProposal
        fields = [
            "id",
            "product",
            "product_name",
            "variant",
            "variant_name",
            "sku",
            "currency",
            "base_landed_cost",
            "current_net_price",
            "proposed_net_price",
            "tax_rate_percent",
            "proposed_gross_price",
            "projected_margin_percent",
            "projected_markup_percent",
            "projected_gross_profit",
            "fx_scenario_rate",
            "status",
            "status_display",
            "notes",
            "approved_at",
            "created_at",
        ]

    def get_sku(self, obj):
        return obj.variant.sku if obj.variant_id and obj.variant else (obj.product.sku or "")

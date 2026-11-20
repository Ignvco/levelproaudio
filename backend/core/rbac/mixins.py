# core/rbac/mixins.py
"""Mixins para protección y enmascaramiento de campos sensibles en serializers de DRF."""

from rest_framework import serializers
from core.rbac.constants import (
    PERM_VIEW_COSTS,
    PERM_EDIT_COSTS,
    PERM_VIEW_MARGINS,
    PERM_VIEW_FINANCES,
    PERM_EDIT_PRICES,
)
from core.rbac.permissions import user_has_capability


class SensitiveDataSerializerMixin:
    """
    Mixin para serializers de DRF que enmascara o remueve campos sensibles
    según las capacidades RBAC del usuario solicitante (request.user).
    Aplica protección estricta tanto a lectura como a escritura.
    """
    COST_FIELDS = {
        "cost_price", "cost", "supplier_cost", "purchase_price",
        "landed_cost", "unit_cost", "precio_costo",
    }
    MARGIN_FIELDS = {
        "margin", "margin_percentage", "gross_margin", "net_margin",
        "profit", "markup", "utilidad",
    }
    FINANCIAL_FIELDS = {
        "daily_revenue", "withdrawals", "balance", "bank_account",
        "bank_accounts", "revenue", "gross_sales", "net_sales",
        "monto_total_ventas", "margen_total",
    }
    PRICE_WRITE_FIELDS = {
        "price", "compare_price", "price_ars", "price_usd",
    }

    def _get_request_user(self):
        request = self.context.get("request") if hasattr(self, "context") else None
        return getattr(request, "user", None)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not isinstance(data, dict):
            return data

        user = self._get_request_user()

        # Super Admin tiene visibilidad total
        if user and user.is_authenticated and user.is_superuser:
            return data

        can_view_costs = user_has_capability(user, PERM_VIEW_COSTS)
        can_view_margins = user_has_capability(user, PERM_VIEW_MARGINS)
        can_view_finances = user_has_capability(user, PERM_VIEW_FINANCES)

        # Enmascaramiento de costos
        if not can_view_costs:
            for field in self.COST_FIELDS:
                data.pop(field, None)

        # Enmascaramiento de márgenes y ganancias derivadas
        if not can_view_margins:
            for field in self.MARGIN_FIELDS:
                data.pop(field, None)

        # Enmascaramiento de datos financieros agregados
        if not can_view_finances:
            for field in self.FINANCIAL_FIELDS:
                data.pop(field, None)

        return data

    def to_internal_value(self, data):
        user = self._get_request_user()

        if user and user.is_authenticated and not user.is_superuser:
            # Protección de escritura en costos
            if any(f in data for f in self.COST_FIELDS):
                if not user_has_capability(user, PERM_EDIT_COSTS):
                    raise serializers.ValidationError({
                        "cost_price": "No posee autorización para modificar costos de adquisición."
                    })

            # Protección de escritura en precios de venta
            if any(f in data for f in self.PRICE_WRITE_FIELDS):
                if not user_has_capability(user, PERM_EDIT_PRICES):
                    raise serializers.ValidationError({
                        "price": "No posee autorización para modificar precios de catálogo."
                    })

        return super().to_internal_value(data)

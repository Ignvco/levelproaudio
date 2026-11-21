# core/rbac/mixins.py
"""Mixins y utilidades recursivas para protección y enmascaramiento de campos sensibles en DRF."""

from rest_framework import serializers
from core.rbac.constants import (
    PERM_VIEW_COSTS,
    PERM_EDIT_COSTS,
    PERM_VIEW_MARGINS,
    PERM_VIEW_FINANCES,
    PERM_EDIT_PRICES,
    PERM_ADJUST_INVENTORY,
)
from core.rbac.permissions import is_effective_super_admin, user_has_capability

COST_FIELDS = {
    "cost_price", "cost", "supplier_cost", "purchase_price",
    "landed_cost", "unit_cost", "precio_costo", "total_cost",
    "valor_inventario", "cost_missing_count",
}
MARGIN_FIELDS = {
    "margin", "margin_percentage", "gross_margin", "net_margin",
    "profit", "markup", "utilidad", "utilidad_mes",
    "ganancia_potencial", "profit_calculable", "margen_total",
}
FINANCIAL_FIELDS = {
    "daily_revenue", "withdrawals", "balance", "bank_account",
    "bank_accounts", "revenue", "gross_sales", "net_sales",
    "monto_total_ventas", "net_balance", "net_balance_identified_only",
    "total_income", "total_withdrawn",
}
GATEWAY_PRIVATE_FIELDS = {
    "raw_response", "webhook_secret", "private_key", "access_token",
}
PRICE_WRITE_FIELDS = {
    "price", "compare_price", "price_ars", "price_usd",
}
STOCK_WRITE_FIELDS = {
    "stock", "stock_min",
}


def _recursively_strip_fields(obj, forbidden_keys):
    """Elimina recursivamente las llaves prohibidas en diccionarios y listas anidadas."""
    if isinstance(obj, dict):
        cleaned = {}
        for k, v in obj.items():
            if k in forbidden_keys:
                continue
            cleaned[k] = _recursively_strip_fields(v, forbidden_keys)
        return cleaned
    if isinstance(obj, list):
        return [_recursively_strip_fields(item, forbidden_keys) for item in obj]
    return obj


class SensitiveDataSerializerMixin:
    """
    Mixin para serializers de DRF que enmascara o remueve campos sensibles
    de forma recursiva (incluyendo estructuras anidadas) según las capacidades RBAC
    del usuario solicitante (request.user). Aplica protección en lectura y escritura.
    """
    COST_FIELDS = COST_FIELDS
    MARGIN_FIELDS = MARGIN_FIELDS
    FINANCIAL_FIELDS = FINANCIAL_FIELDS
    GATEWAY_PRIVATE_FIELDS = GATEWAY_PRIVATE_FIELDS
    PRICE_WRITE_FIELDS = PRICE_WRITE_FIELDS
    STOCK_WRITE_FIELDS = STOCK_WRITE_FIELDS

    def _get_request_user(self):
        request = self.context.get("request") if hasattr(self, "context") else None
        return getattr(request, "user", None)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not isinstance(data, (dict, list)):
            return data

        user = self._get_request_user()
        forbidden = set(self.GATEWAY_PRIVATE_FIELDS)

        if not is_effective_super_admin(user):
            if not user_has_capability(user, PERM_VIEW_COSTS):
                forbidden.update(self.COST_FIELDS)
            if not user_has_capability(user, PERM_VIEW_MARGINS):
                forbidden.update(self.MARGIN_FIELDS)
            if not user_has_capability(user, PERM_VIEW_FINANCES):
                forbidden.update(self.FINANCIAL_FIELDS)

        return _recursively_strip_fields(data, forbidden)

    def to_internal_value(self, data):
        user = self._get_request_user()

        if isinstance(data, dict) and not is_effective_super_admin(user):
            if any(f in data for f in self.COST_FIELDS):
                if not user_has_capability(user, PERM_EDIT_COSTS):
                    raise serializers.ValidationError({
                        "cost_price": "No posee autorización para modificar costos de adquisición."
                    })

            if any(f in data for f in self.PRICE_WRITE_FIELDS):
                if not user_has_capability(user, PERM_EDIT_PRICES):
                    raise serializers.ValidationError({
                        "price": "No posee autorización para modificar precios de catálogo."
                    })

            if any(f in data for f in self.STOCK_WRITE_FIELDS):
                if not user_has_capability(user, PERM_ADJUST_INVENTORY):
                    raise serializers.ValidationError({
                        "stock": "No posee autorización para modificar existencias de inventario."
                    })

        return super().to_internal_value(data)

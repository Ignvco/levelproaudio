# apps/payments/serializers.py

from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    provider_display = serializers.CharField(
        source="get_provider_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = Payment
        fields = [
            "id",
            "order",
            "provider",           # ← era "method" (no existía)
            "provider_display",
            "status",
            "status_display",
            "external_id",        # ← era "transaction_id" (no existía)
            "amount",
            "currency",
            "paid_at",
            "created_at",
        ]
        read_only_fields = [
            "status",
            "external_id",
            "provider_display",
            "status_display",
        ]
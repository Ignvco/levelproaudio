# apps/payments/serializers.py

from rest_framework import serializers
from .models import Payment, PaymentProvider


class CreatePaymentRequestSerializer(serializers.Serializer):
    order_id = serializers.UUIDField()
    # CASH is reserved for administration; customers cannot choose it.
    provider = serializers.ChoiceField(choices=[
        PaymentProvider.MERCADOPAGO_CL,
        PaymentProvider.MERCADOPAGO_AR,
        PaymentProvider.PAYPAL,
        PaymentProvider.GLOBAL66,
        PaymentProvider.TRANSFER,
        PaymentProvider.PAYONEER,
    ])


class CapturePayPalRequestSerializer(serializers.Serializer):
    paypal_payment_id = serializers.CharField(max_length=255)
    payer_id = serializers.CharField(max_length=255)


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

class PaymentMethodConfigSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source="get_method_display", read_only=True)

    class Meta:
        from .models import PaymentMethodConfig
        model = PaymentMethodConfig
        fields = ["id", "method", "method_display", "is_active", "label",
                  "description", "currencies", "order"]


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import BankAccount
        model = BankAccount
        fields = ["id", "label", "currency", "bank_name", "account_type",
                  "account_number", "holder_name", "holder_id", "email",
                  "instructions", "is_active", "order"]

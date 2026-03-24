# apps/payments/serializers.py
# Serializers relacionados con pagos

from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    """
    Serializer de pagos.
    """

    class Meta:
        model = Payment

        fields = [
            'id',
            'order',
            'method',
            'status',
            'transaction_id',
            'amount',
            'created_at'
        ]

        read_only_fields = [
            'status',
            'transaction_id'
        ]
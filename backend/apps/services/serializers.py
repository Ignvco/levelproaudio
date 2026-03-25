# apps/services/serializers.py
# Serializers del sistema de servicios

from rest_framework import serializers
from .models import ServiceCategory, Service


class ServiceCategorySerializer(serializers.ModelSerializer):
    """
    Serializer de categorías de servicio.
    """

    class Meta:
        model = ServiceCategory
        fields = [
            'id',
            'name',
            'slug',
            'description'
        ]


class ServiceSerializer(serializers.ModelSerializer):
    """
    Serializer de servicios profesionales.
    """

    category = ServiceCategorySerializer(read_only=True)

    class Meta:
        model = Service
        fields = [
            'id',
            'name',
            'slug',
            'category',
            'description',
            'price'
        ]
        
        
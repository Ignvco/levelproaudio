# apps/services/serializers.py
# ← duplicado eliminado, queda una sola definición de cada clase

from rest_framework import serializers
from .models import ServiceCategory, Service, Booking, ServiceRequest


class ServiceCategorySerializer(serializers.ModelSerializer):
    services_count = serializers.SerializerMethodField()

    class Meta:
        model  = ServiceCategory
        fields = ["id", "name", "slug", "description", "icon", "services_count"]

    def get_services_count(self, obj):
        return obj.services.filter(is_active=True).count()


class ServiceListSerializer(serializers.ModelSerializer):
    category_name      = serializers.CharField(source="category.name", read_only=True)
    price_display      = serializers.CharField(read_only=True)
    price_type_display = serializers.CharField(
        source="get_price_type_display", read_only=True
    )

    class Meta:
        model  = Service
        fields = [
            "id", "name", "slug",
            "category_name", "short_description",
            "thumbnail", "price", "price_type",
            "price_type_display", "price_display",
            "duration_hours", "is_featured",
        ]


class ServiceDetailSerializer(serializers.ModelSerializer):
    category           = ServiceCategorySerializer(read_only=True)
    price_display      = serializers.CharField(read_only=True)
    deliverables_list  = serializers.ListField(read_only=True)
    price_type_display = serializers.CharField(
        source="get_price_type_display", read_only=True
    )

    class Meta:
        model  = Service
        fields = [
            "id", "name", "slug", "category",
            "description", "short_description", "thumbnail",
            "price", "price_type", "price_type_display", "price_display",
            "duration_hours", "deliverables", "deliverables_list",
            "is_featured",
        ]


class BookingSerializer(serializers.ModelSerializer):
    service_name   = serializers.CharField(source="service.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model  = Booking
        fields = [
            "id", "service", "service_name",
            "scheduled_date", "notes",
            "status", "status_display",
            "created_at",
        ]
        read_only_fields = ["status"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class ServiceRequestSerializer(serializers.ModelSerializer):
    service_name   = serializers.CharField(source="service.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model  = ServiceRequest
        fields = [
            "id", "service", "service_name",
            "name", "email", "phone",
            "message", "budget", "preferred_date",
            "status", "status_display",
            "created_at",
        ]
        read_only_fields = ["status", "admin_notes"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
# apps/services/serializers.py
from rest_framework import serializers
from .models import ServiceCategory, Service, Booking, ServiceRequest
from core.media import media_url as _media_url


class ServiceCategorySerializer(serializers.ModelSerializer):
    services_count = serializers.SerializerMethodField()

    class Meta:
        model  = ServiceCategory
        fields = ["id", "name", "slug", "description", "icon", "services_count"]

    def get_services_count(self, obj):
        return obj.services.filter(is_active=True).count()


def _get_exchange_rates(context):
    if "_rates" not in context:
        from apps.site_settings.models import SiteSettings
        s = SiteSettings.objects.first()
        context["_rates"] = {
            "usd_to_clp": s.usd_to_clp if s else None,
            "usd_to_ars": s.usd_to_ars if s else None,
        }
    return context["_rates"]


class ServiceListSerializer(serializers.ModelSerializer):
    category_name      = serializers.CharField(source="category.name", read_only=True)
    thumbnail          = serializers.SerializerMethodField()
    prices             = serializers.SerializerMethodField()
    price_display      = serializers.CharField(read_only=True)
    price_type_display = serializers.CharField(
        source="get_price_type_display", read_only=True
    )

    class Meta:
        model  = Service
        fields = [
            "id", "name", "slug",
            "category_name", "short_description",
            "thumbnail", "price", "price_usd", "price_ars", "prices",
            "price_type", "price_type_display", "price_display",
            "duration_hours", "is_featured",
        ]

    def get_thumbnail(self, obj) -> str | None:
        return _media_url(obj.thumbnail)

    def get_prices(self, obj) -> dict[str, str | None]:
        rates = _get_exchange_rates(self.context)
        p = obj.prices_by_currency(rates["usd_to_clp"], rates["usd_to_ars"])
        return {k: (str(v) if v is not None else None) for k, v in p.items()}


class ServiceDetailSerializer(serializers.ModelSerializer):
    category           = ServiceCategorySerializer(read_only=True)
    thumbnail          = serializers.SerializerMethodField()
    prices             = serializers.SerializerMethodField()
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
            "price", "price_usd", "price_ars", "prices",
            "price_type", "price_type_display", "price_display",
            "duration_hours", "deliverables", "deliverables_list",
            "is_featured",
        ]

    def get_thumbnail(self, obj) -> str | None:
        return _media_url(obj.thumbnail)

    def get_prices(self, obj) -> dict[str, str | None]:
        rates = _get_exchange_rates(self.context)
        p = obj.prices_by_currency(rates["usd_to_clp"], rates["usd_to_ars"])
        return {k: (str(v) if v is not None else None) for k, v in p.items()}


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
        booking = super().create(validated_data)
        from apps.emails import send_booking_received
        send_booking_received(booking)
        return booking


class ServiceRequestSerializer(serializers.ModelSerializer):
    service_name   = serializers.CharField(source="service.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model  = ServiceRequest
        fields = [
            "id", "service", "service_name",
            "name", "email", "phone",
            "message", "budget", "preferred_date",
            "status", "status_display", "admin_notes",
            "created_at",
        ]
        read_only_fields = ["status", "admin_notes"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        sr = super().create(validated_data)
        from apps.emails import send_service_request_received
        send_service_request_received(sr)
        return sr
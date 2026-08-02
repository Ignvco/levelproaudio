# tests/test_order_tracking.py
#
# Antes, no había forma de comunicar el número de guía/tracking al
# cliente cuando una orden pasaba a "Enviado". Confirma que el campo
# viaja correctamente en el serializer que ve el cliente.

import pytest
from decimal import Decimal
from apps.users.models import User
from apps.orders.models import Order, OrderStatus
from apps.orders.serializers import OrderSerializer


@pytest.mark.django_db
def test_tracking_number_visible_to_customer():
    user = User.objects.create_user(email="track@test.com", username="track", password="x")
    order = Order.objects.create(
        user=user, status=OrderStatus.SHIPPED, total=Decimal("50000"),
        email=user.email, shipping_address="Test 123",
        shipping_carrier="Chilexpress", tracking_number="CL123456789",
    )

    data = OrderSerializer(order).data

    assert data["shipping_carrier"] == "Chilexpress"
    assert data["tracking_number"] == "CL123456789"


@pytest.mark.django_db
def test_tracking_fields_default_empty():
    user = User.objects.create_user(email="notrack@test.com", username="notrack", password="x")
    order = Order.objects.create(
        user=user, status=OrderStatus.PENDING, total=Decimal("10000"),
        email=user.email, shipping_address="Test 123",
    )
    data = OrderSerializer(order).data
    assert data["shipping_carrier"] == ""
    assert data["tracking_number"] == ""

# tests/test_service_request_admin_notes.py
#
# Antes, admin_notes existía en el modelo y el admin ya podía escribirlo
# vía el endpoint, pero el serializer que ve el CLIENTE nunca lo incluía
# en "fields" — así que la respuesta del staff quedaba invisible para
# quien hizo la solicitud. Este test confirma que ahora sí viaja.

import pytest
from apps.users.models import User
from apps.services.models import ServiceCategory, Service, ServiceRequest
from apps.services.serializers import ServiceRequestSerializer


@pytest.mark.django_db
def test_admin_notes_visible_to_customer_in_serializer():
    user = User.objects.create_user(email="cliente@test.com", username="cliente", password="x")
    category = Service.category.field.related_model.objects.create(name="Mezcla", slug="mezcla")
    service = Service.objects.create(name="Mezcla y masterización", slug="mezcla-master", category=category)
    req = ServiceRequest.objects.create(
        user=user, service=service, message="Necesito mezclar un EP de 5 canciones.",
        admin_notes="Te escribimos por email con la cotización.",
    )

    data = ServiceRequestSerializer(req).data

    assert data["admin_notes"] == "Te escribimos por email con la cotización."
    assert data["message"] == "Necesito mezclar un EP de 5 canciones."

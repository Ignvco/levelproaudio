# backend/core/contracts/tests/test_security_rbac.py
"""
LEVELPRO OS V4.0 — GATE 1.4: PRUEBAS DE INTEGRACIÓN RBAC Y AUDIT TRAIL
Verifica:
- Exigencia de permisos RBAC explícitos para operaciones sobre contratos.
- Emisión obligatoria de eventos de auditoría CATEGORY_SECURITY_DENIED ante intentos no autorizados.
- Autorización a usuarios con roles/permisos correspondientes o Super Admin.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from core.contracts.security import (
    ContractPermissionDeniedError,
    PERM_ORDER_CANCEL,
    PERM_PAYMENT_REFUND,
    check_contract_permission,
    enforce_contract_permission,
)
from apps.analytics.models import AuditEvent
from core.audit.constants import CATEGORY_SECURITY_DENIED

User = get_user_model()


@pytest.fixture
def unprivileged_user(db):
    return User.objects.create_user(
        username="unprivileged_usr",
        email="unprivileged@levelproaudio.com",
        password="securepass123",
        first_name="No",
        last_name="Perms",
    )


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        username="super_usr",
        email="superuser-contract@levelproaudio.com",
        password="supersecret123",
        first_name="Super",
        last_name="Admin",
    )


@pytest.fixture
def staff_with_cancel_perm(db):
    user = User.objects.create_user(
        username="staff_cancel_usr",
        email="staff-cancel@levelproaudio.com",
        password="securepass123",
        is_staff=True,
    )
    perm = Permission.objects.get(codename="change_order", content_type__app_label="orders")
    user.user_permissions.add(perm)
    return user


def test_unprivileged_user_is_denied_and_audited(db, unprivileged_user):
    initial_denied_count = AuditEvent.objects.filter(event_category=CATEGORY_SECURITY_DENIED).count()

    assert check_contract_permission(unprivileged_user, PERM_ORDER_CANCEL) is False

    with pytest.raises(ContractPermissionDeniedError, match="Acceso denegado"):
        enforce_contract_permission(unprivileged_user, PERM_ORDER_CANCEL, resource_id="order-999")

    # Verificar que se registró el evento de auditoría
    new_denied_count = AuditEvent.objects.filter(event_category=CATEGORY_SECURITY_DENIED).count()
    assert new_denied_count > initial_denied_count


def test_superuser_is_always_authorized(db, superuser):
    assert check_contract_permission(superuser, PERM_ORDER_CANCEL) is True
    # No debe lanzar excepción
    enforce_contract_permission(superuser, PERM_ORDER_CANCEL)


def test_staff_with_specific_permission_is_authorized(db, staff_with_cancel_perm):
    assert check_contract_permission(staff_with_cancel_perm, PERM_ORDER_CANCEL) is True
    enforce_contract_permission(staff_with_cancel_perm, PERM_ORDER_CANCEL)

    # Pero si intenta reembolso (no otorgado), es denegado
    assert check_contract_permission(staff_with_cancel_perm, PERM_PAYMENT_REFUND) is False
    with pytest.raises(ContractPermissionDeniedError):
        enforce_contract_permission(staff_with_cancel_perm, PERM_PAYMENT_REFUND)

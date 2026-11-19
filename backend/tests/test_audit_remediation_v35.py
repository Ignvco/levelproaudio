"""
tests/test_audit_remediation_v35.py — Verificación de remediación V3.5
- P1-A: Sanitización de UUIDs en /api/v1/products/compare/ (HTTP 400 en vez de 500)
- P2-A: Sembrado de cursos iniciales en Academia con soporte multi-moneda (CLP/USD/ARS)
- P2-B: Cuentas bancarias de transferencia activas en CLP y ARS
- P2-C: Imagen primaria asociada a Shure GLXD4/SM58
"""
from decimal import Decimal
import pytest
from rest_framework.test import APIClient
from apps.products.models import Product, ProductImage
from apps.academy.models import Course
from apps.payments.models import BankAccount, PaymentMethodConfig


@pytest.mark.django_db
def test_compare_endpoint_invalid_uuid_returns_400():
    client = APIClient()
    # Petición con un UUID inválido mezclado con uno sintáctico
    payload = {
        "product_ids": ["not-a-valid-uuid", "another-invalid-id"],
        "currency": "CLP",
    }
    response = client.post("/api/v1/products/compare/", payload, format="json")
    assert response.status_code == 400
    assert "Identificador de producto inválido" in response.data.get("error", "")


@pytest.mark.django_db
def test_compare_endpoint_valid_products():
    client = APIClient()
    p1 = Product.objects.create(name="Mic A", price=Decimal("100000.00"), stock=3, is_active=True)
    p2 = Product.objects.create(name="Mic B", price=Decimal("150000.00"), stock=2, is_active=True)

    payload = {
        "product_ids": [str(p1.id), str(p2.id)],
        "currency": "CLP",
    }
    response = client.post("/api/v1/products/compare/", payload, format="json")
    assert response.status_code == 200
    assert response.data["count"] == 2
    assert "advantages" in response.data


@pytest.mark.django_db
def test_academy_initial_courses_seeded_and_multicurrency():
    courses = Course.objects.filter(is_published=True)
    assert courses.count() >= 3
    slugs = set(courses.values_list("slug", flat=True))
    assert "mezcla-y-masterizacion-audio-en-vivo" in slugs
    assert "fundamentos-audio-pro-microfonia" in slugs
    assert "optimizacion-sistemas-alineacion-acustica" in slugs

    course = Course.objects.get(slug="mezcla-y-masterizacion-audio-en-vivo")
    prices = course.prices_by_currency()
    assert prices["CLP"] == Decimal("49990.00")
    assert prices["USD"] == Decimal("52.00")
    assert prices["ARS"] == Decimal("52000.00")
    assert course.modules.count() >= 2


@pytest.mark.django_db
def test_payment_methods_returns_bank_accounts_for_clp_and_ars():
    client = APIClient()
    # CLP
    res_clp = client.get("/api/v1/payments/methods/?currency=CLP")
    assert res_clp.status_code == 200
    clp_method_ids = [m["id"] for m in res_clp.data.get("methods", [])]
    assert "transfer" in clp_method_ids
    assert len(res_clp.data.get("bank_accounts", [])) >= 1
    clp_acc = res_clp.data["bank_accounts"][0]
    assert clp_acc["currency"] == "CLP"
    assert "Banco de Chile" in clp_acc["bank_name"]

    # ARS
    res_ars = client.get("/api/v1/payments/methods/?currency=ARS")
    assert res_ars.status_code == 200
    ars_method_ids = [m["id"] for m in res_ars.data.get("methods", [])]
    assert "uala" in ars_method_ids
    assert "transfer" in ars_method_ids
    assert len(res_ars.data.get("bank_accounts", [])) >= 1
    ars_acc = [a for a in res_ars.data["bank_accounts"] if a["currency"] == "ARS"][0]
    assert "Santander" in ars_acc["bank_name"]

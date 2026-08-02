# apps/products/tests_importers.py
#
# Antes, el import masivo de productos (Excel/CSV) también tenía el
# mismo bug que el formulario del admin: cualquier fila sin columna
# "tipo" quedaba con product_type="physical" (que no existe en las
# choices reales). Confirma que ahora cae a "stock" por defecto y
# valida lo que venga en la planilla.

import pytest
from apps.products.importers import parse_rows
from apps.products.models import Product


@pytest.mark.django_db
def test_row_without_type_column_defaults_to_stock():
    rows = [{"name": "Micrófono sin tipo", "price": "50000", "stock": "5"}]
    result = parse_rows(rows)

    assert result["errors"] == []
    product = Product.objects.get(name="Micrófono sin tipo")
    assert product.product_type == "stock"


@pytest.mark.django_db
def test_row_with_invalid_type_falls_back_to_stock():
    rows = [{"name": "Micrófono tipo raro", "price": "50000", "stock": "5", "product_type": "physical"}]
    result = parse_rows(rows)

    assert result["errors"] == []
    product = Product.objects.get(name="Micrófono tipo raro")
    assert product.product_type == "stock"  # nunca guarda "physical"


@pytest.mark.django_db
def test_row_with_valid_type_is_respected():
    rows = [{"name": "Micrófono preventa", "price": "50000", "stock": "0", "product_type": "preorder"}]
    result = parse_rows(rows)

    assert result["errors"] == []
    product = Product.objects.get(name="Micrófono preventa")
    assert product.product_type == "preorder"


@pytest.mark.django_db
def test_stock_min_is_imported_when_provided():
    rows = [{"name": "Micrófono con minimo", "price": "50000", "stock": "10", "stock_min": "3"}]
    result = parse_rows(rows)

    assert result["errors"] == []
    product = Product.objects.get(name="Micrófono con minimo")
    assert product.stock_min == 3


@pytest.mark.django_db
def test_stock_min_omitted_keeps_model_default():
    rows = [{"name": "Micrófono sin minimo", "price": "50000", "stock": "10"}]
    result = parse_rows(rows)

    assert result["errors"] == []
    product = Product.objects.get(name="Micrófono sin minimo")
    assert product.stock_min == 5  # default del modelo, no tocado

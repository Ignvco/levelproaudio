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


@pytest.mark.django_db
def test_negative_stock_is_rejected():
    rows = [{"name": "Producto Negativo", "price": "50000", "stock": "-3"}]
    result = parse_rows(rows)

    assert len(result["errors"]) == 1
    assert "El stock no puede ser negativo" in result["errors"][0]["error"]
    assert not Product.objects.filter(name="Producto Negativo").exists()


@pytest.mark.django_db
def test_zero_or_negative_price_is_rejected():
    rows = [
        {"name": "Producto Gratis", "price": "0", "stock": "5"},
        {"name": "Producto Menos", "price": "-100", "stock": "5"},
    ]
    result = parse_rows(rows)

    assert len(result["errors"]) == 2
    assert "Precio inválido o 0" in result["errors"][0]["error"]
    assert "Precio inválido o 0" in result["errors"][1]["error"]


@pytest.mark.django_db
def test_cost_and_multicurrency_import():
    rows = [{
        "name": "Interfaz Pro Studio",
        "price": "250000",
        "stock": "8",
        "cost_price": "180000",
        "price_usd": "260.50",
        "price_ars": "310000",
        "sku": "INT-PRO-01",
    }]
    result = parse_rows(rows)

    assert result["errors"] == []
    p = Product.objects.get(name="Interfaz Pro Studio")
    assert p.cost_price == 180000
    assert float(p.price_usd) == 260.50
    assert float(p.price_ars) == 310000
    assert p.sku == "INT-PRO-01"


@pytest.mark.django_db
def test_negative_cost_or_currency_is_rejected():
    rows = [
        {"name": "Prod Costo Negativo", "price": "10000", "stock": "2", "cost_price": "-500"},
        {"name": "Prod USD Negativo", "price": "10000", "stock": "2", "price_usd": "-10"},
        {"name": "Prod ARS Negativo", "price": "10000", "stock": "2", "price_ars": "-10"},
    ]
    result = parse_rows(rows)

    assert len(result["errors"]) == 3
    assert "El precio de costo no puede ser negativo" in result["errors"][0]["error"]
    assert "El precio USD no puede ser negativo" in result["errors"][1]["error"]
    assert "El precio ARS no puede ser negativo" in result["errors"][2]["error"]


@pytest.mark.django_db
def test_sku_collision_with_other_product_is_rejected():
    Product.objects.create(name="Existente", slug="existente", price=1000, stock=1, sku="SKU-DUP-01")
    rows = [{"name": "Nuevo Producto", "price": "5000", "stock": "2", "sku": "SKU-DUP-01"}]
    result = parse_rows(rows)

    assert len(result["errors"]) == 1
    assert "ya pertenece a otro producto" in result["errors"][0]["error"]
    assert not Product.objects.filter(name="Nuevo Producto").exists()


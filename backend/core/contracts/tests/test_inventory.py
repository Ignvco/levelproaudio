# backend/core/contracts/tests/test_inventory.py
"""
LEVELPRO OS V4.0 — GATE 1.4: PRUEBAS DEL CONTRATO DE INVENTARIO
Verifica:
- Creación de registros de movimiento inmutables (InventoryMovementRecord).
- Prohibición de doble deducción al confirmar venta (commit_order_sale).
- Liberación atómica de existencias reservadas.
- Reingreso por RMA e incremento físico.
"""

from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from apps.orders.models import Order, OrderStatus
from apps.products.models import Product
from core.contracts.inventory import (
    InventoryContractService,
    InventoryMovementRecord,
    StockMovementType,
)

User = get_user_model()


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        username="inv_contract_test",
        email="inventory-contract-test@levelproaudio.com",
        password="securepass123",
        first_name="Inv",
        last_name="Tester",
    )


@pytest.fixture
def sample_product(db):
    return Product.objects.create(
        name="Micrófono Shure SM7B",
        slug="shure-sm7b",
        sku="SHURE-SM7B",
        price=Decimal("399000.00"),
        stock=15,
        is_active=True,
    )


@pytest.fixture
def sample_order(db, customer, sample_product):
    return Order.objects.create(
        user=customer,
        email=customer.email,
        total=Decimal("399000.00"),
        currency="CLP",
        status=OrderStatus.PENDING,
        stock_deductions={str(sample_product.id): 1},
    )


def test_reserve_for_order_generates_records(db, sample_order, sample_product):
    demand = {sample_product.id: 2}
    records = InventoryContractService.reserve_for_order(sample_order, demand)

    assert len(records) == 1
    assert records[0].movement_type == StockMovementType.RESERVATION
    assert records[0].quantity == 2
    assert records[0].reference_type == "ORDER"
    assert records[0].reference_id == str(sample_order.id)


def test_commit_sale_does_not_deduct_double_stock(db, sample_order, sample_product):
    initial_stock = sample_product.stock

    # El pedido ya tenía descontada 1 unidad en stock_deductions al crearse
    records = InventoryContractService.commit_order_sale(sample_order)

    assert len(records) == 1
    assert records[0].movement_type == StockMovementType.COMMIT
    assert records[0].metadata.get("double_deduction_prevented") is True

    sample_product.refresh_from_db()
    # REGLA CRÍTICA: El stock físico NO se descuenta por segunda vez
    assert sample_product.stock == initial_stock


def test_release_reservation_restores_stock(db, sample_order, sample_product):
    initial_stock = sample_product.stock

    records = InventoryContractService.release_order_reservation(sample_order)

    assert len(records) == 1
    assert records[0].movement_type == StockMovementType.RELEASE

    sample_product.refresh_from_db()
    # Stock restaurado (+1)
    assert sample_product.stock == initial_stock + 1


def test_restock_inspected_return(db, sample_product):
    initial_stock = sample_product.stock

    record = InventoryContractService.restock_inspected_return(
        product_id=sample_product.id,
        quantity=3,
        reference_id="RMA-2026-001",
        notes="Inspección aprobada en bodega",
    )

    assert isinstance(record, InventoryMovementRecord)
    assert record.movement_type == StockMovementType.RETURN_IN
    assert record.quantity == 3

    sample_product.refresh_from_db()
    assert sample_product.stock == initial_stock + 3

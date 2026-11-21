# backend/core/contracts/tests/test_cancellation_refund.py
"""
LEVELPRO OS V4.0 — GATE 1.4: PRUEBAS DE CANCELACIONES Y REEMBOLSOS
Verifica:
- Cancelación de órdenes PENDING con liberación atómica de stock.
- Rechazo de cancelación directa sobre órdenes pagadas (exige flujo de reembolso).
- Reembolso financiero desacoplado del reingreso físico (no restock automático).
- Reingreso físico controlado (restock=True) tras verificación RMA.
- Control de moneda y límites máximos de reembolso.
"""

from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from apps.products.models import Product
from core.contracts.cancellation_refund import (
    CancellationRefundContractService,
    CancellationResultContract,
    RefundResultContract,
)
from core.contracts.money import CurrencyMismatchError, Money
from core.contracts.states import (
    CommercialStatus,
    FinancialStatus,
    FulfillmentStatus,
    StateTransitionError,
)

User = get_user_model()


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        username="cust_cancel_test",
        email="customer-cancel@levelproaudio.com",
        password="securepass123",
        first_name="Test",
        last_name="Customer",
    )


@pytest.fixture
def product(db):
    return Product.objects.create(
        name="Audífonos DT 770 Pro 80 Ohm",
        slug="dt-770-pro-80",
        sku="BEYER-DT770-80",
        price=Decimal("180000.00"),
        stock=10,
        is_active=True,
    )


@pytest.fixture
def pending_order(db, customer, product):
    return Order.objects.create(
        user=customer,
        email=customer.email,
        total=Decimal("180000.00"),
        currency="CLP",
        status=OrderStatus.PENDING,
        stock_deductions={str(product.id): 2},
    )


@pytest.fixture
def paid_order(db, customer, product):
    order = Order.objects.create(
        user=customer,
        email=customer.email,
        total=Decimal("180000.00"),
        currency="CLP",
        status=OrderStatus.PAID,
        stock_deductions={str(product.id): 1},
    )
    Payment.objects.create(
        order=order,
        provider=PaymentProvider.MERCADOPAGO_CL,
        amount=Decimal("180000.00"),
        currency="CLP",
        status=PaymentStatus.APPROVED,
    )
    return order


def test_cancel_pending_order_releases_stock(db, pending_order, product):
    # En la base, el producto tiene stock=10. La orden tenía 2 unidades reservadas.
    res = CancellationRefundContractService.cancel_pending_order(
        pending_order, reason="Cliente desistió de la compra"
    )

    assert isinstance(res, CancellationResultContract)
    assert res.stock_released is True
    assert res.new_state.commercial == CommercialStatus.CANCELLED
    assert res.new_state.financial == FinancialStatus.FAILED

    pending_order.refresh_from_db()
    assert pending_order.status == OrderStatus.CANCELLED

    product.refresh_from_db()
    # El stock debe haberse restituido (+2) -> 12
    assert product.stock == 12


def test_cancel_paid_order_directly_is_rejected(db, paid_order):
    with pytest.raises(StateTransitionError, match="Solo se pueden cancelar órdenes en estado 'pending'"):
        CancellationRefundContractService.cancel_pending_order(paid_order)


def test_refund_paid_order_does_not_restock_by_default(db, paid_order, product):
    initial_stock = product.stock

    res = CancellationRefundContractService.refund_paid_order(
        paid_order,
        reason="Garantía de satisfacción aplicada",
        restock=False,
    )

    assert isinstance(res, RefundResultContract)
    assert res.is_full_refund is True
    assert res.restocked is False
    assert res.new_state.financial == FinancialStatus.REFUNDED

    paid_order.refresh_from_db()
    assert paid_order.status == OrderStatus.CANCELLED

    product.refresh_from_db()
    # REGLA TRANSVERSAL: El reembolso monetario NO repone stock físico automáticamente
    assert product.stock == initial_stock


def test_refund_paid_order_with_inspected_restock(db, paid_order, product):
    initial_stock = product.stock

    res = CancellationRefundContractService.refund_paid_order(
        paid_order,
        reason="Devolución física recibida e inspeccionada en bodega",
        restock=True,
    )

    assert res.restocked is True
    assert res.new_state.fulfillment == FulfillmentStatus.RETURNED

    product.refresh_from_db()
    # Con restock=True explícito, se incrementa (+1)
    assert product.stock == initial_stock + 1


def test_refund_currency_mismatch_rejected(db, paid_order):
    usd_refund = Money(Decimal("200.00"), "USD")
    with pytest.raises(CurrencyMismatchError, match="no coincide"):
        CancellationRefundContractService.refund_paid_order(paid_order, refund_amount=usd_refund)


def test_refund_amount_exceeding_total_rejected(db, paid_order):
    excessive_refund = Money(Decimal("250000.00"), "CLP")
    with pytest.raises(ValueError, match="supera el total de la orden"):
        CancellationRefundContractService.refund_paid_order(paid_order, refund_amount=excessive_refund)

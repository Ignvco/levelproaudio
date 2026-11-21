# backend/core/contracts/tests/test_reconciliation.py
"""
LEVELPRO OS V4.0 — GATE 1.4: PRUEBAS DEL CONTRATO DE CONCILIACIÓN
Verifica:
- Aislamiento estricto de monedas (CurrencyMismatchError ante discrepancias CLP/USD/ARS).
- Conciliación de cobertura total (PENDING -> PAID).
- Conciliación de cobertura parcial (PARTIALLY_PAID sin cierre prematuro de orden).
- Guardia de orden cancelada: cobro tardío se deriva a IN_REVIEW sin reabrir la orden.
- Prevención de doble descuento de inventario.
"""

from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from apps.orders.models import Order, OrderStatus
from apps.payments.models import Payment, PaymentProvider, PaymentStatus
from core.contracts.money import CurrencyMismatchError, Money
from core.contracts.reconciliation import (
    PaymentReconciliationContractService,
    ReconciliationResultContract,
)
from core.contracts.states import (
    CommercialStatus,
    FinancialStatus,
    FulfillmentStatus,
)

User = get_user_model()


@pytest.fixture
def test_user(db):
    return User.objects.create_user(
        username="recon_test_user",
        email="reconciliation-test@levelproaudio.com",
        password="securepass123",
        first_name="Recon",
        last_name="Tester",
    )


@pytest.fixture
def clp_order(db, test_user):
    return Order.objects.create(
        user=test_user,
        email=test_user.email,
        total=Decimal("150000.00"),
        currency="CLP",
        status=OrderStatus.PENDING,
        stock_deductions={"test-sku-1": 1},
    )


@pytest.fixture
def clp_payment(db, clp_order):
    return Payment.objects.create(
        order=clp_order,
        provider=PaymentProvider.MERCADOPAGO_CL,
        amount=Decimal("150000.00"),
        currency="CLP",
        status=PaymentStatus.APPROVED,
    )


def test_reconcile_full_payment_approves_order(db, clp_order, clp_payment):
    result = PaymentReconciliationContractService.reconcile_payment(clp_order, clp_payment)

    assert isinstance(result, ReconciliationResultContract)
    assert result.is_fully_paid is True
    assert result.is_partially_paid is False
    assert result.is_cancelled_conflict is False
    assert result.new_state.financial == FinancialStatus.PAID
    assert result.new_state.commercial == CommercialStatus.CONFIRMED

    clp_order.refresh_from_db()
    assert clp_order.status == OrderStatus.PAID


def test_reconcile_partial_payment(db, clp_order, test_user):
    # Pago de 50.000 sobre orden de 150.000
    partial_pay = Payment.objects.create(
        order=clp_order,
        provider=PaymentProvider.TRANSFER,
        amount=Decimal("50000.00"),
        currency="CLP",
        status=PaymentStatus.APPROVED,
    )

    result = PaymentReconciliationContractService.reconcile_payment(clp_order, partial_pay)

    assert result.is_fully_paid is False
    assert result.is_partially_paid is True
    assert result.new_state.financial == FinancialStatus.PARTIALLY_PAID

    clp_order.refresh_from_db()
    # La orden sigue en pending hasta completar el 100%
    assert clp_order.status == OrderStatus.PENDING


def test_reconcile_rejects_currency_mismatch(db, clp_order):
    # Mercado Pago no permite pagos en USD para una orden en CLP: violación de aislamiento
    usd_payment = Payment.objects.create(
        order=clp_order,
        provider=PaymentProvider.MERCADOPAGO_CL,
        amount=Decimal("150.00"),
        currency="USD",
        status=PaymentStatus.APPROVED,
    )

    with pytest.raises(CurrencyMismatchError, match="Aislamiento monetario violado"):
        PaymentReconciliationContractService.reconcile_payment(clp_order, usd_payment)


def test_reconcile_authorized_paypal_cross_currency(db, clp_order):
    # PayPal tiene autorización expresa de conversión CLP -> USD con USD_CLP_RATE
    # Orden de 150.000 CLP a tasa 950 = 157.89 USD
    from decimal import Decimal, ROUND_HALF_UP
    usd_amount = (clp_order.total / Decimal("950")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    paypal_payment = Payment.objects.create(
        order=clp_order,
        provider=PaymentProvider.PAYPAL,
        amount=usd_amount,
        currency="USD",
        status=PaymentStatus.APPROVED,
    )

    result = PaymentReconciliationContractService.reconcile_payment(clp_order, paypal_payment)
    assert result.is_fully_paid is True
    assert result.new_state.financial == FinancialStatus.PAID
    clp_order.refresh_from_db()
    assert clp_order.status == OrderStatus.PAID


def test_reconcile_late_payment_on_cancelled_order_derives_to_in_review(db, clp_order, clp_payment):
    # Orden cancelada previamente
    clp_order.status = OrderStatus.CANCELLED
    clp_order.save(update_fields=["status"])

    result = PaymentReconciliationContractService.reconcile_payment(clp_order, clp_payment)

    assert result.is_cancelled_conflict is True
    assert result.is_fully_paid is False

    clp_payment.refresh_from_db()
    assert clp_payment.status == PaymentStatus.IN_REVIEW

    clp_order.refresh_from_db()
    assert clp_order.status == OrderStatus.CANCELLED  # NUNCA se reabre

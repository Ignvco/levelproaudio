# backend/core/contracts/tests/test_states.py
"""
LEVELPRO OS V4.0 — GATE 1.4: PRUEBAS DE MÁQUINA DE ESTADOS Y DESACOPLAMIENTO TRI-DIMENSIONAL
Verifica el cumplimiento de functional-backlog-matrix.md BF-13:
- Desacoplamiento entre Estado Comercial, Financiero y Logístico.
- Validación de transiciones permitidas y rechazo de transiciones ilegales.
- Reglas cruzadas transversales (ej. no despachar si no está pagada o si está cancelada).
- Preservación 100% retrocompatible con Order.status legacy.
"""

import pytest

from core.contracts.states import (
    CommercialStatus,
    FinancialStatus,
    FulfillmentStatus,
    OrderStateContract,
    StateTransitionError,
)


def test_order_state_contract_initialization():
    contract = OrderStateContract(
        commercial=CommercialStatus.CONFIRMED,
        financial=FinancialStatus.PENDING,
        fulfillment=FulfillmentStatus.ALLOCATED,
    )
    assert contract.commercial == CommercialStatus.CONFIRMED
    assert contract.financial == FinancialStatus.PENDING
    assert contract.fulfillment == FulfillmentStatus.ALLOCATED
    assert contract.to_legacy_status() == "pending"


def test_valid_transitions():
    # 1. Pago de orden pendiente
    initial = OrderStateContract(
        commercial=CommercialStatus.CONFIRMED,
        financial=FinancialStatus.PENDING,
        fulfillment=FulfillmentStatus.ALLOCATED,
    )
    paid = initial.transition_to(financial=FinancialStatus.PAID)
    assert paid.financial == FinancialStatus.PAID
    assert paid.to_legacy_status() == "paid"

    # 2. Despacho logístico
    shipped = paid.transition_to(fulfillment=FulfillmentStatus.SHIPPED)
    assert shipped.fulfillment == FulfillmentStatus.SHIPPED
    assert shipped.to_legacy_status() == "shipped"

    # 3. Entrega y cierre
    completed = shipped.transition_to(
        commercial=CommercialStatus.COMPLETED,
        fulfillment=FulfillmentStatus.DELIVERED,
    )
    assert completed.commercial == CommercialStatus.COMPLETED
    assert completed.fulfillment == FulfillmentStatus.DELIVERED
    assert completed.to_legacy_status() == "completed"


def test_illegal_commercial_transition_cancelled_cannot_reopen():
    cancelled = OrderStateContract(
        commercial=CommercialStatus.CANCELLED,
        financial=FinancialStatus.FAILED,
        fulfillment=FulfillmentStatus.UNFULFILLED,
    )
    with pytest.raises(StateTransitionError, match="no se puede pasar de 'cancelled'"):
        cancelled.transition_to(commercial=CommercialStatus.CONFIRMED)


def test_illegal_financial_transition_refunded_cannot_become_paid():
    refunded = OrderStateContract(
        commercial=CommercialStatus.CANCELLED,
        financial=FinancialStatus.REFUNDED,
        fulfillment=FulfillmentStatus.UNFULFILLED,
    )
    with pytest.raises(StateTransitionError, match="no se puede pasar de 'refunded'"):
        refunded.transition_to(financial=FinancialStatus.PAID)


def test_cross_dimensional_rule_cannot_ship_cancelled_order():
    cancelled = OrderStateContract(
        commercial=CommercialStatus.CANCELLED,
        financial=FinancialStatus.PAID,
        fulfillment=FulfillmentStatus.ALLOCATED,
    )
    with pytest.raises(StateTransitionError, match="Una orden cancelada comercialmente no puede estar despachada"):
        cancelled.transition_to(fulfillment=FulfillmentStatus.SHIPPED)


def test_cross_dimensional_rule_cannot_ship_unpaid_order():
    unpaid = OrderStateContract(
        commercial=CommercialStatus.CONFIRMED,
        financial=FinancialStatus.PENDING,
        fulfillment=FulfillmentStatus.ALLOCATED,
    )
    with pytest.raises(StateTransitionError, match="No se puede despachar una orden en estado financiero 'pending'"):
        unpaid.transition_to(fulfillment=FulfillmentStatus.SHIPPED)


def test_bidirectional_legacy_status_mapping():
    assert OrderStateContract.from_legacy_status("pending").to_legacy_status() == "pending"
    assert OrderStateContract.from_legacy_status("paid").to_legacy_status() == "paid"
    assert OrderStateContract.from_legacy_status("shipped").to_legacy_status() == "shipped"
    assert OrderStateContract.from_legacy_status("completed").to_legacy_status() == "completed"
    assert OrderStateContract.from_legacy_status("cancelled").to_legacy_status() == "cancelled"

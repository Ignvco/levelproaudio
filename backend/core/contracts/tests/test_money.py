# backend/core/contracts/tests/test_money.py
"""
LEVELPRO OS V4.0 — GATE 1.4: PRUEBAS DEL CONTRATO DE MONEDA
Verifica el cumplimiento de transversal-architecture.md Sección 6:
- Precisión Decimal y prohibición absoluta de coma flotante (float).
- Redondeo bancario estándar ROUND_HALF_UP.
- Aislamiento monetario: prohibición de aritmética y comparaciones cruzadas CLP/USD/ARS.
- MultiCurrencyLedger con balances segregados.
"""

from decimal import Decimal
import pytest

from core.contracts.money import (
    Currency,
    CurrencyMismatchError,
    InvalidAmountError,
    Money,
    MultiCurrencyLedger,
    SUPPORTED_CURRENCIES,
)


def test_money_initialization_with_decimal_and_int():
    m1 = Money(Decimal("15000.50"), "CLP")
    assert m1.amount == Decimal("15000.50")
    assert m1.currency == "CLP"

    m2 = Money(100, "USD")
    assert m2.amount == Decimal("100.00")
    assert m2.currency == "USD"

    m3 = Money("250.75", "ars")
    assert m3.amount == Decimal("250.75")
    assert m3.currency == "ARS"


def test_money_rejects_float_initialization():
    with pytest.raises(InvalidAmountError, match="Prohibido inicializar Money con tipo 'float'"):
        Money(1500.50, "CLP")


def test_money_rejects_unsupported_currency():
    with pytest.raises(ValueError, match="no soportada"):
        Money(Decimal("100"), "EUR")


def test_money_quantization_round_half_up():
    # 10.005 redondea a 10.01 bajo ROUND_HALF_UP
    m = Money(Decimal("10.005"), "USD")
    assert m.amount == Decimal("10.01")

    # 10.004 redondea a 10.00
    m2 = Money(Decimal("10.004"), "USD")
    assert m2.amount == Decimal("10.00")


def test_money_arithmetic_same_currency():
    m1 = Money(Decimal("100.25"), "CLP")
    m2 = Money(Decimal("50.50"), "CLP")

    m_add = m1 + m2
    assert m_add == Money(Decimal("150.75"), "CLP")

    m_sub = m1 - m2
    assert m_sub == Money(Decimal("49.75"), "CLP")

    m_mul = m1 * 2
    assert m_mul == Money(Decimal("200.50"), "CLP")

    m_rmul = 3 * m2
    assert m_rmul == Money(Decimal("151.50"), "CLP")

    m_div = m1 / 2
    assert m_div == Money(Decimal("50.13"), "CLP")


def test_money_arithmetic_cross_currency_forbidden():
    clp = Money(Decimal("10000"), "CLP")
    usd = Money(Decimal("10"), "USD")

    with pytest.raises(CurrencyMismatchError, match="Aislamiento monetario violado"):
        _ = clp + usd

    with pytest.raises(CurrencyMismatchError, match="Aislamiento monetario violado"):
        _ = clp - usd


def test_money_comparison_cross_currency_forbidden():
    clp = Money(Decimal("10000"), "CLP")
    ars = Money(Decimal("10000"), "ARS")

    with pytest.raises(CurrencyMismatchError, match="Aislamiento monetario violado"):
        _ = clp < ars

    with pytest.raises(CurrencyMismatchError, match="Aislamiento monetario violado"):
        _ = clp > ars


def test_money_equality():
    m1 = Money(Decimal("100.00"), "USD")
    m2 = Money(Decimal("100.00"), "USD")
    m3 = Money(Decimal("100.00"), "CLP")

    assert m1 == m2
    assert m1 != m3
    assert m1 != 100.00


def test_money_formatting():
    assert Money(Decimal("1500000"), "CLP").format() == "$ 1.500.000 CLP"
    assert Money(Decimal("1500.50"), "USD").format() == "$ 1,500.50 USD"
    assert Money(Decimal("25000.75"), "ARS").format() == "$ 25.000,75 ARS"


def test_multicurrency_ledger_isolation():
    ledger = MultiCurrencyLedger()

    ledger.credit(Money(Decimal("50000"), "CLP"))
    ledger.credit(Money(Decimal("100"), "USD"))
    ledger.credit(Money(Decimal("25000"), "ARS"))

    assert ledger.get_balance("CLP") == Money(Decimal("50000.00"), "CLP")
    assert ledger.get_balance("USD") == Money(Decimal("100.00"), "USD")
    assert ledger.get_balance("ARS") == Money(Decimal("25000.00"), "ARS")

    ledger.debit(Money(Decimal("10000"), "CLP"))
    assert ledger.get_balance("CLP") == Money(Decimal("40000.00"), "CLP")
    # Otras monedas inalteradas
    assert ledger.get_balance("USD") == Money(Decimal("100.00"), "USD")
    assert ledger.get_balance("ARS") == Money(Decimal("25000.00"), "ARS")

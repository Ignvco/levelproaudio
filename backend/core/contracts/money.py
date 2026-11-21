# backend/core/contracts/money.py
"""
LEVELPRO OS V4.0 — GATE 1.4: BUSINESS CORE CONTRACTS
Contrato Transversal de Moneda y Aislamiento Monetario (CLP, USD, ARS).
Cumple con transversal-architecture.md Sección 6:
- Precisión numérica estricta con Decimal (prohibido float).
- Redondeo estándar ROUND_HALF_UP.
- Aislamiento monetario total: prohibida la mezcla, consolidación o aritmética
  entre divisas sin tasa de conversión explícita documentada.
"""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from enum import Enum
from typing import Any, Dict, Union


class Currency(str, Enum):
    CLP = "CLP"
    USD = "USD"
    ARS = "ARS"

    @classmethod
    def has_value(cls, value: str) -> bool:
        return value in cls._value2member_map_


SUPPORTED_CURRENCIES = (Currency.CLP.value, Currency.USD.value, Currency.ARS.value)


class CurrencyMismatchError(TypeError):
    """Lanzada cuando se intenta operar entre dos monedas distintas sin conversión explícita."""
    pass


class InvalidAmountError(ValueError):
    """Lanzada cuando un monto monetario es inválido o se inicializa con tipos inseguros (float)."""
    pass


@dataclass(frozen=True)
class Money:
    """
    Objeto de Valor (Value Object) Inmutable para importes monetarios.
    Garantiza aislamiento de divisas, precisión Decimal y operaciones matemáticas seguras.
    """
    amount: Decimal
    currency: str

    def __post_init__(self):
        # 1. Prohibir estrictamente tipos de coma flotante (float)
        raw_amount = self.amount
        if isinstance(raw_amount, float):
            raise InvalidAmountError(
                "Prohibido inicializar Money con tipo 'float' para prevenir errores de precisión. "
                "Utilice Decimal, int o str numérico."
            )

        # 2. Convertir a Decimal si es int o str
        if not isinstance(raw_amount, Decimal):
            try:
                dec_amount = Decimal(str(raw_amount))
            except (InvalidOperation, TypeError, ValueError) as exc:
                raise InvalidAmountError(f"Monto inválido para Money: {raw_amount}") from exc
        else:
            dec_amount = raw_amount

        # 3. Validar moneda
        if not isinstance(self.currency, str):
            raise ValueError(f"La moneda debe ser una cadena ISO (ej: 'CLP', 'USD', 'ARS'). Recibido: {type(self.currency)}")

        curr_upper = self.currency.strip().upper()
        if curr_upper not in SUPPORTED_CURRENCIES:
            raise ValueError(
                f"Moneda '{curr_upper}' no soportada por LEVELPRO OS V4.0. "
                f"Monedas admitidas: {SUPPORTED_CURRENCIES}"
            )

        # 4. Cuantización bancaria estándar (2 decimales con ROUND_HALF_UP)
        quantized = dec_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        object.__setattr__(self, "amount", quantized)
        object.__setattr__(self, "currency", curr_upper)

    # ── Operaciones Aritméticas Seguras ─────────────────────────

    def _assert_same_currency(self, other: "Money") -> None:
        if not isinstance(other, Money):
            raise TypeError(f"Operación no soportada entre Money y {type(other).__name__}")
        if self.currency != other.currency:
            raise CurrencyMismatchError(
                f"Aislamiento monetario violado: No se puede operar directamente entre "
                f"{self.currency} y {other.currency}. Requiere tasa de conversión explícita."
            )

    def __add__(self, other: "Money") -> "Money":
        self._assert_same_currency(other)
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: "Money") -> "Money":
        self._assert_same_currency(other)
        return Money(self.amount - other.amount, self.currency)

    def __mul__(self, scalar: Union[int, Decimal, str]) -> "Money":
        if isinstance(scalar, float):
            raise InvalidAmountError("Prohibido multiplicar Money por float. Use Decimal o int.")
        if not isinstance(scalar, (int, Decimal)):
            try:
                scalar = Decimal(str(scalar))
            except (InvalidOperation, TypeError):
                raise TypeError(f"Multiplicador inválido: {scalar}")
        return Money(self.amount * Decimal(str(scalar)), self.currency)

    def __rmul__(self, scalar: Union[int, Decimal, str]) -> "Money":
        return self.__mul__(scalar)

    def __truediv__(self, scalar: Union[int, Decimal, str]) -> "Money":
        if isinstance(scalar, float):
            raise InvalidAmountError("Prohibido dividir Money por float. Use Decimal o int.")
        if not isinstance(scalar, (int, Decimal)):
            try:
                scalar = Decimal(str(scalar))
            except (InvalidOperation, TypeError):
                raise TypeError(f"Divisor inválido: {scalar}")
        dec_scalar = Decimal(str(scalar))
        if dec_scalar == Decimal("0"):
            raise ZeroDivisionError("División por cero en operación monetaria.")
        return Money(self.amount / dec_scalar, self.currency)

    def __neg__(self) -> "Money":
        return Money(-self.amount, self.currency)

    def __abs__(self) -> "Money":
        return Money(abs(self.amount), self.currency)

    # ── Comparaciones ───────────────────────────────────────────

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, Money):
            return False
        return self.amount == other.amount and self.currency == other.currency

    def __lt__(self, other: "Money") -> bool:
        self._assert_same_currency(other)
        return self.amount < other.amount

    def __le__(self, other: "Money") -> bool:
        self._assert_same_currency(other)
        return self.amount <= other.amount

    def __gt__(self, other: "Money") -> bool:
        self._assert_same_currency(other)
        return self.amount > other.amount

    def __ge__(self, other: "Money") -> bool:
        self._assert_same_currency(other)
        return self.amount >= other.amount

    def is_zero(self) -> bool:
        return self.amount == Decimal("0.00")

    def is_positive(self) -> bool:
        return self.amount > Decimal("0.00")

    def is_negative(self) -> bool:
        return self.amount < Decimal("0.00")

    # ── Serialización y Representación ──────────────────────────

    def to_dict(self) -> Dict[str, Any]:
        return {
            "amount": str(self.amount),
            "currency": self.currency,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Money":
        return cls(amount=Decimal(str(data["amount"])), currency=str(data["currency"]))

    @classmethod
    def zero(cls, currency: str = "CLP") -> "Money":
        return cls(amount=Decimal("0.00"), currency=currency)

    def format(self) -> str:
        """Formatea el importe según la convención regional de la divisa."""
        if self.currency == Currency.CLP.value:
            # En Chile comúnmente no se usan centavos visualmente en montos redondos
            int_part = int(self.amount)
            formatted = f"{int_part:,}".replace(",", ".")
            return f"$ {formatted} CLP"
        elif self.currency == Currency.USD.value:
            formatted = f"{self.amount:,.2f}"
            return f"$ {formatted} USD"
        elif self.currency == Currency.ARS.value:
            formatted = f"{self.amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            return f"$ {formatted} ARS"
        return f"{self.amount} {self.currency}"

    def __str__(self) -> str:
        return self.format()

    def __repr__(self) -> str:
        return f"Money({self.amount}, '{self.currency}')"


class MultiCurrencyLedger:
    """
    Libro mayor multi-moneda segregado.
    Almacena balances independientes por moneda e impide agregaciones cruzadas accidentales.
    """

    def __init__(self):
        self._balances: Dict[str, Money] = {
            c: Money.zero(c) for c in SUPPORTED_CURRENCIES
        }

    def credit(self, money: Money) -> None:
        """Acredita fondos al balance de la moneda correspondiente."""
        self._balances[money.currency] = self._balances[money.currency] + money

    def debit(self, money: Money) -> None:
        """Debita fondos del balance de la moneda correspondiente."""
        self._balances[money.currency] = self._balances[money.currency] - money

    def get_balance(self, currency: str) -> Money:
        curr = currency.strip().upper()
        if curr not in self._balances:
            raise ValueError(f"Moneda no soportada: {currency}")
        return self._balances[curr]

    def all_balances(self) -> Dict[str, Money]:
        return dict(self._balances)

    def to_dict(self) -> Dict[str, Dict[str, str]]:
        return {c: m.to_dict() for c, m in self._balances.items()}

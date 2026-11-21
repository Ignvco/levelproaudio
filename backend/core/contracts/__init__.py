# backend/core/contracts/__init__.py
"""
LEVELPRO OS V4.0 — GATE 1.4: BUSINESS CORE CONTRACTS
Punto de exportación unificado de los contratos empresariales fundamentales.
"""

from .money import (
    Currency,
    CurrencyMismatchError,
    InvalidAmountError,
    Money,
    MultiCurrencyLedger,
    SUPPORTED_CURRENCIES,
)
from .states import (
    CommercialStatus,
    FinancialStatus,
    FulfillmentStatus,
    OrderStateContract,
    StateTransitionError,
)
from .inventory import (
    InventoryContractService,
    InventoryMovementRecord,
    StockMovementType,
)
from .idempotency import (
    IdempotencyConflictError,
    IdempotencyContractService,
    IdempotencyExecutionError,
    IdempotencyResult,
)
from .reconciliation import (
    PaymentReconciliationContractService,
    ReconciliationResultContract,
)
from .cancellation_refund import (
    CancellationRefundContractService,
    CancellationResultContract,
    RefundResultContract,
)
from .data_contracts import (
    OrderContractDTO,
    OrderItemContractDTO,
    PaymentContractDTO,
)
from .security import (
    ContractPermissionDeniedError,
    check_contract_permission,
    enforce_contract_permission,
    PERM_ORDER_CANCEL,
    PERM_PAYMENT_REFUND,
    PERM_STOCK_MANUAL_ADJUST,
    PERM_VIEW_FINANCIAL,
)

__all__ = [
    # Moneda
    "Currency",
    "CurrencyMismatchError",
    "InvalidAmountError",
    "Money",
    "MultiCurrencyLedger",
    "SUPPORTED_CURRENCIES",
    # Estados
    "CommercialStatus",
    "FinancialStatus",
    "FulfillmentStatus",
    "OrderStateContract",
    "StateTransitionError",
    # Inventario
    "InventoryContractService",
    "InventoryMovementRecord",
    "StockMovementType",
    # Idempotencia
    "IdempotencyConflictError",
    "IdempotencyContractService",
    "IdempotencyExecutionError",
    "IdempotencyResult",
    # Conciliación
    "PaymentReconciliationContractService",
    "ReconciliationResultContract",
    # Cancelación & Reembolso
    "CancellationRefundContractService",
    "CancellationResultContract",
    "RefundResultContract",
    # DTOs
    "OrderContractDTO",
    "OrderItemContractDTO",
    "PaymentContractDTO",
    # Seguridad
    "ContractPermissionDeniedError",
    "check_contract_permission",
    "enforce_contract_permission",
    "PERM_ORDER_CANCEL",
    "PERM_PAYMENT_REFUND",
    "PERM_STOCK_MANUAL_ADJUST",
    "PERM_VIEW_FINANCIAL",
]

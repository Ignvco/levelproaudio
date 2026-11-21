# backend/core/contracts/states.py
"""
LEVELPRO OS V4.0 — GATE 1.4: BUSINESS CORE CONTRACTS
Contrato Transversal de Estados y Desacoplamiento Tri-Dimensional:
1. Estado Comercial (CommercialStatus)
2. Estado Financiero (FinancialStatus)
3. Estado Logístico / Fulfillment (FulfillmentStatus)

Cumple con:
- functional-backlog-matrix.md BF-13: Desacoplamiento Pedido / Pago / Logística.
- Preservación 100% retrocompatible con el modelo legacy Order.status.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional, Tuple


class CommercialStatus(str, Enum):
    """Estado del acuerdo comercial y ciclo de vida de la orden."""
    DRAFT     = "draft"       # Borrador / Cotización asistida
    CONFIRMED = "confirmed"   # Orden comercial formalmente emitida y confirmada
    CANCELLED = "cancelled"   # Orden cancelada comercialmente (terminal)
    COMPLETED = "completed"   # Orden cerrada comercialmente con éxito (terminal)


class FinancialStatus(str, Enum):
    """Estado de conciliación monetaria y cobranza."""
    UNPAID             = "unpaid"             # Sin intento de cobro
    PENDING            = "pending"            # Cobro en espera (link generado, comprobante por revisar)
    AUTHORIZED         = "authorized"         # Fondos retenidos/autorizados
    PAID               = "paid"               # 100% pagado y conciliado
    PARTIALLY_PAID     = "partially_paid"     # Pago parcial recibido
    PARTIALLY_REFUNDED = "partially_refunded" # Reembolso parcial ejecutado
    REFUNDED           = "refunded"           # Reembolso total ejecutado
    FAILED             = "failed"             # Cobro rechazado o expirado


class FulfillmentStatus(str, Enum):
    """Estado de inventario físico y despacho logístico."""
    UNFULFILLED       = "unfulfilled"        # Stock no comprometido aún / Preorden
    ALLOCATED         = "allocated"          # Stock reservado/comprometido en bodega
    PARTIALLY_SHIPPED = "partially_shipped"  # Despacho parcial con guía
    SHIPPED           = "shipped"            # 100% despachado en tránsito
    DELIVERED         = "delivered"          # Entregado al cliente (acuse de recibo)
    RETURNED          = "returned"           # Retornado físicamente a bodega (RMA)


class StateTransitionError(ValueError):
    """Lanzada cuando se intenta una transición de estado ilegal o contradictoria."""
    pass


# ── Matrices de Transición Permitidas ─────────────────────────────

VALID_COMMERCIAL_TRANSITIONS = {
    CommercialStatus.DRAFT: {CommercialStatus.CONFIRMED, CommercialStatus.CANCELLED},
    CommercialStatus.CONFIRMED: {CommercialStatus.COMPLETED, CommercialStatus.CANCELLED},
    CommercialStatus.CANCELLED: set(),  # Terminal: una orden cancelada no se reabre
    CommercialStatus.COMPLETED: set(),  # Terminal
}

VALID_FINANCIAL_TRANSITIONS = {
    FinancialStatus.UNPAID: {FinancialStatus.PENDING, FinancialStatus.AUTHORIZED, FinancialStatus.PAID, FinancialStatus.FAILED},
    FinancialStatus.PENDING: {FinancialStatus.AUTHORIZED, FinancialStatus.PAID, FinancialStatus.PARTIALLY_PAID, FinancialStatus.FAILED},
    FinancialStatus.AUTHORIZED: {FinancialStatus.PAID, FinancialStatus.FAILED},
    FinancialStatus.PARTIALLY_PAID: {FinancialStatus.PAID, FinancialStatus.PARTIALLY_REFUNDED, FinancialStatus.REFUNDED},
    FinancialStatus.PAID: {FinancialStatus.PARTIALLY_REFUNDED, FinancialStatus.REFUNDED},
    FinancialStatus.PARTIALLY_REFUNDED: {FinancialStatus.REFUNDED},
    FinancialStatus.REFUNDED: set(),  # Terminal
    FinancialStatus.FAILED: {FinancialStatus.PENDING, FinancialStatus.PAID},  # Reintento de pago
}

VALID_FULFILLMENT_TRANSITIONS = {
    FulfillmentStatus.UNFULFILLED: {FulfillmentStatus.ALLOCATED, FulfillmentStatus.SHIPPED},
    FulfillmentStatus.ALLOCATED: {FulfillmentStatus.PARTIALLY_SHIPPED, FulfillmentStatus.SHIPPED, FulfillmentStatus.UNFULFILLED},
    FulfillmentStatus.PARTIALLY_SHIPPED: {FulfillmentStatus.SHIPPED, FulfillmentStatus.RETURNED},
    FulfillmentStatus.SHIPPED: {FulfillmentStatus.DELIVERED, FulfillmentStatus.RETURNED},
    FulfillmentStatus.DELIVERED: {FulfillmentStatus.RETURNED},  # Devolución post-entrega
    FulfillmentStatus.RETURNED: set(),  # Terminal
}


@dataclass(frozen=True)
class OrderStateContract:
    """
    Contrato Tri-Dimensional del Estado de una Orden.
    Desacopla la visión comercial, financiera y logística.
    """
    commercial: CommercialStatus
    financial: FinancialStatus
    fulfillment: FulfillmentStatus

    def validate_transition(
        self,
        target_commercial: Optional[CommercialStatus] = None,
        target_financial: Optional[FinancialStatus] = None,
        target_fulfillment: Optional[FulfillmentStatus] = None,
    ) -> None:
        """Valida que la transición tri-dimensional sea coherente y esté permitida."""
        # 1. Validación Comercial
        if target_commercial is not None and target_commercial != self.commercial:
            allowed = VALID_COMMERCIAL_TRANSITIONS.get(self.commercial, set())
            if target_commercial not in allowed:
                raise StateTransitionError(
                    f"Transición comercial inválida: no se puede pasar de '{self.commercial.value}' a '{target_commercial.value}'."
                )

        # 2. Validación Financiera
        if target_financial is not None and target_financial != self.financial:
            allowed = VALID_FINANCIAL_TRANSITIONS.get(self.financial, set())
            if target_financial not in allowed:
                raise StateTransitionError(
                    f"Transición financiera inválida: no se puede pasar de '{self.financial.value}' a '{target_financial.value}'."
                )

        # 3. Validación Logística
        if target_fulfillment is not None and target_fulfillment != self.fulfillment:
            allowed = VALID_FULFILLMENT_TRANSITIONS.get(self.fulfillment, set())
            if target_fulfillment not in allowed:
                raise StateTransitionError(
                    f"Transición logística inválida: no se puede pasar de '{self.fulfillment.value}' a '{target_fulfillment.value}'."
                )

        # 4. Validaciones Cruzadas Transversales (Cross-Dimensional Rules)
        eff_commercial = target_commercial or self.commercial
        eff_financial = target_financial or self.financial
        eff_fulfillment = target_fulfillment or self.fulfillment

        # Si comercial está cancelado, fulfillment no puede estar en despacho
        if eff_commercial == CommercialStatus.CANCELLED and eff_fulfillment in (
            FulfillmentStatus.SHIPPED, FulfillmentStatus.DELIVERED
        ):
            raise StateTransitionError(
                "Inconsistencia: Una orden cancelada comercialmente no puede estar despachada o entregada."
            )

        # Para despachar físicamente (SHIPPED/DELIVERED), la orden debe estar pagada o con término comercial formal
        if eff_fulfillment in (FulfillmentStatus.SHIPPED, FulfillmentStatus.DELIVERED):
            if eff_financial not in (FinancialStatus.PAID, FinancialStatus.AUTHORIZED, FinancialStatus.PARTIALLY_REFUNDED):
                raise StateTransitionError(
                    f"Inconsistencia operativa: No se puede despachar una orden en estado financiero '{eff_financial.value}'."
                )

    def transition_to(
        self,
        commercial: Optional[CommercialStatus] = None,
        financial: Optional[FinancialStatus] = None,
        fulfillment: Optional[FulfillmentStatus] = None,
    ) -> "OrderStateContract":
        """Ejecuta la transición validada y devuelve un nuevo contrato inmutable."""
        self.validate_transition(commercial, financial, fulfillment)
        return OrderStateContract(
            commercial=commercial or self.commercial,
            financial=financial or self.financial,
            fulfillment=fulfillment or self.fulfillment,
        )

    # ── Adaptador Bidireccional con Order.status Legacy ──────────

    def to_legacy_status(self) -> str:
        """
        Calcula el valor equivalente para el campo plano Order.status (PENDING, PAID, SHIPPED, COMPLETED, CANCELLED).
        Garantiza 100% de compatibilidad con endpoints REST existentes y frontend legacy.
        """
        if self.commercial == CommercialStatus.CANCELLED:
            return "cancelled"
        if self.commercial == CommercialStatus.COMPLETED or self.fulfillment == FulfillmentStatus.DELIVERED:
            return "completed"
        if self.fulfillment in (FulfillmentStatus.SHIPPED, FulfillmentStatus.PARTIALLY_SHIPPED):
            return "shipped"
        if self.financial in (FinancialStatus.PAID, FinancialStatus.PARTIALLY_REFUNDED):
            return "paid"
        return "pending"

    @classmethod
    def from_legacy_status(cls, legacy_status: str) -> "OrderStateContract":
        """Construye un contrato tri-dimensional a partir de un estado legacy plano."""
        status_clean = (legacy_status or "pending").strip().lower()
        if status_clean == "cancelled":
            return cls(
                commercial=CommercialStatus.CANCELLED,
                financial=FinancialStatus.FAILED,
                fulfillment=FulfillmentStatus.UNFULFILLED,
            )
        elif status_clean == "completed":
            return cls(
                commercial=CommercialStatus.COMPLETED,
                financial=FinancialStatus.PAID,
                fulfillment=FulfillmentStatus.DELIVERED,
            )
        elif status_clean == "shipped":
            return cls(
                commercial=CommercialStatus.CONFIRMED,
                financial=FinancialStatus.PAID,
                fulfillment=FulfillmentStatus.SHIPPED,
            )
        elif status_clean == "paid":
            return cls(
                commercial=CommercialStatus.CONFIRMED,
                financial=FinancialStatus.PAID,
                fulfillment=FulfillmentStatus.ALLOCATED,
            )
        else:  # "pending" u otros
            return cls(
                commercial=CommercialStatus.CONFIRMED,
                financial=FinancialStatus.PENDING,
                fulfillment=FulfillmentStatus.ALLOCATED,
            )

    @classmethod
    def from_order(cls, order: Any) -> "OrderStateContract":
        """Extrae el contrato a partir de una instancia del modelo Order."""
        return cls.from_legacy_status(getattr(order, "status", "pending"))

    def to_dict(self) -> Dict[str, str]:
        return {
            "commercial": self.commercial.value,
            "financial": self.financial.value,
            "fulfillment": self.fulfillment.value,
            "legacy_status": self.to_legacy_status(),
        }

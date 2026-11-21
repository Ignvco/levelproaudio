# backend/core/contracts/cancellation_refund.py
"""
LEVELPRO OS V4.0 — GATE 1.4: BUSINESS CORE CONTRACTS
Contrato Transversal de Cancelaciones, Devoluciones y Reembolsos.
Distingue formalmente entre:
1. Cancelación de orden pendiente (liberación inmediata y atómica de stock reservado).
2. Reembolso financiero de orden pagada (transición financiera a REFUNDED o PARTIALLY_REFUNDED).
3. Reingreso físico de inventario (estrictamente desacoplado del reembolso monetario;
   no repone stock automáticamente a menos que exista confirmación física RMA).
"""

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Optional

from django.core.exceptions import ValidationError
from django.db import transaction

from core.contracts.inventory import InventoryContractService
from core.contracts.money import CurrencyMismatchError, Money
from core.contracts.states import (
    CommercialStatus,
    FinancialStatus,
    FulfillmentStatus,
    OrderStateContract,
    StateTransitionError,
)
from core.audit.constants import (
    CATEGORY_FINANCIAL_OPERATION,
    CATEGORY_ORDER_STATUS,
    SEVERITY_HIGH,
    SEVERITY_INFO,
    ACTOR_SYSTEM,
    SOURCE_API,
)
from core.audit.services import record_audit_event

logger = logging.getLogger("levelpro.contracts.cancellation_refund")


@dataclass(frozen=True)
class CancellationResultContract:
    """Resultado estructurado de la cancelación de una orden."""
    order_id: str
    previous_state: OrderStateContract
    new_state: OrderStateContract
    stock_released: bool
    reason: str
    message: str

    def to_dict(self):
        return {
            "order_id": self.order_id,
            "previous_state": self.previous_state.to_dict(),
            "new_state": self.new_state.to_dict(),
            "stock_released": self.stock_released,
            "reason": self.reason,
            "message": self.message,
        }


@dataclass(frozen=True)
class RefundResultContract:
    """Resultado estructurado de un reembolso monetario."""
    order_id: str
    refund_amount: Money
    previous_state: OrderStateContract
    new_state: OrderStateContract
    is_full_refund: bool
    is_partial_refund: bool
    restocked: bool
    reason: str
    message: str

    def to_dict(self):
        return {
            "order_id": self.order_id,
            "refund_amount": self.refund_amount.to_dict(),
            "previous_state": self.previous_state.to_dict(),
            "new_state": self.new_state.to_dict(),
            "is_full_refund": self.is_full_refund,
            "is_partial_refund": self.is_partial_refund,
            "restocked": self.restocked,
            "reason": self.reason,
            "message": self.message,
        }


class CancellationRefundContractService:
    """
    Servicio de contratos para cancelaciones seguras y reversas monetarias/físicas.
    """

    @classmethod
    def cancel_pending_order(
        cls,
        order: Any,
        reason: str = "Solicitud de cancelación de orden pendiente",
        actor_id: Optional[str] = None,
    ) -> CancellationResultContract:
        """
        Cancela una orden PENDING y restituye de inmediato el stock reservado.
        Rechaza cancelaciones automáticas sobre pedidos ya pagados o despachados.
        """
        from apps.orders.models import Order, OrderStatus

        order_id = str(order.id)

        with transaction.atomic():
            locked_order = Order.objects.select_for_update().get(pk=order.id)
            prev_contract = OrderStateContract.from_order(locked_order)

            if locked_order.status != OrderStatus.PENDING:
                raise StateTransitionError(
                    f"Solo se pueden cancelar órdenes en estado 'pending'. Estado actual: '{locked_order.status}'."
                )

            # 1. Transición de estado a cancelado
            # NOTA ARQUITECTÓNICA: Order.save() ejecuta atómicamente restore_inventory(previous)
            # al transicionar de PENDING a CANCELLED. No invocar doble restauración.
            locked_order.status = OrderStatus.CANCELLED
            note_entry = f"[CANCELACIÓN] {reason}".strip()
            locked_order.notes = f"{locked_order.notes}\n{note_entry}".strip() if locked_order.notes else note_entry
            locked_order.save(update_fields=["status", "notes", "updated_at"])

            new_contract = OrderStateContract(
                commercial=CommercialStatus.CANCELLED,
                financial=FinancialStatus.FAILED,
                fulfillment=FulfillmentStatus.UNFULFILLED,
            )

            # 2. Registro de auditoría
            try:
                record_audit_event(
                    module="orders",
                    action="ORDER_CANCELLED",
                    event_category=CATEGORY_ORDER_STATUS,
                    resource_type="Order",
                    resource_id=order_id,
                    resource_repr=f"Cancelación Orden #{order_id}",
                    actor=actor_id,
                    actor_type=ACTOR_SYSTEM if not actor_id else "user",
                    previous_values=prev_contract.to_dict(),
                    new_values=new_contract.to_dict(),
                    changed_fields=["status", "notes"],
                    source=SOURCE_API,
                    severity=SEVERITY_INFO,
                    mandatory=True,
                )
            except Exception:
                pass

            return CancellationResultContract(
                order_id=order_id,
                previous_state=prev_contract,
                new_state=new_contract,
                stock_released=True,
                reason=reason,
                message="Orden cancelada exitosamente y stock reservado reincorporado a disponible.",
            )

    @classmethod
    def refund_paid_order(
        cls,
        order: Any,
        refund_amount: Optional[Money] = None,
        reason: str = "Reembolso acordado con el cliente",
        actor_id: Optional[str] = None,
        restock: bool = False,
    ) -> RefundResultContract:
        """
        Ejecuta la reversa financiera de una orden pagada.
        REGLA TRANSVERSAL INNEGOCIABLE:
        El reembolso de dinero NO reincorpora stock al inventario automáticamente (restock=False por defecto).
        El reingreso de mercadería física a bodega debe ocurrir por un flujo de devolución e inspección (RMA).
        """
        from apps.orders.models import Order, OrderStatus
        from apps.payments.models import Payment, PaymentStatus

        order_id = str(order.id)

        with transaction.atomic():
            locked_order = Order.objects.select_for_update().get(pk=order.id)
            prev_contract = OrderStateContract.from_order(locked_order)

            if locked_order.status not in (OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED):
                raise StateTransitionError(
                    f"No se puede reembolsar una orden en estado '{locked_order.status}'. "
                    f"Solo se reembolsan órdenes pagadas o procesadas."
                )

            order_curr = getattr(locked_order, "currency", "CLP") or "CLP"
            total_money = Money(locked_order.total, order_curr)

            # Si no se especifica monto, se asume reembolso total
            if refund_amount is None:
                eff_refund = total_money
            else:
                if refund_amount.currency != order_curr:
                    raise CurrencyMismatchError(
                        f"Moneda de reembolso ({refund_amount.currency}) no coincide con la orden ({order_curr})."
                    )
                if refund_amount > total_money:
                    raise ValueError(
                        f"El monto a reembolsar ({refund_amount.format()}) supera el total de la orden ({total_money.format()})."
                    )
                eff_refund = refund_amount

            is_full = (eff_refund == total_money)
            is_partial = not is_full

            target_financial = FinancialStatus.REFUNDED if is_full else FinancialStatus.PARTIALLY_REFUNDED
            target_commercial = CommercialStatus.CANCELLED if is_full else prev_contract.commercial
            target_fulfillment = prev_contract.fulfillment

            # Crear registro de pago negativo o marcar pagos como reembolsados
            approved_payments = locked_order.payments.filter(status=PaymentStatus.APPROVED)
            if is_full:
                for p in approved_payments:
                    p.status = PaymentStatus.REFUNDED
                    p.save(update_fields=["status", "updated_at"])

            # Si se solicitó explícitamente restock físico certificado
            if restock:
                stock_deductions = getattr(locked_order, "stock_deductions", {}) or {}
                for prod_id, qty in stock_deductions.items():
                    InventoryContractService.restock_inspected_return(
                        product_id=prod_id,
                        quantity=qty,
                        reference_id=f"REFUND-{order_id}",
                        actor_id=actor_id,
                        notes=f"Reingreso físico por reembolso de Orden #{order_id}",
                    )
                target_fulfillment = FulfillmentStatus.RETURNED

            new_contract = OrderStateContract(
                commercial=target_commercial,
                financial=target_financial,
                fulfillment=target_fulfillment,
            )

            # Si fue reembolso total, reflejar en status legacy si no estaba despachada
            if is_full and locked_order.status == OrderStatus.PAID:
                locked_order.status = OrderStatus.CANCELLED
                note = f"[REEMBOLSO TOTAL] {reason}".strip()
                locked_order.notes = f"{locked_order.notes}\n{note}".strip() if locked_order.notes else note
                locked_order.save(update_fields=["status", "notes", "updated_at"])

            # Auditoría financiera de alta severidad
            try:
                record_audit_event(
                    module="finance",
                    action="ORDER_REFUNDED",
                    event_category=CATEGORY_FINANCIAL_OPERATION,
                    resource_type="Order",
                    resource_id=order_id,
                    resource_repr=f"Reembolso Orden #{order_id}: {eff_refund.format()}",
                    actor=actor_id,
                    actor_type=ACTOR_SYSTEM if not actor_id else "user",
                    previous_values=prev_contract.to_dict(),
                    new_values=new_contract.to_dict(),
                    metadata={
                        "refund_amount": eff_refund.to_dict(),
                        "is_full_refund": is_full,
                        "restocked": restock,
                        "reason": reason,
                    },
                    source=SOURCE_API,
                    severity=SEVERITY_HIGH,
                    mandatory=True,
                )
            except Exception:
                pass

            return RefundResultContract(
                order_id=order_id,
                refund_amount=eff_refund,
                previous_state=prev_contract,
                new_state=new_contract,
                is_full_refund=is_full,
                is_partial_refund=is_partial,
                restocked=restock,
                reason=reason,
                message=f"Reembolso de {eff_refund.format()} procesado exitosamente (restock={restock}).",
            )

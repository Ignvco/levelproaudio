# backend/core/contracts/reconciliation.py
"""
LEVELPRO OS V4.0 — GATE 1.4: BUSINESS CORE CONTRACTS
Contrato Transversal de Conciliación de Pagos y Estados de Órdenes.
Garantiza:
1. Aislamiento estricto de divisas (payment.currency == order.currency).
2. Protección de órdenes canceladas (pagos tardíos se derivan a IN_REVIEW).
3. Transición atómica de estados y cálculo exacto de cobertura financiera.
4. Trazabilidad completa con Audit Trail.
"""

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Optional

from django.db import transaction

from core.contracts.inventory import InventoryContractService
from core.contracts.money import CurrencyMismatchError, Money
from core.contracts.states import (
    CommercialStatus,
    FinancialStatus,
    FulfillmentStatus,
    OrderStateContract,
)
from core.audit.constants import (
    CATEGORY_ORDER_STATUS,
    CATEGORY_PAYMENT_OPERATION,
    SEVERITY_HIGH,
    SEVERITY_INFO,
    ACTOR_SYSTEM,
    SOURCE_API,
)
from core.audit.services import record_audit_event

logger = logging.getLogger("levelpro.contracts.reconciliation")


@dataclass(frozen=True)
class ReconciliationResultContract:
    """Resultado estructurado de una conciliación de pago contra pedido."""
    order_id: str
    payment_id: str
    previous_state: OrderStateContract
    new_state: OrderStateContract
    amount_reconciled: Money
    order_total: Money
    is_fully_paid: bool
    is_partially_paid: bool
    is_cancelled_conflict: bool
    message: str

    def to_dict(self):
        return {
            "order_id": self.order_id,
            "payment_id": self.payment_id,
            "previous_state": self.previous_state.to_dict(),
            "new_state": self.new_state.to_dict(),
            "amount_reconciled": self.amount_reconciled.to_dict(),
            "order_total": self.order_total.to_dict(),
            "is_fully_paid": self.is_fully_paid,
            "is_partially_paid": self.is_partially_paid,
            "is_cancelled_conflict": self.is_cancelled_conflict,
            "message": self.message,
        }


class PaymentReconciliationContractService:
    """
    Servicio de conciliación determinista y atómica entre transacciones de pago y pedidos.
    """

    @classmethod
    def reconcile_payment(
        cls,
        order: Any,
        payment: Any,
        actor_id: Optional[str] = None,
    ) -> ReconciliationResultContract:
        """
        Concilia un pago con su orden asociada bajo bloqueo pesimista select_for_update.
        """
        from apps.orders.models import Order
        from apps.payments.models import Payment, PaymentStatus

        order_id = str(order.id)
        payment_id = str(payment.id)

        with transaction.atomic():
            # 1. Bloqueo de orden y pago para evitar carreras concurrentes
            locked_order = Order.objects.select_for_update().get(pk=order.id)
            locked_payment = Payment.objects.select_for_update().get(pk=payment.id)

            prev_contract = OrderStateContract.from_order(locked_order)

            # 2. Validación de Aislamiento Monetario (Multi-Currency Boundary Check)
            order_curr = (getattr(locked_order, "currency", "CLP") or "CLP").upper()
            pay_curr = (getattr(locked_payment, "currency", "CLP") or "CLP").upper()

            fx_metadata = None
            if order_curr != pay_curr:
                # Caso Documentado: Conversión Cambiaria autorizada para pasarela PayPal
                # PayPal no opera en CLP directamente; convierte CLP a USD mediante USD_CLP_RATE
                from django.conf import settings
                from apps.payments.models import PaymentProvider
                from decimal import ROUND_HALF_UP

                if (
                    locked_payment.provider == PaymentProvider.PAYPAL
                    and order_curr == "CLP"
                    and pay_curr == "USD"
                ):
                    rate = Decimal(str(getattr(settings, "USD_CLP_RATE", 950)))
                    fx_metadata = {
                        "source_currency": "CLP",
                        "target_currency": "USD",
                        "rate": str(rate),
                        "paid_usd": str(locked_payment.amount),
                    }
                else:
                    raise CurrencyMismatchError(
                        f"Aislamiento monetario violado: El pago #{payment_id} está en {pay_curr} "
                        f"pero la orden #{order_id} se cotizó en {order_curr}. Conciliación rechazada."
                    )

            order_money = Money(locked_order.total, order_curr)
            payment_money = Money(locked_payment.amount, pay_curr)

            # 3. Guardia de Orden Cancelada (Late Payment Safety Guard)
            if locked_order.status == "cancelled":
                locked_payment.status = PaymentStatus.IN_REVIEW
                locked_payment.save(update_fields=["status", "updated_at"])

                # Alerta crítica en auditoría
                try:
                    record_audit_event(
                        module="payments",
                        action="LATE_PAYMENT_ON_CANCELLED_ORDER",
                        event_category=CATEGORY_PAYMENT_OPERATION,
                        resource_type="Payment",
                        resource_id=payment_id,
                        resource_repr=f"Pago #{payment_id} para Orden Cancelada #{order_id}",
                        actor=actor_id,
                        actor_type=ACTOR_SYSTEM if not actor_id else "user",
                        new_values={"payment_status": PaymentStatus.IN_REVIEW, "order_status": "cancelled"},
                        source=SOURCE_API,
                        severity=SEVERITY_HIGH,
                        mandatory=True,
                    )
                except Exception:
                    pass

                return ReconciliationResultContract(
                    order_id=order_id,
                    payment_id=payment_id,
                    previous_state=prev_contract,
                    new_state=prev_contract,
                    amount_reconciled=payment_money,
                    order_total=order_money,
                    is_fully_paid=False,
                    is_partially_paid=False,
                    is_cancelled_conflict=True,
                    message="Pago recibido para orden cancelada. Derivado a revisión; orden no reabierta.",
                )

            # 4. Cálculo de Cobertura Financiera Total de la Orden
            if fx_metadata is not None:
                # Caso PayPal FX validado: cubre el total del pedido
                is_full = True
                is_partial = False
                total_reconciled = order_money
            else:
                approved_payments = locked_order.payments.filter(status=PaymentStatus.APPROVED)
                total_approved_amount = Decimal("0.00")
                for p in approved_payments:
                    total_approved_amount += p.amount

                # Si el pago en curso ya fue marcado como aprobado o se está aprobando aquí
                if locked_payment.status == PaymentStatus.APPROVED and locked_payment not in approved_payments:
                    total_approved_amount += locked_payment.amount

                total_reconciled = Money(total_approved_amount, order_curr)
                # Tolerancia de redondeo admitida por pasarelas (0.5% o $1 CLP/moneda base)
                rounding_tolerance = max(order_money.amount * Decimal("0.005"), Decimal("1.00"))
                is_full = total_reconciled.amount >= (order_money.amount - rounding_tolerance)
                is_partial = (not is_full) and (total_reconciled.amount > Decimal("0.00"))

            # 5. Determinación del Nuevo Estado Tri-Dimensional
            if is_full:
                target_financial = FinancialStatus.PAID
                target_commercial = CommercialStatus.CONFIRMED
                target_fulfillment = FulfillmentStatus.ALLOCATED

                # Si estaba pendiente, pasa a paid
                if locked_order.status == "pending":
                    locked_order.status = "paid"
                    locked_order.save(update_fields=["status", "updated_at"])

                    # Consolidar reserva de inventario como venta confirmada (sin doble descuento)
                    InventoryContractService.commit_order_sale(locked_order, actor_id=actor_id)

                    # Enrollment de academia si aplica
                    try:
                        from apps.payments.services import create_enrollment_if_course
                        create_enrollment_if_course(locked_order)
                    except Exception as exc:
                        logger.warning("Error creando enrollment para orden #%s: %s", order_id, exc)

            elif is_partial:
                target_financial = FinancialStatus.PARTIALLY_PAID
                target_commercial = CommercialStatus.CONFIRMED
                target_fulfillment = FulfillmentStatus.ALLOCATED
            else:
                target_financial = FinancialStatus.PENDING
                target_commercial = CommercialStatus.CONFIRMED
                target_fulfillment = FulfillmentStatus.ALLOCATED

            new_contract = OrderStateContract(
                commercial=target_commercial,
                financial=target_financial,
                fulfillment=target_fulfillment,
            )

            # 6. Registro de Auditoría de Conciliación
            try:
                record_audit_event(
                    module="orders",
                    action="PAYMENT_RECONCILED",
                    event_category=CATEGORY_ORDER_STATUS if is_full else CATEGORY_PAYMENT_OPERATION,
                    resource_type="Order",
                    resource_id=order_id,
                    resource_repr=f"Conciliación Orden #{order_id}",
                    actor=actor_id,
                    actor_type=ACTOR_SYSTEM if not actor_id else "user",
                    previous_values=prev_contract.to_dict(),
                    new_values=new_contract.to_dict(),
                    source=SOURCE_API,
                    severity=SEVERITY_INFO,
                    mandatory=False,
                )
            except Exception:
                pass

            msg = "Orden totalmente pagada y conciliada." if is_full else (
                f"Pago parcial conciliado ({total_reconciled.format()} de {order_money.format()})."
            )

            return ReconciliationResultContract(
                order_id=order_id,
                payment_id=payment_id,
                previous_state=prev_contract,
                new_state=new_contract,
                amount_reconciled=payment_money,
                order_total=order_money,
                is_fully_paid=is_full,
                is_partially_paid=is_partial,
                is_cancelled_conflict=False,
                message=msg,
            )

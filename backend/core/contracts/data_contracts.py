# backend/core/contracts/data_contracts.py
"""
LEVELPRO OS V4.0 — GATE 1.4: BUSINESS CORE CONTRACTS
Contratos de Datos Compartidos entre Módulos (DTOs tipados).
Garantiza interfaces desacopladas y contratos estrictos entre Pedidos, Pagos,
Inventario, Finanzas y Catálogo sin acoplamiento rígido a modelos ORM.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from core.contracts.money import Money
from core.contracts.states import OrderStateContract


@dataclass(frozen=True)
class OrderItemContractDTO:
    """Contrato de línea de producto en una orden."""
    product_id: str
    product_name: str
    quantity: int
    unit_price: Money
    subtotal: Money

    def to_dict(self) -> Dict[str, Any]:
        return {
            "product_id": self.product_id,
            "product_name": self.product_name,
            "quantity": self.quantity,
            "unit_price": self.unit_price.to_dict(),
            "subtotal": self.subtotal.to_dict(),
        }


@dataclass(frozen=True)
class OrderContractDTO:
    """Contrato canónico de orden para comunicación inter-modular."""
    order_id: str
    user_id: Optional[str]
    email: str
    total: Money
    state: OrderStateContract
    items: List[OrderItemContractDTO] = field(default_factory=list)
    created_at: Optional[datetime] = None
    shipping_address: str = ""
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "order_id": self.order_id,
            "user_id": self.user_id,
            "email": self.email,
            "total": self.total.to_dict(),
            "state": self.state.to_dict(),
            "items": [item.to_dict() for item in self.items],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "shipping_address": self.shipping_address,
            "notes": self.notes,
        }

    @classmethod
    def from_model(cls, order: Any) -> "OrderContractDTO":
        """Construye un DTO tipado a partir de una instancia del modelo Order."""
        order_curr = getattr(order, "currency", "CLP") or "CLP"
        items_dto = []
        for it in order.items.all():
            it_price = Money(it.price, order_curr)
            it_subtotal = it_price * it.quantity
            items_dto.append(
                OrderItemContractDTO(
                    product_id=str(it.product_id or ""),
                    product_name=it.product_name,
                    quantity=it.quantity,
                    unit_price=it_price,
                    subtotal=it_subtotal,
                )
            )

        return cls(
            order_id=str(order.id),
            user_id=str(order.user_id) if order.user_id else None,
            email=order.email,
            total=Money(order.total, order_curr),
            state=OrderStateContract.from_order(order),
            items=items_dto,
            created_at=getattr(order, "created_at", None),
            shipping_address=getattr(order, "shipping_address", ""),
            notes=getattr(order, "notes", ""),
        )


@dataclass(frozen=True)
class PaymentContractDTO:
    """Contrato canónico de transacción de pago."""
    payment_id: str
    order_id: str
    provider: str
    amount: Money
    status: str
    preference_id: str = ""
    external_id: str = ""
    paid_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "payment_id": self.payment_id,
            "order_id": self.order_id,
            "provider": self.provider,
            "amount": self.amount.to_dict(),
            "status": self.status,
            "preference_id": self.preference_id,
            "external_id": self.external_id,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
        }

    @classmethod
    def from_model(cls, payment: Any) -> "PaymentContractDTO":
        pay_curr = getattr(payment, "currency", "CLP") or "CLP"
        return cls(
            payment_id=str(payment.id),
            order_id=str(payment.order_id),
            provider=payment.provider,
            amount=Money(payment.amount, pay_curr),
            status=payment.status,
            preference_id=getattr(payment, "preference_id", "") or "",
            external_id=getattr(payment, "external_id", "") or "",
            paid_at=getattr(payment, "paid_at", None),
        )

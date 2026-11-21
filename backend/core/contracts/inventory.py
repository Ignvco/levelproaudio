# backend/core/contracts/inventory.py
"""
LEVELPRO OS V4.0 — GATE 1.4: BUSINESS CORE CONTRACTS
Contrato Transversal de Reservas y Movimientos de Inventario (Kardex-Ready).
Cumple con:
- transversal-architecture.md Sección 1:
  1. Stock Disponible = Stock Físico - Stock Reservado.
  2. Reconciliación de deducciones al crear pedidos pendientes.
  3. Prohibición estricta de doble descuento al pagar (PENDING -> PAID).
  4. Reposición atómica de stock reservado al cancelar o expirar la orden.
  5. Registro estructurado de movimientos de inventario auditable.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from django.db import transaction
from django.db.models import F

from core.audit.constants import (
    CATEGORY_STOCK_ADJUSTMENT,
    SEVERITY_INFO,
    ACTOR_SYSTEM,
    SOURCE_API,
)
from core.audit.services import record_audit_event


class StockMovementType(str, Enum):
    """Tipos oficiales de movimiento de inventario para Kardex y Auditoría."""
    RESERVATION = "reservation"  # Bloqueo temporal en checkout
    RELEASE     = "release"      # Liberación de reserva por cancelación o TTL
    COMMIT      = "commit"       # Confirmación de venta con pago aprobado (sin doble descuento)
    DISPATCH    = "dispatch"     # Salida física por despacho
    RETURN_IN   = "return_in"    # Reingreso físico tras inspección técnica RMA
    ADJUSTMENT  = "adjustment"   # Ajuste manual por recuento o merma


@dataclass(frozen=True)
class InventoryMovementRecord:
    """Registro inmutable de un movimiento de inventario."""
    product_id: str
    movement_type: StockMovementType
    quantity: int
    reference_type: str
    reference_id: str
    movement_id: str = field(default_factory=lambda: str(uuid4()))
    actor_id: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "movement_id": self.movement_id,
            "product_id": self.product_id,
            "movement_type": self.movement_type.value,
            "quantity": self.quantity,
            "reference_type": self.reference_type,
            "reference_id": self.reference_id,
            "actor_id": self.actor_id,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


class InventoryContractService:
    """
    Servicio de contratos para la orquestación segura de reservas y movimientos de inventario.
    """

    @classmethod
    def reserve_for_order(
        cls,
        order: Any,
        stock_demand: Dict[Any, int],
        actor_id: Optional[str] = None,
    ) -> List[InventoryMovementRecord]:
        """
        Registra los movimientos de reserva para una orden recién creada.
        El descuento físico ya fue validado en prepare_inventory/deduct_inventory.
        """
        records: List[InventoryMovementRecord] = []
        for product_id, qty in stock_demand.items():
            record = InventoryMovementRecord(
                product_id=str(product_id),
                movement_type=StockMovementType.RESERVATION,
                quantity=qty,
                reference_type="ORDER",
                reference_id=str(order.id),
                actor_id=actor_id,
                metadata={"order_status": "pending", "currency": getattr(order, "currency", "CLP")},
            )
            records.append(record)

            # Registro de auditoría individual por SKU
            try:
                record_audit_event(
                    module="inventory",
                    action="STOCK_RESERVED",
                    event_category=CATEGORY_STOCK_ADJUSTMENT,
                    resource_type="Product",
                    resource_id=str(product_id),
                    resource_repr=f"Reserva Orden #{order.id}",
                    actor=actor_id,
                    actor_type=ACTOR_SYSTEM if not actor_id else "user",
                    new_values={"reserved_quantity": qty, "order_id": str(order.id)},
                    source=SOURCE_API,
                    severity=SEVERITY_INFO,
                    mandatory=False,
                )
            except Exception:
                pass  # Registro auxiliar no bloquea la orden
        return records

    @classmethod
    def release_order_reservation(
        cls,
        order: Any,
        actor_id: Optional[str] = None,
        reason: str = "Order cancelled or expired",
    ) -> List[InventoryMovementRecord]:
        """
        Libera atómicamente el stock reservado de una orden PENDING cancelada o expirada.
        Ejecuta la restauración de existencias físicas y genera trazabilidad.
        """
        from apps.orders.inventory import restore_inventory

        records: List[InventoryMovementRecord] = []
        with transaction.atomic():
            # restore_inventory restaura físicamente el stock bloqueando los productos
            restore_inventory(order)

            stock_deductions = getattr(order, "stock_deductions", {}) or {}
            for product_id, qty in stock_deductions.items():
                record = InventoryMovementRecord(
                    product_id=str(product_id),
                    movement_type=StockMovementType.RELEASE,
                    quantity=qty,
                    reference_type="ORDER",
                    reference_id=str(order.id),
                    actor_id=actor_id,
                    metadata={"reason": reason, "order_status": "cancelled"},
                )
                records.append(record)

                try:
                    record_audit_event(
                        module="inventory",
                        action="STOCK_RELEASED",
                        event_category=CATEGORY_STOCK_ADJUSTMENT,
                        resource_type="Product",
                        resource_id=str(product_id),
                        resource_repr=f"Liberación Orden #{order.id}",
                        actor=actor_id,
                        actor_type=ACTOR_SYSTEM if not actor_id else "user",
                        new_values={"released_quantity": qty, "reason": reason, "order_id": str(order.id)},
                        source=SOURCE_API,
                        severity=SEVERITY_INFO,
                        mandatory=False,
                    )
                except Exception:
                    pass
        return records

    @classmethod
    def commit_order_sale(
        cls,
        order: Any,
        actor_id: Optional[str] = None,
    ) -> List[InventoryMovementRecord]:
        """
        Confirma la venta al pagarse la orden.
        REGLA TRANSVERSAL INNEGOCIABLE:
        No se deduce stock físico nuevamente porque ya fue reservado en el checkout.
        Este método consolida la transición de 'Reserva' a 'Venta Comprometida' (Commit).
        """
        records: List[InventoryMovementRecord] = []
        stock_deductions = getattr(order, "stock_deductions", {}) or {}
        for product_id, qty in stock_deductions.items():
            record = InventoryMovementRecord(
                product_id=str(product_id),
                movement_type=StockMovementType.COMMIT,
                quantity=qty,
                reference_type="ORDER",
                reference_id=str(order.id),
                actor_id=actor_id,
                metadata={"order_status": "paid", "double_deduction_prevented": True},
            )
            records.append(record)

            try:
                record_audit_event(
                    module="inventory",
                    action="STOCK_COMMITTED",
                    event_category=CATEGORY_STOCK_ADJUSTMENT,
                    resource_type="Product",
                    resource_id=str(product_id),
                    resource_repr=f"Venta Confirmada Orden #{order.id}",
                    actor=actor_id,
                    actor_type=ACTOR_SYSTEM if not actor_id else "user",
                    new_values={"committed_quantity": qty, "order_id": str(order.id)},
                    source=SOURCE_API,
                    severity=SEVERITY_INFO,
                    mandatory=False,
                )
            except Exception:
                pass
        return records

    @classmethod
    def restock_inspected_return(
        cls,
        product_id: UUID,
        quantity: int,
        reference_id: str,
        actor_id: Optional[str] = None,
        notes: str = "RMA Restock",
    ) -> InventoryMovementRecord:
        """
        Reingreso físico controlado de existencias tras inspección técnica de devolución (RMA).
        Incrementa el stock físico disponible en base de datos de manera atómica.
        """
        from apps.products.models import Product

        if quantity <= 0:
            raise ValueError("La cantidad a reingresar debe ser mayor a cero.")

        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=product_id)
            Product.objects.filter(pk=product_id).update(stock=F("stock") + quantity)

            record = InventoryMovementRecord(
                product_id=str(product_id),
                movement_type=StockMovementType.RETURN_IN,
                quantity=quantity,
                reference_type="RMA",
                reference_id=reference_id,
                actor_id=actor_id,
                metadata={"notes": notes, "previous_stock": product.stock, "new_stock": product.stock + quantity},
            )

            try:
                record_audit_event(
                    module="inventory",
                    action="STOCK_RESTOCKED_RMA",
                    event_category=CATEGORY_STOCK_ADJUSTMENT,
                    resource_type="Product",
                    resource_id=str(product_id),
                    resource_repr=f"Reingreso RMA {reference_id}: {product.name}",
                    actor=actor_id,
                    actor_type=ACTOR_SYSTEM if not actor_id else "user",
                    previous_values={"stock": product.stock},
                    new_values={"stock": product.stock + quantity, "added_quantity": quantity, "rma_id": reference_id},
                    source=SOURCE_API,
                    severity=SEVERITY_INFO,
                    mandatory=True,
                )
            except Exception:
                pass

        return record

// Texto de confirmación derivado del MISMO estado que usa el retorno de pagos.
// No crear una segunda máquina de estados: reembolsos y revisiones importan.
import { getOrderPaymentState, validOrderId } from "../pages/payment/paymentReturn.js"

export const isOrderId = validOrderId

const STATES = {
  pending: {
    kind: "pending", title: "Pedido recibido · Pago pendiente",
    detail: "Registramos tu pedido, pero el pago todavía no está confirmado. Si ya pagaste, verifica el estado antes de volver a pagar.",
    icon: "!", color: "#F59E0B",
  },
  review: {
    kind: "review", title: "Pago en revisión",
    detail: "Estamos revisando el pago. No realices otro pago hasta confirmar su estado.",
    icon: "…", color: "#F59E0B",
  },
  rejected: {
    kind: "rejected", title: "El pago no fue aprobado",
    detail: "El último intento figura rechazado o cancelado. Revisa el pedido antes de volver a pagar.",
    icon: "×", color: "#F87171",
  },
  confirmed: {
    kind: "paid", title: "Pago confirmado",
    detail: "El servidor confirmó el pago. Estamos preparando tu pedido.",
    icon: "✓", color: "var(--accent)",
  },
  cancelled: {
    kind: "cancelled", title: "Pedido cancelado",
    detail: "El pedido está cancelado. Si ya pagaste, consulta el cargo antes de realizar otra compra.",
    icon: "×", color: "#F87171",
  },
  refunded: {
    kind: "refunded", title: "Pago reembolsado",
    detail: "El registro del pago indica un reembolso. Consulta los detalles en Mis pedidos.",
    icon: "↩", color: "#F59E0B",
  },
}

const UNVERIFIED = {
  kind: "unverified", title: "No pudimos verificar el pedido",
  detail: "No mostraremos una confirmación de pago sin una respuesta válida. Revisa Mis pedidos o intenta nuevamente.",
  icon: "?", color: "var(--text-2)",
}

export function orderConfirmationView(order) {
  if (!order || typeof order !== "object") return UNVERIFIED
  const state = getOrderPaymentState(order)
  if (state === "confirmed" && order.status === "shipped") {
    return { ...STATES.confirmed, kind: "shipped", title: "Pedido enviado",
      detail: "El pedido figura enviado. Consulta su seguimiento en Mis pedidos." }
  }
  if (state === "confirmed" && order.status === "completed") {
    return { ...STATES.confirmed, kind: "completed", title: "Pedido entregado",
      detail: "El pedido figura entregado en nuestros registros." }
  }
  return STATES[state] || UNVERIFIED
}

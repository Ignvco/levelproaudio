const CONFIRMED_ORDERS = new Set(["paid", "shipped", "completed"])
const CHECKOUT_KEY = "levelproaudio-checkout-return"

export function validOrderId(value) {
  return typeof value === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
}

export function getOrderPaymentState(order) {
  if (order?.status === "cancelled") return "cancelled"
  const payments = Array.isArray(order?.payments) ? order.payments : []
  // A refund does not currently change Order.status in the backend.
  if (payments.some(p => p.status === "refunded") && !payments.some(p => p.status === "approved")) {
    return "refunded"
  }
  if (CONFIRMED_ORDERS.has(order?.status)) return "confirmed"
  if (order?.status !== "pending") return "unknown"
  if (payments.some(p => p.status === "in_review")) return "review"
  // Payment.Meta orders this relation newest first. Older failed attempts
  // must not override a subsequent pending attempt.
  if (["rejected", "cancelled"].includes(payments[0]?.status)) return "rejected"
  return "pending"
}

export function getPaymentReturnState({ order, hasFetched, error, captureStatus, incompletePayPal }) {
  if (error) return "error"
  if (!hasFetched) return "loading"
  const state = getOrderPaymentState(order)
  if (state !== "pending") return state
  if (captureStatus === "capturing") return "capturing"
  if (captureStatus === "error" || incompletePayPal) return "capture_error"
  return "pending"
}

export function paymentPollInterval(query) {
  if (query.state.status === "error") return false
  return ["pending", "review"].includes(getOrderPaymentState(query.state.data)) ? 3000 : false
}

export function captureErrorReference(error) {
  const value = error?.response?.data?.error_id
  return typeof value === "string" && /^[\da-f]{32}$/i.test(value) ? value : null
}

function cartSignature(cart) {
  return JSON.stringify({
    items: cart.items.map(item => [item.product.id, item.quantity]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    points: cart.pointsToRedeem || 0,
  })
}

export function rememberCheckout(orderId, cart, storage) {
  try {
    if (!validOrderId(orderId)) return
    ;(storage ?? globalThis.sessionStorage).setItem(CHECKOUT_KEY, JSON.stringify({
      orderId, signature: cartSignature(cart),
    }))
  } catch { /* Storage restrictions must not block checkout. */ }
}

export function consumeConfirmedCheckout(orderId, cart, storage) {
  try {
    const target = storage ?? globalThis.sessionStorage
    const saved = JSON.parse(target.getItem(CHECKOUT_KEY))
    if (saved?.orderId !== orderId) return false
    // Consume once, including when the customer changed the cart after checkout.
    target.removeItem(CHECKOUT_KEY)
    return saved.signature === cartSignature(cart)
  } catch {
    return false
  }
}

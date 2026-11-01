import test from "node:test"
import assert from "node:assert/strict"
import {
  validOrderId, getOrderPaymentState, getPaymentReturnState, paymentPollInterval,
  captureErrorReference, rememberCheckout, consumeConfirmedCheckout,
} from "../src/pages/payment/paymentReturn.js"

const id = "12345678-1234-1234-1234-123456789abc"
const otherId = "12345678-1234-1234-1234-123456789abd"
const cart = { items: [{ product: { id: "p1" }, quantity: 2 }], pointsToRedeem: 100 }
const storage = () => {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}

for (const status of ["paid", "shipped", "completed"]) {
  test(`${status} is confirmed by the server`, () => {
    assert.equal(getOrderPaymentState({ status }), "confirmed")
  })
}

for (const [order, expected] of [
  [{ status: "pending" }, "pending"],
  [{ status: "pending", payments: [{ status: "approved" }] }, "pending"],
  [{ status: "pending", payments: [{ status: "in_review" }] }, "review"],
  [{ status: "pending", payments: [{ status: "rejected" }] }, "rejected"],
  [{ status: "pending", payments: [{ status: "cancelled" }] }, "rejected"],
  [{ status: "cancelled", payments: [{ status: "approved" }] }, "cancelled"],
  [{ status: "cancelled", payments: [{ status: "in_review" }] }, "cancelled"],
  [{ status: "paid", payments: [{ status: "refunded" }] }, "refunded"],
  [{ status: "paid", payments: [{ status: "approved" }, { status: "refunded" }] }, "confirmed"],
  [{ status: "pending", payments: [{ status: "pending" }, { status: "rejected" }] }, "pending"],
  [{ status: "paid", payments: [{ status: "rejected" }, { status: "approved" }] }, "confirmed"],
  [{ status: "unexpected" }, "unknown"],
  [undefined, "unknown"],
]) {
  test(`payment state ${JSON.stringify(order)} -> ${expected}`, () => {
    assert.equal(getOrderPaymentState(order), expected)
  })
}

test("cached paid data is not confirmation before the first fresh lookup", () => {
  assert.equal(getPaymentReturnState({ order: { status: "paid" }, hasFetched: false }), "loading")
})
test("lookup errors override cached paid data", () => {
  assert.equal(getPaymentReturnState({ order: { status: "paid" }, hasFetched: true, error: new Error() }), "error")
})
test("an approved capture response alone does not confirm a pending order", () => {
  assert.equal(getPaymentReturnState({ order: { status: "pending" }, hasFetched: true, captureStatus: "done" }), "pending")
})
for (const [extra, expected] of [
  [{ captureStatus: "capturing" }, "capturing"],
  [{ captureStatus: "error" }, "capture_error"],
  [{ incompletePayPal: true }, "capture_error"],
]) {
  test(`pending return ${JSON.stringify(extra)}`, () => {
    assert.equal(getPaymentReturnState({ order: { status: "pending" }, hasFetched: true, ...extra }), expected)
  })
}
test("fresh paid order resolves an uncertain capture response", () => {
  assert.equal(getPaymentReturnState({ order: { status: "paid" }, hasFetched: true, captureStatus: "error" }), "confirmed")
})
for (const status of ["pending", "paid", "shipped", "completed", "cancelled", "unknown"]) {
  test(`polling uses the Query v5 argument for ${status}`, () => {
    assert.equal(paymentPollInterval({ state: { status: "success", data: { status } } }), status === "pending" ? 3000 : false)
  })
}
test("review continues polling but a query error stops polling", () => {
  const data = { status: "pending", payments: [{ status: "in_review" }] }
  assert.equal(paymentPollInterval({ state: { status: "success", data } }), 3000)
  assert.equal(paymentPollInterval({ state: { status: "error", data } }), false)
})
test("URL order identifiers must be UUIDs, not paths or empty values", () => {
  assert.equal(validOrderId(id.toUpperCase()), true)
  for (const value of [null, "", "../auth/profile", "abc", [], 123]) assert.equal(validOrderId(value), false)
})
test("only an opaque support reference can be displayed from an error", () => {
  const reference = "a".repeat(32)
  assert.equal(captureErrorReference({ response: { data: { error_id: reference } } }), reference)
  for (const error_id of ["private-token", "<script>bad</script>", {}, null]) {
    assert.equal(captureErrorReference({ response: { data: { error_id } } }), null)
  }
})
test("the originating unchanged checkout can clear its cart exactly once", () => {
  const target = storage()
  rememberCheckout(id, cart, target)
  assert.equal(consumeConfirmedCheckout(id, cart, target), true)
  assert.equal(consumeConfirmedCheckout(id, cart, target), false)
})
test("old orders and direct course purchases cannot empty an unrelated cart", () => {
  const target = storage()
  assert.equal(consumeConfirmedCheckout(id, cart, target), false)
  rememberCheckout(otherId, cart, target)
  assert.equal(consumeConfirmedCheckout(id, cart, target), false)
  assert.equal(consumeConfirmedCheckout(otherId, cart, target), true)
})
test("cart changes after checkout are preserved, even if later reverted", () => {
  const target = storage()
  rememberCheckout(id, cart, target)
  const changed = { ...cart, items: [{ product: { id: "p1" }, quantity: 3 }] }
  assert.equal(consumeConfirmedCheckout(id, changed, target), false)
  assert.equal(consumeConfirmedCheckout(id, cart, target), false)
})
test("redeemed points changes prevent clearing the current cart", () => {
  const target = storage()
  rememberCheckout(id, cart, target)
  assert.equal(consumeConfirmedCheckout(id, { ...cart, pointsToRedeem: 0 }, target), false)
})
test("blocked or malformed storage does not break checkout", () => {
  const blocked = { getItem() { throw new Error("blocked") }, setItem() { throw new Error("blocked") } }
  assert.doesNotThrow(() => rememberCheckout(id, cart, blocked))
  assert.equal(consumeConfirmedCheckout(id, cart, blocked), false)
  assert.equal(consumeConfirmedCheckout(id, cart, { getItem: () => "not JSON" }), false)
})

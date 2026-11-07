import test from "node:test"
import assert from "node:assert/strict"
import { isOrderId, orderConfirmationView } from "../src/utils/orderConfirmationView.js"

test("el identificador debe ser UUID antes de consultar una orden", () => {
  assert.equal(isOrderId("12345678-1234-1234-1234-123456789abc"), true)
  for (const id of ["", "fake-order", "../../admin", null, undefined]) {
    assert.equal(isOrderId(id), false)
  }
})

test("solo estados respaldados por API muestran confirmación", () => {
  assert.equal(orderConfirmationView({ status: "pending" }).kind, "pending")
  assert.equal(orderConfirmationView({ status: "paid" }).title, "Pago confirmado")
  assert.equal(orderConfirmationView({ status: "shipped" }).kind, "shipped")
  assert.equal(orderConfirmationView({ status: "completed" }).kind, "completed")
  assert.equal(orderConfirmationView({ status: "pending", payments: [{ status: "in_review" }] }).kind, "review")
  assert.equal(orderConfirmationView({ status: "pending", payments: [{ status: "rejected" }] }).kind, "rejected")
  assert.equal(orderConfirmationView({ status: "paid", payments: [{ status: "refunded" }] }).kind, "refunded")
  for (const value of [null, {}, { status: "mystery" }, { status: "cancelled" },
    { status: "paid", payments: [{ status: "refunded" }] }]) {
    assert.notEqual(orderConfirmationView(value).title, "Pago confirmado")
  }
})

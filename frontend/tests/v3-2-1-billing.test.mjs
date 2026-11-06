import test from "node:test"
import assert from "node:assert/strict"
import { initialTaxDocumentAmount } from "../src/utils/billingViewData.js"

test("never auto-copy USD or ARS order value into a Chilean tax document", () => {
  assert.equal(initialTaxDocumentAmount(null, { currency: "USD", total: 99.99 }), "")
  assert.equal(initialTaxDocumentAmount(null, { currency: "ARS", total: 50000 }), "")
  assert.equal(initialTaxDocumentAmount(null, { total: 9000 }), "")
})
test("CLP may prefill catalog CLP order total without FX conversion", () => {
  assert.equal(initialTaxDocumentAmount(null, { currency: "CLP", total: 12000 }), 12000)
  assert.equal(initialTaxDocumentAmount(null, { currency: "CLP", total: 0 }), 0)
})
test("existing historical document amount is not erased automatically", () => {
  assert.equal(initialTaxDocumentAmount({ monto: 20000 }, { currency: "USD", total: 90 }), 20000)
  assert.equal(initialTaxDocumentAmount({ monto: 0 }, { currency: "ARS", total: 100 }), 0)
})

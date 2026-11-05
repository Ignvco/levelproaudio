import test from "node:test"
import assert from "node:assert/strict"
import {
  availableOrderPaymentMethods, selectedOrderPaymentMethod, paymentNextStep,
} from "../src/pages/dashboard/dashboardPaymentMethods.js"

test("no se inventan métodos de pago cuando la API no devuelve opciones", () => {
  assert.deepEqual(availableOrderPaymentMethods(undefined), [])
  assert.deepEqual(availableOrderPaymentMethods({ methods: [] }), [])
  assert.equal(selectedOrderPaymentMethod("paypal", []), "")
})

test("los métodos para ARS/USD/CLP dependen de la respuesta del backend", () => {
  const methods = availableOrderPaymentMethods({
    methods: [{ id: "mercadopago_ar" }, { id: "payoneer" }, { id: "transfer" }],
  })
  assert.deepEqual(methods.map(m => m.id), ["mercadopago_ar", "payoneer", "transfer"])
  assert.equal(selectedOrderPaymentMethod("mercadopago_cl", methods), "mercadopago_ar")
  assert.equal(selectedOrderPaymentMethod("payoneer", methods), "payoneer")
})

test("dlocal y proveedores desconocidos nunca aparecen antes de su implementación", () => {
  assert.deepEqual(
    availableOrderPaymentMethods({ methods: [{ id: "dlocal" }, { id: "bitcoin" }, { id: "paypal" }] }).map(m => m.id),
    ["paypal"],
  )
})

test("redirige a MP Chile, MP Argentina y PayPal solo con un enlace HTTPS válido", () => {
  assert.deepEqual(paymentNextStep("mercadopago_cl", { init_point: "https://mp.test/1" }, "id"), { type: "external", url: "https://mp.test/1" })
  assert.deepEqual(paymentNextStep("mercadopago_ar", { init_point: "https://mp.test/2" }, "id"), { type: "external", url: "https://mp.test/2" })
  assert.deepEqual(paymentNextStep("paypal", { approve_url: "https://pp.test/1" }, "id"), { type: "external", url: "https://pp.test/1" })
  assert.equal(paymentNextStep("paypal", {}, "id"), null)
  assert.equal(paymentNextStep("mercadopago_cl", { init_point: "javascript:alert(1)" }, "id"), null)
})

test("transferencias, Payoneer y Global66 usan instrucciones de la orden existente", () => {
  for (const method of ["transfer", "payoneer", "global66"]) {
    assert.deepEqual(paymentNextStep(method, {}, "ord123"), { type: "internal", url: "/payment/transfer/ord123" })
  }
  assert.equal(paymentNextStep("dlocal", {}, "ord123"), null)
})

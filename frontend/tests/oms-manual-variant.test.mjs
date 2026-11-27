import test from "node:test"
import assert from "node:assert/strict"
import {
  manualProductRequiresVariant,
  availableManualVariants,
  manualVariantPrice,
  makeManualDraftLine,
  toManualOrderPayloadLine,
} from "../src/pages/admin/manualOrderVariant.js"

const base = { id: "p-simple", name: "SM58", sku: "SH-SM58", price: "120000", variants: [], admin_variants: [], has_variants: false }
const variants = {
  id: "p-variant", name: "DT990", sku: "BE-DT990", has_variants: true,
  variants: [
    { id: "v-80", name: "80 Ohm", sku: "BE-DT990-80", is_active: true, stock: 8, prices: { CLP: "199000", USD: "215.00", ARS: "290000" } },
    { id: "v-250", name: "250 Ohm", sku: "BE-DT990-250", is_active: true, stock: 4, prices: { CLP: "209000", USD: "225.00", ARS: "310000" } },
    { id: "v-old", name: "Descontinuada", sku: "BE-OLD", is_active: false },
  ],
}

test("producto simple no exige variant_id y preserva contrato OMS", () => {
  const line = makeManualDraftLine({ product: base, quantity: 2 })
  assert.equal(manualProductRequiresVariant(base), false)
  assert.deepEqual(toManualOrderPayloadLine(line), { product_id: "p-simple", quantity: 2 })
})

test("producto multivariante exige elección explícita", () => {
  assert.equal(manualProductRequiresVariant(variants), true)
  assert.throws(() => makeManualDraftLine({ product: variants, quantity: 1 }), /Selecciona una variante/)
})

test("selección válida propaga variante/SKU al payload y presentación", () => {
  const line = makeManualDraftLine({ product: variants, variantId: "v-250", quantity: 2, currency: "USD" })
  assert.equal(line.sku, "BE-DT990-250")
  assert.equal(line.variant_name, "250 Ohm")
  assert.deepEqual(toManualOrderPayloadLine(line), { product_id: "p-variant", variant_id: "v-250", quantity: 2 })
})

test("precio autorizado se envía sin metadatos de UI", () => {
  const line = makeManualDraftLine({ product: variants, variantId: "v-80", quantity: 1, authorizedUnitPrice: "149000.50" })
  assert.deepEqual(toManualOrderPayloadLine(line), { product_id: "p-variant", variant_id: "v-80", quantity: 1, authorized_unit_price: "149000.50" })
})

test("rechaza variante de otro producto y variante inactiva", () => {
  assert.throws(() => makeManualDraftLine({ product: variants, variantId: "v-otro" }), /Selecciona una variante/)
  assert.throws(() => makeManualDraftLine({ product: variants, variantId: "v-old" }), /Selecciona una variante/)
  assert.deepEqual(availableManualVariants(variants).map((v) => v.id), ["v-80", "v-250"])
})

test("no permite heredar variante en producto simple", () => {
  assert.throws(() => makeManualDraftLine({ product: base, variantId: "v-80" }), /producto simple/)
})

test("no permite enviar un producto inexistente", () => {
  assert.throws(() => makeManualDraftLine({ product: null }), /Selecciona un producto/)
})

test("productos con solo variantes inactivas quedan bloqueados", () => {
  const inactive = { ...base, has_variants: false, admin_variants: [{ id: "v-old", is_active: false }] }
  assert.equal(manualProductRequiresVariant(inactive), true)
  assert.deepEqual(availableManualVariants(inactive), [])
  assert.throws(() => makeManualDraftLine({ product: inactive }), /no tiene variantes activas/)
})

test("variantes hidratadas solo en admin_variants también son elegibles", () => {
  const onlyAdmin = { ...base, variants: [], has_variants: true, admin_variants: [{ id: "v-adm", sku: "ADM", is_active: true }] }
  const line = makeManualDraftLine({ product: onlyAdmin, variantId: "v-adm" })
  assert.equal(toManualOrderPayloadLine(line).variant_id, "v-adm")
})

test("has_variants true sin opciones hidratadas falla de manera segura", () => {
  assert.throws(() => makeManualDraftLine({ product: { ...base, has_variants: true } }), /no tiene variantes activas/)
})

test("valida cantidad entera y estrictamente positiva", () => {
  for (const quantity of [0, -1, 1.5, "abc", "", Infinity]) {
    assert.throws(() => makeManualDraftLine({ product: base, quantity }), /cantidad entera positiva/)
  }
})

test("valida precio autorizado", () => {
  for (const value of ["0", "-10", "NaN", "1.234", "Infinity", "a"]) {
    assert.throws(() => makeManualDraftLine({ product: base, authorizedUnitPrice: value }), /precio autorizado válido/)
  }
})

test("precios de variantes no mezclan monedas y priorizan prices", () => {
  assert.equal(manualVariantPrice(variants.variants[0], "USD"), "215.00")
  assert.equal(manualVariantPrice(variants.variants[0], "ARS"), "290000")
  assert.equal(manualVariantPrice({ price: "100" }, "USD"), null)
  assert.equal(manualVariantPrice({ price: "100" }, "CLP"), "100")
})

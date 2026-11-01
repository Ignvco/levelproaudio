import test from "node:test"
import assert from "node:assert/strict"
import { routeSeo, isPublicSeoPath } from "../src/utils/seoHead.js"
for (const path of ["/", "/shop", "/academy/", "/services", "/bajo-pedido", "/rewards", "/garantia"]) {
  test(`public route ${path}`, () => { assert.equal(routeSeo(path).noindex, false); assert.equal(isPublicSeoPath(path), true) })
}
for (const path of ["/payment/success", "/payment/transfer/id", "/dashboard", "/admin", "/checkout", "/login", "/unknown"]) {
  test(`private/unknown route ${path}`, () => { assert.equal(routeSeo(path).noindex, true); assert.equal(isPublicSeoPath(path), false) })
}
for (const path of ["/shop/mic", "/academy/curso", "/services/mastering"]) {
  test(`detail ${path} waits for published content`, () => { assert.equal(routeSeo(path).noindex, true); assert.equal(isPublicSeoPath(path), true) })
}

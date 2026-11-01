import test from "node:test"
import assert from "node:assert/strict"
import { serializeJsonLd } from "../src/utils/jsonLd.js"

for (const value of [
  { name: "Audio & música <profesional>" },
  { description: '</script><script>globalThis.injected=true</script>' },
  { description: '<!-- <ScRiPt src="https://example.test"> -->' },
  { name: '"quoted" \\ slash / ñ 🎵 \u2028 \u2029' },
  { "<unsafe-key>": { value: "<&>", offers: [{ price: 49.99, currency: "USD" }] } },
  [true, false, null, 0, ""],
  null,
]) {
  test(`JSON round trip: ${JSON.stringify(value).slice(0, 70)}`, () => {
    const serialized = serializeJsonLd(value)
    assert.deepEqual(JSON.parse(serialized), value)
    assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/)
  })
}
test("undefined retains JSON.stringify semantics", () => assert.equal(serializeJsonLd(undefined), undefined))

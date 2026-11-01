import test from "node:test"
import assert from "node:assert/strict"
import { chromium } from "playwright"
import { serializeJsonLd } from "../src/utils/jsonLd.js"

test("HTML parsing cannot break out of serialized JSON-LD", async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PAYMENT_TEST_CHROMIUM ? { executablePath: process.env.PAYMENT_TEST_CHROMIUM } : {}), args: ["--no-sandbox"] })
  try {
    const page = await browser.newPage()
    await page.route("**/*", route => route.abort())
    const data = { "@type": "Product", name: '</script><script>window.jsonLdInjected=true</script><img src=x onerror="window.jsonLdInjected=true">', description: "Audio & sonido" }
    await page.setContent(`<html><head><script type="application/ld+json">${serializeJsonLd(data)}</script></head><body></body></html>`)
    assert.equal(await page.locator("script").count(), 1)
    assert.equal(await page.locator("img").count(), 0)
    assert.equal(await page.evaluate(() => window.jsonLdInjected), undefined)
    assert.deepEqual(JSON.parse(await page.locator("script").textContent()), data)
  } finally { await browser.close() }
})

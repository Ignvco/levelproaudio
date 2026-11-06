import test from "node:test"
import assert from "node:assert/strict"
import { queryDisplayState, listFromResponse } from "../src/utils/queryDisplayState.js"

test("an API error is never reported as an empty successful response", () => {
  assert.equal(queryDisplayState({ isError: true, isPending: true }), "error")
  assert.equal(queryDisplayState({ isError: true, data: [] }), "error")
})
test("distinguishes loading and successful empty accounts", () => {
  assert.equal(queryDisplayState({ isPending: true }), "loading")
  assert.equal(queryDisplayState(), "loading")
  assert.equal(queryDisplayState({ data: [] }), "ready")
  assert.deepEqual(listFromResponse([]), [])
  assert.deepEqual(listFromResponse({ results: [{ id: 1 }] }), [{ id: 1 }])
  assert.deepEqual(listFromResponse({ results: null }), [])
})
test("keeps valid successful account data intact", () => {
  const data = [{ id: "LP-1" }, { id: "LP-2" }]
  assert.equal(queryDisplayState({ data }), "ready")
  assert.deepEqual(listFromResponse(data), data)
  assert.equal(queryDisplayState({ data: { puntos_disponibles: 0 } }), "ready")
})

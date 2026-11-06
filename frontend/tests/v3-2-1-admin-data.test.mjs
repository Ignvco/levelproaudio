import test from "node:test"
import assert from "node:assert/strict"
import { enrollmentProgress, adminUserRole } from "../src/utils/adminListData.js"

test("enrollment progress uses the actual API field, including a real zero", () => {
  assert.equal(enrollmentProgress({ progress: 100 }), 100)
  assert.equal(enrollmentProgress({ progress: "37.5" }), 37.5)
  assert.equal(enrollmentProgress({ progress: 0, progress_percentage: 90 }), 0)
  assert.equal(enrollmentProgress({ progress_percentage: 50 }), 50)
})

test("missing or invalid progress is unavailable, never a fabricated zero", () => {
  for (const value of [null, undefined, "", "  ", [], {}, true, false, "invalid", -1, 101, Infinity]) {
    assert.equal(enrollmentProgress({ progress: value }), null, String(value))
  }
  assert.equal(enrollmentProgress({}), null)
})

test("admin user roles reflect explicit server flags without granting permissions", () => {
  assert.equal(adminUserRole({ is_superuser: true, is_staff: true }), "super")
  assert.equal(adminUserRole({ is_superuser: false, is_staff: true }), "admin")
  assert.equal(adminUserRole({ is_superuser: false, is_staff: false }), "cliente")
  for (const user of [{}, null, { is_staff: false }, { is_staff: "false", is_superuser: "false" }]) {
    assert.equal(adminUserRole(user), "unknown")
  }
})

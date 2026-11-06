// Shared event emitter. Keep non-component exports outside the React boundary.
export function showToast(message, type = "success") {
  window.dispatchEvent(new CustomEvent("show-toast", {
    detail: { message, type },
  }))
}

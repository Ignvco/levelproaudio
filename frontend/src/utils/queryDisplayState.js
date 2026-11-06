// Display states for authenticated account resources.
// API errors must never be presented as "zero results".
export function queryDisplayState({ isPending = false, isError = false, data } = {}) {
  if (isError) return "error"
  if (isPending || data === undefined) return "loading"
  return "ready"
}

export function listFromResponse(data) {
  return Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
}

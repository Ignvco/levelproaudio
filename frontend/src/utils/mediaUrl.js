export const mediaUrl = (path) => {
  if (!path) return null
  if (path.startsWith("http")) return path
  const base = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000"
  if (path.startsWith("/")) return `${base}${path}`
  return `${base}/media/${path}`
}
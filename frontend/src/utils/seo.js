// utils/seo.js — Helpers SEO compartidos
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://levelproaudio.com").replace(/\/$/, "")

// Convierte una ruta o URL relativa en absoluta usando el dominio canónico
export function absUrl(pathOrUrl) {
  if (!pathOrUrl) return SITE_URL
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`
}

// URL canónica de la página actual (sin query ni hash)
export function canonicalOf(pathname) {
  const path = pathname || (typeof window !== "undefined" ? window.location.pathname : "/")
  return `${SITE_URL}${path === "/" ? "" : path.replace(/\/$/, "")}` || SITE_URL
}

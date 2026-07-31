// utils/analytics.js — Helper para eventos de conversión GA4 (no-op si GA no está cargado)
export function track(event, params = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", event, params)
  }
}

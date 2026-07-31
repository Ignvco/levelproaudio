// components/Analytics.jsx — Google Analytics 4 para SPA React/Vite.
// Carga gtag.js una sola vez y envía page_view en cada cambio de ruta.
import { useEffect } from "react"
import { useLocation } from "react-router-dom"

const GA_ID = import.meta.env.VITE_GA4_ID

export default function Analytics() {
  const location = useLocation()

  // 1) Cargar gtag.js e inicializar una sola vez (sin duplicar la etiqueta)
  useEffect(() => {
    if (!GA_ID || window.__ga4_loaded) return
    window.__ga4_loaded = true

    const s = document.createElement("script")
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    document.head.appendChild(s)

    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() { window.dataLayer.push(arguments) }
    window.gtag("js", new Date())
    // send_page_view:false → el page_view lo enviamos manualmente por ruta (SPA)
    window.gtag("config", GA_ID, { send_page_view: false })
  }, [])

  // 2) Enviar page_view en cada navegación (incluye la carga inicial)
  useEffect(() => {
    if (!GA_ID || typeof window.gtag !== "function") return
    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [location.pathname, location.search])

  return null
}

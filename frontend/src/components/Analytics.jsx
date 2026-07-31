// components/Analytics.jsx — page_view en cambios de ruta (SPA).
// La etiqueta gtag.js y el page_view inicial se cargan desde index.html (<head>),
// para que Google detecte la etiqueta en el HTML inicial. Acá solo trackeamos
// las navegaciones internas del SPA (sin recargar la página).
import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"

const GA_ID = import.meta.env.VITE_GA4_ID

export default function Analytics() {
  const location = useLocation()
  const firstLoad = useRef(true)
  const lastPath = useRef(null)

  useEffect(() => {
    if (!GA_ID || typeof window.gtag !== "function") return
    const path = location.pathname + location.search

    // El page_view inicial ya lo envió el snippet de index.html
    if (firstLoad.current) {
      firstLoad.current = false
      lastPath.current = path
      return
    }
    if (lastPath.current === path) return
    lastPath.current = path

    window.gtag("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [location.pathname, location.search])

  return null
}

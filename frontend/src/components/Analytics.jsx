// components/Analytics.jsx — Carga Google Analytics 4 solo si hay ID configurado
import { useEffect } from "react"

const GA_ID = import.meta.env.VITE_GA4_ID

export default function Analytics() {
  useEffect(() => {
    if (!GA_ID || window.__ga_loaded) return
    window.__ga_loaded = true

    const s = document.createElement("script")
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    document.head.appendChild(s)

    window.dataLayer = window.dataLayer || []
    function gtag() { window.dataLayer.push(arguments) }
    window.gtag = gtag
    gtag("js", new Date())
    gtag("config", GA_ID)
  }, [])

  return null
}

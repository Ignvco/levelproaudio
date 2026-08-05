// components/SeoGlobal.jsx — Datos estructurados globales + verificación Search Console
import { useEffect } from "react"
import JsonLd from "./JsonLd"
import { SITE_URL, absUrl } from "../utils/seo"
import { useSiteSettings } from "../hooks/useSiteSettings"

const GSC = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION
const FALLBACK_LOGO = absUrl("/favicon.png")

export default function SeoGlobal() {
  const { instagramUrl, siteName, logoUrl, settings } = useSiteSettings()

  // Antes, cambiar el color de marca desde Configuración del sitio no
  // hacía nada — el verde de acento seguía fijo en el CSS. Ahora, si
  // hay un accent_color configurado, sobreescribe la variable CSS real
  // en tiempo de ejecución (--accent se usa en todo el sitio).
  useEffect(() => {
    if (settings?.accent_color) {
      document.documentElement.style.setProperty("--accent", settings.accent_color)
    }
  }, [settings?.accent_color])

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: SITE_URL,
    logo: logoUrl ? absUrl(logoUrl) : FALLBACK_LOGO,
    description: "Equipamiento de audio profesional, academia y servicios de mezcla y mastering en Chile y Argentina.",
    areaServed: ["CL", "AR"],
    sameAs: [instagramUrl],
  }

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: SITE_URL,
    inLanguage: "es",
  }

  return (
    <>
      {GSC && <meta name="google-site-verification" content={GSC} />}
      <JsonLd data={organization} />
      <JsonLd data={website} />
    </>
  )
}

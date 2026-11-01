import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { SITE_URL, absUrl, canonicalOf } from "../utils/seo"
import { isPublicSeoPath, registerHead } from "../utils/seoHead"
import { useSiteSettings } from "../hooks/useSiteSettings"

const DEFAULT_DESC = "Equipamiento de audio profesional, academia y servicios en Chile y Argentina."
export default function Seo({ title, description, image, type = "website", noindex = false, canonicalPath, priority = 10 }) {
  const { settings, siteName } = useSiteSettings()
  const { pathname } = useLocation()
  const fullTitle = title ? `${title} · ${siteName}` : settings?.seo_title || `${siteName} — Equipamiento, Academia y Servicios de Audio`
  const desc = description || settings?.seo_description || DEFAULT_DESC
  const img = absUrl(image || settings?.og_image_url || "/og-image.png")
  const canonical = canonicalOf(canonicalPath || pathname)
  const hidden = noindex || !isPublicSeoPath(pathname)
  useEffect(() => registerHead({ title: fullTitle, description: desc, image: img, type, siteName, canonical, noindex: hidden }, priority),
    [fullTitle, desc, img, type, siteName, canonical, hidden, priority])
  return null
}
export { SITE_URL }

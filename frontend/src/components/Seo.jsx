// components/Seo.jsx — Meta tags por página (React 19 hoista title/meta/link al <head>)
import { SITE_URL, absUrl, canonicalOf } from "../utils/seo"
import { useSiteSettings } from "../hooks/useSiteSettings"

const DEFAULT_IMAGE = "https://levelproaudio.com/og-image.png"
const DEFAULT_DESC  = "LevelPro Audio: tienda de equipamiento profesional, academia con cursos y certificaciones, servicios y sorteos exclusivos. Envíos en Chile y Argentina."
const DEFAULT_TITLE = "LevelPro Audio — Equipamiento, Academia y Servicios de Audio"

export default function Seo({ title, description, image, type = "website", noindex = false, canonicalPath }) {
  const { settings } = useSiteSettings()

  // Orden de prioridad: lo que la página pasa explícitamente > lo
  // configurado en Configuración del sitio > constante fija de último
  // recurso. Antes seo_title/seo_description/og_image_url del admin
  // nunca se usaban en ningún lado, ni siquiera en la home.
  const baseTitle  = title || settings?.seo_title || DEFAULT_TITLE
  const fullTitle  = title ? `${title} · LevelPro Audio` : baseTitle
  const desc       = description || settings?.seo_description || DEFAULT_DESC
  const img        = absUrl(image || settings?.og_image_url || DEFAULT_IMAGE)
  const canonical  = canonicalOf(canonicalPath)

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
      <link rel="canonical" href={canonical} />

      <meta property="og:site_name" content="LevelPro Audio" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={type === "product" ? "product" : type} />
      <meta property="og:image" content={img} />
      <meta property="og:url" content={canonical} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
    </>
  )
}

export { SITE_URL }

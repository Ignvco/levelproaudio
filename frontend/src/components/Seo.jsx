// components/Seo.jsx — Meta tags por página (React 19 hoista title/meta/link al <head>)
import { SITE_URL, absUrl, canonicalOf } from "../utils/seo"

const DEFAULT_IMAGE = "https://static.prod-images.emergentagent.com/jobs/a80cc9a7-30ca-4161-aff6-32be289a34b2/images/9e25f8cddad6b215d24fbabfb18e39756e7f132344c499ff9042b894d6d9829a.jpeg"
const DEFAULT_DESC  = "LevelPro Audio: tienda de equipamiento profesional, academia con cursos y certificaciones, servicios y sorteos exclusivos. Envíos en Chile y Argentina."

export default function Seo({ title, description, image, type = "website", noindex = false, canonicalPath }) {
  const fullTitle = title ? `${title} · LevelPro Audio` : "LevelPro Audio — Equipamiento, Academia y Servicios de Audio"
  const desc      = description || DEFAULT_DESC
  const img       = absUrl(image || DEFAULT_IMAGE)
  const canonical = canonicalOf(canonicalPath)

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

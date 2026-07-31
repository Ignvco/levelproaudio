// components/SeoGlobal.jsx — Datos estructurados globales + verificación Search Console
import JsonLd from "./JsonLd"
import { SITE_URL, absUrl } from "../utils/seo"

const GSC = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION
const LOGO = absUrl("/favicon.png")

const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "LevelPro Audio",
  url: SITE_URL,
  logo: LOGO,
  description: "Equipamiento de audio profesional, academia y servicios de mezcla y mastering en Chile y Argentina.",
  areaServed: ["CL", "AR"],
  sameAs: [
    "https://instagram.com/levelproar",
  ],
}

const WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "LevelPro Audio",
  url: SITE_URL,
  inLanguage: "es",
}

export default function SeoGlobal() {
  return (
    <>
      {GSC && <meta name="google-site-verification" content={GSC} />}
      <JsonLd data={ORGANIZATION} />
      <JsonLd data={WEBSITE} />
    </>
  )
}

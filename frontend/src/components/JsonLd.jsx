// components/JsonLd.jsx — Datos estructurados Schema.org (JSON-LD)
import { serializeJsonLd } from "../utils/jsonLd"
export default function JsonLd({ data }) {
  if (!data) return null
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}

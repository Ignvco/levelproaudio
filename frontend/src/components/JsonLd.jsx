// components/JsonLd.jsx — Inyecta datos estructurados Schema.org (JSON-LD)
export default function JsonLd({ data }) {
  if (!data) return null
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

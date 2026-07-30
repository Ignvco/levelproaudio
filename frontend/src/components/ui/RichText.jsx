// components/ui/RichText.jsx — Formatea descripciones largas legibles
export function RichText({ text, style, size = "15px", color = "var(--text-2)" }) {
  if (!text) return null
  // Separa en párrafos por líneas en blanco; conserva saltos simples dentro del párrafo
  const paras = String(text).trim().split(/\n{2,}/).filter(p => p.trim())
  const list = paras.length ? paras : [String(text)]
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px",
      maxWidth: "68ch", ...style }}>
      {list.map((p, i) => (
        <p key={i} style={{ fontSize: size, color, lineHeight: 1.85,
          letterSpacing: "0.005em", whiteSpace: "pre-line" }}>
          {p.trim()}
        </p>
      ))}
    </div>
  )
}

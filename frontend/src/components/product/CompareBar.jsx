// components/product/CompareBar.jsx — Barra flotante Obsidian del comparador técnico
import { Scale, X, ArrowRight } from "lucide-react"
import { useCompareStore } from "../../store/compareStore"
import { mediaUrl } from "../../utils/mediaUrl"

export default function CompareBar() {
  const { items, removeItem, clear, openModal } = useCompareStore()
  if (!items.length) return null

  const canCompare = items.length >= 2

  return (
    <div
      role="region"
      aria-label="Comparador técnico de productos"
      data-testid="compare-bar"
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        width: "min(94vw, 860px)",
        background: "rgba(12,12,12,0.95)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(26,255,110,0.28)",
        borderRadius: "20px",
        padding: "12px 16px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          fontSize: "12px", fontWeight: 700, color: "var(--accent)",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          <Scale size={15} /> Comparar ({items.length}/4)
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {items.map(p => {
            const img = p.primary_image || p.images?.[0]?.image
            return (
              <div
                key={p.id}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  background: "#181818", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px", padding: "4px 8px 4px 6px", maxWidth: "180px",
                }}
              >
                {img && (
                  <img
                    src={mediaUrl(img)}
                    alt=""
                    style={{ width: "24px", height: "24px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }}
                  />
                )}
                <span style={{
                  fontSize: "12px", color: "#fff", fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {p.name}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${p.name} del comparador`}
                  onClick={() => removeItem(p.id)}
                  style={{
                    background: "none", border: "none", color: "var(--text-3)",
                    cursor: "pointer", padding: "2px", display: "flex",
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={clear}
          style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--text-2)", borderRadius: "999px", padding: "8px 14px",
            fontSize: "12px", fontWeight: 600, cursor: "pointer",
          }}
        >
          Limpiar
        </button>
        <button
          type="button"
          data-testid="open-compare-modal"
          disabled={!canCompare}
          onClick={openModal}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: canCompare ? "var(--accent)" : "rgba(255,255,255,0.08)",
            color: canCompare ? "#050505" : "var(--text-3)",
            border: "none", borderRadius: "999px", padding: "9px 18px",
            fontSize: "12.5px", fontWeight: 700, cursor: canCompare ? "pointer" : "not-allowed",
          }}
        >
          {canCompare ? "Ver comparativa" : "Elegí 1 más"}
          {canCompare && <ArrowRight size={14} />}
        </button>
      </div>
    </div>
  )
}

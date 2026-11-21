// components/product/CompareModal.jsx — Matriz comparativa técnica V3.3
import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { X, Scale, Award, PackageCheck, ShoppingCart, Sparkles, AlertCircle } from "lucide-react"
import { useCompareStore } from "../../store/compareStore"
import { useCartStore } from "../../store/cartStore"
import { usePrice } from "../../hooks/usePrice"
import { compareProducts } from "../../api/products.api"
import { mediaUrl } from "../../utils/mediaUrl"
import { showToast } from "../../utils/toast"

const BASE_SPEC_ROWS = [
  { key: "brand",              label: "Marca" },
  { key: "category",           label: "Categoría" },
  { key: "sku",                label: "SKU" },
  { key: "product_type",       label: "Disponibilidad" },
]

const FALLBACK_SPEC_ROWS = [
  { key: "frequency_response", label: "Respuesta en frecuencia" },
  { key: "connectivity",       label: "Conectividad" },
  { key: "weight_kg",          label: "Peso", fmt: v => (v != null ? `${v} kg` : "—") },
]

export default function CompareModal() {
  const { items, isOpen, closeModal, removeItem } = useCompareStore()
  const addItem = useCartStore(s => s.addItem)
  const { currency, format } = usePrice()

  const ids = items.map(p => p.id)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === "Escape") closeModal() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, closeModal])

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["products-compare", ids.join(","), currency],
    queryFn:  () => compareProducts({ product_ids: ids, currency }),
    enabled:  isOpen && ids.length >= 2,
  })

  if (!isOpen) return null

  const products = data?.products || []
  const advantages = data?.advantages || {}
  const accessories = data?.compatible_accessories || []
  const dynamicRows = data?.dynamic_spec_rows || []
  const specRows = [
    ...BASE_SPEC_ROWS,
    ...(dynamicRows.length > 0
      ? dynamicRows.map(r => ({ key: r.key, label: r.label }))
      : FALLBACK_SPEC_ROWS),
  ]

  const handleAddToCart = (comparedProd) => {
    const original = items.find(i => String(i.id) === String(comparedProd.id))
    if (original) {
      addItem(original, 1)
      showToast(`${original.name} agregado al carrito`)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comparador técnico de equipamiento"
      data-testid="compare-modal"
      onClick={closeModal}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(1120px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#0d0d0d",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "24px",
          padding: "clamp(20px, 3vw, 32px)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.75)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "12px", paddingBottom: "18px", marginBottom: "20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div>
            <p style={{
              fontSize: "11px", fontWeight: 700, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "4px",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <Scale size={14} /> Comparador Técnico Pro · {currency}
            </p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.25rem, 2.2vw, 1.65rem)", fontWeight: 800, color: "#fff" }}>
              Análisis lado a lado ({items.length} equipos)
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar comparador"
            onClick={closeModal}
            style={{
              width: "38px", height: "38px", borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", cursor: "pointer", display: "grid", placeItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {ids.length < 2 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-2)" }}>
            Seleccioná al menos 2 productos en la tienda para generar la matriz comparativa.
          </div>
        ) : isPending ? (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-2)", fontFamily: "var(--font-mono)", fontSize: "13px" }}>
            Calculando especificaciones y ventajas comparativas…
          </div>
        ) : isError ? (
          <div style={{ padding: "36px 16px", textAlign: "center" }}>
            <AlertCircle size={28} style={{ color: "var(--danger)", marginBottom: "10px" }} />
            <p style={{ color: "var(--text-2)", marginBottom: "14px" }}>No pudimos cargar la comparativa técnica.</p>
            <button
              type="button"
              onClick={() => refetch()}
              style={{
                background: "var(--accent)", color: "#050505", border: "none",
                borderRadius: "999px", padding: "9px 18px", fontWeight: 700, cursor: "pointer",
              }}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* Tabla comparativa responsive */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "12px", width: "190px", color: "var(--text-3)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", verticalAlign: "bottom" }}>
                      Especificación
                    </th>
                    {products.map(p => {
                      const isBestPrice = advantages?.best_price?.product_id === p.id
                      const isMaxStock  = advantages?.highest_availability?.product_id === p.id
                      return (
                        <th key={p.id} style={{ padding: "12px", verticalAlign: "top", textAlign: "left" }}>
                          <div style={{
                            background: "#151515", border: isBestPrice ? "1px solid rgba(26,255,110,0.45)" : "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "16px", padding: "14px", position: "relative",
                          }}>
                            <button
                              type="button"
                              aria-label={`Quitar ${p.name}`}
                              onClick={() => removeItem(p.id)}
                              style={{
                                position: "absolute", top: "10px", right: "10px",
                                background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "50%",
                                width: "24px", height: "24px", color: "var(--text-3)",
                                cursor: "pointer", display: "grid", placeItems: "center",
                              }}
                            >
                              <X size={13} />
                            </button>

                            {p.image_url && (
                              <img
                                src={mediaUrl(p.image_url)}
                                alt={p.name}
                                style={{ width: "100%", height: "110px", objectFit: "contain", marginBottom: "10px", borderRadius: "10px", background: "#0b0b0b" }}
                              />
                            )}

                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                              {isBestPrice && (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: "4px",
                                  fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                                  background: "rgba(26,255,110,0.14)", color: "var(--accent)",
                                }}>
                                  <Award size={11} /> Mejor precio
                                </span>
                              )}
                              {isMaxStock && (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: "4px",
                                  fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                                  background: "rgba(96,165,250,0.14)", color: "#60a5fa",
                                }}>
                                  <PackageCheck size={11} /> Mayor stock
                                </span>
                              )}
                            </div>

                            <Link
                              to={`/shop/${p.slug}`}
                              onClick={closeModal}
                              style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#fff", textDecoration: "none", marginBottom: "6px", lineHeight: 1.3 }}
                            >
                              {p.name}
                            </Link>
                            <p style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 800, color: "var(--accent)", marginBottom: "10px" }}>
                              {format(p.price, p.currency)}
                            </p>
                            <button
                              type="button"
                              disabled={!p.in_stock}
                              onClick={() => handleAddToCart(p)}
                              style={{
                                width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                background: p.in_stock ? "var(--accent)" : "rgba(255,255,255,0.06)",
                                color: p.in_stock ? "#050505" : "var(--text-3)",
                                border: "none", borderRadius: "10px", padding: "8px 10px",
                                fontSize: "12px", fontWeight: 700, cursor: p.in_stock ? "pointer" : "not-allowed",
                              }}
                            >
                              <ShoppingCart size={13} />
                              {p.in_stock ? "Agregar al carrito" : "Sin stock"}
                            </button>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td style={{ padding: "12px", fontSize: "12px", fontWeight: 600, color: "var(--text-3)" }}>Stock disponible</td>
                    {products.map(p => (
                      <td key={p.id} style={{ padding: "12px", fontSize: "13px", fontFamily: "var(--font-mono)", color: p.in_stock ? "#fff" : "var(--danger)" }}>
                        {p.in_stock ? `${p.stock} u.` : "Agotado"}
                      </td>
                    ))}
                  </tr>
                  {specRows.map(row => (
                    <tr key={row.key} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "12px", fontSize: "12px", fontWeight: 600, color: "var(--text-3)" }}>{row.label}</td>
                      {products.map(p => {
                        const raw = p.specs?.[row.key]
                        const val = row.fmt ? row.fmt(raw) : (raw || "—")
                        return (
                          <td key={p.id} style={{ padding: "12px", fontSize: "13px", color: "var(--text-2)" }}>
                            {val}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Accesorios compatibles */}
            {accessories.length > 0 && (
              <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <p style={{
                  fontSize: "11px", fontWeight: 700, color: "var(--accent)",
                  textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "12px",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <Sparkles size={13} /> Equipamiento complementario en stock
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "10px" }}>
                  {accessories.map(acc => (
                    <Link
                      key={acc.id}
                      to={`/shop/${acc.slug}`}
                      onClick={closeModal}
                      style={{
                        display: "block", padding: "12px 14px", borderRadius: "14px",
                        background: "#151515", border: "1px solid rgba(255,255,255,0.07)",
                        textDecoration: "none",
                      }}
                    >
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>{acc.name}</p>
                      <p style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                        {format(acc.price, "CLP")} · {acc.stock} en stock
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

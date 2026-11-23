// pages/AssistedCheckout.jsx
// LEVELPRO OS V4.0 — GATE 7 (BF-12): Recuperación segura de propuesta comercial y continuación al checkout
import { useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { getWhatsappProposal, continueWhatsappCheckout } from "../api/orders.api"
import { formatCurrency } from "../utils/accountingCurrency"
import {
  ShieldCheck, ShoppingBag, Clock, CheckCircle2, AlertTriangle, ArrowRight, Lock,
} from "lucide-react"

export default function AssistedCheckout() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [shippingAddress, setShippingAddress] = useState("")
  const [convertedOrder, setConvertedOrder] = useState(null)

  const { data: proposal, isLoading, isError, error } = useQuery({
    queryKey: ["whatsapp-proposal", token],
    queryFn: () => getWhatsappProposal(token),
    retry: false,
  })

  const continueMutation = useMutation({
    mutationFn: () => continueWhatsappCheckout(token, {
      shipping_address: shippingAddress || undefined,
      idempotency_key: `wa_checkout:${proposal?.draft_number || token}`,
    }),
    onSuccess: (res) => {
      setConvertedOrder(res)
    },
  })

  if (isLoading) {
    return (
      <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "32px", color: "var(--text)" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "var(--text-2)" }}>Verificando firma criptográfica de la propuesta comercial…</p>
        </div>
      </div>
    )
  }

  if (isError || !proposal) {
    const errMsg = error?.response?.data?.error || "El enlace de la propuesta comercial es inválido, fue manipulado o ha expirado."
    return (
      <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "32px", color: "var(--text)" }}>
        <div style={{
          maxWidth: "520px", width: "100%", background: "#121212",
          border: "1px solid rgba(239,68,68,0.35)", borderRadius: "24px", padding: "28px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", color: "#EF4444" }}>
            <AlertTriangle size={22} />
            <h1 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Enlace Comercial No Disponible</h1>
          </div>
          <p style={{ fontSize: "13.5px", color: "var(--text-2)", lineHeight: 1.6, marginBottom: "20px" }}>
            {errMsg}
          </p>
          <Link to="/shop" style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", borderRadius: "999px", background: "var(--accent)",
            color: "#000", fontWeight: 700, fontSize: "13px", textDecoration: "none",
          }}>
            Ir al catálogo LevelPro Audio <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "880px", margin: "0 auto", padding: "40px 20px", color: "var(--text)" }}>
      <div style={{
        background: "#121212", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "24px", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px",
        }}>
          <div>
            <p style={{
              fontSize: "11px", color: "var(--accent)", textTransform: "uppercase",
              letterSpacing: "0.14em", fontWeight: 700, marginBottom: "6px",
            }}>
              LEVELPRO AUDIO · CHECKOUT ASISTIDO SEGURO
            </p>
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, fontFamily: "var(--font-mono)" }}>
              Propuesta {proposal.draft_number}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
              background: "rgba(26,255,110,0.12)", color: "var(--accent)", border: "1px solid rgba(26,255,110,0.3)",
            }}>
              <Lock size={13} /> Token Firmado Verificado
            </span>
            <span style={{
              padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
              background: "rgba(255,255,255,0.06)", color: "#fff",
            }}>
              Moneda: {proposal.currency}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "22px" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px",
          }}>
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px", padding: "14px 16px",
            }}>
              <p style={{ fontSize: "11px", color: "var(--text-2)", textTransform: "uppercase", marginBottom: "4px" }}>
                Estado de la Propuesta
              </p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>
                {proposal.status === "converted" ? "Convertida en Pedido" : "Activa y Validada"}
              </p>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px", padding: "14px 16px",
            }}>
              <p style={{ fontSize: "11px", color: "var(--text-2)", textTransform: "uppercase", marginBottom: "4px" }}>
                Reserva WMS
              </p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent)", margin: 0 }}>
                {proposal.reserve_inventory ? "Stock Reservado Temporalmente" : "Sujeto a Confirmación"}
              </p>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px", padding: "14px 16px",
            }}>
              <p style={{ fontSize: "11px", color: "var(--text-2)", textTransform: "uppercase", marginBottom: "4px" }}>
                Vigencia del Enlace
              </p>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={13} />
                {proposal.valid_until ? new Date(proposal.valid_until).toLocaleString("es-CL") : "Vigente"}
              </p>
            </div>
          </div>

          {/* Items table */}
          <div style={{
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", overflow: "hidden",
          }}>
            <div style={{
              padding: "12px 18px", background: "rgba(255,255,255,0.04)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700,
            }}>
              <ShoppingBag size={14} /> Resumen de Equipamiento ({proposal.items?.length || 0} líneas)
            </div>
            {(proposal.items || []).map((it, idx) => (
              <div key={it.id || idx} style={{
                padding: "14px 18px",
                borderBottom: idx < proposal.items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
              }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: "0 0 4px 0" }}>
                    {it.product_name} {it.variant_name ? `(${it.variant_name})` : ""}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-2)", margin: 0, fontFamily: "var(--font-mono)" }}>
                    SKU: {it.sku} · {formatCurrency(it.unit_price, proposal.currency)} × {it.quantity}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--accent)", margin: 0 }}>
                    {formatCurrency(it.subtotal, proposal.currency)}
                  </p>
                </div>
              </div>
            ))}
            <div style={{
              padding: "16px 18px", background: "rgba(255,255,255,0.03)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: "14px", fontWeight: 700 }}>Total Autorizado ({proposal.currency})</span>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--accent)" }}>
                {formatCurrency(proposal.total, proposal.currency)}
              </span>
            </div>
          </div>

          {proposal.notes && (
            <div style={{
              padding: "14px 18px", borderRadius: "14px",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              fontSize: "13px", color: "var(--text-2)",
            }}>
              <strong style={{ color: "#fff" }}>Observaciones Comerciales:</strong> {proposal.notes}
            </div>
          )}

          {/* Action / Conversion */}
          {convertedOrder || proposal.converted_order_id ? (
            <div style={{
              padding: "20px", borderRadius: "18px",
              background: "rgba(26,255,110,0.08)", border: "1px solid rgba(26,255,110,0.3)",
              display: "flex", flexDirection: "column", gap: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--accent)" }}>
                <CheckCircle2 size={20} />
                <strong style={{ fontSize: "15px" }}>
                  Pedido Confirmado #{String(convertedOrder?.order_id || proposal.converted_order_id).slice(0, 8).toUpperCase()}
                </strong>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-2)", margin: 0 }}>
                Tu propuesta comercial fue validada y convertida en pedido formal con precios y reserva protegidos.
                El enlace compartido no equivale a pago confirmado hasta completar la pasarela o transferencia.
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => navigate(`/payment/transfer/${convertedOrder?.order_id || proposal.converted_order_id}`)}
                  style={{
                    padding: "10px 18px", borderRadius: "999px", border: "none",
                    background: "var(--accent)", color: "#000", fontWeight: 700, fontSize: "13px", cursor: "pointer",
                  }}
                >
                  Continuar a Instrucciones de Pago
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px" }}>
                  Confirmar dirección o indicación de despacho (opcional)
                </label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Ej: Despacho a estudio / Retiro en Showroom"
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: "12px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff", fontSize: "13.5px",
                  }}
                />
              </div>

              {continueMutation.isError && (
                <p style={{ fontSize: "13px", color: "#EF4444", margin: 0 }}>
                  {continueMutation.error?.response?.data?.error || "No se pudo confirmar la propuesta."}
                </p>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-2)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ShieldCheck size={15} color="var(--accent)" />
                  Precios y disponibilidad verificados en el servidor
                </span>
                <button
                  type="button"
                  data-testid="assisted-checkout-confirm-btn"
                  disabled={continueMutation.isPending}
                  onClick={() => continueMutation.mutate()}
                  style={{
                    padding: "12px 24px", borderRadius: "999px", border: "none",
                    background: "var(--accent)", color: "#000", fontWeight: 800,
                    fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px",
                  }}
                >
                  {continueMutation.isPending ? "Validando en servidor…" : "Confirmar Propuesta y Continuar al Checkout"}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

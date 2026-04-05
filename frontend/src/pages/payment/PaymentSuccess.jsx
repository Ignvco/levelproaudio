// pages/PaymentSuccess.jsx

import { useEffect, useState } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getOrder } from "../../api/orders.api"


// ── Confetti simple ──────────────────────────────────────────
function Confetti() {
  const colors = ["#1aff6e", "#facc15", "#60a5fa", "#f87171", "#c084fc"]
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    size: `${6 + Math.random() * 8}px`,
  }))

  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none",
      zIndex: 0, overflow: "hidden",
    }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute", top: "-20px",
          left: p.left, width: p.size, height: p.size,
          background: p.color, borderRadius: "2px",
          opacity: 0.7,
          animation: `fall ${p.duration} ${p.delay} ease-in forwards`,
        }} />
      ))}
      <style>{`
        @keyframes fall {
          0%   { transform: translateY(0) rotate(0deg);   opacity: 0.8; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Badge de estado ──────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pending: { label: "Pendiente de confirmación", color: "#facc15" },
    paid: { label: "Pago confirmado", color: "#4ade80" },
    completed: { label: "Completado", color: "#4ade80" },
    shipped: { label: "En camino", color: "#60a5fa" },
  }
  const s = map[status] || map.pending
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "4px 12px", borderRadius: "100px", fontSize: "12px",
      fontWeight: 500, color: s.color,
      background: `${s.color}14`, border: `1px solid ${s.color}30`,
    }}>
      <span style={{
        width: "6px", height: "6px", borderRadius: "50%",
        background: s.color, display: "inline-block",
      }} />
      {s.label}
    </span>
  )
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderId = searchParams.get("order")
  const [showConfetti, setShowConfetti] = useState(true)

  // Oculta confetti después de 4s
  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000)
    return () => clearTimeout(t)
  }, [])

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId),
    enabled: !!orderId,
    // Reintenta hasta que el pago esté confirmado (webhook puede demorar)
    refetchInterval: (data) =>
      data?.status === "pending" ? 3000 : false,
    refetchIntervalInBackground: false,
  })

  // Si no hay orderId en la URL → redirige al inicio
  useEffect(() => {
    if (!orderId) {
      const t = setTimeout(() => navigate("/"), 3000)
      return () => clearTimeout(t)
    }
  }, [orderId])

  if (!orderId) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: "16px",
    }}>
      <p style={{ color: "var(--text-3)" }}>Redirigiendo...</p>
    </div>
  )

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "clamp(24px, 5vw, 60px)",
      position: "relative",
    }}>
      {showConfetti && <Confetti />}

      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: "560px",
        display: "flex", flexDirection: "column", gap: "16px",
      }}>

        {/* ── Header de éxito ── */}
        <div style={{
          background: "var(--surface)", border: "1px solid rgba(26,255,110,0.2)",
          borderRadius: "var(--r-xl)", padding: "40px 32px",
          textAlign: "center",
        }}>
          {/* Ícono animado */}
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "rgba(26,255,110,0.1)",
            border: "2px solid rgba(26,255,110,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: "32px",
            animation: "pop 0.4s ease",
          }}>
            ✓
          </div>

          <style>{`
            @keyframes pop {
              0%   { transform: scale(0.5); opacity: 0; }
              70%  { transform: scale(1.1); }
              100% { transform: scale(1);   opacity: 1; }
            }
          `}</style>

          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            marginBottom: "10px", lineHeight: 1.1,
          }}>
            ¡Tu compra fue exitosa!
          </h1>

          <p style={{
            fontSize: "15px", color: "var(--text-2)",
            lineHeight: 1.6, marginBottom: "16px",
          }}>
            Gracias por tu compra en LevelPro Audio.{" "}

          </p>
          {/* Dentro del bloque donde se muestra el order y status === "pending" */}
          {order?.status === "pending" && (
            <div style={{
              padding: "14px 18px", borderRadius: "var(--r-md)",
              background: "rgba(250,204,21,0.06)",
              border: "1px solid rgba(250,204,21,0.2)",
              fontSize: "13px", color: "#facc15",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <span style={{ fontSize: "18px" }}>⏳</span>
              <div>
                <p style={{ fontWeight: 500, marginBottom: "3px" }}>
                  Pago en proceso de confirmación
                </p>
                <p style={{ color: "var(--text-3)", fontSize: "12px" }}>
                  Si ya pagaste, esta página se actualizará automáticamente.
                  Si no pudiste pagar,{" "}
                  <Link to={`/dashboard/orders/${order.id}`}
                    style={{ color: "var(--accent)", textDecoration: "underline" }}>
                    volvé a tu orden para reintentar
                  </Link>.
                </p>
              </div>
            </div>
          )}

          {order && <StatusBadge status={order.status} />}
        </div>

        {/* ── Comprobante ── */}
        {isLoading && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)", padding: "32px",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: "20px" }} />
              ))}
            </div>
          </div>
        )}

        {order && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)", overflow: "hidden",
          }}>
            {/* Header del comprobante */}
            <div style={{
              padding: "16px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between",
              alignItems: "center",
              background: "var(--surface-2)",
            }}>
              <p style={{
                fontSize: "13px", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.06em"
              }}>
                Comprobante de compra
              </p>
              <p style={{
                fontSize: "12px", fontFamily: "monospace",
                color: "var(--text-3)"
              }}>
                #{order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>

            {/* Datos del comprobante */}
            <div style={{ padding: "20px 24px" }}>
              {[
                {
                  label: "Número de orden",
                  value: `#${order.id.slice(0, 8).toUpperCase()}`,
                  mono: true,
                },
                {
                  label: "Email",
                  value: order.email,
                },
                {
                  label: "Fecha",
                  value: new Date(order.created_at).toLocaleDateString("es-CL", {
                    weekday: "long", day: "numeric",
                    month: "long", year: "numeric",
                  }),
                },
                {
                  label: "Estado del pago",
                  value: <StatusBadge status={order.status} />,
                },
              ].map(({ label, value, mono }) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "12px 0",
                  borderBottom: "1px solid var(--border)",
                  gap: "16px",
                }}>
                  <span style={{
                    fontSize: "13px", color: "var(--text-3)",
                    flexShrink: 0
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: "13px", textAlign: "right",
                    fontFamily: mono ? "monospace" : "inherit",
                    color: "var(--text)",
                  }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Productos */}
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <p style={{
                padding: "12px 24px", fontSize: "12px", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.06em",
                color: "var(--text-3)", borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}>
                Productos
              </p>
              {order.items?.map((item, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "14px 24px",
                  borderBottom: i < order.items.length - 1
                    ? "1px solid var(--border)" : "none",
                  gap: "16px",
                }}>
                  <div>
                    <p style={{ fontSize: "14px", marginBottom: "3px" }}>
                      {item.product_name}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      ${Number(item.price).toLocaleString("es-CL")} × {item.quantity}
                    </p>
                  </div>
                  <p style={{
                    fontSize: "14px", fontWeight: 500,
                    whiteSpace: "nowrap"
                  }}>
                    ${Number(item.subtotal).toLocaleString("es-CL")}
                  </p>
                </div>
              ))}

              {/* Total */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "16px 24px",
                borderTop: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}>
                <span style={{ fontSize: "15px", fontWeight: 600 }}>Total</span>
                <span style={{
                  fontFamily: "var(--font-serif)", fontSize: "1.6rem",
                  color: "var(--accent)",
                }}>
                  ${Number(order.total).toLocaleString("es-CL")}
                </span>
              </div>
            </div>

            {/* Dirección de envío */}
            {order.shipping_address && (
              <div style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border)",
              }}>
                <p style={{
                  fontSize: "12px", color: "var(--text-3)",
                  marginBottom: "6px"
                }}>
                  Dirección de envío
                </p>
                <p style={{ fontSize: "14px" }}>{order.shipping_address}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Info adicional ── */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: "12px",
        }}>
          <p style={{ fontSize: "13px", fontWeight: 600 }}>¿Qué sigue?</p>
          {[
            { icon: "📧", text: "Recibirás un email de confirmación con el detalle de tu compra." },
            { icon: "📦", text: "Coordinaremos el envío contigo por email o WhatsApp." },
            { icon: "🎧", text: "Para cursos digitales, ya tenés acceso en tu cuenta." },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: "flex", gap: "12px", alignItems: "flex-start",
            }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>{icon}</span>
              <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.6 }}>
                {text}
              </p>
            </div>
          ))}
        </div>

        {/* ── Botones ── */}
        <div style={{ display: "flex", gap: "12px" }}>
          <Link to="/dashboard/orders" className="btn btn-accent"
            style={{ flex: 1, justifyContent: "center" }}>
            Ver mis pedidos
          </Link>
          <Link to="/shop" className="btn btn-ghost"
            style={{ flex: 1, justifyContent: "center" }}>
            Seguir comprando
          </Link>
        </div>

        {/* ── WhatsApp ── */}
        <a

          href="https://wa.me/5492622635045"
          target="_blank" rel="noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "8px", padding: "12px", borderRadius: "var(--r-md)",
            background: "rgba(37,211,102,0.08)",
            border: "1px solid rgba(37,211,102,0.2)",
            color: "#25d166", fontSize: "13px", fontWeight: 500,
            textDecoration: "none", transition: "all var(--dur) var(--ease)",
          }}
        >
          <span style={{ fontSize: "18px" }}>💬</span>
          ¿Consultas? Escríbenos por WhatsApp
        </a>

      </div>
    </div>
  )
}
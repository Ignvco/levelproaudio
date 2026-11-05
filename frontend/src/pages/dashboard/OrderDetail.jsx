// pages/dashboard/OrderDetail.jsx — LevelPro Dashboard Experience V2 (Usuario / Detalle de Pedido)
import { useParams, Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import {
  X,
  CreditCard,
  Globe,
  Landmark,
  ReceiptText,
  ArrowRight,
  Truck,
  CheckCircle2,
  Package,
} from "lucide-react"
import { getOrder, cancelOrder } from "../../api/orders.api"
import { createPayment } from "../../api/payments.api"
import {
  AdminPageHeader,
  StatusBadge,
  SecondaryButton,
  PrimaryButton,
  DangerButton,
  SectionCard,
} from "../../components/admin/ui"

const STATUS_CONFIG = {
  pending:   { label: "Pendiente",  tone: "warning", step: 0, desc: "Completa o confirma tu pago para iniciar la preparación de tu orden." },
  paid:      { label: "En proceso", tone: "success", step: 1, desc: "Pago verificado. Tu orden está en fase de preparación en bodega." },
  shipped:   { label: "Enviado",    tone: "info",    step: 2, desc: "Tu paquete ha sido despachado y se encuentra en ruta con el transportista." },
  completed: { label: "Entregado",  tone: "success", step: 3, desc: "Pedido entregado satisfactoriamente." },
  cancelled: { label: "Cancelado",  tone: "danger",  step: -1, desc: "Este pedido fue cancelado y el stock ha sido restablecido." },
}

const PAYMENT_METHODS = [
  { id: "mercadopago_cl", label: "MercadoPago Chile",   Icon: CreditCard, desc: "Tarjetas de crédito, débito y Webpay" },
  { id: "paypal",         label: "PayPal",              Icon: Globe,      desc: "Tarjetas internacionales en USD" },
  { id: "global66",       label: "Transferencia Bancaria", Icon: Landmark,   desc: "Verificación directa y comprobante" },
]

const TRACKING_STEPS = ["Confirmado", "Preparación", "Despacho", "Entregado"]

function OrderTracking({ status }) {
  if (status === "cancelled") {
    return (
      <div
        className="au-callout au-callout--danger"
        style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "10px" }}
      >
        <X size={18} />
        <div>
          <p style={{ fontWeight: 700, fontSize: "13.5px" }}>Este pedido fue cancelado</p>
          <p style={{ fontSize: "12px", opacity: 0.85 }}>El stock de los productos ha sido reintegrado al inventario.</p>
        </div>
      </div>
    )
  }

  const info = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const activeStep = info.step

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="lp-tracking" aria-label="Progreso del pedido">
        {TRACKING_STEPS.map((label, idx) => {
          let lineClass = "lp-track-line"
          let labelClass = "lp-track-label"
          if (activeStep >= 0) {
            if (idx < activeStep || activeStep === 3) {
              lineClass += " complete"
              labelClass += " current"
            } else if (idx === activeStep) {
              lineClass += " current"
              labelClass += " current"
            }
          }
          return (
            <div key={label} className="lp-track-step">
              <div className={lineClass} />
              <div className={labelClass}>{label}</div>
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: "12.5px", color: "var(--admin-text-secondary)", marginTop: "4px" }}>
        {info.desc}
      </p>
    </div>
  )
}

function PaymentPanel({ order, onCancelled }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [method, setMethod] = useState("mercadopago_cl")
  const [error, setError] = useState("")
  const [showCancel, setShowCancel] = useState(false)

  const payMutation = useMutation({
    mutationFn: () => createPayment(order.id, method),
    onSuccess: (data) => {
      if (method === "mercadopago_cl" || method === "mercadopago_ar") {
        window.location.href = data.sandbox_url || data.init_point
      } else if (method === "paypal") {
        window.location.href = data.approve_url
      } else {
        navigate(`/payment/transfer/${order.id}`, { state: { transferData: data } })
      }
    },
    onError: () => setError("No se pudo iniciar la pasarela de pago. Intenta de nuevo."),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries(["order", order.id])
      queryClient.invalidateQueries(["orders"])
      onCancelled?.()
    },
    onError: () => setError("No se pudo cancelar la orden."),
  })

  return (
    <SectionCard
      eyebrow="ACCIÓN REQUERIDA"
      title="Pago pendiente"
      description="Selecciona tu método de pago preferido para procesar la compra."
      style={{ border: "1px solid rgba(245, 158, 11, 0.35)" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
        {PAYMENT_METHODS.map(m => {
          const active = method === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              data-testid={`od-method-${m.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "14px 18px",
                borderRadius: "14px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                background: active ? "rgba(26, 255, 110, 0.08)" : "var(--admin-surface-soft)",
                border: `1.5px solid ${active ? "var(--admin-primary)" : "var(--admin-border)"}`,
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  flexShrink: 0,
                  border: `2px solid ${active ? "var(--admin-primary)" : "var(--admin-border-strong)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {active && (
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--admin-primary)" }} />
                )}
              </div>
              <span style={{ color: active ? "var(--admin-primary-text)" : "var(--admin-text-secondary)", display: "flex" }}>
                <m.Icon size={20} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--admin-text)" }}>{m.label}</p>
                <p style={{ fontSize: "12px", color: "var(--admin-text-secondary)" }}>{m.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <p style={{ fontSize: "12.5px", color: "var(--admin-danger)", marginBottom: "12px" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <PrimaryButton
          onClick={() => payMutation.mutate()}
          loading={payMutation.isPending}
          disabled={payMutation.isPending}
          data-testid="od-pay"
          style={{ width: "100%", justifyContent: "center" }}
        >
          {payMutation.isPending
            ? "Procesando pago..."
            : method === "global66"
            ? "Ver instrucciones de transferencia"
            : "Continuar con el pago"}
          {!payMutation.isPending && <ArrowRight size={15} style={{ marginLeft: "4px" }} />}
        </PrimaryButton>

        {!showCancel ? (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            data-testid="od-cancel-open"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--admin-text-muted)",
              fontSize: "12.5px",
              cursor: "pointer",
              padding: "6px",
              textDecoration: "underline",
            }}
          >
            Cancelar este pedido
          </button>
        ) : (
          <div
            style={{
              padding: "16px",
              background: "rgba(239, 68, 68, 0.06)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "14px",
              marginTop: "4px",
            }}
          >
            <p style={{ fontSize: "13px", color: "var(--admin-text)", marginBottom: "12px", fontWeight: 600 }}>
              ¿Estás seguro de cancelar este pedido? Se liberará el stock reservado.
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <DangerButton
                size="sm"
                onClick={() => cancelMutation.mutate()}
                loading={cancelMutation.isPending}
                disabled={cancelMutation.isPending}
                data-testid="od-cancel-confirm"
              >
                {cancelMutation.isPending ? "Cancelando..." : "Sí, cancelar pedido"}
              </DangerButton>
              <SecondaryButton size="sm" onClick={() => setShowCancel(false)}>
                Volver
              </SecondaryButton>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
    refetchInterval: (data) => (data?.status === "pending" ? 5000 : false),
  })

  if (isLoading) {
    return (
      <div className="au-page" data-testid="order-detail-page">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: i === 0 ? "140px" : "180px", borderRadius: "20px" }} />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="au-page" data-testid="order-detail-page">
        <div className="au-card" style={{ padding: "64px 24px", textAlign: "center" }}>
          <p style={{ fontSize: "36px", marginBottom: "12px" }}>📦</p>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.3rem", marginBottom: "8px" }}>
            Pedido no encontrado
          </h3>
          <p style={{ fontSize: "13.5px", color: "var(--admin-text-secondary)", marginBottom: "20px" }}>
            El pedido solicitado no existe o no tienes permisos para visualizarlo.
          </p>
          <SecondaryButton to="/dashboard/orders">
            ← Volver a mis pedidos
          </SecondaryButton>
        </div>
      </div>
    )
  }

  const shortId = (order.id || "").slice(0, 8).toUpperCase()
  const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const rawDate = order.created_at || order.created
  const d = rawDate ? new Date(rawDate) : null
  const formattedDate = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : String(rawDate || "—")

  return (
    <div className="au-page" data-testid="order-detail-page">
      <AdminPageHeader
        eyebrow="LEVELPRO / MI CUENTA"
        title={`Pedido #${shortId}`}
        description={`Realizado el ${formattedDate} · ${order.items?.length || 0} producto${order.items?.length !== 1 ? "s" : ""}`}
        breadcrumbs={[
          { label: "Inicio", to: "/dashboard" },
          { label: "Mis pedidos", to: "/dashboard/orders" },
          { label: `#${shortId}` },
        ]}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <StatusBadge tone={statusInfo.tone}>{statusInfo.label}</StatusBadge>
            <SecondaryButton to="/dashboard/orders" size="sm">
              ← Mis pedidos
            </SecondaryButton>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
        {/* Columna Principal: Seguimiento, Pago y Productos */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
          {/* Tracking */}
          <SectionCard eyebrow="ESTADO DEL ENVÍO" title="Seguimiento">
            <OrderTracking status={order.status} />

            {order.tracking_number && (
              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--admin-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "rgba(26, 255, 110, 0.12)",
                      color: "var(--admin-primary-text)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Truck size={18} />
                  </span>
                  <div>
                    <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      {order.shipping_carrier || "Transportista asignado"}
                    </p>
                    <p style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
                      {order.tracking_number}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Panel de Pago si está pendiente */}
          {order.status === "pending" && (
            <PaymentPanel order={order} onCancelled={() => navigate("/dashboard/orders")} />
          )}

          {/* Lista de Productos */}
          <SectionCard eyebrow="ITEMS DE LA ORDEN" title="Productos comprados">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {(order.items || []).map((item, i) => (
                <div
                  key={item.id || `${item.product_name}-${i}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    background: "var(--admin-surface-soft)",
                    borderRadius: "14px",
                    gap: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: "var(--admin-surface)",
                        border: "1px solid var(--admin-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--admin-text-secondary)",
                        flexShrink: 0,
                      }}
                    >
                      <Package size={17} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--admin-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.product_name}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--admin-text-secondary)", fontFamily: "var(--font-mono)" }}>
                        ${Number(item.price).toLocaleString("es-CL")} × {item.quantity} ud{item.quantity !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--admin-text)", flexShrink: 0 }}>
                    ${Number(item.subtotal || item.price * item.quantity).toLocaleString("es-CL")}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingTop: "18px",
                marginTop: "16px",
                borderTop: "1px solid var(--admin-border)",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--admin-text)" }}>Total Pagado</span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.8rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "var(--admin-primary-text)",
                }}
              >
                ${Number(order.total).toLocaleString("es-CL")}
              </span>
            </div>
          </SectionCard>
        </div>

        {/* Columna Lateral: Datos de Envío y Acciones */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
          <SectionCard eyebrow="DESPACHO" title="Datos de entrega">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              <div>
                <p style={{ fontSize: "11px", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>
                  Email de contacto
                </p>
                <p style={{ fontWeight: 600, color: "var(--admin-text)" }}>{order.email}</p>
              </div>

              <div>
                <p style={{ fontSize: "11px", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>
                  Dirección de despacho
                </p>
                <p style={{ fontWeight: 600, color: "var(--admin-text)", lineHeight: 1.5 }}>
                  {order.shipping_address || "No especificada / Retiro en tienda"}
                </p>
                {order.shipping_city && (
                  <p style={{ color: "var(--admin-text-secondary)", fontSize: "12px", marginTop: "2px" }}>
                    {order.shipping_city}{order.shipping_region ? `, ${order.shipping_region}` : ""}
                  </p>
                )}
              </div>

              {order.notes && (
                <div>
                  <p style={{ fontSize: "11px", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>
                    Instrucciones de entrega
                  </p>
                  <p style={{ color: "var(--admin-text-secondary)", fontStyle: "italic", background: "var(--admin-surface-soft)", padding: "10px 12px", borderRadius: "10px" }}>
                    &quot;{order.notes}&quot;
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          {(order.status === "paid" || order.status === "completed" || order.status === "shipped") && (
            <SectionCard eyebrow="DOCUMENTACIÓN" title="Comprobante de compra">
              <p style={{ fontSize: "12.5px", color: "var(--admin-text-secondary)", marginBottom: "14px", lineHeight: 1.5 }}>
                Tu pago fue procesado correctamente. Puedes consultar tu comprobante tributario o recibo oficial.
              </p>
              <Link
                to={`/payment/success?order=${order.id}`}
                data-testid="od-receipt"
                className="au-btn au-btn--secondary"
                style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}
              >
                <ReceiptText size={15} /> Ver comprobante digital
              </Link>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  )
}

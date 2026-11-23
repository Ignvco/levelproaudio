// pages/admin/AdminOrders.jsx
// LEVELPRO OS V4.0 — GATE 7: Order Management System (OMS)
// BF-11 (Ventas Manuales / DraftOrder), BF-12 (WhatsApp Checkout), BF-13 (Estados 3D Comercial/Financiero/Logístico), BF-23 (RMA e Inspección)
import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminOrders,
  updateOrderStatus,
  updateOrderShipping,
  getAdminManualOrders,
  createAdminManualOrder,
  convertAdminManualOrder,
  cancelAdminManualOrder,
  generateManualOrderWhatsappLink,
  transitionOrderStates3D,
  getFulfillmentQueue,
  dispatchOrderWMS,
  recordOrderPaymentAttempt,
  getAdminRMAs,
  createOrderRMA,
  authorizeAdminRMA,
  inspectAdminRMA,
  refundAdminRMA,
  getAdminProducts,
} from "../../api/admin.api"
import { getMyPermissions } from "../../api/rbac.api"
import { useAuthStore } from "../../store/authStore"
import {
  Eye, Inbox, Truck, FileText, ShoppingBag, CheckCircle2, Clock3, PackageCheck, X,
  Plus, Share2, RotateCcw, Columns, List, ShieldCheck, ExternalLink, Copy, Check,
  CreditCard, ClipboardCheck, AlertTriangle, ArrowRight,
} from "lucide-react"
import {
  DataTable, StatusBadge, AdminPageHeader, StatCard,
  PrimaryButton, SecondaryButton, formInputStyle,
} from "../../components/admin/ui"
import { showToast } from "../../utils/toast"
import { formatCurrency } from "../../utils/accountingCurrency"

const STATUS = {
  pending:   { label: "Pendiente",  color: "#D97706" },
  paid:      { label: "Pagado",     color: "#0F9940" },
  shipped:   { label: "Enviado",    color: "#2563EB" },
  completed: { label: "Completado", color: "#0F9940" },
  cancelled: { label: "Cancelado",  color: "#EF4444" },
}

const COMMERCIAL_LABELS = {
  draft: "Borrador",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
}

const FINANCIAL_LABELS = {
  unpaid: "Sin pago",
  pending: "Pendiente cobro",
  authorized: "Autorizado",
  partially_paid: "Pago parcial",
  paid: "Pagado 100%",
  partially_refunded: "Reembolso parcial",
  refunded: "Reembolsado",
  failed: "Pago fallido",
}

const FULFILLMENT_LABELS = {
  unfulfilled: "Sin preparación",
  allocated: "Reservado WMS",
  partially_shipped: "Despacho parcial",
  shipped: "Despachado",
  delivered: "Entregado",
  returned: "Devuelto (RMA)",
}

const ORIGIN_LABELS = {
  online: "Web Online",
  manual: "Venta Manual",
  whatsapp: "WhatsApp Checkout",
  b2b: "Cotización B2B",
}

const TONE = {
  pending: "warning",
  paid: "success",
  shipped: "info",
  completed: "success",
  cancelled: "danger",
  approved: "success",
  rejected: "danger",
  refunded: "info",
  in_review: "warning",
  confirmed: "info",
  allocated: "warning",
  delivered: "success",
  returned: "danger",
  partially_paid: "warning",
  partially_refunded: "info",
  unfulfilled: "neutral",
  draft: "neutral",
  proposed: "info",
  reserved: "warning",
  shared: "info",
  converted: "success",
  expired: "danger",
  requested: "warning",
  authorized: "info",
  received: "info",
  inspected: "info",
  restocked: "success",
  closed: "success",
}

const labelStyle = {
  display: "block",
  fontSize: "11.5px",
  color: "var(--admin-text)",
  fontWeight: 700,
  marginBottom: "5px",
}

function OrderPanel({ order, onClose, canViewFinances = true, canApprovePayments = false }) {
  const queryClient = useQueryClient()
  const [carrier, setCarrier] = useState(order.shipping_carrier || "")
  const [tracking, setTracking] = useState(order.tracking_number || "")

  // 3D state form
  const [commState, setCommState] = useState(order.commercial_status || "confirmed")
  const [finState, setFinState] = useState(order.financial_status || "pending")
  const [fulfState, setFulfState] = useState(order.fulfillment_status || "allocated")
  const [stateReason, setStateReason] = useState("")

  // Payment attempt form
  const [payProvider, setPayProvider] = useState("transfer")
  const [payAmount, setPayAmount] = useState(String(order.total || ""))
  const [payExternalId, setPayExternalId] = useState("")

  // RMA creation quick modal inside drawer
  const [showRmaBuilder, setShowRmaBuilder] = useState(false)
  const [rmaReasonCode, setRmaReasonCode] = useState("defective")
  const [rmaReasonDetails, setRmaReasonDetails] = useState("")
  const [rmaSerial, setRmaSerial] = useState("")
  const [rmaQty, setRmaQty] = useState(1)
  const [rmaOrderItemId, setRmaOrderItemId] = useState(order.items?.[0]?.id || "")

  const invalidateAllOMS = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
    queryClient.invalidateQueries({ queryKey: ["admin-fulfillment-queue"] })
    queryClient.invalidateQueries({ queryKey: ["admin-rmas"] })
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["admin-payments"] })
    queryClient.invalidateQueries({ queryKey: ["admin-finance-summary"] })
  }

  const shippingMutation = useMutation({
    mutationFn: () => updateOrderShipping(order.id, {
      shipping_carrier: carrier,
      tracking_number: tracking,
    }),
    onSuccess: () => {
      invalidateAllOMS()
      showToast("Datos de envío actualizados.", "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.detail || e?.response?.data?.error || "No se pudo guardar el envío.", "error")
    },
  })
  const shippingDirty = carrier !== (order.shipping_carrier || "") || tracking !== (order.tracking_number || "")

  const statusMutation = useMutation({
    mutationFn: (s) => updateOrderStatus(order.id, s),
    onSuccess: () => {
      invalidateAllOMS()
      showToast("Estado legacy sincronizado.", "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || e?.response?.data?.detail || "No se pudo actualizar el estado.", "error")
    },
  })

  const state3DMutation = useMutation({
    mutationFn: () => transitionOrderStates3D(order.id, {
      commercial_status: commState,
      financial_status: finState,
      fulfillment_status: fulfState,
      shipping_carrier: carrier || undefined,
      tracking_number: tracking || undefined,
      reason: stateReason || "Actualización tri-dimensional OMS",
    }),
    onSuccess: () => {
      invalidateAllOMS()
      showToast("Estados comercial, financiero y logístico actualizados.", "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "Transición 3D rechazada por contrato.", "error")
    },
  })

  const paymentAttemptMutation = useMutation({
    mutationFn: () => recordOrderPaymentAttempt(order.id, {
      provider: payProvider,
      amount: payAmount,
      currency: order.currency,
      external_id: payExternalId || `PAY-${Date.now()}`,
      approve_immediately: true,
    }),
    onSuccess: (res) => {
      invalidateAllOMS()
      showToast(
        res.is_duplicate
          ? "Intento duplicado detectado (idempotente)."
          : `Pago registrado (${res.payment_status} → ${res.financial_status}).`,
        "success"
      )
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "Error al registrar intento de pago.", "error")
    },
  })

  const createRmaMutation = useMutation({
    mutationFn: () => createOrderRMA(order.id, {
      reason_code: rmaReasonCode,
      reason_details: rmaReasonDetails,
      items: [
        {
          order_item_id: rmaOrderItemId || order.items?.[0]?.id,
          quantity_requested: Number(rmaQty) || 1,
          serial_number: rmaSerial.trim(),
        },
      ],
    }),
    onSuccess: (res) => {
      invalidateAllOMS()
      setShowRmaBuilder(false)
      showToast(`Solicitud RMA ${res.rma_number} creada exitosamente.`, "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "No se pudo crear la solicitud RMA.", "error")
    },
  })

  return (
    <>
      <div onClick={onClose} className="lp-drawer-backdrop" />

      <div className="lp-drawer" role="dialog" aria-modal="true" aria-label="Detalle de orden">
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--admin-border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "var(--admin-surface-secondary)", flexShrink: 0,
        }}>
          <div>
            <p className="au-eyebrow" style={{ marginBottom: "4px" }}>
              Orden OMS · {ORIGIN_LABELS[order.order_origin] || "Online"}
            </p>
            <p style={{ fontSize: "17px", fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--admin-text)" }}>
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className="au-iconbtn" aria-label="Cerrar panel">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: "16px",
        }}>
          {/* BF-13: Matriz Tri-Dimensional de Estados */}
          <div style={{
            background: "#fff", border: "1px solid var(--admin-border)",
            borderRadius: "18px", padding: "18px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <p style={{
                fontSize: "11px", color: "var(--admin-text)", textTransform: "uppercase",
                letterSpacing: "0.08em", fontWeight: 800, margin: 0,
              }}>
                BF-13 · Estados Desacoplados (3D)
              </p>
              <StatusBadge tone={TONE[order.status] || "neutral"}>
                Legacy: {STATUS[order.status]?.label || order.status}
              </StatusBadge>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>1. Comercial</label>
                <select
                  value={commState}
                  onChange={(e) => setCommState(e.target.value)}
                  style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px", padding: "8px 10px" }}
                >
                  {Object.entries(COMMERCIAL_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>2. Financiero</label>
                <select
                  value={finState}
                  onChange={(e) => setFinState(e.target.value)}
                  disabled={!canApprovePayments}
                  style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px", padding: "8px 10px" }}
                >
                  {Object.entries(FINANCIAL_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>3. Logístico</label>
                <select
                  value={fulfState}
                  onChange={(e) => setFulfState(e.target.value)}
                  style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px", padding: "8px 10px" }}
                >
                  {Object.entries(FULFILLMENT_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>{lbl}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
              <input
                value={stateReason}
                onChange={(e) => setStateReason(e.target.value)}
                placeholder="Motivo de transición auditable..."
                style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px", padding: "8px 12px", flex: 1 }}
              />
              <PrimaryButton size="sm" onClick={() => state3DMutation.mutate()} disabled={state3DMutation.isPending}>
                {state3DMutation.isPending ? "Validando..." : "Aplicar 3D"}
              </PrimaryButton>
            </div>

            <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)", marginBottom: "8px" }}>
              Acción rápida compatible (Legacy):
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {Object.entries(STATUS)
                .filter(([s]) => s !== order.status)
                .map(([s, { label, color }]) => (
                  <button
                    key={s}
                    onClick={() => statusMutation.mutate(s)}
                    disabled={statusMutation.isPending}
                    style={{
                      padding: "6px 12px", borderRadius: "9999px",
                      fontSize: "12px", fontWeight: 700, cursor: "pointer",
                      color, background: `${color}15`, border: `1px solid ${color}40`,
                    }}
                  >
                    → {label}
                  </button>
                ))}
            </div>
          </div>

          {/* Sección 8: Registro de Cobro / Conciliación Parcial o Total */}
          {canApprovePayments && (
            <div style={{
              background: "var(--admin-surface-secondary)", border: "1px solid var(--admin-border)",
              borderRadius: "18px", padding: "18px",
            }}>
              <p style={{
                fontSize: "11px", color: "var(--admin-text)", textTransform: "uppercase",
                letterSpacing: "0.08em", fontWeight: 800, marginBottom: "10px",
                display: "flex", alignItems: "center", gap: "6px",
              }}>
                <CreditCard size={13} /> Conciliar Cobro / Pago Parcial ({order.currency})
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                <select
                  value={payProvider}
                  onChange={(e) => setPayProvider(e.target.value)}
                  style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px", padding: "8px 10px" }}
                >
                  <option value="transfer">Transferencia</option>
                  <option value="mercadopago_cl">MercadoPago CL</option>
                  <option value="paypal">PayPal</option>
                  <option value="cash">Pago Manual</option>
                </select>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Monto"
                  style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px", padding: "8px 10px" }}
                />
                <input
                  value={payExternalId}
                  onChange={(e) => setPayExternalId(e.target.value)}
                  placeholder="Ref / ID Externo"
                  style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px", padding: "8px 10px" }}
                />
              </div>
              <PrimaryButton size="sm" onClick={() => paymentAttemptMutation.mutate()} disabled={paymentAttemptMutation.isPending}>
                {paymentAttemptMutation.isPending ? "Conciliando..." : "Registrar y Aprobar Cobro"}
              </PrimaryButton>
            </div>
          )}

          {/* Envío */}
          <div style={{
            background: "var(--admin-surface-secondary)", border: "1px solid var(--admin-border)",
            borderRadius: "18px", padding: "18px",
          }}>
            <p style={{
              fontSize: "11px", color: "var(--admin-text)", textTransform: "uppercase",
              letterSpacing: "0.08em", fontWeight: 800, marginBottom: "12px",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <Truck size={13} /> Envío y Seguimiento
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={labelStyle}>Transportista</label>
                <input
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="Ej: Chilexpress, Starken..."
                  style={{ ...formInputStyle, background: "#fff", fontSize: "13px", padding: "9px 12px" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Número de seguimiento</label>
                <input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="Ej: CL123456789"
                  style={{ ...formInputStyle, background: "#fff", fontSize: "13px", padding: "9px 12px" }}
                />
              </div>
              {shippingDirty && (
                <PrimaryButton size="sm" onClick={() => shippingMutation.mutate()} disabled={shippingMutation.isPending}>
                  {shippingMutation.isPending ? "Guardando..." : "Guardar envío"}
                </PrimaryButton>
              )}
            </div>
          </div>

          {/* Cliente */}
          <div style={{
            background: "var(--admin-surface-secondary)", border: "1px solid var(--admin-border)",
            borderRadius: "18px", padding: "18px",
          }}>
            <p style={{
              fontSize: "11px", color: "var(--admin-text)", textTransform: "uppercase",
              letterSpacing: "0.08em", fontWeight: 800, marginBottom: "12px",
            }}>Cliente</p>
            {[
              ...(order.customer_name ? [{ label: "Nombre", value: order.customer_name }] : []),
              { label: "Email", value: order.email },
              ...(order.customer_tax_id ? [{ label: "RUT/CUIT", value: order.customer_tax_id }] : []),
              { label: "Dirección", value: order.shipping_address || "—" },
              ...(order.sales_rep_email ? [{ label: "Ejecutivo", value: order.sales_rep_email }] : []),
              ...(order.notes ? [{ label: "Notas", value: order.notes }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", gap: "12px", fontSize: "13px", marginBottom: "8px" }}>
                <span style={{ color: "var(--admin-text-muted)", flexShrink: 0, minWidth: "78px", fontWeight: 600 }}>
                  {label}
                </span>
                <span style={{ color: "var(--admin-text)", fontWeight: 600, wordBreak: "break-word" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Productos */}
          <div style={{
            background: "#fff", border: "1px solid var(--admin-border)",
            borderRadius: "18px", overflow: "hidden",
          }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid var(--admin-border)",
              background: "var(--admin-surface-secondary)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <p style={{
                fontSize: "11px", color: "var(--admin-text)", textTransform: "uppercase",
                letterSpacing: "0.08em", fontWeight: 800, margin: 0,
              }}>
                Productos ({order.items_count})
              </p>
              {["shipped", "completed"].includes(order.status) && (
                <button
                  type="button"
                  onClick={() => setShowRmaBuilder(!showRmaBuilder)}
                  style={{
                    fontSize: "11.5px", fontWeight: 700, color: "#065F46",
                    background: "#ECFDF5", border: "1px solid #A7F3D0",
                    borderRadius: "999px", padding: "4px 10px", cursor: "pointer",
                  }}
                >
                  + Solicitar Devolución RMA
                </button>
              )}
            </div>
            {order.items?.map((item, i) => (
              <div key={item.id || `item-${i}`} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "11px 16px",
                borderBottom: i < order.items.length - 1 ? "1px solid var(--admin-border)" : "none",
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{
                    fontSize: "13px", fontWeight: 700, color: "var(--admin-text)", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0,
                  }}>
                    {item.product_name} {item.variant_name ? `(${item.variant_name})` : ""}
                  </p>
                  <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)", margin: "2px 0 0 0" }}>
                    {formatCurrency(item.price, order.currency)} × {item.quantity}
                  </p>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--admin-text)", flexShrink: 0, marginLeft: "12px" }}>
                  {formatCurrency(item.subtotal, order.currency)}
                </span>
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "13px 16px", borderTop: "1px solid var(--admin-border)",
              background: "var(--admin-surface-secondary)",
            }}>
              <span style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--admin-text)" }}>Total</span>
              <span style={{
                fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 800,
                color: "var(--admin-primary-text)",
              }}>
                {formatCurrency(order.total, order.currency)}
              </span>
            </div>
          </div>

          {/* Constructor rápido RMA para la orden */}
          {showRmaBuilder && (
            <div style={{
              background: "#fff", border: "1px solid var(--admin-border)",
              borderRadius: "18px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px",
            }}>
              <p style={{ fontSize: "12px", fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>
                Nueva Solicitud RMA (BF-23)
              </p>
              <select
                value={rmaOrderItemId}
                onChange={(e) => setRmaOrderItemId(e.target.value)}
                style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px" }}
              >
                {(order.items || []).map((it) => (
                  <option key={it.id} value={it.id}>{it.product_name} (x{it.quantity})</option>
                ))}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <select
                  value={rmaReasonCode}
                  onChange={(e) => setRmaReasonCode(e.target.value)}
                  style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px" }}
                >
                  <option value="defective">Falla técnica / Defecto</option>
                  <option value="damaged_shipping">Daño en transporte</option>
                  <option value="wrong_item">Producto incorrecto</option>
                  <option value="retract">Retracto legal</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={rmaQty}
                  onChange={(e) => setRmaQty(e.target.value)}
                  placeholder="Cantidad"
                  style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px" }}
                />
              </div>
              <input
                value={rmaSerial}
                onChange={(e) => setRmaSerial(e.target.value)}
                placeholder="Número de serie devuelto (obligatorio si REQUIRED)"
                style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px" }}
              />
              <input
                value={rmaReasonDetails}
                onChange={(e) => setRmaReasonDetails(e.target.value)}
                placeholder="Detalle técnico del motivo..."
                style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px" }}
              />
              <PrimaryButton size="sm" onClick={() => createRmaMutation.mutate()} disabled={createRmaMutation.isPending}>
                {createRmaMutation.isPending ? "Registrando RMA..." : "Confirmar Solicitud RMA"}
              </PrimaryButton>
            </div>
          )}

          {/* Pagos */}
          {order.payments?.length > 0 && (
            <div style={{
              background: "#fff", border: "1px solid var(--admin-border)",
              borderRadius: "18px", overflow: "hidden",
            }}>
              <p style={{
                fontSize: "11px", color: "var(--admin-text)", textTransform: "uppercase",
                letterSpacing: "0.08em", fontWeight: 800, padding: "12px 16px",
                borderBottom: "1px solid var(--admin-border)", background: "var(--admin-surface-secondary)",
              }}>
                Historial de Pagos
              </p>
              {order.payments.map((p, i) => (
                <div key={p.id || `pay-${i}`} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "11px 16px",
                  borderBottom: i < order.payments.length - 1 ? "1px solid var(--admin-border)" : "none",
                }}>
                  <div>
                    <p style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>{p.provider}</p>
                    <p style={{ fontSize: "11px", color: "var(--admin-text-muted)", margin: 0 }}>{p.paid_at || p.created_at}</p>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--admin-text)" }}>
                    <span>{formatCurrency(p.amount, p.currency || order.currency)}</span>
                    <StatusBadge tone={TONE[p.status] || "neutral"}>{p.status}</StatusBadge>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Documentación tributaria */}
          {canViewFinances && ["paid", "shipped", "completed"].includes(order.status) && (
            <div style={{ paddingTop: "4px" }}>
              <p style={{ fontSize: "11.5px", color: "var(--admin-text-muted)", fontWeight: 600, marginBottom: "8px" }}>
                Documentación tributaria
              </p>
              <Link to="/admin/billing" className="au-btn au-btn--secondary" style={{ width: "100%", textDecoration: "none" }}>
                <FileText size={14} /> Registrar / gestionar en Documentación Tributaria
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function AdminOrders() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  // Pestaña principal OMS: "orders" | "manual" | "fulfillment" | "rma"
  const [activeTab, setActiveTab] = useState("orders")
  // Modo de vista en Centro de Pedidos: "table" | "kanban"
  const [viewMode, setViewMode] = useState("table")

  // Filtros en Centro de Pedidos
  const [statusFilter, setStatusFilter] = useState("")
  const [currencyFilter, setCurrencyFilter] = useState("")
  const [originFilter, setOriginFilter] = useState("")
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Modal / Drawer para Venta Manual (BF-11 & BF-12)
  const [showManualModal, setShowManualModal] = useState(false)
  const [selectedDraft, setSelectedDraft] = useState(null)
  const [whatsappLinkData, setWhatsappLinkData] = useState(null)
  const [copiedWa, setCopiedWa] = useState(false)

  // Campos del formulario de Venta Manual
  const [draftCustomerName, setDraftCustomerName] = useState("")
  const [draftCustomerEmail, setDraftCustomerEmail] = useState("")
  const [draftCustomerPhone, setDraftCustomerPhone] = useState("")
  const [draftCustomerTaxId, setDraftCustomerTaxId] = useState("")
  const [draftShippingAddress, setDraftShippingAddress] = useState("")
  const [draftCurrency, setDraftCurrency] = useState("CLP")
  const [draftChannel, setDraftChannel] = useState("whatsapp")
  const [draftReserveInventory, setDraftReserveInventory] = useState(true)
  const [draftNotes, setDraftNotes] = useState("")
  const [draftProductId, setDraftProductId] = useState("")
  const [draftQuantity, setDraftQuantity] = useState(1)
  const [draftCustomPrice, setDraftCustomPrice] = useState("")
  const [draftLines, setDraftLines] = useState([])

  // Campos de Despacho (Sección 9)
  const [dispatchSerialsMap, setDispatchSerialsMap] = useState({})
  const [dispatchCarrierMap, setDispatchCarrierMap] = useState({})
  const [dispatchTrackingMap, setDispatchTrackingMap] = useState({})

  // Modal de Inspección y Reembolso RMA (BF-23)
  const [selectedRma, setSelectedRma] = useState(null)
  const [inspectCondition, setInspectCondition] = useState("sellable_good")
  const [inspectDecision, setInspectDecision] = useState("restock_sellable")
  const [inspectNotes, setInspectNotes] = useState("")
  const [refundAmountInput, setRefundAmountInput] = useState("")
  const [refundReferenceInput, setRefundReferenceInput] = useState("")
  const [refundExecuteNow, setRefundExecuteNow] = useState(true)

  const { data: myPerms } = useQuery({
    queryKey: ["my-permissions", user?.id || user?.email || "anon"],
    queryFn: getMyPermissions,
    staleTime: 60 * 1000,
  })

  const canViewFinances = !myPerms || myPerms.is_superuser || (
    Array.isArray(myPerms.modules)
    && myPerms.modules.includes("finances")
    && myPerms.capabilities?.view_finances !== false
  )
  const canApprovePayments = !myPerms || myPerms.is_superuser || Boolean(myPerms.capabilities?.approve_payments)
  const canEditPrices = !myPerms || myPerms.is_superuser || Boolean(myPerms.capabilities?.edit_prices)

  // Queries principales
  const { data: ordersData, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-orders", statusFilter, currencyFilter, originFilter],
    queryFn: () => getAdminOrders({
      ...(statusFilter && { status: statusFilter }),
      ...(currencyFilter && { currency: currencyFilter }),
      ...(originFilter && { order_origin: originFilter }),
    }),
  })

  const { data: manualOrdersData, isLoading: loadingManual } = useQuery({
    queryKey: ["admin-manual-orders"],
    queryFn: () => getAdminManualOrders(),
  })

  const { data: fulfillmentData, isLoading: loadingFulfillment } = useQuery({
    queryKey: ["admin-fulfillment-queue"],
    queryFn: () => getFulfillmentQueue(),
  })

  const { data: rmasData, isLoading: loadingRmas } = useQuery({
    queryKey: ["admin-rmas"],
    queryFn: () => getAdminRMAs(),
  })

  const { data: catalogData } = useQuery({
    queryKey: ["admin-products-oms-selector"],
    queryFn: () => getAdminProducts({ is_active: true }),
    staleTime: 60 * 1000,
  })

  const orders = ordersData?.results || []
  const manualDrafts = manualOrdersData?.results || []
  const fulfillmentQueue = fulfillmentData?.results || []
  const rmasList = rmasData?.results || []
  const catalogProducts = catalogData?.results || (Array.isArray(catalogData) ? catalogData : [])

  const totalCount = ordersData?.count ?? orders.length
  const paidCount = orders.filter((o) => o.status === "paid" || o.status === "completed" || o.financial_status === "paid").length
  const pendingCount = orders.filter((o) => o.status === "pending").length
  const shippedCount = orders.filter((o) => o.status === "shipped" || o.fulfillment_status === "shipped").length

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
    queryClient.invalidateQueries({ queryKey: ["admin-manual-orders"] })
    queryClient.invalidateQueries({ queryKey: ["admin-fulfillment-queue"] })
    queryClient.invalidateQueries({ queryKey: ["admin-rmas"] })
  }

  // Mutaciones BF-11 & BF-12
  const createDraftMutation = useMutation({
    mutationFn: (payload) => createAdminManualOrder(payload),
    onSuccess: (created) => {
      invalidateAll()
      setShowManualModal(false)
      setSelectedDraft(created)
      setDraftLines([])
      showToast(`Propuesta comercial ${created.draft_number} creada.`, "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "No se pudo crear la venta manual.", "error")
    },
  })

  const whatsappLinkMutation = useMutation({
    mutationFn: (draftId) => generateManualOrderWhatsappLink(draftId, { expires_in_hours: 48 }),
    onSuccess: (res) => {
      invalidateAll()
      setWhatsappLinkData(res)
      showToast("Enlace seguro de WhatsApp Checkout generado.", "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "Error al generar enlace de WhatsApp.", "error")
    },
  })

  const convertDraftMutation = useMutation({
    mutationFn: (draftId) => convertAdminManualOrder(draftId, { idempotency_key: `ui_conv:${draftId}` }),
    onSuccess: (res) => {
      invalidateAll()
      setSelectedDraft(res.draft)
      showToast(`Borrador convertido en Orden #${res.order.id.slice(0, 8).toUpperCase()}.`, "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "No se pudo convertir el borrador.", "error")
    },
  })

  const cancelDraftMutation = useMutation({
    mutationFn: (draftId) => cancelAdminManualOrder(draftId, { reason: "Cancelado desde panel OMS" }),
    onSuccess: (res) => {
      invalidateAll()
      setSelectedDraft(res)
      showToast("Borrador cancelado y reservas liberadas.", "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "No se pudo cancelar el borrador.", "error")
    },
  })

  // Mutación Sección 9: Despacho WMS
  const dispatchMutation = useMutation({
    mutationFn: ({ orderId, serialAssignments, carrier, tracking }) =>
      dispatchOrderWMS(orderId, {
        serial_assignments: serialAssignments,
        shipping_carrier: carrier,
        tracking_number: tracking,
      }),
    onSuccess: (res) => {
      invalidateAll()
      showToast(
        res.idempotent_replay
          ? "Despacho ya confirmado previamente (idempotente)."
          : "Despacho físico confirmado en WMS y COGS congelado.",
        "success"
      )
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "Error al confirmar despacho.", "error")
    },
  })

  // Mutaciones BF-23: RMA
  const authorizeRmaMutation = useMutation({
    mutationFn: ({ rmaId, approve }) => authorizeAdminRMA(rmaId, { approve, notes: "Resolución comercial OMS" }),
    onSuccess: (res) => {
      invalidateAll()
      setSelectedRma(res)
      showToast(`RMA ${res.rma_number} actualizado a ${res.status_display}.`, "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "No se pudo autorizar el RMA.", "error")
    },
  })

  const inspectRmaMutation = useMutation({
    mutationFn: ({ rmaId, rmaItemId, quantityReceived }) =>
      inspectAdminRMA(rmaId, {
        inspections: [
          {
            rma_item_id: rmaItemId,
            quantity_received: quantityReceived,
            condition_status: inspectCondition,
            restock_decision: inspectDecision,
            inspection_notes: inspectNotes || "Inspección física certificada en bodega",
          },
        ],
      }),
    onSuccess: (res) => {
      invalidateAll()
      setSelectedRma(res)
      showToast(`Inspección física de ${res.rma_number} completada y Kardex actualizado.`, "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "Inspección rechazada por invariante de calidad.", "error")
    },
  })

  const refundRmaMutation = useMutation({
    mutationFn: ({ rmaId, amount, executeNow, reference }) =>
      refundAdminRMA(rmaId, {
        refund_amount: amount,
        execute_now: executeNow,
        provider: "transfer",
        reference: reference || "",
        idempotency_key: `ui_rma_ref:${rmaId}`,
      }),
    onSuccess: (res) => {
      invalidateAll()
      setSelectedRma(res)
      showToast(`Reembolso RMA procesado (${res.refund_status_display}).`, "success")
    },
    onError: (e) => {
      showToast(e?.response?.data?.error || "No se pudo procesar el reembolso.", "error")
    },
  })

  const handleAddDraftLine = () => {
    const prod = catalogProducts.find((p) => String(p.id) === String(draftProductId))
    if (!prod) {
      showToast("Selecciona un producto del catálogo.", "error")
      return
    }
    const qty = Math.max(1, Number(draftQuantity) || 1)
    const line = {
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku || "SKU",
      quantity: qty,
      catalog_price: prod.price,
      ...(draftCustomPrice ? { authorized_unit_price: draftCustomPrice } : {}),
    }
    setDraftLines((prev) => [...prev, line])
    setDraftQuantity(1)
    setDraftCustomPrice("")
  }

  const handleCreateManualOrderSubmit = (e) => {
    e.preventDefault()
    const effectiveLines = draftLines.length > 0
      ? draftLines
      : (draftProductId ? [{ product_id: draftProductId, quantity: Math.max(1, Number(draftQuantity) || 1), ...(draftCustomPrice ? { authorized_unit_price: draftCustomPrice } : {}) }] : [])

    if (!draftCustomerName.trim() || !draftCustomerEmail.trim() || effectiveLines.length === 0) {
      showToast("Completa cliente, email y al menos un producto.", "error")
      return
    }
    createDraftMutation.mutate({
      customer_name: draftCustomerName.trim(),
      customer_email: draftCustomerEmail.trim(),
      customer_phone: draftCustomerPhone.trim(),
      customer_tax_id: draftCustomerTaxId.trim(),
      shipping_address: draftShippingAddress.trim(),
      currency: draftCurrency,
      channel: draftChannel,
      reserve_inventory: draftReserveInventory,
      notes: draftNotes.trim(),
      items: effectiveLines,
    })
  }

  const columns = [
    {
      key: "id",
      header: "Orden",
      sortable: true,
      render: (o) => (
        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 12.5, color: "var(--admin-text)" }}>
            #{o.id.slice(0, 8).toUpperCase()}
          </span>
          {o.order_origin && (
            <span style={{
              display: "block", fontSize: "10.5px", color: "var(--admin-text-muted)", fontWeight: 600,
            }}>
              {ORIGIN_LABELS[o.order_origin] || o.order_origin}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "email",
      header: "Cliente",
      sortable: true,
      render: (o) => (
        <div>
          {o.customer_name && (
            <span style={{ display: "block", fontWeight: 700, color: "var(--admin-text)", fontSize: "12.5px" }}>
              {o.customer_name}
            </span>
          )}
          <span style={{ color: "var(--admin-text-muted)", fontSize: "12px" }}>{o.email}</span>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      align: "right",
      render: (o) => (
        <span style={{ fontWeight: 800, color: "var(--admin-primary-text)" }}>
          {formatCurrency(o.total, o.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado / 3D",
      render: (o) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          <StatusBadge tone={TONE[o.status] || "neutral"}>
            {STATUS[o.status]?.label || o.status}
          </StatusBadge>
          {o.financial_status && (
            <StatusBadge tone={TONE[o.financial_status] || "neutral"}>
              Fin: {FINANCIAL_LABELS[o.financial_status] || o.financial_status}
            </StatusBadge>
          )}
          {o.fulfillment_status && (
            <StatusBadge tone={TONE[o.fulfillment_status] || "neutral"}>
              Log: {FULFILLMENT_LABELS[o.fulfillment_status] || o.fulfillment_status}
            </StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Fecha",
      sortable: true,
      render: (o) => {
        const raw = o.created_at || o.created
        if (!raw) return <span style={{ color: "var(--admin-text-muted)" }}>—</span>
        const d = new Date(raw)
        const formatted = Number.isNaN(d.getTime())
          ? String(raw)
          : d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "2-digit" })
        return <span style={{ color: "var(--admin-text-muted)", fontWeight: 600 }}>{formatted}</span>
      },
    },
  ]

  const kanbanColumns = [
    { key: "pending", title: "1. Pendientes / Por Cobrar", color: "#D97706", items: orders.filter((o) => o.status === "pending") },
    { key: "paid", title: "2. Pagados / En Preparación WMS", color: "#0F9940", items: orders.filter((o) => o.status === "paid") },
    { key: "shipped", title: "3. Despachados / En Tránsito", color: "#2563EB", items: orders.filter((o) => o.status === "shipped") },
    { key: "completed", title: "4. Entregados / Completados", color: "#065F46", items: orders.filter((o) => o.status === "completed") },
  ]

  return (
    <div className="au-page">
      {selectedOrder && (
        <OrderPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          canViewFinances={canViewFinances}
          canApprovePayments={canApprovePayments}
        />
      )}

      <AdminPageHeader
        eyebrow="LEVELPRO / GATE 7 OMS"
        title="Órdenes & Operaciones Comerciales"
        description={
          isLoading || isError
            ? "Order Management System: Ventas manuales, WhatsApp Checkout, Despacho WMS y RMA"
            : `${totalCount} pedidos comerciales · ${manualDrafts.length} propuestas asistidas · ${rmasList.length} casos RMA`
        }
        actions={
          <>
            <PrimaryButton
              size="sm"
              data-testid="open-manual-sale-modal-btn"
              onClick={() => {
                setActiveTab("manual")
                setShowManualModal(true)
              }}
            >
              <Plus size={14} /> Nueva Venta Manual
            </PrimaryButton>
            <SecondaryButton to="/admin/special-orders" size="sm">Bajo pedido</SecondaryButton>
            <SecondaryButton to="/admin/payments" size="sm">Pagos</SecondaryButton>
            {canViewFinances && <SecondaryButton to="/admin/billing" size="sm">Tributario</SecondaryButton>}
          </>
        }
      />

      {!isLoading && !isError && (
        <div className="lp-grid-kpi">
          <StatCard
            variant="ink"
            label="Total pedidos"
            value={totalCount}
            sub="Centro OMS"
            Icon={ShoppingBag}
            onClick={() => { setActiveTab("orders"); setStatusFilter("") }}
          />
          <StatCard
            variant="primary"
            label="Pagados / Completados"
            value={paidCount}
            sub="Conciliados"
            Icon={CheckCircle2}
            onClick={() => { setActiveTab("orders"); setStatusFilter(statusFilter === "paid" ? "" : "paid") }}
          />
          <StatCard
            variant="light"
            label="Pendientes"
            value={pendingCount}
            sub={pendingCount > 0 ? "Por confirmar" : "Al día"}
            Icon={Clock3}
            onClick={() => { setActiveTab("orders"); setStatusFilter(statusFilter === "pending" ? "" : "pending") }}
          />
          <StatCard
            variant="light"
            label="En tránsito"
            value={shippedCount}
            sub="Despachados WMS"
            Icon={PackageCheck}
            onClick={() => { setActiveTab("orders"); setStatusFilter(statusFilter === "shipped" ? "" : "shipped") }}
          />
        </div>
      )}

      {/* Barra de Navegación de Sub-módulos OMS */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "12px", marginBottom: "18px",
        background: "#fff", border: "1px solid var(--admin-border)",
        borderRadius: "16px", padding: "10px 14px",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {[
            { id: "orders", label: `1. Centro de Pedidos (${totalCount})` },
            { id: "manual", label: `2. Ventas Manuales & WhatsApp (${manualDrafts.length})` },
            { id: "fulfillment", label: `3. Preparación y Despacho WMS (${fulfillmentQueue.length})` },
            { id: "rma", label: `4. Devoluciones e Inspección RMA (${rmasList.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`oms-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "8px 14px", borderRadius: "10px", fontSize: "12.5px", fontWeight: 800,
                cursor: "pointer",
                background: activeTab === t.id ? "#065F46" : "var(--admin-surface-secondary)",
                color: activeTab === t.id ? "#fff" : "var(--admin-text)",
                border: activeTab === t.id ? "1px solid #065F46" : "1px solid var(--admin-border)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "orders" && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              data-testid="oms-view-table"
              onClick={() => setViewMode("table")}
              style={{
                padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px",
                background: viewMode === "table" ? "var(--admin-text)" : "#fff",
                color: viewMode === "table" ? "#fff" : "var(--admin-text)",
                border: "1px solid var(--admin-border)",
              }}
            >
              <List size={14} /> Vista Tabla
            </button>
            <button
              type="button"
              data-testid="oms-view-kanban"
              onClick={() => setViewMode("kanban")}
              style={{
                padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px",
                background: viewMode === "kanban" ? "var(--admin-text)" : "#fff",
                color: viewMode === "kanban" ? "#fff" : "var(--admin-text)",
                border: "1px solid var(--admin-border)",
              }}
            >
              <Columns size={14} /> Vista Kanban
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: CENTRO DE PEDIDOS (TABLA Y KANBAN + ESTADOS 3D)
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "orders" && viewMode === "table" && (
        <DataTable
          columns={columns}
          data={orders}
          loading={isLoading}
          error={isError}
          onRetry={() => refetch()}
          getRowId={(o) => o.id}
          searchable
          searchKeys={["email", "id", "customer_name"]}
          searchPlaceholder="Buscar por email, cliente o ID..."
          filters={[
            {
              label: "Estado",
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: "", label: "Todos los estados" },
                ...Object.entries(STATUS).map(([v, { label }]) => ({ value: v, label })),
              ],
            },
            {
              label: "Moneda",
              value: currencyFilter,
              onChange: setCurrencyFilter,
              options: [
                { value: "", label: "Todas las monedas" },
                { value: "CLP", label: "CLP ($)" },
                { value: "USD", label: "USD (US$)" },
                { value: "ARS", label: "ARS ($)" },
              ],
            },
            {
              label: "Origen",
              value: originFilter,
              onChange: setOriginFilter,
              options: [
                { value: "", label: "Todos los orígenes" },
                { value: "online", label: "Checkout Web Online" },
                { value: "manual", label: "Venta Manual Asistida" },
                { value: "whatsapp", label: "WhatsApp Checkout" },
                { value: "b2b", label: "Cotización B2B" },
              ],
            },
          ]}
          onRowClick={(o) => setSelectedOrder(o)}
          rowActions={(o) => [{ label: "Ver detalle", icon: Eye, onClick: () => setSelectedOrder(o) }]}
          emptyIcon={Inbox}
          emptyTitle="No hay órdenes"
          emptyDesc="No hay pedidos con este filtro."
          testId="orders-table"
        />
      )}

      {activeTab === "orders" && viewMode === "kanban" && (
        <div
          data-testid="orders-kanban-board"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
            gap: "16px",
          }}
        >
          {kanbanColumns.map((col) => (
            <div
              key={col.key}
              style={{
                background: "#fff",
                border: "1px solid var(--admin-border)",
                borderRadius: "18px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                paddingBottom: "10px", borderBottom: "1px solid var(--admin-border)",
              }}>
                <span style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--admin-text)" }}>
                  {col.title}
                </span>
                <span style={{
                  padding: "2px 9px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 800,
                  background: `${col.color}18`, color: col.color,
                }}>
                  {col.items.length}
                </span>
              </div>
              {col.items.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--admin-text-muted)", textAlign: "center", padding: "18px 0" }}>
                  Sin pedidos en esta columna
                </p>
              ) : (
                col.items.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    style={{
                      background: "var(--admin-surface-secondary)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: "14px",
                      padding: "14px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "12.5px", color: "var(--admin-text)" }}>
                        #{o.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: "13px", color: "var(--admin-primary-text)" }}>
                        {formatCurrency(o.total, o.currency)}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>
                      {o.customer_name || o.email}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      <StatusBadge tone={TONE[o.financial_status || o.status] || "neutral"}>
                        {FINANCIAL_LABELS[o.financial_status] || STATUS[o.status]?.label || o.status}
                      </StatusBadge>
                      <StatusBadge tone={TONE[o.fulfillment_status] || "neutral"}>
                        {FULFILLMENT_LABELS[o.fulfillment_status] || "Asignado"}
                      </StatusBadge>
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: BF-11 & BF-12 — VENTAS MANUALES (DRAFT ORDERS) & WHATSAPP
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "manual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Formulario de creación de Venta Manual */}
          {showManualModal && (
            <form
              onSubmit={handleCreateManualOrderSubmit}
              data-testid="manual-order-form"
              style={{
                background: "#fff",
                border: "1px solid var(--admin-border)",
                borderRadius: "20px",
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p className="au-eyebrow">BF-11 · CREADOR DE VENTA ASISTIDA</p>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>
                    Nueva Propuesta Comercial / DraftOrder con Reserva WMS
                  </h3>
                </div>
                <button type="button" onClick={() => setShowManualModal(false)} className="au-iconbtn">
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Nombre Cliente / Estudio *</label>
                  <input
                    data-testid="manual-customer-name"
                    value={draftCustomerName}
                    onChange={(e) => setDraftCustomerName(e.target.value)}
                    placeholder="Ej: Estudio Cordillera SpA"
                    required
                    style={{ ...formInputStyle, background: "#fff" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email Cliente *</label>
                  <input
                    type="email"
                    data-testid="manual-customer-email"
                    value={draftCustomerEmail}
                    onChange={(e) => setDraftCustomerEmail(e.target.value)}
                    placeholder="cliente@estudio.cl"
                    required
                    style={{ ...formInputStyle, background: "#fff" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Teléfono / WhatsApp</label>
                  <input
                    data-testid="manual-customer-phone"
                    value={draftCustomerPhone}
                    onChange={(e) => setDraftCustomerPhone(e.target.value)}
                    placeholder="+56991234567"
                    style={{ ...formInputStyle, background: "#fff" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>RUT / CUIT</label>
                  <input
                    value={draftCustomerTaxId}
                    onChange={(e) => setDraftCustomerTaxId(e.target.value)}
                    placeholder="76.123.456-7"
                    style={{ ...formInputStyle, background: "#fff" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Dirección de Despacho</label>
                  <input
                    data-testid="manual-shipping-address"
                    value={draftShippingAddress}
                    onChange={(e) => setDraftShippingAddress(e.target.value)}
                    placeholder="Av. Providencia 1200, Santiago"
                    style={{ ...formInputStyle, background: "#fff" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Moneda</label>
                  <select
                    data-testid="manual-currency-select"
                    value={draftCurrency}
                    onChange={(e) => setDraftCurrency(e.target.value)}
                    style={{ ...formInputStyle, background: "#fff" }}
                  >
                    <option value="CLP">CLP ($)</option>
                    <option value="USD">USD (US$)</option>
                    <option value="ARS">ARS ($)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Canal Comercial</label>
                  <select
                    value={draftChannel}
                    onChange={(e) => setDraftChannel(e.target.value)}
                    style={{ ...formInputStyle, background: "#fff" }}
                  >
                    <option value="whatsapp">WhatsApp Checkout</option>
                    <option value="manual">Venta Manual Ejecutiva</option>
                    <option value="phone">Atención Telefónica</option>
                    <option value="showroom">Showroom</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", paddingTop: "22px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", fontWeight: 700, color: "var(--admin-text)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={draftReserveInventory}
                      onChange={(e) => setDraftReserveInventory(e.target.checked)}
                    />
                    Reservar stock WMS (TTL)
                  </label>
                </div>
              </div>

              {/* Selector de productos */}
              <div style={{
                background: "var(--admin-surface-secondary)", border: "1px solid var(--admin-border)",
                borderRadius: "14px", padding: "14px",
              }}>
                <label style={labelStyle}>Agregar Equipamiento del Catálogo WMS</label>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 100px 160px auto", gap: "10px", alignItems: "center" }}>
                  <select
                    data-testid="manual-product-select"
                    value={draftProductId}
                    onChange={(e) => setDraftProductId(e.target.value)}
                    style={{ ...formInputStyle, background: "#fff" }}
                  >
                    <option value="">Seleccionar producto o variante...</option>
                    {catalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku ? `[${p.sku}] ` : ""}{p.name} — Stock: {p.stock} — {formatCurrency(p.price, "CLP")}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    data-testid="manual-product-qty"
                    value={draftQuantity}
                    onChange={(e) => setDraftQuantity(e.target.value)}
                    placeholder="Cant."
                    style={{ ...formInputStyle, background: "#fff" }}
                  />
                  <input
                    type="number"
                    value={draftCustomPrice}
                    onChange={(e) => setDraftCustomPrice(e.target.value)}
                    placeholder={canEditPrices ? "Precio aut. (opc)" : "Precio catálogo"}
                    disabled={!canEditPrices}
                    style={{ ...formInputStyle, background: "#fff" }}
                  />
                  <SecondaryButton type="button" size="sm" onClick={handleAddDraftLine}>
                    + Añadir línea
                  </SecondaryButton>
                </div>

                {draftLines.length > 0 && (
                  <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {draftLines.map((ln, idx) => (
                      <div key={idx} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: "#fff", padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--admin-border)",
                        fontSize: "12.5px", fontWeight: 700, color: "var(--admin-text)",
                      }}>
                        <span>[{ln.sku}] {ln.product_name} × {ln.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setDraftLines((prev) => prev.filter((_, i) => i !== idx))}
                          style={{ border: "none", background: "transparent", color: "#EF4444", cursor: "pointer", fontWeight: 700 }}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Observaciones Comerciales (visibles en propuesta)</label>
                <input
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Condiciones de entrega, garantía oficial LevelPro Audio..."
                  style={{ ...formInputStyle, background: "#fff" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <SecondaryButton type="button" size="sm" onClick={() => setShowManualModal(false)}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="submit" size="sm" data-testid="submit-manual-order-btn" disabled={createDraftMutation.isPending}>
                  {createDraftMutation.isPending ? "Creando propuesta..." : "Emitir Propuesta y Reservar Stock"}
                </PrimaryButton>
              </div>
            </form>
          )}

          {/* Panel de Detalle de DraftOrder y Generador de Enlace WhatsApp (BF-12) */}
          {selectedDraft && (
            <div
              data-testid="draft-order-detail-card"
              style={{
                background: "#fff",
                border: "2px solid #065F46",
                borderRadius: "20px",
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <p className="au-eyebrow">DETALLE DE PROPUESTA ASISTIDA · SNAPSHOT PROTEGIDO</p>
                  <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--admin-text)", margin: 0, fontFamily: "var(--font-mono)" }}>
                    {selectedDraft.draft_number} — {selectedDraft.customer_name} ({selectedDraft.customer_email})
                  </h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <StatusBadge tone={TONE[selectedDraft.status] || "info"}>
                    {selectedDraft.status_display || selectedDraft.status}
                  </StatusBadge>
                  <button type="button" onClick={() => { setSelectedDraft(null); setWhatsappLinkData(null) }} className="au-iconbtn">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div style={{ background: "var(--admin-surface-secondary)", padding: "12px 14px", borderRadius: "12px" }}>
                  <span style={{ fontSize: "11px", color: "var(--admin-text-muted)", fontWeight: 700, display: "block" }}>TOTAL AUTORIZADO</span>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--admin-primary-text)" }}>
                    {formatCurrency(selectedDraft.total, selectedDraft.currency)}
                  </span>
                </div>
                <div style={{ background: "var(--admin-surface-secondary)", padding: "12px 14px", borderRadius: "12px" }}>
                  <span style={{ fontSize: "11px", color: "var(--admin-text-muted)", fontWeight: 700, display: "block" }}>RESERVA WMS</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--admin-text)" }}>
                    {selectedDraft.reserve_inventory ? `Activa (${selectedDraft.warehouse_code || "BOD-CENTRAL"})` : "Sin reserva previa"}
                  </span>
                </div>
                <div style={{ background: "var(--admin-surface-secondary)", padding: "12px 14px", borderRadius: "12px" }}>
                  <span style={{ fontSize: "11px", color: "var(--admin-text-muted)", fontWeight: 700, display: "block" }}>VIGENCIA</span>
                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--admin-text)" }}>
                    {selectedDraft.valid_until ? new Date(selectedDraft.valid_until).toLocaleString("es-CL") : "48h"}
                  </span>
                </div>
              </div>

              {/* Líneas snapshot del borrador */}
              <div style={{ border: "1px solid var(--admin-border)", borderRadius: "14px", overflow: "hidden" }}>
                {(selectedDraft.items || []).map((it, idx) => (
                  <div key={it.id || idx} style={{
                    padding: "10px 14px",
                    borderBottom: idx < selectedDraft.items.length - 1 ? "1px solid var(--admin-border)" : "none",
                    display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px",
                  }}>
                    <div>
                      <strong style={{ color: "var(--admin-text)" }}>[{it.sku_snapshot}] {it.product_name_snapshot}</strong>
                      <span style={{ color: "var(--admin-text-muted)", marginLeft: "8px" }}>
                        {formatCurrency(it.authorized_unit_price, selectedDraft.currency)} × {it.quantity}
                      </span>
                    </div>
                    <strong style={{ color: "var(--admin-text)" }}>
                      {formatCurrency(it.subtotal, selectedDraft.currency)}
                    </strong>
                  </div>
                ))}
              </div>

              {/* Botones de acción BF-11 y BF-12 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <PrimaryButton
                  size="sm"
                  data-testid="generate-whatsapp-link-btn"
                  disabled={whatsappLinkMutation.isPending}
                  onClick={() => whatsappLinkMutation.mutate(selectedDraft.id)}
                >
                  <Share2 size={14} /> Generar Enlace WhatsApp Checkout (BF-12)
                </PrimaryButton>

                {selectedDraft.status !== "converted" && selectedDraft.status !== "cancelled" && (
                  <>
                    <SecondaryButton
                      size="sm"
                      data-testid="convert-draft-to-order-btn"
                      disabled={convertDraftMutation.isPending}
                      onClick={() => convertDraftMutation.mutate(selectedDraft.id)}
                    >
                      <CheckCircle2 size={14} /> Convertir a Orden (Idempotente)
                    </SecondaryButton>
                    <SecondaryButton
                      size="sm"
                      disabled={cancelDraftMutation.isPending}
                      onClick={() => cancelDraftMutation.mutate(selectedDraft.id)}
                    >
                      Cancelar y Liberar Reserva
                    </SecondaryButton>
                  </>
                )}
              </div>

              {/* Resultado del Generador de Enlace Seguro de WhatsApp */}
              {whatsappLinkData && (
                <div
                  data-testid="whatsapp-link-generated-box"
                  style={{
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    borderRadius: "14px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#065F46", display: "flex", alignItems: "center", gap: "6px" }}>
                      <ShieldCheck size={15} /> Enlace HTTPS Firmado Criptográficamente (Sin PII en URL)
                    </span>
                    <span style={{ fontSize: "11.5px", color: "#047857", fontWeight: 700 }}>
                      Expira: {new Date(whatsappLinkData.expires_at).toLocaleString("es-CL")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      readOnly
                      data-testid="whatsapp-checkout-url-input"
                      value={whatsappLinkData.checkout_url}
                      style={{ ...formInputStyle, background: "#fff", fontFamily: "var(--font-mono)", fontSize: "12px", flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(whatsappLinkData.checkout_url)
                        setCopiedWa(true)
                        setTimeout(() => setCopiedWa(false), 2000)
                      }}
                      style={{
                        padding: "9px 14px", borderRadius: "10px", border: "1px solid #065F46",
                        background: "#065F46", color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      {copiedWa ? <Check size={14} /> : <Copy size={14} />} {copiedWa ? "Copiado" : "Copiar URL"}
                    </button>
                    <a
                      href={whatsappLinkData.wa_me_url}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="whatsapp-wame-share-link"
                      style={{
                        padding: "9px 14px", borderRadius: "10px", border: "1px solid #047857",
                        background: "#fff", color: "#065F46", fontWeight: 800, fontSize: "12px",
                        textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      Compartir wa.me <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabla de Borradores de Ventas Manuales */}
          <div style={{
            background: "#fff", border: "1px solid var(--admin-border)",
            borderRadius: "18px", overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid var(--admin-border)",
              background: "var(--admin-surface-secondary)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--admin-text)" }}>
                Registro de Ventas Manuales y Propuestas WhatsApp ({manualDrafts.length})
              </span>
              <PrimaryButton size="sm" onClick={() => setShowManualModal(true)}>
                <Plus size={14} /> Crear Borrador
              </PrimaryButton>
            </div>
            {loadingManual ? (
              <p style={{ padding: "24px", textAlign: "center", color: "var(--admin-text-muted)" }}>Cargando borradores...</p>
            ) : manualDrafts.length === 0 ? (
              <p style={{ padding: "24px", textAlign: "center", color: "var(--admin-text-muted)" }}>
                No hay propuestas manuales registradas.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--admin-border)", textAlign: "left", background: "var(--admin-surface-secondary)" }}>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)" }}>Folio</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)" }}>Cliente</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)" }}>Canal</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)" }}>Estado</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)", textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {manualDrafts.map((d) => (
                    <tr key={d.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--admin-text)" }}>
                        {d.draft_number}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--admin-text)" }}>{d.customer_name}</div>
                        <div style={{ fontSize: "11.5px", color: "var(--admin-text-muted)" }}>{d.customer_email}</div>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--admin-text)" }}>
                        {d.channel_display || d.channel}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge tone={TONE[d.status] || "neutral"}>
                          {d.status_display || d.status}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "var(--admin-primary-text)" }}>
                        {formatCurrency(d.total, d.currency)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <SecondaryButton size="sm" onClick={() => setSelectedDraft(d)}>
                            Gestionar / WhatsApp
                          </SecondaryButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: SECCIÓN 9 — COLA DE PREPARACIÓN Y DESPACHO WMS
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "fulfillment" && (
        <div
          data-testid="oms-fulfillment-queue-panel"
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          {loadingFulfillment ? (
            <p style={{ padding: "24px", textAlign: "center", color: "var(--admin-text-muted)" }}>Cargando cola de preparación WMS...</p>
          ) : fulfillmentQueue.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid var(--admin-border)", borderRadius: "18px", padding: "28px", textAlign: "center" }}>
              <p style={{ fontWeight: 700, color: "var(--admin-text)" }}>No hay órdenes en cola de preparación.</p>
            </div>
          ) : (
            fulfillmentQueue.map((fo) => (
              <div
                key={fo.id}
                style={{
                  background: "#fff",
                  border: "1px solid var(--admin-border)",
                  borderRadius: "18px",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "15px", color: "var(--admin-text)" }}>
                      Orden #{fo.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span style={{ marginLeft: "10px", fontSize: "13px", fontWeight: 700, color: "var(--admin-text)" }}>
                      {fo.customer_name || fo.email}
                    </span>
                    <span style={{ marginLeft: "10px", fontSize: "12px", color: "var(--admin-text-muted)", fontWeight: 600 }}>
                      Bodega: {fo.assigned_warehouse_code || "BOD-CENTRAL"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <StatusBadge tone={TONE[fo.financial_status] || "neutral"}>
                      Fin: {FINANCIAL_LABELS[fo.financial_status] || fo.financial_status}
                    </StatusBadge>
                    <StatusBadge tone={TONE[fo.fulfillment_status] || "neutral"}>
                      Log: {FULFILLMENT_LABELS[fo.fulfillment_status] || fo.fulfillment_status}
                    </StatusBadge>
                    <strong style={{ marginLeft: "8px", color: "var(--admin-primary-text)" }}>
                      {formatCurrency(fo.total, fo.currency)}
                    </strong>
                  </div>
                </div>

                {/* Reservas y asignación de seriales */}
                {fo.reservations?.length > 0 && (
                  <div style={{
                    background: "var(--admin-surface-secondary)", borderRadius: "12px", padding: "12px 14px",
                    display: "flex", flexDirection: "column", gap: "8px",
                  }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--admin-text)", textTransform: "uppercase" }}>
                      Reservas WMS & Serialización
                    </span>
                    {fo.reservations.map((res) => (
                      <div key={res.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", fontSize: "12.5px" }}>
                        <div>
                          <strong style={{ color: "var(--admin-text)" }}>{res.product_name}</strong>
                          <span style={{ marginLeft: "8px", color: "var(--admin-text-muted)" }}>
                            Bodega: {res.warehouse_code} · Cant: {res.quantity} · Estado: {res.status}
                          </span>
                        </div>
                        {res.serialization_mode === "required" && (
                          <input
                            placeholder={`Seriales (${res.available_serials?.join(", ") || "SN-..."})`}
                            value={dispatchSerialsMap[`${fo.id}:${res.product_id}`] || ""}
                            onChange={(e) =>
                              setDispatchSerialsMap((prev) => ({
                                ...prev,
                                [`${fo.id}:${res.product_id}`]: e.target.value,
                              }))
                            }
                            style={{ ...formInputStyle, background: "#fff", width: "260px", fontSize: "12px", padding: "6px 10px" }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Controles de confirmación de despacho idempotente */}
                {fo.fulfillment_status !== "shipped" && fo.fulfillment_status !== "delivered" && (
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      placeholder="Transportista (ej. Chilexpress)"
                      value={dispatchCarrierMap[fo.id] || fo.shipping_carrier || ""}
                      onChange={(e) => setDispatchCarrierMap((prev) => ({ ...prev, [fo.id]: e.target.value }))}
                      style={{ ...formInputStyle, background: "#fff", width: "200px", fontSize: "12.5px", padding: "7px 10px" }}
                    />
                    <input
                      placeholder="N° Guía / Tracking"
                      value={dispatchTrackingMap[fo.id] || fo.tracking_number || ""}
                      onChange={(e) => setDispatchTrackingMap((prev) => ({ ...prev, [fo.id]: e.target.value }))}
                      style={{ ...formInputStyle, background: "#fff", width: "200px", fontSize: "12.5px", padding: "7px 10px" }}
                    />
                    <PrimaryButton
                      size="sm"
                      disabled={dispatchMutation.isPending}
                      onClick={() => {
                        const serialAssignments = {}
                        ;(fo.reservations || []).forEach((r) => {
                          const rawSn = dispatchSerialsMap[`${fo.id}:${r.product_id}`]
                          if (rawSn) {
                            serialAssignments[String(r.product_id)] = rawSn.split(",").map((s) => s.trim()).filter(Boolean)
                          } else if (r.serialization_mode === "required" && r.available_serials?.length >= r.quantity) {
                            serialAssignments[String(r.product_id)] = r.available_serials.slice(0, r.quantity)
                          }
                        })
                        dispatchMutation.mutate({
                          orderId: fo.id,
                          serialAssignments,
                          carrier: dispatchCarrierMap[fo.id] || fo.shipping_carrier || "Chilexpress",
                          tracking: dispatchTrackingMap[fo.id] || fo.tracking_number || `TRK-${fo.id.slice(0, 6).toUpperCase()}`,
                        })
                      }}
                    >
                      <Truck size={14} /> Confirmar Despacho WMS (Idempotente)
                    </PrimaryButton>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: BF-23 — DEVOLUCIONES, INSPECCIÓN FÍSICA Y REEMBOLSOS (RMA)
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "rma" && (
        <div
          data-testid="oms-rma-center-panel"
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          {/* Panel de Inspección Física y Resolución de Reembolso del RMA seleccionado */}
          {selectedRma && (
            <div
              data-testid="rma-inspection-detail-card"
              style={{
                background: "#fff",
                border: "2px solid #065F46",
                borderRadius: "20px",
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <p className="au-eyebrow">BF-23 · MESA DE INSPECCIÓN TÉCNICA Y RESOLUCIÓN RMA</p>
                  <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--admin-text)", margin: 0, fontFamily: "var(--font-mono)" }}>
                    {selectedRma.rma_number} · Orden #{String(selectedRma.order).slice(0, 8).toUpperCase()} ({selectedRma.order_email})
                  </h3>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <StatusBadge tone={TONE[selectedRma.status] || "warning"}>
                    {selectedRma.status_display || selectedRma.status}
                  </StatusBadge>
                  <StatusBadge tone={TONE[selectedRma.refund_status] || "neutral"}>
                    Reembolso: {selectedRma.refund_status_display || selectedRma.refund_status}
                  </StatusBadge>
                  <button type="button" onClick={() => setSelectedRma(null)} className="au-iconbtn">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Líneas del RMA */}
              <div style={{ border: "1px solid var(--admin-border)", borderRadius: "14px", overflow: "hidden" }}>
                {(selectedRma.items || []).map((rit, idx) => (
                  <div key={rit.id || idx} style={{
                    padding: "12px 16px",
                    borderBottom: idx < selectedRma.items.length - 1 ? "1px solid var(--admin-border)" : "none",
                    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px",
                  }}>
                    <div>
                      <strong style={{ color: "var(--admin-text)", fontSize: "13.5px" }}>
                        [{rit.sku_snapshot}] {rit.product_name}
                      </strong>
                      {rit.serial_number && (
                        <span style={{
                          marginLeft: "8px", padding: "2px 8px", borderRadius: "6px",
                          background: "var(--admin-surface-secondary)", fontFamily: "var(--font-mono)",
                          fontSize: "11.5px", fontWeight: 800, color: "var(--admin-text)",
                        }}>
                          SN: {rit.serial_number}
                        </span>
                      )}
                      <div style={{ fontSize: "12px", color: "var(--admin-text-muted)", marginTop: "2px" }}>
                        Solicitado: {rit.quantity_requested} · Recibido: {rit.quantity_received} · Vendible: {rit.quantity_accepted_sellable} · Dañado: {rit.quantity_damaged_non_sellable}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <StatusBadge tone={rit.condition_status === "sellable_good" ? "success" : "warning"}>
                        {rit.condition_status_display || rit.condition_status}
                      </StatusBadge>
                      {rit.is_restocked && (
                        <StatusBadge tone="success">Kardex RETURN_IN Compensado</StatusBadge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Etapa 2: Autorización comercial */}
              {selectedRma.status === "requested" && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <PrimaryButton
                    size="sm"
                    data-testid="rma-authorize-btn"
                    onClick={() => authorizeRmaMutation.mutate({ rmaId: selectedRma.id, approve: true })}
                  >
                    Autorizar Retorno Físico (Etapa 2)
                  </PrimaryButton>
                  <SecondaryButton
                    size="sm"
                    onClick={() => authorizeRmaMutation.mutate({ rmaId: selectedRma.id, approve: false })}
                  >
                    Rechazar Solicitud
                  </SecondaryButton>
                </div>
              )}

              {/* Etapas 3, 4 y 5: Recepción Física, Inspección y Decisión de Reingreso a Bodega */}
              {["authorized", "received", "inspected"].includes(selectedRma.status) && (
                <div style={{
                  background: "var(--admin-surface-secondary)", border: "1px solid var(--admin-border)",
                  borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px",
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--admin-text)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <ClipboardCheck size={15} /> Recepción Física e Inspección Técnica de Bodega (Etapas 3, 4 y 5)
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: "10px", alignItems: "center" }}>
                    <select
                      data-testid="rma-inspect-condition-select"
                      value={inspectCondition}
                      onChange={(e) => {
                        const val = e.target.value
                        setInspectCondition(val)
                        if (val !== "sellable_good" && inspectDecision === "restock_sellable") {
                          setInspectDecision("restock_damaged_quarantine")
                        }
                      }}
                      style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px" }}
                    >
                      <option value="sellable_good">Apto para venta (Sellable)</option>
                      <option value="damaged_non_sellable">Dañado / No elegible para venta</option>
                      <option value="defective_warranty">Defectuoso (Garantía / Taller)</option>
                    </select>
                    <select
                      data-testid="rma-inspect-decision-select"
                      value={inspectDecision}
                      onChange={(e) => setInspectDecision(e.target.value)}
                      style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px" }}
                    >
                      <option value="restock_sellable" disabled={inspectCondition !== "sellable_good"}>
                        Reingresar a stock vendible
                      </option>
                      <option value="restock_damaged_quarantine">
                        Reingresar como dañado / no vendible
                      </option>
                      <option value="do_not_restock">No reingresar a inventario</option>
                    </select>
                    <input
                      value={inspectNotes}
                      onChange={(e) => setInspectNotes(e.target.value)}
                      placeholder="Observaciones de cápsula, chasis, serial..."
                      style={{ ...formInputStyle, background: "#fff", fontSize: "12.5px" }}
                    />
                    <PrimaryButton
                      size="sm"
                      data-testid="rma-confirm-inspection-btn"
                      disabled={inspectRmaMutation.isPending}
                      onClick={() => {
                        const firstItem = selectedRma.items?.[0]
                        if (!firstItem) return
                        inspectRmaMutation.mutate({
                          rmaId: selectedRma.id,
                          rmaItemId: firstItem.id,
                          quantityReceived: firstItem.quantity_requested,
                        })
                      }}
                    >
                      Confirmar Inspección y Kardex
                    </PrimaryButton>
                  </div>
                </div>
              )}

              {/* Etapa 6: Resolución de Reembolso Financiero (Desacoplado del Stock) */}
              {canApprovePayments && selectedRma.refund_status !== "executed" && (
                <div style={{
                  background: "#fff", border: "1px solid var(--admin-border)",
                  borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px",
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--admin-text)" }}>
                    Etapa 6 · Resolución Financiera de Reembolso ({selectedRma.refund_currency}) — Desacoplado de WarehouseStock
                  </span>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="number"
                      data-testid="rma-refund-amount-input"
                      value={refundAmountInput}
                      onChange={(e) => setRefundAmountInput(e.target.value)}
                      placeholder="Monto a reembolsar"
                      style={{ ...formInputStyle, background: "#fff", width: "180px", fontSize: "12.5px" }}
                    />
                    <input
                      type="text"
                      data-testid="rma-refund-reference-input"
                      value={refundReferenceInput}
                      onChange={(e) => setRefundReferenceInput(e.target.value)}
                      placeholder="Comprobante / Referencia"
                      style={{ ...formInputStyle, background: "#fff", width: "190px", fontSize: "12.5px" }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: "var(--admin-text)" }}>
                      <input
                        type="checkbox"
                        checked={refundExecuteNow}
                        onChange={(e) => setRefundExecuteNow(e.target.checked)}
                      />
                      Ejecutar reembolso autorizado ahora
                    </label>
                    <PrimaryButton
                      size="sm"
                      data-testid="rma-execute-refund-btn"
                      disabled={refundRmaMutation.isPending}
                      onClick={() =>
                        refundRmaMutation.mutate({
                          rmaId: selectedRma.id,
                          amount: refundAmountInput || "100000",
                          executeNow: refundExecuteNow,
                          reference: refundReferenceInput,
                        })
                      }
                    >
                      Procesar Reembolso
                    </PrimaryButton>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabla general de solicitudes RMA */}
          <div style={{
            background: "#fff", border: "1px solid var(--admin-border)",
            borderRadius: "18px", overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid var(--admin-border)",
              background: "var(--admin-surface-secondary)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--admin-text)" }}>
                Solicitudes de Devolución, Inspección y Reembolsos RMA ({rmasList.length})
              </span>
            </div>
            {loadingRmas ? (
              <p style={{ padding: "24px", textAlign: "center", color: "var(--admin-text-muted)" }}>Cargando casos RMA...</p>
            ) : rmasList.length === 0 ? (
              <p style={{ padding: "24px", textAlign: "center", color: "var(--admin-text-muted)" }}>
                No hay solicitudes RMA registradas.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--admin-border)", textAlign: "left", background: "var(--admin-surface-secondary)" }}>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)" }}>Folio RMA</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)" }}>Orden / Cliente</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)" }}>Motivo</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)" }}>Estado Físico</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)" }}>Estado Reembolso</th>
                    <th style={{ padding: "11px 16px", fontWeight: 800, color: "var(--admin-text)", textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rmasList.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--admin-text)" }}>
                        {r.rma_number}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--admin-text)", fontFamily: "var(--font-mono)" }}>
                          #{String(r.order).slice(0, 8).toUpperCase()}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--admin-text-muted)" }}>{r.order_email}</div>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--admin-text)" }}>
                        {r.reason_code_display || r.reason_code}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge tone={TONE[r.status] || "warning"}>
                          {r.status_display || r.status}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge tone={TONE[r.refund_status] || "neutral"}>
                          {r.refund_status_display || r.refund_status}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <SecondaryButton size="sm" onClick={() => setSelectedRma(r)}>
                          Inspeccionar / Resolver
                        </SecondaryButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

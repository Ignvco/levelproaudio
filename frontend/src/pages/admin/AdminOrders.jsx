// pages/admin/AdminOrders.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAdminOrders, updateOrderStatus } from "../../api/admin.api"
import { generateDocumentFromOrder, downloadDocument } from "../../api/admin.api"

const statusColors = {
  pending: "#facc15",
  paid: "#4ade80",
  shipped: "#60a5fa",
  completed: "#4ade80",
  cancelled: "#f87171",
}
const statusLabels = {
  pending: "Pendiente",
  paid: "Pagado",
  shipped: "Enviado",
  completed: "Completado",
  cancelled: "Cancelado",
}
const allStatuses = Object.keys(statusLabels)

function Badge({ status }) {
  const color = statusColors[status] || "var(--text-3)"
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "100px", fontSize: "11px",
      fontWeight: 500, color,
      background: `${color}14`, border: `1px solid ${color}30`,
    }}>
      {statusLabels[status] || status}
    </span>
  )
}

// ── Panel de detalle lateral ─────────────────────────────────
function OrderDetailPanel({ order, onClose, onStatusChange }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (s) => updateOrderStatus(order.id, s),
    onSuccess: () => {
      // ← Invalida todo lo relacionado
      queryClient.invalidateQueries(["admin-orders"])
      queryClient.invalidateQueries(["admin-dashboard"])
      queryClient.invalidateQueries(["admin-payments"])        // ← nuevo
      queryClient.invalidateQueries(["admin-finance-summary"]) // ← nuevo
      queryClient.invalidateQueries(["admin-finance-withdrawals"]) // ← nuevo
    },
  })

  const [docResult, setDocResult] = useState(null)

  const docMutation = useMutation({
    mutationFn: (tipo) => generateDocumentFromOrder(order.id, tipo),
    onSuccess: (data) => setDocResult(data),
    onError: (e) => {
      const msg = e?.response?.data?.error || "Error al generar documento"
      alert(msg)
    },
  })

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: "420px", zIndex: 100,
      background: "var(--surface)",
      borderLeft: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      boxShadow: "-20px 0 60px rgba(0,0,0,0.4)",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{
            fontSize: "11px", color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px"
          }}>
            Orden
          </p>
          <p style={{ fontSize: "15px", fontWeight: 500, fontFamily: "monospace" }}>
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-3)", fontSize: "20px", lineHeight: 1,
          padding: "4px 8px", borderRadius: "var(--r-sm)",
          transition: "color var(--dur)",
        }}
          className="hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Contenido scrollable */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "20px 24px",
        display: "flex", flexDirection: "column", gap: "20px"
      }}>

        {/* Estado actual + cambiar */}
        <div style={{
          background: "var(--surface-2)", border: "1px solid var(--border)",
          borderRadius: "var(--r-md)", padding: "16px",
        }}>
          <p style={{
            fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: "12px"
          }}>
            Estado del pedido
          </p>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: "14px"
          }}>
            <Badge status={order.status} />
            <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
              {order.created_at ? new Date(order.created_at).toLocaleDateString("es-CL", {
                day: "numeric", month: "long", year: "numeric"
              }) : "—"}
            </span>
          </div>

          {/* Botones de cambio de estado */}
          <p style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "8px" }}>
            Cambiar a:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {allStatuses.filter(s => s !== order.status).map(s => {
              const color = statusColors[s] || "var(--text-3)"
              return (
                <button key={s} onClick={() => mutation.mutate(s)}
                  disabled={mutation.isPending}
                  style={{
                    padding: "5px 12px", borderRadius: "100px", fontSize: "12px",
                    fontWeight: 500, cursor: "pointer",
                    transition: "all var(--dur) var(--ease)",
                    color, background: `${color}14`,
                    border: `1px solid ${color}30`,
                    opacity: mutation.isPending ? 0.5 : 1,
                  }}
                  className="hover:opacity-80"
                >
                  {statusLabels[s]}
                </button>
              )
            })}
          </div>
          {mutation.isSuccess && (
            <p style={{ fontSize: "12px", color: "var(--accent)", marginTop: "8px" }}>
              ✓ Estado actualizado
            </p>
          )}
        </div>

        {/* Cliente */}
        <div style={{
          background: "var(--surface-2)", border: "1px solid var(--border)",
          borderRadius: "var(--r-md)", padding: "16px",
        }}>
          <p style={{
            fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: "12px"
          }}>
            Cliente
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { label: "Email", value: order.email },
              { label: "Dirección", value: order.shipping_address },
              ...(order.notes ? [{ label: "Notas", value: order.notes }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
                <span style={{ color: "var(--text-3)", flexShrink: 0, minWidth: "72px" }}>
                  {label}
                </span>
                <span style={{ color: "var(--text-2)", wordBreak: "break-word" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Productos */}
        <div style={{
          background: "var(--surface-2)", border: "1px solid var(--border)",
          borderRadius: "var(--r-md)", overflow: "hidden",
        }}>
          <p style={{
            fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
            letterSpacing: "0.08em", padding: "12px 16px",
            borderBottom: "1px solid var(--border)"
          }}>
            Productos ({order.items_count})
          </p>
          {order.items?.map((item, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", padding: "11px 16px",
              borderBottom: i < order.items.length - 1
                ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: "13px", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>
                  {item.product_name}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                  ${Number(item.price).toLocaleString("es-CL")} × {item.quantity}
                </p>
              </div>
              <span style={{
                fontSize: "13px", fontWeight: 500, flexShrink: 0,
                marginLeft: "12px"
              }}>
                ${Number(item.subtotal).toLocaleString("es-CL")}
              </span>
            </div>
          ))}

          {/* Total */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "12px 16px", borderTop: "1px solid var(--border)",
            background: "var(--surface-3)",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 500 }}>Total</span>
            <span style={{
              fontSize: "16px", fontWeight: 500,
              color: "var(--accent)"
            }}>
              ${Number(order.total).toLocaleString("es-CL")}
            </span>
          </div>
        </div>

        {/* Pagos asociados */}
        {order.payments?.length > 0 && (
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: "var(--r-md)", overflow: "hidden",
          }}>
            <p style={{
              fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
              letterSpacing: "0.08em", padding: "12px 16px",
              borderBottom: "1px solid var(--border)"
            }}>
              Pagos
            </p>
            {order.payments.map((p, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "11px 16px",
                borderBottom: i < order.payments.length - 1
                  ? "1px solid var(--border)" : "none",
              }}>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 500 }}>
                    {p.provider}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                    {p.paid_at || p.created_at}
                  </p>
                </div>
                <Badge status={p.status} />
              </div>
            ))}
          </div>
        )}
        {/* Dentro del OrderDetailPanel, al final */}
        {order.status !== "pending" && order.status !== "cancelled" && (
          <div style={{ marginTop: "16px" }}>
            {order.has_document ? (
              <button
                onClick={async () => {
                  const resp = await downloadDocument(order.document_id)
                  const url = window.URL.createObjectURL(new Blob([resp.data]))
                  const link = document.createElement("a")
                  link.href = url
                  link.setAttribute("download", `${order.document_folio}.pdf`)
                  document.body.appendChild(link)
                  link.click()
                  link.remove()
                }}
                style={{
                  width: "100%", padding: "10px",
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-2)", fontSize: "13px",
                  cursor: "pointer",
                }}>
                ⬇️ Descargar {order.document_tipo || "boleta"}
              </button>
            ) : (
              <a href={`/admin/billing`} style={{
                display: "block", textAlign: "center",
                fontSize: "12px", color: "var(--text-3)",
                padding: "8px",
              }}>
                🧾 Generar boleta/factura →
              </a>
            )}
          </div>
        )}
        {/* Generar boleta desde la orden */}
        {["paid", "shipped", "completed"].includes(order.status) && (
          <div style={{
            marginTop: "16px", paddingTop: "16px",
            borderTop: "1px solid var(--border)"
          }}>
            <p style={{
              fontSize: "12px", color: "var(--text-3)",
              marginBottom: "10px"
            }}>
              Documentos tributarios
            </p>

            {docResult ? (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={async () => {
                    const resp = await downloadDocument(docResult.id)
                    const url = window.URL.createObjectURL(new Blob([resp.data]))
                    const link = document.createElement("a")
                    link.href = url
                    link.setAttribute("download", `${docResult.folio}.pdf`)
                    document.body.appendChild(link)
                    link.click()
                    link.remove()
                  }}
                  style={{
                    flex: 1, padding: "9px", borderRadius: "var(--r-md)",
                    background: "var(--accent)", border: "none",
                    color: "#000", fontSize: "12px", fontWeight: 600,
                    cursor: "pointer",
                  }}>
                  ⬇️ {docResult.folio} — Descargar PDF
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                {["boleta", "factura"].map(tipo => (
                  <button
                    key={tipo}
                    onClick={() => docMutation.mutate(tipo)}
                    disabled={docMutation.isPending}
                    style={{
                      flex: 1, padding: "9px", borderRadius: "var(--r-md)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-2)", fontSize: "12px",
                      cursor: "pointer", textTransform: "capitalize",
                    }}>
                    {docMutation.isPending ? "..." : `🧾 ${tipo}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── AdminOrders ──────────────────────────────────────────────
export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [selectedOrder, setSelectedOrder] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", statusFilter, search],
    queryFn: () => getAdminOrders({
      ...(statusFilter && { status: statusFilter }),
      ...(search && { search }),
    }),
  })

  const orders = data?.results || []

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)", position: "relative" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px"
        }}>
          Órdenes
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          {data?.count || 0} pedidos totales
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <input
          placeholder="Buscar por email o ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ maxWidth: "280px" }}
        />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["", ...allStatuses].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "7px 14px", borderRadius: "100px", fontSize: "12px",
              cursor: "pointer", transition: "all var(--dur) var(--ease)",
              background: statusFilter === s ? "var(--text)" : "transparent",
              color: statusFilter === s ? "var(--bg)" : "var(--text-2)",
              border: `1px solid ${statusFilter === s ? "var(--text)" : "var(--border)"}`,
            }}>
              {s ? statusLabels[s] : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "56px" }} />
          ))}
        </div>
      ) : (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden",
        }}>
          {/* Header tabla */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 2fr 1fr 1fr 1fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span>ID</span>
            <span>Email</span>
            <span>Total</span>
            <span>Estado</span>
            <span>Fecha</span>
          </div>

          {orders.length === 0 ? (
            <div style={{
              padding: "40px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px"
            }}>
              No hay órdenes con estos filtros.
            </div>
          ) : orders.map((order, i) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(
                selectedOrder?.id === order.id ? null : order
              )}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 2fr 1fr 1fr 1fr",
                padding: "13px 20px", alignItems: "center", gap: "8px",
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
                transition: "background var(--dur) var(--ease)",
                background: selectedOrder?.id === order.id
                  ? "var(--surface-2)" : "transparent",
              }}
              className="hover:bg-[var(--surface-2)]"
            >
              <span style={{
                fontSize: "12px", fontFamily: "monospace",
                color: "var(--text-2)"
              }}>
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
              <span style={{
                fontSize: "13px", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>
                {order.email}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 500 }}>
                ${Number(order.total).toLocaleString("es-CL")}
              </span>
              <Badge status={order.status} />
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {new Date(order.created_at).toLocaleDateString("es-CL")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Panel lateral */}
      {selectedOrder && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setSelectedOrder(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 99,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(2px)",
            }}
          />
          <OrderDetailPanel
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        </>
      )}
    </div>
  )
}
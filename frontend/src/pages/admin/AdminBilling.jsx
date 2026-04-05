// pages/admin/AdminBilling.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getBillingDocuments,
  getBillingConfig,
  updateBillingConfig,
  generateDocument,
  downloadDocument,
  sendDocumentEmail,
  voidDocument,
} from "../../api/admin.api"

const TABS = ["Documentos", "Generar", "Configuración"]

const estadoColors = {
  emitido: { color: "#4ade80", label: "Emitido" },
  enviado: { color: "#60a5fa", label: "Enviado" },
  anulado: { color: "#f87171", label: "Anulado" },
}

const tipoColors = {
  boleta: { color: "#facc15", label: "Boleta" },
  factura: { color: "#60a5fa", label: "Factura" },
  nota_credito: { color: "#f87171", label: "Nota Crédito" },
}

function DocBadge({ tipo }) {
  const t = tipoColors[tipo] || tipoColors.boleta
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "100px", fontSize: "11px",
      fontWeight: 600, color: t.color,
      background: `${t.color}14`, border: `1px solid ${t.color}30`,
    }}>
      {t.label}
    </span>
  )
}

function EstadoBadge({ estado }) {
  const e = estadoColors[estado] || estadoColors.emitido
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "100px", fontSize: "11px",
      color: e.color, background: `${e.color}14`,
      border: `1px solid ${e.color}30`,
    }}>
      {e.label}
    </span>
  )
}

// ── Tab Documentos ────────────────────────────────────────────
function TabDocumentos() {
  const queryClient = useQueryClient()
  const [sending, setSending] = useState(null)
  const [voiding, setVoiding] = useState(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ["billing-documents"],
    queryFn: getBillingDocuments,
  })

  const sendMutation = useMutation({
    mutationFn: (id) => sendDocumentEmail(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["billing-documents"])
      setSending(null)
    },
  })

  const voidMutation = useMutation({
    mutationFn: (id) => voidDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["billing-documents"])
      setVoiding(null)
    },
  })

  const handleDownload = async (doc) => {
    try {
      const response = await downloadDocument(doc.id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `${doc.folio}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      alert("Error al descargar el PDF")
    }
  }

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "52px" }} />
      ))}
    </div>
  )

  if (data.length === 0) return (
    <div style={{
      padding: "60px", textAlign: "center",
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)",
    }}>
      <p style={{ fontSize: "32px", marginBottom: "12px" }}>🧾</p>
      <p style={{ fontSize: "15px", fontWeight: 500, marginBottom: "6px" }}>
        Sin documentos emitidos
      </p>
      <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
        Ve a la pestaña "Generar" para emitir boletas o facturas.
      </p>
    </div>
  )

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 140px",
        padding: "10px 20px", borderBottom: "1px solid var(--border)",
        fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        <span>Folio</span>
        <span>Tipo</span>
        <span>Cliente</span>
        <span>Total</span>
        <span>Estado</span>
        <span>Acciones</span>
      </div>

      {data.map((doc, i) => (
        <div key={doc.id}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 140px",
            padding: "13px 20px", alignItems: "center",
            borderTop: i > 0 ? "1px solid var(--border)" : "none",
            gap: "8px",
          }}>
            <div>
              <p style={{
                fontSize: "13px", fontFamily: "monospace",
                fontWeight: 600
              }}>
                {doc.folio}
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                {doc.created_at}
              </p>
            </div>
            <DocBadge tipo={doc.tipo} />
            <span style={{
              fontSize: "12px", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>
              {doc.orden_email}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 500 }}>
              ${Math.round(doc.total).toLocaleString("es-CL")}
            </span>
            <EstadoBadge estado={doc.estado} />

            {/* Acciones */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {/* Descargar PDF */}
              <button
                onClick={() => handleDownload(doc)}
                title="Descargar PDF"
                style={{
                  padding: "5px 8px", borderRadius: "var(--r-sm)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  cursor: "pointer", fontSize: "13px",
                }}>
                ⬇️
              </button>

              {/* Enviar email */}
              {doc.estado !== "anulado" && (
                <button
                  onClick={() => setSending(doc.id)}
                  title="Enviar por email"
                  style={{
                    padding: "5px 8px", borderRadius: "var(--r-sm)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    cursor: "pointer", fontSize: "13px",
                  }}>
                  📧
                </button>
              )}

              {/* Anular */}
              {doc.estado !== "anulado" && (
                <button
                  onClick={() => setVoiding(doc.id)}
                  title="Anular"
                  style={{
                    padding: "5px 8px", borderRadius: "var(--r-sm)",
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    cursor: "pointer", fontSize: "13px",
                    color: "#f87171",
                  }}>
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Confirm enviar email */}
          {sending === doc.id && (
            <div style={{
              padding: "12px 20px", background: "var(--surface-2)",
              borderTop: "1px solid var(--border)",
              display: "flex", alignItems: "center",
              justifyContent: "space-between", gap: "12px",
            }}>
              <p style={{ fontSize: "13px", color: "var(--text-2)" }}>
                ¿Enviar {doc.folio} a <strong>{doc.orden_email}</strong>?
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => sendMutation.mutate(doc.id)}
                  disabled={sendMutation.isPending}
                  style={{
                    padding: "7px 14px", borderRadius: "var(--r-sm)",
                    background: "var(--accent)", border: "none",
                    color: "#000", fontSize: "13px", fontWeight: 600,
                    cursor: "pointer",
                  }}>
                  {sendMutation.isPending ? "Enviando..." : "Confirmar"}
                </button>
                <button onClick={() => setSending(null)} style={{
                  padding: "7px 14px", borderRadius: "var(--r-sm)",
                  background: "none", border: "1px solid var(--border)",
                  color: "var(--text-2)", fontSize: "13px", cursor: "pointer",
                }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Confirm anular */}
          {voiding === doc.id && (
            <div style={{
              padding: "12px 20px", background: "rgba(248,113,113,0.05)",
              borderTop: "1px solid rgba(248,113,113,0.2)",
              display: "flex", alignItems: "center",
              justifyContent: "space-between", gap: "12px",
            }}>
              <p style={{ fontSize: "13px", color: "#f87171" }}>
                ¿Anular {doc.folio}? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => voidMutation.mutate(doc.id)}
                  disabled={voidMutation.isPending}
                  style={{
                    padding: "7px 14px", borderRadius: "var(--r-sm)",
                    background: "rgba(248,113,113,0.2)",
                    border: "1px solid rgba(248,113,113,0.3)",
                    color: "#f87171", fontSize: "13px", cursor: "pointer",
                  }}>
                  {voidMutation.isPending ? "Anulando..." : "Anular"}
                </button>
                <button onClick={() => setVoiding(null)} style={{
                  padding: "7px 14px", borderRadius: "var(--r-sm)",
                  background: "none", border: "1px solid var(--border)",
                  color: "var(--text-2)", fontSize: "13px", cursor: "pointer",
                }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Tab Generar ───────────────────────────────────────────────
function TabGenerar() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    order_id: "",
    tipo: "boleta",
    receptor_nombre: "",
    receptor_rut: "",
    receptor_giro: "",
    notas: "",
  })
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: (data) => generateDocument(data),
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries(["billing-documents"])
    },
    onError: (e) => {
      setError(e?.response?.data?.error || "Error al generar documento")
    },
  })

  const inputSt = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)",
    fontSize: "13px", outline: "none",
  }

  return (
    <div style={{
      maxWidth: "560px",
      display: "flex", flexDirection: "column", gap: "20px"
    }}>

      {result ? (
        <div style={{
          background: "rgba(26,255,110,0.06)",
          border: "1px solid rgba(26,255,110,0.2)",
          borderRadius: "var(--r-xl)", padding: "28px",
          textAlign: "center",
        }}>
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>✅</p>
          <h3 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.4rem", marginBottom: "8px"
          }}>
            Documento generado
          </h3>
          <p style={{
            fontSize: "20px", fontFamily: "monospace",
            color: "var(--accent)", marginBottom: "16px"
          }}>
            {result.folio}
          </p>
          <p style={{
            fontSize: "13px", color: "var(--text-3)",
            marginBottom: "20px"
          }}>
            Total: ${Math.round(result.total).toLocaleString("es-CL")}
          </p>
          <div style={{
            display: "flex", gap: "10px",
            justifyContent: "center"
          }}>
            <button
              onClick={async () => {
                const resp = await downloadDocument(result.id)
                const url = window.URL.createObjectURL(new Blob([resp.data]))
                const link = document.createElement("a")
                link.href = url
                link.setAttribute("download", `${result.folio}.pdf`)
                document.body.appendChild(link)
                link.click()
                link.remove()
              }}
              style={{
                padding: "10px 20px", borderRadius: "var(--r-md)",
                background: "var(--accent)", border: "none",
                color: "#000", fontWeight: 600, cursor: "pointer",
              }}>
              ⬇️ Descargar PDF
            </button>
            <button
              onClick={() => { setResult(null); setError("") }}
              style={{
                padding: "10px 20px", borderRadius: "var(--r-md)",
                background: "none", border: "1px solid var(--border)",
                color: "var(--text-2)", cursor: "pointer",
              }}>
              Generar otro
            </button>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: "var(--danger)", fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          {/* ID de orden */}
          <div>
            <label style={{
              display: "block", fontSize: "12px",
              fontWeight: 500, color: "var(--text-2)", marginBottom: "6px"
            }}>
              ID de Orden *
            </label>
            <input
              value={form.order_id}
              onChange={e => setForm(p => ({ ...p, order_id: e.target.value }))}
              style={inputSt}
              placeholder="UUID de la orden pagada"
            />
            <p style={{
              fontSize: "11px", color: "var(--text-3)",
              marginTop: "4px"
            }}>
              Copiá el ID desde la sección Órdenes
            </p>
          </div>

          {/* Tipo de documento */}
          <div>
            <label style={{
              display: "block", fontSize: "12px",
              fontWeight: 500, color: "var(--text-2)", marginBottom: "6px"
            }}>
              Tipo de documento
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { val: "boleta", label: "🧾 Boleta" },
                { val: "factura", label: "📄 Factura" },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, tipo: val }))}
                  style={{
                    flex: 1, padding: "10px", borderRadius: "var(--r-md)",
                    cursor: "pointer", fontSize: "13px", fontWeight: 500,
                    background: form.tipo === val ? "var(--accent)" : "var(--surface-2)",
                    border: `1px solid ${form.tipo === val ? "var(--accent)" : "var(--border)"}`,
                    color: form.tipo === val ? "#000" : "var(--text-2)",
                    transition: "all var(--dur) var(--ease)",
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Datos receptor (solo factura) */}
          {form.tipo === "factura" && (
            <div style={{
              display: "flex", flexDirection: "column", gap: "12px",
              padding: "16px", borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)"
            }}>
              <p style={{
                fontSize: "12px", fontWeight: 600,
                color: "var(--text-2)"
              }}>
                Datos del receptor (empresa)
              </p>
              {[
                { key: "receptor_nombre", label: "Razón social *" },
                { key: "receptor_rut", label: "RUT" },
                { key: "receptor_giro", label: "Giro" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={{
                    display: "block", fontSize: "11px",
                    color: "var(--text-3)", marginBottom: "4px"
                  }}>
                    {label}
                  </label>
                  <input
                    value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={inputSt}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Notas */}
          <div>
            <label style={{
              display: "block", fontSize: "12px",
              fontWeight: 500, color: "var(--text-2)", marginBottom: "6px"
            }}>
              Notas (opcional)
            </label>
            <textarea
              value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              rows={2}
              style={{ ...inputSt, resize: "vertical" }}
              placeholder="Ej: Pago con transferencia, referencia #123..."
            />
          </div>

          <button
            onClick={() => {
              // Validar formato UUID
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
              if (!uuidRegex.test(form.order_id.trim())) {
                setError("El ID de orden no es válido. Debe ser un UUID completo. Ej: 5a0e424c-bb4a-49d1-b54d-0bb9cc31c3dd")
                return
              }
              setError("")
              mutation.mutate({ ...form, order_id: form.order_id.trim() })
            }}
            disabled={mutation.isPending || !form.order_id}
            style={{
              padding: "13px", borderRadius: "var(--r-md)",
              background: form.order_id ? "var(--accent)" : "var(--surface-2)",
              border: "none",
              color: form.order_id ? "#000" : "var(--text-3)",
              fontSize: "14px", fontWeight: 600,
              cursor: form.order_id ? "pointer" : "default",
              transition: "all var(--dur) var(--ease)",
            }}>
            {mutation.isPending ? "Generando PDF..." : "🧾 Generar documento"}
          </button>
        </>
      )}
    </div>
  )
}

// ── Tab Configuración ─────────────────────────────────────────
function TabConfig() {
  const queryClient = useQueryClient()
  const { data: config, isLoading } = useQuery({
    queryKey: ["billing-config"],
    queryFn: getBillingConfig,
  })

  const [form, setForm] = useState(null)

  const mutation = useMutation({
    mutationFn: (data) => updateBillingConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["billing-config"])
      setForm(null)
    },
  })

  const current = form || config

  if (isLoading || !current) return (
    <div className="skeleton" style={{ height: "400px" }} />
  )

  const inputSt = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)",
    fontSize: "13px", outline: "none",
  }

  const fields = [
    { key: "razon_social", label: "Razón Social / Nombre del negocio" },
    { key: "rut", label: "RUT del negocio" },
    { key: "giro", label: "Giro comercial" },
    { key: "direccion", label: "Dirección" },
    { key: "ciudad", label: "Ciudad / País" },
    { key: "telefono", label: "Teléfono" },
    { key: "email", label: "Email de facturación" },
    { key: "iva_porcentaje", label: "IVA %" },
  ]

  return (
    <div style={{
      maxWidth: "560px",
      display: "flex", flexDirection: "column", gap: "16px"
    }}>

      {/* Preview del encabezado del PDF */}
      <div style={{
        padding: "16px 20px", borderRadius: "var(--r-lg)",
        background: "var(--surface-2)", border: "1px solid var(--border)",
      }}>
        <p style={{
          fontSize: "11px", color: "var(--text-3)",
          textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: "8px"
        }}>
          Vista previa del encabezado del PDF
        </p>
        <p style={{
          fontFamily: "var(--font-serif)", fontSize: "1.4rem",
          marginBottom: "4px"
        }}>
          {current.razon_social || "Tu Negocio"}
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
          RUT: {current.rut || "—"} · {current.giro || "Giro comercial"}
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
          {current.direccion || "Dirección"} · {current.ciudad}
        </p>
      </div>

      {/* Campos */}
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label style={{
            display: "block", fontSize: "12px",
            fontWeight: 500, color: "var(--text-2)", marginBottom: "6px"
          }}>
            {label}
          </label>
          <input
            type={key === "iva_porcentaje" ? "number" : "text"}
            value={current[key] ?? ""}
            onChange={e => setForm(f => ({
              ...(f || config), [key]: e.target.value
            }))}
            style={inputSt}
          />
        </div>
      ))}

      {/* Info numeración */}
      <div style={{
        padding: "12px 16px", borderRadius: "var(--r-md)",
        background: "var(--surface-2)", border: "1px solid var(--border)",
        fontSize: "12px", color: "var(--text-3)",
      }}>
        <p>Última boleta: <strong>B-{String(config?.ultimo_numero_boleta || 0).padStart(6, "0")}</strong></p>
        <p>Última factura: <strong>F-{String(config?.ultimo_numero_factura || 0).padStart(6, "0")}</strong></p>
      </div>

      <button
        onClick={() => mutation.mutate(form || config)}
        disabled={mutation.isPending || !form}
        style={{
          padding: "12px", borderRadius: "var(--r-md)",
          background: form ? "var(--accent)" : "var(--surface-2)",
          border: "none",
          color: form ? "#000" : "var(--text-3)",
          fontSize: "13px", fontWeight: 600,
          cursor: form ? "pointer" : "default",
        }}>
        {mutation.isPending ? "Guardando..." : "Guardar configuración"}
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export default function AdminBilling() {
  const [tab, setTab] = useState(0)

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px"
        }}>
          Facturación
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
          Genera boletas y facturas en PDF · Envía por email · Historial completo
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: "6px", marginBottom: "24px",
        borderBottom: "1px solid var(--border)"
      }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: "8px 16px", fontSize: "13px", cursor: "pointer",
            background: "none", border: "none",
            borderBottom: tab === i ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === i ? "var(--accent)" : "var(--text-3)",
            fontWeight: tab === i ? 500 : 400,
            marginBottom: "-1px",
            transition: "all var(--dur) var(--ease)",
          }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <TabDocumentos />}
      {tab === 1 && <TabGenerar />}
      {tab === 2 && <TabConfig />}
    </div>
  )
}
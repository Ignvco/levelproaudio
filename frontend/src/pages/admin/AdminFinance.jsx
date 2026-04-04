// pages/admin/AdminFinance.jsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getFinanceSummary, getFinanceCategories,
  createFinanceCategory, updateFinanceCategory, deleteFinanceCategory,
  getWithdrawals, createWithdrawal, deleteWithdrawal,
} from "../../api/admin.api"

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n) => `$${Number(n).toLocaleString("es-CL")}`

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: "20px 22px",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "10px"
      }}>
        <p style={{
          fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase",
          letterSpacing: "0.08em", fontWeight: 500
        }}>
          {label}
        </p>
        <span style={{ fontSize: "20px" }}>{icon}</span>
      </div>
      <p style={{
        fontFamily: "var(--font-serif)", fontSize: "1.9rem",
        lineHeight: 1, marginBottom: "6px",
        color: accent ? "var(--accent)" : "var(--text)"
      }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: "12px", color: "var(--text-3)" }}>{sub}</p>}
    </div>
  )
}

// ── Barra de distribución ────────────────────────────────────
function DistributionBar({ categories }) {
  const total = categories.reduce((a, c) => a + c.balance, 0) || 1
  return (
    <div>
      <div style={{
        display: "flex", height: "12px", borderRadius: "100px",
        overflow: "hidden", gap: "2px", marginBottom: "12px"
      }}>
        {categories.map(c => (
          <div key={c.id} style={{
            flex: Math.max(c.balance, 0),
            background: c.color,
            transition: "flex 0.5s ease",
            minWidth: c.balance > 0 ? "4px" : "0",
          }} title={`${c.name}: ${fmt(c.balance)}`} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {categories.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: c.color, flexShrink: 0
            }} />
            <span style={{ fontSize: "12px", color: "var(--text-2)" }}>
              {c.icon} {c.name}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 500 }}>
              {fmt(c.balance)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Modal categoría ──────────────────────────────────────────
function CategoryModal({ category, onClose, onSave }) {
  const [form, setForm] = useState({
    name: category?.name || "",
    cat_type: category?.cat_type || "percent",
    percentage: category?.percentage || 0,
    color: category?.color || "#1aff6e",
    icon: category?.icon || "💰",
    is_active: category?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido."); return }
    setSaving(true)
    setError("")
    try {
      if (category?.id) {
        await updateFinanceCategory(category.id, form)
      } else {
        await createFinanceCategory(form)
      }
      onSave()
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || "Error al guardar.")
    } finally {
      setSaving(false)
    }
  }

  const inputSt = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)", fontSize: "13px", outline: "none",
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"
    }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", width: "100%", maxWidth: "420px"
      }}>
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between"
        }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>
            {category?.id ? "Editar categoría" : "Nueva categoría"}
          </p>
          <button onClick={onClose} style={{
            background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "20px"
          }}>×</button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Tipo */}
            <div>
              <label style={{
                display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px"
              }}>Tipo de categoría</label>
              <select value={form.cat_type}
                onChange={e => setForm(p => ({ ...p, cat_type: e.target.value }))}
                style={inputSt}>
                <option value="fixed">💰 Monto fijo — costo real del producto</option>
                <option value="percent">% Porcentaje del precio de venta</option>
                <option value="remainder">💵 Resto — utilidad neta (lo que sobra)</option>
              </select>
              <p style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "4px" }}>
                {form.cat_type === "fixed" && "Se toma del costo de capital ingresado en cada producto"}
                {form.cat_type === "percent" && "Se calcula como porcentaje del precio de venta"}
                {form.cat_type === "remainder" && "Recibe lo que queda después de descontar todos los costos"}
              </p>
            </div>

            {/* Nombre + Icono */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 64px", gap: "10px" }}>
            <div>
              <label style={{
                display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px"
              }}>Nombre *</label>
              <input value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                style={inputSt} placeholder="Ej: Capital" />
            </div>
            <div>
              <label style={{
                display: "block", fontSize: "12px", fontWeight: 500,
                color: "var(--text-2)", marginBottom: "6px"
              }}>Icono</label>
              <input value={form.icon}
                onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
                style={{ ...inputSt, textAlign: "center", fontSize: "20px" }} />
            </div>
          </div>
          <div>
            <label style={{
              display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px"
            }}>
              Porcentaje (%)
            </label>
            <input type="number" value={form.percentage} min="0" max="100" step="0.5"
              onChange={e => setForm(p => ({ ...p, percentage: parseFloat(e.target.value) || 0 }))}
              style={inputSt} />
          </div>
          <div>
            <label style={{
              display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px"
            }}>Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input type="color" value={form.color}
                onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                style={{
                  width: "44px", height: "44px", padding: "2px",
                  borderRadius: "var(--r-sm)", border: "1px solid var(--border)",
                  background: "var(--surface-2)", cursor: "pointer"
                }} />
              <input value={form.color}
                onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                style={{ ...inputSt, fontFamily: "monospace" }} placeholder="#1aff6e" />
            </div>
          </div>
          <label style={{
            display: "flex", alignItems: "center", gap: "8px",
            cursor: "pointer", fontSize: "13px"
          }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              style={{ accentColor: "var(--accent)" }} />
            Activa
          </label>
          </div>
          {error && (
            <p style={{
              fontSize: "12px", color: "var(--danger)", padding: "8px 12px",
              background: "rgba(255,59,59,0.08)", borderRadius: "var(--r-sm)",
              border: "1px solid rgba(255,59,59,0.2)"
            }}>{error}</p>
          )}
          
        </div>
        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end"
        }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "9px 18px", fontSize: "13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-accent"
            style={{ padding: "9px 18px", fontSize: "13px", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal retiro ─────────────────────────────────────────────
function WithdrawalModal({ categories, onClose, onSave }) {
  const [form, setForm] = useState({
    category_id: categories[0]?.id || "",
    amount: "",
    destination: "",
    notes: "",
    reference: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const selectedCat = categories.find(c => c.id === form.category_id)

  const handleSave = async () => {
    if (!form.amount || !form.destination) {
      setError("Monto y cuenta destino son requeridos.")
      return
    }
    if (selectedCat && parseFloat(form.amount) > selectedCat.balance) {
      setError(`Saldo insuficiente en ${selectedCat.name}. Disponible: ${fmt(selectedCat.balance)}`)
      return
    }
    setSaving(true)
    setError("")
    try {
      await createWithdrawal(form)
      onSave()
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || "Error al registrar.")
    } finally {
      setSaving(false)
    }
  }

  const inputSt = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "var(--r-md)", color: "var(--text)", fontSize: "13px", outline: "none",
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"
    }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", width: "100%", maxWidth: "480px"
      }}>
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between"
        }}>
          <p style={{ fontSize: "15px", fontWeight: 500 }}>Registrar retiro</p>
          <button onClick={onClose} style={{
            background: "none", border: "none",
            cursor: "pointer", color: "var(--text-3)", fontSize: "20px"
          }}>×</button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <p style={{
              fontSize: "12px", color: "var(--danger)", padding: "8px 12px",
              background: "rgba(255,59,59,0.08)", borderRadius: "var(--r-sm)",
              border: "1px solid rgba(255,59,59,0.2)"
            }}>{error}</p>
          )}

          <div>
            <label style={{
              display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px"
            }}>Categoría *</label>
            <select value={form.category_id}
              onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
              style={inputSt}>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name} — disponible: {fmt(c.balance)}
                </option>
              ))}
            </select>
          </div>

          {/* Saldo disponible */}
          {selectedCat && (
            <div style={{
              padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "var(--surface-2)", border: "1px solid var(--border)"
            }}>
              <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "2px" }}>
                Saldo disponible en {selectedCat.name}
              </p>
              <p style={{
                fontSize: "1.4rem", fontFamily: "var(--font-serif)",
                color: selectedCat.balance > 0 ? "var(--accent)" : "var(--danger)"
              }}>
                {fmt(selectedCat.balance)}
              </p>
            </div>
          )}

          <div>
            <label style={{
              display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px"
            }}>Monto a retirar *</label>
            <input type="number" value={form.amount} min="1"
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              style={inputSt} placeholder="0" />
          </div>

          <div>
            <label style={{
              display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px"
            }}>Cuenta destino *</label>
            <input value={form.destination}
              onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
              style={inputSt} placeholder="Ej: Banco Estado — cuenta corriente 12345678" />
          </div>

          <div>
            <label style={{
              display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px"
            }}>N° de referencia / transferencia</label>
            <input value={form.reference}
              onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
              style={inputSt} placeholder="Opcional" />
          </div>

          <div>
            <label style={{
              display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "6px"
            }}>Notas</label>
            <textarea value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3} style={{ ...inputSt, resize: "vertical" }}
              placeholder="Motivo del retiro..." />
          </div>
        </div>
        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end"
        }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding: "9px 18px", fontSize: "13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-accent"
            style={{ padding: "9px 18px", fontSize: "13px", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Registrando..." : "Registrar retiro"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AdminFinance ─────────────────────────────────────────────
export default function AdminFinance() {
  const [tab, setTab] = useState("overview")
  const [modal, setModal] = useState(null)
  const queryClient = useQueryClient()

  const { data: summary, isLoading } = useQuery({
    queryKey: ["admin-finance-summary"],
    queryFn: getFinanceSummary,
    refetchInterval: 60000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-finance-categories"],
    queryFn: getFinanceCategories,
  })

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["admin-finance-withdrawals"],
    queryFn: getWithdrawals,
    enabled: tab === "withdrawals" || tab === "overview",
  })

  const deleteWithdrawalMutation = useMutation({
    mutationFn: deleteWithdrawal,
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-finance-summary"])
      queryClient.invalidateQueries(["admin-finance-withdrawals"])
    },
  })

  const deleteCatMutation = useMutation({
    mutationFn: deleteFinanceCategory,
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-finance-categories"])
      queryClient.invalidateQueries(["admin-finance-summary"])
    },
  })

  const onSave = () => {
    queryClient.invalidateQueries(["admin-finance-summary"])
    queryClient.invalidateQueries(["admin-finance-categories"])
    queryClient.invalidateQueries(["admin-finance-withdrawals"])
  }

  const summaryCategories = summary?.summary || []
  const recentIncome = summary?.recent_income || []

  const tabs = [
    { key: "overview", label: "Resumen" },
    { key: "income", label: "Ingresos" },
    { key: "withdrawals", label: "Retiros" },
    { key: "categories", label: "Configuración" },
    { key: "by_product", label: "Por producto" },
    
  ]

  const { data: incomeByProduct } = useQuery({
  queryKey: ["admin-finance-by-product"],
  queryFn:  () => api.get("/admin/finance/by-product/").then(r => r.data),
  enabled:  tab === "by_product",
})


  if (isLoading) return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div className="grid grid-cols-3 gap-3" style={{ marginBottom: "24px" }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: "100px" }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: "200px" }} />
    </div>
  )

  return (
    <div style={{ padding: "clamp(24px, 4vw, 40px)", maxWidth: "1100px" }}>

      {/* Modals */}
      {modal === "category" && (
        <CategoryModal onClose={() => setModal(null)} onSave={onSave} />
      )}
      {modal?.type === "edit-category" && (
        <CategoryModal category={modal.item} onClose={() => setModal(null)} onSave={onSave} />
      )}
      {modal === "withdrawal" && (
        <WithdrawalModal
          categories={summaryCategories}
          onClose={() => setModal(null)}
          onSave={onSave}
        />
      )}

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px"
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", marginBottom: "6px"
          }}>
            Finanzas
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
            Distribución automática de ingresos y retiros
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setModal("withdrawal")} className="btn btn-ghost"
            style={{ padding: "10px 18px", fontSize: "13px" }}>
            ↑ Registrar retiro
          </button>
          <button onClick={() => setModal("category")} className="btn btn-accent"
            style={{ padding: "10px 18px", fontSize: "13px" }}>
            + Nueva categoría
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        style={{ marginBottom: "24px" }}>
        <KpiCard
          label="Ingresos totales"
          value={fmt(summary?.total_income || 0)}
          sub="Desde todos los pagos aprobados"
          accent icon="📈"
        />
        <KpiCard
          label="Total retirado"
          value={fmt(summary?.total_withdrawn || 0)}
          sub="Suma de todos los retiros"
          icon="↑"
        />
        <KpiCard
          label="Balance neto"
          value={fmt(summary?.net_balance || 0)}
          sub="Ingresos − retiros"
          accent={summary?.net_balance > 0}
          icon="💼"
        />
      </div>

      {/* Barra visual de distribución */}
      {summaryCategories.length > 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "24px", marginBottom: "24px"
        }}>
          <p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "16px" }}>
            Distribución de fondos disponibles
          </p>
          <DistributionBar categories={summaryCategories} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "7px 16px", borderRadius: "100px", fontSize: "13px",
            cursor: "pointer", transition: "all var(--dur) var(--ease)",
            background: tab === key ? "var(--text)" : "transparent",
            color: tab === key ? "var(--bg)" : "var(--text-2)",
            border: `1px solid ${tab === key ? "var(--text)" : "var(--border)"}`,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB RESUMEN ── */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Cards por categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summaryCategories.map(cat => (
              <div key={cat.id} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)", padding: "20px",
                borderLeft: `3px solid ${cat.color}`,
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", marginBottom: "12px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "20px" }}>{cat.icon}</span>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 500 }}>{cat.name}</p>
                      <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                        {cat.percentage}% de cada ingreso
                      </p>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: "12px"
                  }}>
                    <span style={{ color: "var(--text-3)" }}>Ingresado</span>
                    <span style={{ color: "#4ade80" }}>{fmt(cat.total_in)}</span>
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: "12px"
                  }}>
                    <span style={{ color: "var(--text-3)" }}>Retirado</span>
                    <span style={{ color: "#f87171" }}>−{fmt(cat.total_out)}</span>
                  </div>
                  <div style={{
                    height: "1px", background: "var(--border)",
                    margin: "4px 0"
                  }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      Disponible
                    </span>
                    <span style={{
                      fontSize: "16px", fontWeight: 600,
                      fontFamily: "var(--font-serif)",
                      color: cat.balance >= 0 ? "var(--accent)" : "var(--danger)"
                    }}>
                      {fmt(cat.balance)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Últimos retiros */}
          {withdrawals.length > 0 && (
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", overflow: "hidden"
            }}>
              <p style={{
                padding: "14px 20px", borderBottom: "1px solid var(--border)",
                fontSize: "13px", fontWeight: 500
              }}>
                Últimos retiros
              </p>
              {withdrawals.slice(0, 5).map((w, i) => (
                <div key={w.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 20px", gap: "12px", flexWrap: "wrap",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "16px" }}>{w.category_icon}</span>
                    <div>
                      <p style={{ fontSize: "13px" }}>{w.destination}</p>
                      <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                        {w.category_name} · {w.created_at}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: "14px", fontWeight: 600,
                    color: "var(--danger)", flexShrink: 0
                  }}>
                    −{fmt(w.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB INGRESOS ── */}
      {tab === "income" && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", overflow: "hidden"
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr 2fr",
            padding: "10px 20px", borderBottom: "1px solid var(--border)",
            fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: "0.08em"
          }}>
            <span>Descripción</span>
            <span>Monto</span>
            <span>Fecha</span>
            <span>Distribución</span>
          </div>
          {recentIncome.length === 0 ? (
            <div style={{
              padding: "48px", textAlign: "center",
              color: "var(--text-3)", fontSize: "14px"
            }}>
              <p style={{ fontSize: "32px", marginBottom: "12px" }}>📊</p>
              Sin ingresos registrados todavía.
              Los ingresos se registran automáticamente al aprobarse un pago.
            </div>
          ) : recentIncome.map((income, i) => (
            <div key={income.id} style={{
              display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 2fr",
              padding: "14px 20px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              transition: "background var(--dur) var(--ease)",
            }} className="hover:bg-[var(--surface-2)]">
              <div>
                <p style={{ fontSize: "13px" }}>{income.description}</p>
                <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
                  {income.source === "payment" ? "Pago automático" : "Manual"}
                </p>
              </div>
              <span style={{
                fontSize: "14px", fontWeight: 600,
                color: "var(--accent)"
              }}>
                {fmt(income.amount)}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {income.created_at}
              </span>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {income.distributions.map((d, j) => (
                  <span key={j} style={{
                    fontSize: "10px", padding: "2px 6px", borderRadius: "100px",
                    fontWeight: 500,
                    color: d.category_color,
                    background: `${d.category_color}14`,
                    border: `1px solid ${d.category_color}30`,
                  }}>
                    {d.category_icon} {d.category_name}: {fmt(d.amount)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB RETIROS ── */}
      {tab === "withdrawals" && (
        <div>
          <div style={{
            display: "flex", justifyContent: "flex-end",
            marginBottom: "16px"
          }}>
            <button onClick={() => setModal("withdrawal")} className="btn btn-accent"
              style={{ padding: "10px 20px", fontSize: "13px" }}>
              + Registrar retiro
            </button>
          </div>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden"
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr 1fr 1fr 60px",
              padding: "10px 20px", borderBottom: "1px solid var(--border)",
              fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.08em"
            }}>
              <span>Categoría</span>
              <span>Destino</span>
              <span>Monto</span>
              <span>Fecha</span>
              <span></span>
            </div>
            {withdrawals.length === 0 ? (
              <div style={{
                padding: "48px", textAlign: "center",
                color: "var(--text-3)", fontSize: "14px"
              }}>
                Sin retiros registrados.
              </div>
            ) : withdrawals.map((w, i) => (
              <div key={w.id} style={{
                display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 1fr 60px",
                padding: "14px 20px", alignItems: "center",
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                transition: "background var(--dur) var(--ease)",
              }} className="hover:bg-[var(--surface-2)]">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>{w.category_icon}</span>
                  <span style={{ fontSize: "13px" }}>{w.category_name}</span>
                </div>
                <div>
                  <p style={{
                    fontSize: "13px", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>
                    {w.destination}
                  </p>
                  {w.reference && (
                    <p style={{
                      fontSize: "11px", color: "var(--text-3)",
                      fontFamily: "monospace"
                    }}>
                      Ref: {w.reference}
                    </p>
                  )}
                </div>
                <span style={{
                  fontSize: "14px", fontWeight: 600,
                  color: "var(--danger)"
                }}>
                  −{fmt(w.amount)}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {w.created_at}
                </span>
                <button
                  onClick={() => {
                    if (window.confirm("¿Eliminar este retiro?")) {
                      deleteWithdrawalMutation.mutate(w.id)
                    }
                  }}
                  style={{
                    padding: "4px 10px", borderRadius: "100px",
                    fontSize: "11px", cursor: "pointer", color: "#f87171",
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.2)"
                  }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONFIGURACIÓN ── */}
      {tab === "categories" && (
        <div>
          {/* Aviso si no suma 100% */}
          {(() => {
            const total = categories.reduce((a, c) => a + parseFloat(c.percentage || 0), 0)
            return Math.abs(total - 100) > 0.01 ? (
              <div style={{
                padding: "12px 16px", borderRadius: "var(--r-md)",
                background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.25)",
                color: "#facc15", fontSize: "13px", marginBottom: "16px"
              }}>
                ⚠️ Los porcentajes suman {total.toFixed(1)}% — se prorratearán automáticamente al distribuir.
                Para mayor precisión, hacé que sumen exactamente 100%.
              </div>
            ) : null
          })()}

          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden"
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "40px 2fr 1fr 80px 1fr 80px",
              padding: "10px 20px", borderBottom: "1px solid var(--border)",
              fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.08em"
            }}>
              <span></span>
              <span>Categoría</span>
              <span>Porcentaje</span>
              <span>Color</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>

            {categories.length === 0 ? (
              <div style={{
                padding: "40px", textAlign: "center",
                color: "var(--text-3)", fontSize: "14px"
              }}>
                Sin categorías. Crea la primera arriba.
              </div>
            ) : categories.map((cat, i) => (
              <div key={cat.id} style={{
                display: "grid", gridTemplateColumns: "40px 2fr 1fr 80px 1fr 80px",
                padding: "13px 20px", alignItems: "center",
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                transition: "background var(--dur) var(--ease)",
              }} className="hover:bg-[var(--surface-2)]">
                <span style={{ fontSize: "20px" }}>{cat.icon}</span>
                <span style={{ fontSize: "13px", fontWeight: 500 }}>{cat.name}</span>
                <span style={{ fontSize: "12px", color: "var(--text-2)" }}>
                  {cat.cat_type === "fixed" && "Costo real del producto"}
                  {cat.cat_type === "percent" && `${cat.percentage}% del precio venta`}
                  {cat.cat_type === "remainder" && "Lo que sobra (utilidad)"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: cat.color, border: "1px solid rgba(255,255,255,0.1)"
                  }} />
                  <span style={{
                    fontSize: "11px", fontFamily: "monospace",
                    color: "var(--text-3)"
                  }}>{cat.color}</span>
                </div>
                <span style={{
                  fontSize: "11px", padding: "2px 8px", borderRadius: "100px",
                  fontWeight: 500, display: "inline-block",
                  color: cat.is_active ? "#4ade80" : "var(--text-3)",
                  background: cat.is_active ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
                  border: `1px solid ${cat.is_active ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
                }}>
                  {cat.is_active ? "Activa" : "Inactiva"}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => setModal({ type: "edit-category", item: cat })}
                    style={{
                      padding: "5px 10px", borderRadius: "100px", fontSize: "11px",
                      cursor: "pointer", color: "#60a5fa",
                      background: "rgba(96,165,250,0.1)",
                      border: "1px solid rgba(96,165,250,0.25)"
                    }}>
                    ✎
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`¿Eliminar "${cat.name}"?`)) {
                        deleteCatMutation.mutate(cat.id)
                      }
                    }}
                    style={{
                      padding: "5px 10px", borderRadius: "100px", fontSize: "11px",
                      cursor: "pointer", color: "#f87171",
                      background: "rgba(248,113,113,0.1)",
                      border: "1px solid rgba(248,113,113,0.25)"
                    }}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "by_product" && (
  <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)", overflow: "hidden" }}>
    <div style={{
      display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
      padding: "10px 20px", borderBottom: "1px solid var(--border)",
      fontSize: "11px", fontWeight: 500, color: "var(--text-3)",
      textTransform: "uppercase", letterSpacing: "0.08em" }}>
      <span>Producto</span>
      <span>Vendidos</span>
      <span>Ingreso total</span>
      <span>Costo total</span>
      <span>Utilidad real</span>
    </div>
    {(incomeByProduct?.results || []).length === 0 ? (
      <div style={{ padding: "48px", textAlign: "center",
        color: "var(--text-3)", fontSize: "14px" }}>
        <p style={{ fontSize: "32px", marginBottom: "12px" }}>📊</p>
        Sin datos todavía. Los datos aparecen al aprobarse pagos.
      </div>
    ) : (incomeByProduct?.results || []).map((p, i) => (
      <div key={i} style={{
        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
        padding: "14px 20px", alignItems: "center",
        borderTop: i > 0 ? "1px solid var(--border)" : "none",
        transition: "background var(--dur) var(--ease)",
      }} className="hover:bg-[var(--surface-2)]">
        <div>
          <p style={{ fontSize: "13px", fontWeight: 400 }}>{p.product_name}</p>
          {p.sku && (
            <p style={{ fontSize: "11px", color: "var(--text-3)",
              fontFamily: "monospace" }}>{p.sku}</p>
          )}
        </div>
        <span style={{ fontSize: "13px" }}>{p.units_sold} u.</span>
        <span style={{ fontSize: "13px", color: "var(--accent)" }}>
          {fmt(p.total_revenue)}
        </span>
        <span style={{ fontSize: "13px", color: "#f87171" }}>
          {fmt(p.total_cost)}
        </span>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 600,
            color: p.profit >= 0 ? "var(--accent)" : "var(--danger)" }}>
            {fmt(p.profit)}
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-3)" }}>
            {p.margin}% margen
          </p>
        </div>
      </div>
    ))}
  </div>
  )}
    </div>
  )
}
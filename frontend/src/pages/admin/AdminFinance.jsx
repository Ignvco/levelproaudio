// pages/admin/AdminFinance.jsx
import { useState }                             from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api                                       from "../../api/client"          // ← fix crítico
import {
  getFinanceSummary, getFinanceCategories,
  createFinanceCategory, updateFinanceCategory, deleteFinanceCategory,
  getWithdrawals, createWithdrawal, deleteWithdrawal,
} from "../../api/admin.api"

const fmt   = n => `$${Number(n || 0).toLocaleString("es-CL")}`
const TABS  = [
  { key:"overview",    label:"Resumen"       },
  { key:"income",      label:"Ingresos"      },
  { key:"withdrawals", label:"Retiros"       },
  { key:"categories",  label:"Configuración" },
  { key:"by_product",  label:"Por producto"  },
]

const inputSt = {
  width:"100%", padding:"10px 14px",
  background:"var(--surface-2)", border:"1px solid var(--border)",
  borderRadius:"var(--r-md)", color:"var(--text)",
  fontSize:"13px", outline:"none",
  transition:"border-color var(--dur)",
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-xl)", padding:"20px 22px" }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:"10px" }}>
        <p style={{ fontSize:"11px", color:"var(--text-3)", textTransform:"uppercase",
          letterSpacing:"0.08em", fontWeight:500 }}>{label}</p>
        <span style={{ fontSize:"20px" }}>{icon}</span>
      </div>
      <p style={{ fontFamily:"var(--font-serif)", fontSize:"1.9rem", lineHeight:1,
        marginBottom:"6px", color: accent ? "var(--accent)" : "var(--text)" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize:"12px", color:"var(--text-3)" }}>{sub}</p>}
    </div>
  )
}

// ── Barra de distribución ─────────────────────────────────────
function DistributionBar({ categories }) {
  if (!categories?.length) return null
  return (
    <div>
      <div style={{ display:"flex", height:"12px", borderRadius:"100px",
        overflow:"hidden", gap:"2px", marginBottom:"14px" }}>
        {categories.map(c => (
          <div key={c.id} style={{ flex:Math.max(c.balance, 0),
            background:c.color, transition:"flex 0.5s ease",
            minWidth: c.balance > 0 ? "4px" : "0" }}
            title={`${c.name}: ${fmt(c.balance)}`} />
        ))}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"10px" }}>
        {categories.map(c => (
          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%",
              background:c.color, flexShrink:0 }} />
            <span style={{ fontSize:"12px", color:"var(--text-2)" }}>
              {c.icon} {c.name}
            </span>
            <span style={{ fontSize:"12px", fontWeight:500 }}>{fmt(c.balance)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Modal categoría ───────────────────────────────────────────
function CategoryModal({ category, onClose, onSave }) {
  const [form, setForm] = useState({
    name:       category?.name       || "",
    cat_type:   category?.cat_type   || "percent",
    percentage: category?.percentage !== undefined ? Number(category.percentage) : 0,
    color:      category?.color      || "#1aff6e",
    icon:       category?.icon       || "💰",
    is_active:  category?.is_active  ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido."); return }
    setSaving(true); setError("")
    try {
      const payload = {
        name:       form.name,
        cat_type:   form.cat_type,
        percentage: parseFloat(form.percentage) || 0,
        color:      form.color,
        icon:       form.icon,
        is_active:  form.is_active,
      }
      if (category?.id) await updateFinanceCategory(category.id, payload)
      else              await createFinanceCategory(payload)
      onSave(); onClose()
    } catch (e) {
      setError(e?.response?.data?.detail || e?.response?.data?.error || "Error al guardar.")
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      backdropFilter:"blur(8px)", zIndex:200, display:"flex",
      alignItems:"center", justifyContent:"center", padding:"24px" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-2xl)", width:"100%", maxWidth:"420px",
        animation:"scaleIn 200ms var(--ease)" }}>

        <div style={{ padding:"20px 24px", borderBottom:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <p style={{ fontSize:"15px", fontWeight:500 }}>
            {category?.id ? "Editar categoría" : "Nueva categoría"}
          </p>
          <button onClick={onClose} style={{ background:"none", border:"none",
            cursor:"pointer", color:"var(--text-3)", fontSize:"22px" }}>×</button>
        </div>

        <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"14px" }}>
          {error && (
            <div style={{ padding:"10px 14px", borderRadius:"var(--r-md)",
              background:"rgba(255,77,77,0.08)", border:"1px solid rgba(255,77,77,0.2)",
              color:"var(--danger)", fontSize:"13px" }}>{error}</div>
          )}

          {/* Tipo */}
          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>Tipo de categoría</label>
            <select value={form.cat_type}
              onChange={e => setForm(p => ({ ...p, cat_type:e.target.value }))}
              style={inputSt}>
              <option value="fixed">💰 Monto fijo — costo real del producto</option>
              <option value="percent">% Porcentaje del precio de venta</option>
              <option value="remainder">💵 Resto — utilidad neta (lo que sobra)</option>
            </select>
            <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"4px" }}>
              {form.cat_type==="fixed"     && "Se toma del costo de capital de cada producto"}
              {form.cat_type==="percent"   && "Se calcula como % del precio de venta"}
              {form.cat_type==="remainder" && "Recibe lo que queda después de todos los costos"}
            </p>
          </div>

          {/* Nombre + Ícono */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 64px", gap:"10px" }}>
            <div>
              <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                color:"var(--text-2)", marginBottom:"7px" }}>Nombre *</label>
              <input value={form.name}
                onChange={e => setForm(p => ({ ...p, name:e.target.value }))}
                style={inputSt} placeholder="Ej: IVA"
                onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
                onBlur={e => e.target.style.borderColor="var(--border)"} />
            </div>
            <div>
              <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                color:"var(--text-2)", marginBottom:"7px" }}>Ícono</label>
              <input value={form.icon}
                onChange={e => setForm(p => ({ ...p, icon:e.target.value }))}
                style={{ ...inputSt, textAlign:"center", fontSize:"20px" }} />
            </div>
          </div>

          {/* Porcentaje — solo si "percent" */}
          {form.cat_type==="percent" && (
            <div>
              <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                color:"var(--text-2)", marginBottom:"7px" }}>Porcentaje (%)</label>
              <input type="number" value={form.percentage} min="0" max="100" step="0.5"
                onChange={e => setForm(p => ({ ...p, percentage:parseFloat(e.target.value)||0 }))}
                style={inputSt}
                onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
                onBlur={e => e.target.style.borderColor="var(--border)"} />
            </div>
          )}

          {/* Color */}
          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>Color</label>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <input type="color" value={form.color}
                onChange={e => setForm(p => ({ ...p, color:e.target.value }))}
                style={{ width:"44px", height:"44px", padding:"2px",
                  borderRadius:"var(--r-sm)", border:"1px solid var(--border)",
                  background:"var(--surface-2)", cursor:"pointer" }} />
              <input value={form.color}
                onChange={e => setForm(p => ({ ...p, color:e.target.value }))}
                style={{ ...inputSt, fontFamily:"monospace" }} placeholder="#1aff6e"
                onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
                onBlur={e => e.target.style.borderColor="var(--border)"} />
            </div>
          </div>

          {/* Activa */}
          <label style={{ display:"flex", alignItems:"center", gap:"8px",
            cursor:"pointer", fontSize:"13px" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active:e.target.checked }))}
              style={{ accentColor:"var(--accent)" }} />
            Categoría activa
          </label>
        </div>

        <div style={{ padding:"16px 24px", borderTop:"1px solid var(--border)",
          display:"flex", gap:"10px", justifyContent:"flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding:"9px 18px", fontSize:"13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent"
            style={{ padding:"9px 18px", fontSize:"13px", opacity:saving?0.7:1 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal retiro ──────────────────────────────────────────────
function WithdrawalModal({ categories, onClose, onSave }) {
  const [form, setForm] = useState({
    category_id: categories[0]?.id || "",
    amount:      "",
    destination: "",
    notes:       "",
    reference:   "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const selectedCat = categories.find(c => c.id === form.category_id)

  const handleSave = async () => {
    if (!form.amount || !form.destination) {
      setError("Monto y cuenta destino son requeridos."); return
    }
    if (selectedCat && parseFloat(form.amount) > selectedCat.balance) {
      setError(`Saldo insuficiente en ${selectedCat.name}. Disponible: ${fmt(selectedCat.balance)}`)
      return
    }
    setSaving(true); setError("")
    try {
      await createWithdrawal(form); onSave(); onClose()
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al registrar.")
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      backdropFilter:"blur(8px)", zIndex:200, display:"flex",
      alignItems:"center", justifyContent:"center", padding:"24px" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-2xl)", width:"100%", maxWidth:"480px",
        animation:"scaleIn 200ms var(--ease)" }}>

        <div style={{ padding:"20px 24px", borderBottom:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <p style={{ fontSize:"15px", fontWeight:500 }}>Registrar retiro</p>
          <button onClick={onClose} style={{ background:"none", border:"none",
            cursor:"pointer", color:"var(--text-3)", fontSize:"22px" }}>×</button>
        </div>

        <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"14px" }}>
          {error && (
            <div style={{ padding:"10px 14px", borderRadius:"var(--r-md)",
              background:"rgba(255,77,77,0.08)", border:"1px solid rgba(255,77,77,0.2)",
              color:"var(--danger)", fontSize:"13px" }}>{error}</div>
          )}

          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>Categoría *</label>
            <select value={form.category_id}
              onChange={e => setForm(p => ({ ...p, category_id:e.target.value }))}
              style={inputSt}>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name} — disponible: {fmt(c.balance)}
                </option>
              ))}
            </select>
          </div>

          {selectedCat && (
            <div style={{ padding:"12px 14px", borderRadius:"var(--r-lg)",
              background:"var(--surface-2)", border:"1px solid var(--border)" }}>
              <p style={{ fontSize:"12px", color:"var(--text-3)", marginBottom:"4px" }}>
                Saldo disponible en {selectedCat.name}
              </p>
              <p style={{ fontFamily:"var(--font-serif)", fontSize:"1.4rem",
                color: selectedCat.balance > 0 ? "var(--accent)" : "var(--danger)" }}>
                {fmt(selectedCat.balance)}
              </p>
            </div>
          )}

          {[
            { key:"amount",      label:"Monto a retirar *",           type:"number", placeholder:"0" },
            { key:"destination", label:"Cuenta destino *",            type:"text",   placeholder:"Ej: Banco Estado — cta. cte 12345678" },
            { key:"reference",   label:"N° de referencia (opcional)", type:"text",   placeholder:"Opcional" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label style={{ display:"block", fontSize:"12px", fontWeight:500,
                color:"var(--text-2)", marginBottom:"7px" }}>{label}</label>
              <input type={type} value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]:e.target.value }))}
                style={inputSt} placeholder={placeholder}
                onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
                onBlur={e => e.target.style.borderColor="var(--border)"} />
            </div>
          ))}

          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>Notas</label>
            <textarea value={form.notes} rows={3}
              onChange={e => setForm(p => ({ ...p, notes:e.target.value }))}
              style={{ ...inputSt, resize:"vertical" }} placeholder="Motivo del retiro..."
              onFocus={e => e.target.style.borderColor="rgba(26,255,110,0.4)"}
              onBlur={e => e.target.style.borderColor="var(--border)"} />
          </div>
        </div>

        <div style={{ padding:"16px 24px", borderTop:"1px solid var(--border)",
          display:"flex", gap:"10px", justifyContent:"flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding:"9px 18px", fontSize:"13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent"
            style={{ padding:"9px 18px", fontSize:"13px", opacity:saving?0.7:1 }}>
            {saving ? "Registrando..." : "Registrar retiro"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AdminFinance ──────────────────────────────────────────────
export default function AdminFinance() {
  const [tab, setTab]   = useState("overview")
  const [modal, setModal] = useState(null)
  const queryClient     = useQueryClient()

  const { data:summary, isLoading } = useQuery({
    queryKey: ["admin-finance-summary"],
    queryFn:  getFinanceSummary,
    refetchInterval: 60000,
  })
  const { data:categories = [] } = useQuery({
    queryKey: ["admin-finance-categories"],
    queryFn:  getFinanceCategories,
  })
  const { data:withdrawals = [] } = useQuery({
    queryKey: ["admin-finance-withdrawals"],
    queryFn:  getWithdrawals,
    enabled:  tab === "withdrawals" || tab === "overview",
  })
  const { data:incomeByProduct } = useQuery({
    queryKey: ["admin-finance-by-product"],
    queryFn:  () => api.get("/admin/finance/by-product/").then(r => r.data),
    enabled:  tab === "by_product",
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

  const summaryCategories = summary?.summary      || []
  const recentIncome      = summary?.recent_income || []

  if (isLoading) return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)",
        gap:"12px", marginBottom:"24px" }}>
        {[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{ height:"100px" }} />)}
      </div>
      <div className="skeleton" style={{ height:"200px" }} />
    </div>
  )

  return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)", maxWidth:"1100px" }}>

      {/* Modals */}
      {modal==="category" && (
        <CategoryModal onClose={() => setModal(null)} onSave={onSave} />
      )}
      {modal?.type==="edit-category" && (
        <CategoryModal category={modal.item} onClose={() => setModal(null)} onSave={onSave} />
      )}
      {modal==="withdrawal" && (
        <WithdrawalModal categories={summaryCategories}
          onClose={() => setModal(null)} onSave={onSave} />
      )}

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:"28px", flexWrap:"wrap", gap:"16px" }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight:300, letterSpacing:"-0.02em", marginBottom:"6px" }}>Finanzas</h1>
          <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
            Distribución automática de ingresos y retiros
          </p>
        </div>
        <div style={{ display:"flex", gap:"10px" }}>
          <button onClick={() => setModal("withdrawal")} className="btn btn-ghost"
            style={{ padding:"10px 18px", fontSize:"13px" }}>
            ↑ Registrar retiro
          </button>
          <button onClick={() => setModal("category")} className="btn btn-accent"
            style={{ padding:"10px 18px", fontSize:"13px" }}>
            + Nueva categoría
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",
        gap:"12px", marginBottom:"24px" }}>
        <KpiCard label="Ingresos totales"
          value={fmt(summary?.total_income)} sub="Desde todos los pagos aprobados"
          accent icon="📈" />
        <KpiCard label="Total retirado"
          value={fmt(summary?.total_withdrawn)} sub="Suma de todos los retiros" icon="↑" />
        <KpiCard label="Balance neto"
          value={fmt(summary?.net_balance)} sub="Ingresos − retiros"
          accent={summary?.net_balance > 0} icon="💼" />
      </div>

      {/* Barra distribución */}
      {summaryCategories.length > 0 && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", padding:"24px", marginBottom:"24px" }}>
          <p style={{ fontSize:"13px", fontWeight:500, marginBottom:"16px" }}>
            Distribución de fondos disponibles
          </p>
          <DistributionBar categories={summaryCategories} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:"0", marginBottom:"24px",
        borderBottom:"1px solid var(--border)" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{
            padding:"9px 18px", fontSize:"13px", cursor:"pointer",
            background:"none", border:"none",
            borderBottom: tab===key ? "2px solid var(--accent)" : "2px solid transparent",
            color:        tab===key ? "var(--accent)"            : "var(--text-3)",
            fontWeight:   tab===key ? 500                        : 400,
            marginBottom:"-1px", whiteSpace:"nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab==="overview" && (
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

          {/* Cards por categoría */}
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:"12px" }}>
            {summaryCategories.map(cat => (
              <div key={cat.id} style={{ background:"var(--surface)",
                border:"1px solid var(--border)", borderRadius:"var(--r-xl)",
                padding:"20px", borderLeft:`3px solid ${cat.color}` }}>
                <div style={{ display:"flex", alignItems:"center",
                  gap:"10px", marginBottom:"14px" }}>
                  <span style={{ fontSize:"22px" }}>{cat.icon}</span>
                  <div>
                    <p style={{ fontSize:"13px", fontWeight:500 }}>{cat.name}</p>
                    <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                      {cat.percentage}% de cada ingreso
                    </p>
                  </div>
                </div>
                {[
                  { label:"Ingresado",  value: fmt(cat.total_in),   color:"#4ade80" },
                  { label:"Retirado",   value: `−${fmt(cat.total_out)}`, color:"#f87171" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between",
                    fontSize:"12px", marginBottom:"6px" }}>
                    <span style={{ color:"var(--text-3)" }}>{label}</span>
                    <span style={{ color }}>{value}</span>
                  </div>
                ))}
                <div style={{ height:"1px", background:"var(--border)", margin:"8px 0" }} />
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"baseline" }}>
                  <span style={{ fontSize:"12px", color:"var(--text-3)" }}>Disponible</span>
                  <span style={{ fontFamily:"var(--font-serif)", fontSize:"1.3rem",
                    fontWeight:600,
                    color: cat.balance >= 0 ? "var(--accent)" : "var(--danger)" }}>
                    {fmt(cat.balance)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Últimos retiros */}
          {withdrawals.length > 0 && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:"var(--r-xl)", overflow:"hidden" }}>
              <p style={{ padding:"14px 20px", borderBottom:"1px solid var(--border)",
                fontSize:"13px", fontWeight:500 }}>Últimos retiros</p>
              {withdrawals.slice(0,5).map((w,i) => (
                <div key={w.id} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:"12px 20px",
                  borderTop: i>0 ? "1px solid var(--border)" : "none",
                  gap:"12px", flexWrap:"wrap",
                  transition:"background var(--dur) var(--ease)" }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--surface-2)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <span style={{ fontSize:"16px" }}>{w.category_icon}</span>
                    <div>
                      <p style={{ fontSize:"13px" }}>{w.destination}</p>
                      <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                        {w.category_name} · {w.created_at}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize:"14px", fontWeight:600,
                    color:"var(--danger)", flexShrink:0 }}>
                    −{fmt(w.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INGRESOS ── */}
      {tab==="income" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", overflow:"hidden" }}>
          <div style={{ display:"grid",
            gridTemplateColumns:"1.5fr 1fr 1fr 2fr",
            padding:"10px 20px", borderBottom:"1px solid var(--border)",
            fontSize:"11px", fontWeight:500, color:"var(--text-3)",
            textTransform:"uppercase", letterSpacing:"0.08em" }}>
            <span>Descripción</span><span>Monto</span>
            <span>Fecha</span><span>Distribución</span>
          </div>

          {recentIncome.length===0 ? (
            <div style={{ padding:"56px", textAlign:"center",
              color:"var(--text-3)", fontSize:"14px" }}>
              <p style={{ fontSize:"36px", marginBottom:"12px" }}>📊</p>
              Sin ingresos registrados todavía. Se registran automáticamente al aprobarse un pago.
            </div>
          ) : recentIncome.map((income,i) => (
            <div key={income.id} style={{ display:"grid",
              gridTemplateColumns:"1.5fr 1fr 1fr 2fr",
              padding:"14px 20px", alignItems:"center",
              borderTop: i>0 ? "1px solid var(--border)" : "none",
              transition:"background var(--dur) var(--ease)" }}
              onMouseEnter={e => e.currentTarget.style.background="var(--surface-2)"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div>
                <p style={{ fontSize:"13px" }}>{income.description}</p>
                <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
                  {income.source==="payment" ? "Pago automático" : "Manual"}
                </p>
              </div>
              <span style={{ fontSize:"14px", fontWeight:600, color:"var(--accent)" }}>
                {fmt(income.amount)}
              </span>
              <span style={{ fontSize:"12px", color:"var(--text-3)" }}>
                {income.created_at}
              </span>
              <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                {income.distributions?.map((d,j) => (
                  <span key={j} style={{ fontSize:"10px", padding:"2px 6px",
                    borderRadius:"100px", fontWeight:500,
                    color:d.category_color,
                    background:`${d.category_color}14`,
                    border:`1px solid ${d.category_color}30` }}>
                    {d.category_icon} {d.category_name}: {fmt(d.amount)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RETIROS ── */}
      {tab==="withdrawals" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"16px" }}>
            <button onClick={() => setModal("withdrawal")} className="btn btn-accent"
              style={{ padding:"10px 20px", fontSize:"13px" }}>
              + Registrar retiro
            </button>
          </div>

          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--r-xl)", overflow:"hidden" }}>
            <div style={{ display:"grid",
              gridTemplateColumns:"1fr 1.5fr 1fr 1fr 60px",
              padding:"10px 20px", borderBottom:"1px solid var(--border)",
              fontSize:"11px", fontWeight:500, color:"var(--text-3)",
              textTransform:"uppercase", letterSpacing:"0.08em" }}>
              <span>Categoría</span><span>Destino</span>
              <span>Monto</span><span>Fecha</span><span />
            </div>

            {withdrawals.length===0 ? (
              <div style={{ padding:"56px", textAlign:"center",
                color:"var(--text-3)", fontSize:"14px" }}>
                Sin retiros registrados.
              </div>
            ) : withdrawals.map((w,i) => (
              <div key={w.id} style={{ display:"grid",
                gridTemplateColumns:"1fr 1.5fr 1fr 1fr 60px",
                padding:"14px 20px", alignItems:"center",
                borderTop: i>0 ? "1px solid var(--border)" : "none",
                transition:"background var(--dur) var(--ease)" }}
                onMouseEnter={e => e.currentTarget.style.background="var(--surface-2)"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <span style={{ fontSize:"16px" }}>{w.category_icon}</span>
                  <span style={{ fontSize:"13px" }}>{w.category_name}</span>
                </div>
                <div>
                  <p style={{ fontSize:"13px", overflow:"hidden",
                    textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {w.destination}
                  </p>
                  {w.reference && (
                    <p style={{ fontSize:"11px", color:"var(--text-3)",
                      fontFamily:"monospace" }}>Ref: {w.reference}</p>
                  )}
                </div>
                <span style={{ fontSize:"14px", fontWeight:600, color:"var(--danger)" }}>
                  −{fmt(w.amount)}
                </span>
                <span style={{ fontSize:"12px", color:"var(--text-3)" }}>
                  {w.created_at}
                </span>
                <button onClick={() => {
                  if (window.confirm("¿Eliminar este retiro?"))
                    deleteWithdrawalMutation.mutate(w.id)
                }} style={{ padding:"4px 10px", borderRadius:"var(--r-full)",
                  fontSize:"11px", cursor:"pointer", color:"#f87171",
                  background:"rgba(248,113,113,0.08)",
                  border:"1px solid rgba(248,113,113,0.2)" }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONFIGURACIÓN (categorías) ── */}
      {tab==="categories" && (
        <div>
          {/* Aviso si no suma 100% */}
          {(() => {
            const total = categories.reduce((a,c) => a + parseFloat(c.percentage||0), 0)
            return Math.abs(total-100) > 0.01 ? (
              <div style={{ padding:"12px 16px", borderRadius:"var(--r-xl)",
                background:"rgba(250,204,21,0.08)",
                border:"1px solid rgba(250,204,21,0.25)",
                color:"#facc15", fontSize:"13px", marginBottom:"16px" }}>
                ⚠️ Los porcentajes suman {total.toFixed(1)}% — deberían sumar 100%.
              </div>
            ) : null
          })()}

          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--r-xl)", overflow:"hidden" }}>
            <div style={{ display:"grid",
              gridTemplateColumns:"40px 2fr 1fr 80px 1fr 80px",
              padding:"10px 20px", borderBottom:"1px solid var(--border)",
              fontSize:"11px", fontWeight:500, color:"var(--text-3)",
              textTransform:"uppercase", letterSpacing:"0.08em" }}>
              <span /><span>Categoría</span><span>Configuración</span>
              <span>Color</span><span>Estado</span><span>Acciones</span>
            </div>

            {categories.length===0 ? (
              <div style={{ padding:"48px", textAlign:"center",
                color:"var(--text-3)", fontSize:"14px" }}>
                Sin categorías. Creá la primera con el botón "+ Nueva categoría".
              </div>
            ) : categories.map((cat,i) => (
              <div key={cat.id} style={{ display:"grid",
                gridTemplateColumns:"40px 2fr 1fr 80px 1fr 80px",
                padding:"13px 20px", alignItems:"center",
                borderTop: i>0 ? "1px solid var(--border)" : "none",
                transition:"background var(--dur) var(--ease)" }}
                onMouseEnter={e => e.currentTarget.style.background="var(--surface-2)"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <span style={{ fontSize:"20px" }}>{cat.icon}</span>
                <span style={{ fontSize:"13px", fontWeight:500 }}>{cat.name}</span>
                <span style={{ fontSize:"12px", color:"var(--text-2)" }}>
                  {cat.cat_type==="fixed"     && "Costo real"}
                  {cat.cat_type==="percent"   && `${cat.percentage}% venta`}
                  {cat.cat_type==="remainder" && "Utilidad neta"}
                </span>
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <div style={{ width:"16px", height:"16px", borderRadius:"50%",
                    background:cat.color, border:"1px solid rgba(255,255,255,0.1)" }} />
                  <span style={{ fontSize:"10px", fontFamily:"monospace",
                    color:"var(--text-3)" }}>{cat.color}</span>
                </div>
                <span style={{ padding:"2px 8px", borderRadius:"var(--r-full)",
                  fontSize:"11px", fontWeight:500, display:"inline-block",
                  color:      cat.is_active ? "#4ade80" : "var(--text-3)",
                  background: cat.is_active ? "rgba(74,222,128,0.1)" : "var(--surface-3)",
                  border:     `1px solid ${cat.is_active ? "rgba(74,222,128,0.25)" : "var(--border)"}` }}>
                  {cat.is_active ? "Activa" : "Inactiva"}
                </span>
                <div style={{ display:"flex", gap:"6px" }}>
                  <button onClick={() => setModal({ type:"edit-category", item:cat })} style={{
                    padding:"5px 10px", borderRadius:"var(--r-md)", fontSize:"11px",
                    cursor:"pointer", color:"#60a5fa",
                    background:"rgba(96,165,250,0.1)", border:"1px solid rgba(96,165,250,0.25)" }}>
                    ✎
                  </button>
                  <button onClick={() => {
                    if (window.confirm(`¿Eliminar "${cat.name}"?`))
                      deleteCatMutation.mutate(cat.id)
                  }} style={{ padding:"5px 10px", borderRadius:"var(--r-md)", fontSize:"11px",
                    cursor:"pointer", color:"#f87171",
                    background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)" }}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── POR PRODUCTO ── */}
      {tab==="by_product" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", overflow:"hidden" }}>
          <div style={{ display:"grid",
            gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
            padding:"10px 20px", borderBottom:"1px solid var(--border)",
            fontSize:"11px", fontWeight:500, color:"var(--text-3)",
            textTransform:"uppercase", letterSpacing:"0.08em" }}>
            <span>Producto</span><span>Vendidos</span>
            <span>Ingreso total</span><span>Costo total</span><span>Utilidad real</span>
          </div>

          {(incomeByProduct?.results || []).length===0 ? (
            <div style={{ padding:"56px", textAlign:"center",
              color:"var(--text-3)", fontSize:"14px" }}>
              <p style={{ fontSize:"36px", marginBottom:"12px" }}>📊</p>
              Sin datos todavía. Aparecen al aprobarse pagos con órdenes reales.
            </div>
          ) : (incomeByProduct?.results || []).map((p,i) => (
            <div key={i} style={{ display:"grid",
              gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
              padding:"14px 20px", alignItems:"center",
              borderTop: i>0 ? "1px solid var(--border)" : "none",
              transition:"background var(--dur) var(--ease)" }}
              onMouseEnter={e => e.currentTarget.style.background="var(--surface-2)"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div>
                <p style={{ fontSize:"13px" }}>{p.product_name}</p>
                {p.sku && (
                  <p style={{ fontSize:"11px", color:"var(--text-3)",
                    fontFamily:"monospace" }}>{p.sku}</p>
                )}
              </div>
              <span style={{ fontSize:"13px" }}>{p.units_sold} u.</span>
              <span style={{ fontSize:"13px", color:"var(--accent)" }}>
                {fmt(p.total_revenue)}
              </span>
              <span style={{ fontSize:"13px", color:"#f87171" }}>
                {fmt(p.total_cost)}
              </span>
              <div>
                <p style={{ fontSize:"13px", fontWeight:600,
                  color: p.profit >= 0 ? "var(--accent)" : "var(--danger)" }}>
                  {fmt(p.profit)}
                </p>
                <p style={{ fontSize:"11px", color:"var(--text-3)" }}>
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

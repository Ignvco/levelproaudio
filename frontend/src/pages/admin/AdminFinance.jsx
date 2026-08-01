// pages/admin/AdminFinance.jsx
import { useState }                             from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api                                       from "../../api/client"          // ← fix crítico
import { TrendingUp, ArrowUpFromLine, Wallet, Pencil, Trash2, Inbox }   from "lucide-react"
import { StatCard, AdminPageHeader, DataTable, PrimaryButton, SecondaryButton }  from "../../components/admin/ui"
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
function KpiCard({ label, value, sub, accent, Icon }) {
  return <StatCard variant={accent ? "primary" : "dark"} Icon={Icon} label={label} value={value} sub={sub} />
}

// ── Barra de distribución ─────────────────────────────────────
function DistributionBar({ categories }) {
  if (!categories?.length) return null
  return (
    <div>
      <div style={{ display:"flex", height:"14px", borderRadius:"100px",
        overflow:"hidden", gap:"3px", marginBottom:"18px",
        background:"#EFF1F4" }}>
        {categories.map(c => (
          <div key={c.id} style={{ flex:Math.max(c.balance, 0),
            background:c.color, transition:"flex 0.5s ease",
            minWidth: c.balance > 0 ? "4px" : "0" }}
            title={`${c.name}: ${fmt(c.balance)}`} />
        ))}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
        {categories.map(c => (
          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:"7px",
            background:"var(--surface-2)", border:"1px solid var(--border)",
            borderRadius:"9999px", padding:"7px 14px" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%",
              background:c.color, flexShrink:0 }} />
            <span style={{ fontSize:"12px", color:"var(--text-2)" }}>
              {c.icon} {c.name}
            </span>
            <span style={{ fontSize:"12px", fontWeight:700, color:"var(--text)" }}>{fmt(c.balance)}</span>
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
              <p style={{ fontFamily:"var(--font-display)", fontSize:"1.4rem",
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
    <div className="au-page" style={{ padding:"clamp(24px, 4vw, 40px)", maxWidth:"1100px" }}>

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

      <AdminPageHeader eyebrow="Contabilidad" title="Finanzas"
        description="Distribución automática de ingresos y retiros"
        actions={
          <>
            <SecondaryButton onClick={() => setModal("withdrawal")} data-testid="register-withdrawal-btn">
              ↑ Registrar retiro
            </SecondaryButton>
            <PrimaryButton onClick={() => setModal("category")} data-testid="new-category-btn">
              + Nueva categoría
            </PrimaryButton>
          </>
        } />

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",
        gap:"12px", marginBottom:"24px" }}>
        <KpiCard label="Ingresos totales"
          value={fmt(summary?.total_income)} sub="Desde todos los pagos aprobados"
          accent Icon={TrendingUp} />
        <KpiCard label="Total retirado"
          value={fmt(summary?.total_withdrawn)} sub="Suma de todos los retiros" Icon={ArrowUpFromLine} />
        <KpiCard label="Balance neto"
          value={fmt(summary?.net_balance)} sub="Ingresos − retiros"
          accent={summary?.net_balance > 0} Icon={Wallet} />
      </div>

      {/* Barra distribución */}
      {summaryCategories.length > 0 && (
        <div style={{ background:"#FCFCFC", border:"1px solid #FFFFFF",
          borderRadius:"24px", padding:"24px", marginBottom:"24px",
          boxShadow:"0 10px 30px rgba(20,30,24,.08)" }}>
          <p style={{ fontSize:"11px", fontWeight:700, letterSpacing:".08em",
            textTransform:"uppercase", color:"var(--text-3)", marginBottom:"18px" }}>
            Distribución de fondos disponibles
          </p>
          <DistributionBar categories={summaryCategories} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:"0", marginBottom:"24px",
        borderBottom:"1px solid var(--border)", overflowX:"auto",
        WebkitOverflowScrolling:"touch" }} className="hide-scroll">
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
            gridTemplateColumns:"repeat(auto-fill, minmax(250px, 1fr))", gap:"14px" }}>
            {summaryCategories.map(cat => (
              <div key={cat.id} className="au-acard">
                <div className="au-acard__head">
                  <span className="au-acard__tag" style={{ display:"inline-flex", alignItems:"center", gap:"6px" }}>
                    <span>{cat.icon}</span> {cat.percentage}% de cada ingreso
                  </span>
                  <span className="au-acard__dot" style={{ background:cat.color, boxShadow:`0 0 10px ${cat.color}` }} />
                </div>
                <p className="au-acard__title">{cat.name}</p>

                <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginTop:"2px" }}>
                  {[
                    { label:"Ingresado",  value: fmt(cat.total_in),        color:"#0F9940" },
                    { label:"Retirado",   value: `−${fmt(cat.total_out)}`, color:"#EF4444" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display:"flex", justifyContent:"space-between",
                      fontSize:"12.5px" }}>
                      <span style={{ color:"var(--text-3)" }}>{label}</span>
                      <span style={{ color, fontWeight:600 }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="au-acard__foot">
                  <span className="au-acard__price">Disponible</span>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:"1.5rem", fontWeight:800,
                    letterSpacing:"-.02em", lineHeight:1,
                    color: cat.balance >= 0 ? "#0F9940" : "#EF4444" }}>
                    {fmt(cat.balance)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Últimos retiros */}
          {withdrawals.length > 0 && (
            <div className="au-card" style={{ overflow:"hidden" }}>
              <p style={{ padding:"16px 20px", borderBottom:"1px solid var(--admin-border)",
                fontSize:"13px", fontWeight:700, color:"var(--admin-text)" }}>Últimos retiros</p>
              {withdrawals.slice(0,5).map((w,i) => (
                <div key={w.id} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:"13px 20px",
                  borderTop: i>0 ? "1px solid var(--admin-border)" : "none",
                  gap:"12px", flexWrap:"wrap",
                  transition:"background var(--dur) var(--ease)" }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--admin-surface-secondary)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <span style={{ fontSize:"16px" }}>{w.category_icon}</span>
                    <div>
                      <p style={{ fontSize:"13px", fontWeight:600, color:"var(--admin-text)" }}>{w.destination}</p>
                      <p style={{ fontSize:"11px", color:"var(--admin-text-muted)" }}>
                        {w.category_name} · {w.created_at}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize:"14px", fontWeight:700,
                    color:"var(--admin-danger)", flexShrink:0 }}>
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
        <DataTable
          columns={[
            { key:"description", header:"Descripción", sortable:true, render:income => (
              <div>
                <p style={{ fontSize:"13px", fontWeight:600, color:"var(--admin-text)" }}>{income.description}</p>
                <p style={{ fontSize:"11px", color:"var(--admin-text-muted)" }}>
                  {income.source==="payment" ? "Pago automático" : "Manual"}
                </p>
              </div>
            )},
            { key:"amount", header:"Monto", sortable:true, align:"right", render:income => (
              <span style={{ fontWeight:700, color:"var(--admin-primary-text)" }}>{fmt(income.amount)}</span>
            )},
            { key:"created_at", header:"Fecha", sortable:true, render:income => (
              <span style={{ color:"var(--admin-text-muted)" }}>{income.created_at}</span>
            )},
            { key:"distributions", header:"Distribución", render:income => (
              <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                {income.distributions?.map((d,j) => (
                  <span key={j} style={{ fontSize:"10px", padding:"2px 6px",
                    borderRadius:"100px", fontWeight:500,
                    color:d.category_color, background:`${d.category_color}14`,
                    border:`1px solid ${d.category_color}30` }}>
                    {d.category_icon} {d.category_name}: {fmt(d.amount)}
                  </span>
                ))}
              </div>
            )},
          ]}
          data={recentIncome} getRowId={r => r.id ?? r.description}
          searchable searchKeys={["description"]} searchPlaceholder="Buscar ingreso..."
          emptyIcon={Inbox} emptyTitle="Sin ingresos registrados"
          emptyDesc="Se registran automáticamente al aprobarse un pago."
          testId="income-table" />
      )}

      {/* ── RETIROS ── */}
      {tab==="withdrawals" && (
        <DataTable
          columns={[
            { key:"category_name", header:"Categoría", sortable:true, render:w => (
              <span style={{ display:"flex", alignItems:"center", gap:"8px", color:"var(--admin-text)" }}>
                <span style={{ fontSize:"16px" }}>{w.category_icon}</span>{w.category_name}
              </span>
            )},
            { key:"destination", header:"Destino", sortable:true, render:w => (
              <div>
                <p style={{ fontSize:"13px", color:"var(--admin-text)", overflow:"hidden",
                  textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"280px" }}>{w.destination}</p>
                {w.reference && <p style={{ fontSize:"11px", color:"var(--admin-text-muted)",
                  fontFamily:"monospace" }}>Ref: {w.reference}</p>}
              </div>
            )},
            { key:"amount", header:"Monto", sortable:true, align:"right", render:w => (
              <span style={{ fontWeight:700, color:"var(--admin-danger)" }}>−{fmt(w.amount)}</span>
            )},
            { key:"created_at", header:"Fecha", sortable:true, render:w => (
              <span style={{ color:"var(--admin-text-muted)" }}>{w.created_at}</span>
            )},
          ]}
          data={withdrawals} getRowId={w => w.id}
          searchable searchKeys={["destination","category_name"]} searchPlaceholder="Buscar retiro..."
          toolbarExtra={
            <PrimaryButton onClick={() => setModal("withdrawal")} data-testid="register-withdrawal-btn-2">
              + Registrar retiro
            </PrimaryButton>
          }
          rowActions={w => [
            { label:"Eliminar", icon:Trash2, danger:true, onClick:() => {
              if (window.confirm("¿Eliminar este retiro?")) deleteWithdrawalMutation.mutate(w.id)
            }},
          ]}
          emptyIcon={Inbox} emptyTitle="Sin retiros registrados"
          emptyDesc="Registrá un retiro con el botón de arriba."
          testId="withdrawals-table" />
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
                color:"#D97706", fontSize:"13px", marginBottom:"16px" }}>
                ⚠️ Los porcentajes suman {total.toFixed(1)}% — deberían sumar 100%.
              </div>
            ) : null
          })()}

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:"14px" }}>
            {categories.length===0 ? (
              <div style={{ gridColumn:"1/-1", padding:"48px", textAlign:"center",
                color:"var(--text-3)", fontSize:"14px", background:"var(--surface)",
                border:"1px solid var(--border)", borderRadius:"var(--r-xl)" }}>
                Sin categorías. Creá la primera con el botón &quot;+ Nueva categoría&quot;.
              </div>
            ) : categories.map(cat => (
              <div key={cat.id} className="au-acard">
                <div className="au-acard__strip" style={{ background:`linear-gradient(135deg, ${cat.color}55, transparent 68%)` }} />
                <div className="au-acard__head">
                  <span className="au-acard__tag">
                    {cat.icon} {cat.cat_type==="fixed" ? "Costo real"
                      : cat.cat_type==="percent" ? `${cat.percentage}% venta` : "Utilidad neta"}
                  </span>
                  <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color: cat.is_active ? "#1AFF6E" : "#8c8c8c" }}>
                    <span className="au-acard__dot" style={{ background: cat.is_active ? "#1AFF6E" : "#6b6b6b" }} />
                    {cat.is_active ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <p className="au-acard__title">{cat.name}</p>
                <div className="au-acard__foot">
                  <span className="au-acard__price" style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, fontFamily:"monospace" }}>
                    <span style={{ width:14, height:14, borderRadius:"50%", background:cat.color, flexShrink:0 }} /> {cat.color}
                  </span>
                  <div className="au-acard__actions">
                    <button onClick={() => setModal({ type:"edit-category", item:cat })} title="Editar"
                      className="au-pill-btn au-pill-btn--edit" style={{ flex:"none", padding:"8px 10px" }}><Pencil size={13} /></button>
                    <button title="Eliminar"
                      onClick={() => { if (window.confirm(`¿Eliminar "${cat.name}"?`)) deleteCatMutation.mutate(cat.id) }}
                      className="au-pill-btn au-pill-btn--del" style={{ flex:"none", padding:"8px 10px" }}><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── POR PRODUCTO ── */}
      {tab==="by_product" && (
        <DataTable
          columns={[
            { key:"product_name", header:"Producto", sortable:true, render:p => (
              <div>
                <p style={{ fontSize:"13px", fontWeight:600, color:"var(--admin-text)" }}>{p.product_name}</p>
                {p.sku && <p style={{ fontSize:"11px", color:"var(--admin-text-muted)",
                  fontFamily:"monospace" }}>{p.sku}</p>}
              </div>
            )},
            { key:"units_sold", header:"Vendidos", sortable:true, align:"right",
              render:p => <span style={{ color:"var(--admin-text)" }}>{p.units_sold} u.</span> },
            { key:"total_revenue", header:"Ingreso total", sortable:true, align:"right",
              render:p => <span style={{ color:"var(--admin-primary-text)", fontWeight:600 }}>{fmt(p.total_revenue)}</span> },
            { key:"total_cost", header:"Costo total", sortable:true, align:"right",
              render:p => <span style={{ color:"var(--admin-danger)" }}>{fmt(p.total_cost)}</span> },
            { key:"profit", header:"Utilidad real", sortable:true, align:"right", render:p => (
              <div style={{ textAlign:"right" }}>
                <p style={{ fontSize:"13px", fontWeight:700,
                  color: p.profit >= 0 ? "var(--admin-primary-text)" : "var(--admin-danger)" }}>{fmt(p.profit)}</p>
                <p style={{ fontSize:"11px", color:"var(--admin-text-muted)" }}>{p.margin}% margen</p>
              </div>
            )},
          ]}
          data={incomeByProduct?.results || []} getRowId={r => r.product_id ?? r.sku ?? r.product_name}
          searchable searchKeys={["product_name","sku"]} searchPlaceholder="Buscar producto..."
          emptyIcon={Inbox} emptyTitle="Sin datos todavía"
          emptyDesc="Aparecen al aprobarse pagos con órdenes reales."
          testId="by-product-table" />
      )}
    </div>
  )
}

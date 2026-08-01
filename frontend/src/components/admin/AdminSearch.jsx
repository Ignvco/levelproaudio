// components/admin/AdminSearch.jsx — Buscador global del panel (command palette)
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Search, X, ShoppingBag, Package, Users, CornerDownLeft } from "lucide-react"
import { getAdminProducts, getAdminOrders, getAdminUsers } from "../../api/admin.api"

const clp = n => `$${Math.round(n||0).toLocaleString("es-CL")}`

export default function AdminSearch({ open, onClose }) {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState({ products: [], orders: [], users: [] })
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 60); setQ(""); setRes({ products:[], orders:[], users:[] }) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < 2) { setRes({ products:[], orders:[], users:[] }); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const [p, o, u] = await Promise.allSettled([
          getAdminProducts({ search: term, page_size: 5 }),
          getAdminOrders({ search: term, page_size: 5 }),
          getAdminUsers({ search: term, page_size: 5 }),
        ])
        const arr = v => Array.isArray(v) ? v : (v?.results || [])
        setRes({
          products: p.status === "fulfilled" ? arr(p.value).slice(0, 5) : [],
          orders:   o.status === "fulfilled" ? arr(o.value).slice(0, 5) : [],
          users:    u.status === "fulfilled" ? arr(u.value).slice(0, 5) : [],
        })
      } finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, open])

  if (!open) return null

  const go = path => { onClose(); navigate(path) }
  const total = res.products.length + res.orders.length + res.users.length

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      data-testid="admin-search-overlay"
      style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(10,12,16,0.55)",
        backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-start", justifyContent:"center",
        padding:"12vh 20px 20px" }}>
      <div style={{ width:"100%", maxWidth:"600px", background:"#fff", borderRadius:"20px",
        boxShadow:"0 30px 70px rgba(0,0,0,0.3)", overflow:"hidden", animation:"scaleIn 180ms ease" }}>
        {/* Input */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"18px 20px",
          borderBottom:"1px solid #ECEEF2" }}>
          <Search size={20} style={{ color:"#98A2B3", flexShrink:0 }} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            data-testid="admin-search-input"
            placeholder="Buscar pedidos, productos o usuarios…"
            style={{ flex:1, border:"none", outline:"none", fontSize:"16px", color:"#14161A",
              background:"transparent", padding:0, boxShadow:"none" }} />
          <button onClick={onClose} aria-label="Cerrar" style={{ background:"#F3F4F6", border:"none",
            borderRadius:"8px", width:"28px", height:"28px", display:"flex", alignItems:"center",
            justifyContent:"center", cursor:"pointer", color:"#6B7280" }}>
            <X size={15} />
          </button>
        </div>

        {/* Resultados */}
        <div style={{ maxHeight:"56vh", overflowY:"auto", padding:"8px" }}>
          {q.trim().length < 2 && (
            <p style={{ padding:"28px", textAlign:"center", fontSize:"13px", color:"#98A2B3" }}>
              Escribí al menos 2 caracteres para buscar.</p>
          )}
          {q.trim().length >= 2 && loading && (
            <p style={{ padding:"28px", textAlign:"center", fontSize:"13px", color:"#98A2B3" }}>Buscando…</p>
          )}
          {q.trim().length >= 2 && !loading && total === 0 && (
            <p style={{ padding:"28px", textAlign:"center", fontSize:"13px", color:"#98A2B3" }}>
              Sin resultados para “{q}”.</p>
          )}

          <Group title="Productos" show={res.products.length}>
            {res.products.map(p => (
              <Row key={`p${p.id}`} Icon={Package} onClick={() => go(`/admin/products?highlight=${p.id}`)}
                testId={`search-product-${p.id}`}
                main={p.name} sub={p.brand?.name || p.sku || "Producto"} right={clp(p.price)} />
            ))}
          </Group>
          <Group title="Pedidos" show={res.orders.length}>
            {res.orders.map(o => (
              <Row key={`o${o.id}`} Icon={ShoppingBag} onClick={() => go(`/admin/orders?id=${o.id}`)}
                testId={`search-order-${o.id}`}
                main={`#${o.short_id || String(o.id).slice(0,8)}`}
                sub={o.user_name || o.email || o.user_email || o.status} right={clp(o.total)} />
            ))}
          </Group>
          <Group title="Usuarios" show={res.users.length}>
            {res.users.map(u => (
              <Row key={`u${u.id}`} Icon={Users} onClick={() => go(`/admin/users?q=${encodeURIComponent(u.email)}`)}
                testId={`search-user-${u.id}`}
                main={[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                sub={u.email} right={u.is_staff ? "Staff" : "Cliente"} />
            ))}
          </Group>
        </div>

        <div style={{ padding:"10px 18px", borderTop:"1px solid #ECEEF2", display:"flex",
          alignItems:"center", gap:"8px", fontSize:"11.5px", color:"#98A2B3" }}>
          <CornerDownLeft size={13} /> Enter para abrir · Esc para cerrar
        </div>
      </div>
    </div>
  )
}

const Group = ({ title, show, children }) => !show ? null : (
  <div style={{ marginBottom:"6px" }}>
    <p style={{ fontSize:"10.5px", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
      color:"#98A2B3", padding:"10px 12px 4px" }}>{title}</p>
    {children}
  </div>
)

const Row = ({ Icon, main, sub, right, onClick, testId }) => (
  <button onClick={onClick} data-testid={testId}
    style={{ display:"flex", alignItems:"center", gap:"12px", width:"100%", padding:"10px 12px",
      borderRadius:"12px", border:"none", background:"transparent", cursor:"pointer", textAlign:"left" }}
    onMouseEnter={e => e.currentTarget.style.background = "#F4F5F7"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
    <span style={{ width:"36px", height:"36px", borderRadius:"10px", background:"rgba(26,255,110,0.12)",
      color:"#0F9940", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <Icon size={17} />
    </span>
    <div style={{ flex:1, minWidth:0 }}>
      <p style={{ fontSize:"13.5px", fontWeight:600, color:"#14161A", overflow:"hidden",
        textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{main}</p>
      <p style={{ fontSize:"11.5px", color:"#98A2B3", overflow:"hidden",
        textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sub}</p>
    </div>
    {right && <span style={{ fontSize:"12.5px", fontWeight:700, color:"#5B6472", flexShrink:0 }}>{right}</span>}
  </button>
)

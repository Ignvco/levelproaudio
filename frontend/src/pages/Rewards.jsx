// pages/Rewards.jsx — Página pública del módulo LevelPro Rewards
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Trophy, Users, Ticket, ArrowRight, X, Plus, Minus, CreditCard, Globe, ShieldCheck } from "lucide-react"
import { getActiveCampaigns, getPublicWinners, buyStickers } from "../api/rewards.api"
import { createPayment } from "../api/payments.api"
import { useAuthStore } from "../store/authStore"
import { showToast } from "../components/ui/ToastNotification"
import { mediaUrl } from "../utils/mediaUrl"
import ProductCard from "../components/product/ProductCard"
import Seo from "../components/Seo"

const clp = (n) => new Intl.NumberFormat("es-CL", {
  style: "currency", currency: "CLP", maximumFractionDigits: 0,
}).format(Number(n || 0))

// ─────────────────────────────────────────────────────────────
// Section eyebrow + title (mismo patrón editorial que Home)
// ─────────────────────────────────────────────────────────────
function SectionEyebrow({ children }) {
  return (
    <p style={{
      fontFamily: "var(--font-sans)", fontSize: "11px",
      color: "var(--accent)", textTransform: "uppercase",
      letterSpacing: "0.15em", marginBottom: "12px", fontWeight: 700,
    }}>
      {children}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────
// Countdown hook
// ─────────────────────────────────────────────────────────────
function useCountdown(targetIso) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(targetIso).getTime() - Date.now())
  )
  useEffect(() => {
    const id = setInterval(() =>
      setRemaining(Math.max(0, new Date(targetIso).getTime() - Date.now())),
      1000
    )
    return () => clearInterval(id)
  }, [targetIso])
  const s = Math.floor(remaining / 1000)
  return {
    days:    Math.floor(s / 86400),
    hours:   Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    isDone:  remaining <= 0,
  }
}

// ─────────────────────────────────────────────────────────────
// Countdown block
// ─────────────────────────────────────────────────────────────
function Countdown({ target }) {
  const { days, hours, minutes, seconds, isDone } = useCountdown(target)
  if (isDone) {
    return (
      <div data-testid="countdown-finished" style={{
        display:"inline-block", padding:"10px 22px",
        borderRadius:"var(--r-full)",
        background:"rgba(26,255,110,0.1)",
        border:"1px solid rgba(26,255,110,0.3)",
        color:"var(--accent)", fontSize:"13px", fontWeight:600,
        letterSpacing:"0.06em", textTransform:"uppercase",
      }}>
        Sorteo realizado
      </div>
    )
  }
  const boxSt = {
    minWidth:"64px", padding:"14px 12px",
    background:"rgba(255,255,255,0.04)",
    border:"1px solid rgba(255,255,255,0.08)",
    borderRadius:"var(--r-lg)",
    textAlign:"center",
  }
  const numSt = {
    fontFamily:"var(--font-display)",
    fontSize:"clamp(1.8rem, 4vw, 2.6rem)",
    fontWeight:800, color:"#fff", lineHeight:1,
    letterSpacing:"-0.03em",
    fontVariantNumeric:"tabular-nums",
  }
  const labelSt = {
    fontSize:"10px", color:"var(--text-3)",
    marginTop:"6px", textTransform:"uppercase", letterSpacing:"0.1em",
  }
  return (
    <div data-testid="countdown" style={{
      display:"inline-flex", gap:"10px", alignItems:"center",
    }}>
      {[
        {v:days,    l:"Días"},
        {v:hours,   l:"Horas"},
        {v:minutes, l:"Min"},
        {v:seconds, l:"Seg"},
      ].map(({v,l}) => (
        <div key={l} style={boxSt}>
          <p style={numSt}>{String(v).padStart(2,"0")}</p>
          <p style={labelSt}>{l}</p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Modal de compra de stickers
// ─────────────────────────────────────────────────────────────
const PROVIDERS = [
  { id: "mercadopago_cl", label: "MercadoPago", Icon: CreditCard, desc: "Tarjetas, Khipu, efectivo" },
  { id: "paypal",         label: "PayPal",      Icon: Globe,      desc: "Tarjetas internacionales" },
]

function StickerModal({ campaign, onClose }) {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const price = Number(campaign.sticker_price || 0)
  const total = price * qty

  const setQtySafe = (v) => setQty(Math.max(1, Math.min(1000, v || 1)))

  const handleBuy = async (provider) => {
    if (!isAuthenticated) {
      showToast("Iniciá sesión para participar", "error")
      navigate("/login")
      return
    }
    try {
      setLoading(true)
      const res = await buyStickers(campaign.slug, qty)
      const pay = await createPayment(res.order_id, provider)
      const url = pay.init_point || pay.approve_url
      if (url) { window.location.href = url; return }
      showToast("No se pudo iniciar el pago. Intentá de nuevo.", "error")
      setLoading(false)
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || "Error al iniciar la compra."
      showToast(msg, "error")
      setLoading(false)
    }
  }

  return (
    <div data-testid="sticker-modal" onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#111", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "24px", padding: "28px", width: "100%", maxWidth: "440px",
        maxHeight: "88vh", overflowY: "auto", position: "relative",
      }}>
        <button data-testid="sticker-modal-close" onClick={onClose} aria-label="Cerrar" style={{
          position: "absolute", top: "18px", right: "18px", width: "34px", height: "34px",
          borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none",
          color: "var(--text-2)", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}><X size={17} /></button>

        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
          textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
          Comprar stickers
        </p>
        <h3 className="display-bold" style={{ fontFamily: "var(--font-display)",
          fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em",
          color: "#fff", marginBottom: "4px" }}>
          {campaign.name}
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-3)", marginBottom: "22px" }}>
          Cada sticker = 1 ticket para el sorteo. {clp(price)} c/u
        </p>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderRadius: "16px", background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)", marginBottom: "10px" }}>
          <span style={{ fontSize: "14px", color: "var(--text-2)", fontWeight: 600 }}>Cantidad</span>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button data-testid="sticker-minus" onClick={() => setQtySafe(qty - 1)} style={stepBtn}>
              <Minus size={16} />
            </button>
            <input data-testid="sticker-qty" type="number" min={1} max={1000} value={qty}
              onChange={e => setQtySafe(parseInt(e.target.value || "1", 10))}
              style={{ width: "56px", textAlign: "center", background: "transparent",
                border: "none", color: "#fff", fontSize: "20px", fontWeight: 800,
                outline: "none", fontFamily: "var(--font-display)" }} />
            <button data-testid="sticker-plus" onClick={() => setQtySafe(qty + 1)} style={stepBtn}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Quick picks */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          {[1, 3, 5, 10].map(n => (
            <button key={n} onClick={() => setQtySafe(n)} style={{
              flex: 1, padding: "8px", borderRadius: "10px", cursor: "pointer",
              background: qty === n ? "rgba(26,255,110,0.12)" : "rgba(255,255,255,0.04)",
              border: qty === n ? "1px solid rgba(26,255,110,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: qty === n ? "var(--accent)" : "var(--text-2)", fontSize: "13px", fontWeight: 700,
            }}>+{n}</button>
          ))}
        </div>

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
          padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "20px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-3)" }}>{qty} ticket{qty > 1 ? "s" : ""}</span>
          <span data-testid="sticker-total" style={{ fontFamily: "var(--font-display)",
            fontSize: "1.8rem", fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.02em" }}>
            {clp(total)}
          </span>
        </div>

        {/* Providers */}
        <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "10px", fontWeight: 600 }}>
          Elegí cómo pagar:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {PROVIDERS.map(({ id, label, Icon, desc }) => (
            <button key={id} data-testid={`sticker-pay-${id}`} disabled={loading}
              onClick={() => handleBuy(id)}
              style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%",
                padding: "14px 16px", borderRadius: "14px", cursor: loading ? "wait" : "pointer",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", textAlign: "left", opacity: loading ? 0.6 : 1,
                transition: "border-color 160ms" }}
              onMouseEnter={e => !loading && (e.currentTarget.style.borderColor = "rgba(26,255,110,0.4)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}>
              <Icon size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: "14px", fontWeight: 700 }}>{label}</span>
                <span style={{ display: "block", fontSize: "12px", color: "var(--text-3)" }}>{desc}</span>
              </span>
              <ArrowRight size={16} style={{ color: "var(--text-3)" }} />
            </button>
          ))}
        </div>

        <p style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center",
          fontSize: "12px", color: "var(--text-3)", marginTop: "18px" }}>
          <ShieldCheck size={14} style={{ color: "var(--accent)" }} />
          {loading ? "Redirigiendo al pago…" : "Los tickets aparecen en tu cuenta al confirmarse el pago."}
        </p>
      </div>
    </div>
  )
}

const stepBtn = {
  width: "34px", height: "34px", borderRadius: "10px", cursor: "pointer",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export default function Rewards() {
  const [modalCampaign, setModalCampaign] = useState(null)
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["rewards", "campaigns"],
    queryFn:  getActiveCampaigns,
  })
  const { data: winners = [] } = useQuery({
    queryKey: ["rewards", "winners"],
    queryFn:  getPublicWinners,
  })

  const featured = campaigns[0]

  if (isLoading) {
    return (
      <div style={{ padding:"160px 24px", textAlign:"center" }}>
        <p style={{ color:"var(--text-3)" }}>Cargando campañas…</p>
      </div>
    )
  }

  return (
    <div
      data-testid="rewards-page"
      style={{
        background:"var(--bg)", minHeight:"100vh",
        paddingTop:"clamp(96px, 12vw, 150px)",
        paddingBottom:"clamp(80px, 10vw, 120px)",
      }}>
      <Seo title="Rewards" description="Participá en los sorteos de LevelPro Audio comprando stickers. Cada sticker es un ticket. ¡Ganá equipamiento profesional!" />
      <div className="lp-container lp-sections">

        {/* ═══════════ HERO ═══════════ */}
        <section data-testid="rewards-hero" style={{ padding:0 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:"10px",
            padding:"7px 16px", borderRadius:"var(--r-full)",
            background:"rgba(26,255,110,0.08)",
            border:"1px solid rgba(26,255,110,0.2)",
            marginBottom:"24px",
          }}>
            <span style={{ width:"7px", height:"7px", borderRadius:"50%",
              background:"var(--accent)",
              animation:"lp-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize:"12px", fontWeight:700,
              color:"var(--accent)", letterSpacing:"0.1em",
              textTransform:"uppercase" }}>
              LevelPro Rewards
            </span>
          </div>

          <h1 data-testid="rewards-hero-title" className="display-bold" style={{
            fontFamily:"var(--font-display)",
            fontSize:"clamp(2.4rem, 5.4vw, 4.4rem)",
            fontWeight:800, letterSpacing:"-0.03em",
            lineHeight:1.02, marginBottom:"22px",
            maxWidth:"820px", color:"var(--text)",
          }}>
            Comprá y participá por{" "}
            <span style={{ color:"var(--accent)", fontStyle:"italic", fontWeight:600 }}>
              premios reales
            </span>.
          </h1>

          <p style={{ fontFamily:"var(--font-sans)",
            fontSize:"clamp(15px, 2vw, 18px)",
            color:"var(--text-2)", lineHeight:1.6, maxWidth:"600px" }}>
            Comprá stickers para participar en nuestros sorteos. Cada sticker es
            un ticket con código único que sumás a tu cuenta. Mientras más
            stickers, más chances de ganar.
          </p>

          {!featured && (
            <div style={{ marginTop:"36px", padding:"40px 32px",
              background:"var(--surface)",
              borderRadius:"var(--r-2xl)", border:"1px solid var(--border)",
              textAlign:"center", maxWidth:"520px" }}>
              <p style={{ fontSize:"15px", color:"var(--text-2)" }}>
                No hay campañas activas en este momento.
                <br/>
                <span style={{ fontSize:"13px", color:"var(--text-3)" }}>
                  Muy pronto vamos a lanzar el próximo sorteo.
                </span>
              </p>
            </div>
          )}
        </section>

        {/* ═══════════ CAMPAÑA DESTACADA ═══════════ */}
        {featured && (
          <section data-testid="rewards-featured" style={{ padding:0 }}>
            <div style={{
              position:"relative",
              background: featured.banner
                ? `linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.9) 100%), url(${mediaUrl(featured.banner)})`
                : `linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)`,
              backgroundSize:"cover", backgroundPosition:"center",
              borderRadius:"var(--r-2xl)",
              border:"1px solid var(--border)",
              padding:"clamp(40px, 6vw, 72px) clamp(28px, 5vw, 56px)",
              overflow:"hidden",
            }}>
              {/* Halo verde neón */}
              <div style={{
                position:"absolute", top:"-20%", right:"-10%",
                width:"400px", height:"400px", borderRadius:"50%",
                background:"radial-gradient(circle, rgba(26,255,110,0.15) 0%, transparent 60%)",
                filter:"blur(60px)", pointerEvents:"none",
              }} />

              <div style={{ position:"relative", maxWidth:"720px" }}>
                <SectionEyebrow>· Campaña activa</SectionEyebrow>

                <h2 data-testid="featured-campaign-name" className="display-bold" style={{
                  fontFamily:"var(--font-display)",
                  fontSize:"clamp(1.9rem, 4vw, 3.2rem)",
                  fontWeight:800, letterSpacing:"-0.03em",
                  lineHeight:1.04, marginBottom:"20px", color:"#fff",
                }}>
                  {featured.name}
                </h2>

                <p style={{ display:"inline-flex", alignItems:"center", gap:"10px",
                  fontSize:"clamp(16px, 2.2vw, 20px)", color:"#fff", fontWeight:600,
                  marginBottom:"12px" }}>
                  <Trophy size={22} color="var(--accent)" strokeWidth={2} />
                  <span>
                    <span style={{ color:"var(--accent)" }}>Premio:</span>{" "}
                    {featured.main_prize}
                  </span>
                </p>

                {featured.description && (
                  <p style={{ fontSize:"15px", color:"var(--text-2)",
                    lineHeight:1.7, marginBottom:"32px", maxWidth:"600px" }}>
                    {featured.description}
                  </p>
                )}

                {featured.show_counter && (
                  <div style={{ marginBottom:"32px" }}>
                    <p style={{ fontSize:"11px", color:"var(--text-3)",
                      marginBottom:"12px", letterSpacing:"0.1em",
                      textTransform:"uppercase", fontWeight:700 }}>
                      Sorteo en
                    </p>
                    <Countdown target={featured.draw_date} />
                  </div>
                )}

                <div style={{ display:"flex", gap:"20px",
                  alignItems:"center", flexWrap:"wrap" }}>
                  <button onClick={() => setModalCampaign(featured)} data-testid="rewards-cta-buy"
                    style={{
                      display:"inline-flex", alignItems:"center", gap:"10px",
                      padding:"14px 12px 14px 24px", borderRadius:"var(--r-full)",
                      background:"var(--accent)", color:"#000", border:"none", cursor:"pointer",
                      fontSize:"14px", fontWeight:700,
                      fontFamily:"var(--font-sans)",
                      boxShadow:"0 8px 30px rgba(26,255,110,0.3)",
                      transition:"transform 200ms var(--ease)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)" }}>
                    Comprar y participar · {clp(featured.sticker_price)} c/u
                    <span style={{ width:"26px", height:"26px", borderRadius:"50%",
                      background:"#000", color:"var(--accent)", display:"flex",
                      alignItems:"center", justifyContent:"center" }}>
                      <ArrowRight size={14} />
                    </span>
                  </button>
                  <div style={{ display:"flex", gap:"18px",
                    fontSize:"13px", color:"var(--text-3)" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:"6px" }}>
                      <Users size={15} /> {featured.total_participants} participantes
                    </span>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:"6px" }}>
                      <Ticket size={15} /> {featured.total_entries} tickets vendidos
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* El premio (ProductCard del producto a sortear) */}
            {featured.prize_product && (
              <div data-testid="rewards-prize-product" style={{ marginTop:"clamp(48px, 6vw, 80px)" }}>
                <div style={{ display:"grid",
                  gridTemplateColumns:"minmax(0, 1fr) minmax(300px, 380px)",
                  gap:"clamp(28px, 4vw, 56px)", alignItems:"center" }}
                  className="rewards-prize-grid">
                  <div>
                    <SectionEyebrow>· El premio</SectionEyebrow>
                    <h3 className="display-bold" style={{ fontFamily:"var(--font-display)",
                      fontSize:"clamp(1.8rem, 3.2vw, 2.8rem)", fontWeight:800,
                      letterSpacing:"-0.03em", lineHeight:1.02, color:"var(--text)",
                      marginBottom:"16px" }}>
                      Esto es lo que te podés ganar
                    </h3>
                    <p style={{ fontSize:"15px", color:"var(--text-2)", lineHeight:1.7,
                      maxWidth:"460px", marginBottom:"24px" }}>
                      {featured.prize_product.name} — el mismo producto de nuestro catálogo.
                      Comprá tus stickers y participá por él.
                    </p>
                    <button onClick={() => setModalCampaign(featured)}
                      data-testid="rewards-prize-cta"
                      style={{ display:"inline-flex", alignItems:"center", gap:"10px",
                        padding:"13px 12px 13px 22px", borderRadius:"var(--r-full)",
                        background:"var(--accent)", color:"#000", border:"none", cursor:"pointer",
                        fontSize:"14px", fontWeight:700,
                        boxShadow:"0 8px 30px rgba(26,255,110,0.28)" }}>
                      Participar por este premio
                      <span style={{ width:"26px", height:"26px", borderRadius:"50%",
                        background:"#000", color:"var(--accent)", display:"flex",
                        alignItems:"center", justifyContent:"center" }}>
                        <ArrowRight size={14} />
                      </span>
                    </button>
                  </div>
                  <div>
                    <ProductCard product={featured.prize_product} />
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginTop:"clamp(48px, 6vw, 80px)" }}>
              <div style={{ marginBottom:"var(--content-gap)" }}>
                <SectionEyebrow>· Cómo funciona</SectionEyebrow>
                <h3 className="display-bold" style={{ fontFamily:"var(--font-display)",
                  fontSize:"clamp(1.6rem, 2.4vw, 2.2rem)", fontWeight:800,
                  letterSpacing:"-0.03em", lineHeight:1, color:"var(--text)" }}>
                  Participar es simple
                </h3>
              </div>
              <div style={{ display:"grid",
                gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",
                gap:"var(--card-gap)" }}>
                {[
                  { n:"1", t:"Comprá tus stickers", d:`Elegí cuántos stickers querés. Cada uno cuesta ${clp(featured.sticker_price)} y equivale a 1 ticket.` },
                  { n:"2", t:"Recibí tus tickets", d:"Al confirmarse el pago, tus tickets con código único aparecen en tu cuenta." },
                  { n:"3", t:"Participá del sorteo", d:`El ${new Date(featured.draw_date).toLocaleDateString("es-CL",{day:"numeric",month:"long"})} sorteamos: ${featured.main_prize}.` },
                ].map(step => (
                  <div key={step.n} style={{ padding:"24px",
                    background:"var(--surface)", border:"1px solid var(--border)",
                    borderRadius:"var(--r-xl)" }}>
                    <span style={{ display:"inline-flex", alignItems:"center",
                      justifyContent:"center", width:"38px", height:"38px",
                      borderRadius:"50%", background:"rgba(26,255,110,0.12)",
                      border:"1px solid rgba(26,255,110,0.3)", color:"var(--accent)",
                      fontFamily:"var(--font-display)", fontWeight:800, fontSize:"17px",
                      marginBottom:"16px" }}>{step.n}</span>
                    <p style={{ fontSize:"16px", fontWeight:700, color:"var(--text)",
                      marginBottom:"8px" }}>{step.t}</p>
                    <p style={{ fontSize:"13.5px", color:"var(--text-2)", lineHeight:1.6 }}>
                      {step.d}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:"28px" }}>
                <button onClick={() => setModalCampaign(featured)} data-testid="rewards-cta-buy-2"
                  style={{ display:"inline-flex", alignItems:"center", gap:"10px",
                    padding:"14px 12px 14px 24px", borderRadius:"var(--r-full)",
                    background:"var(--accent)", color:"#000", border:"none", cursor:"pointer",
                    fontSize:"14px", fontWeight:700,
                    boxShadow:"0 8px 30px rgba(26,255,110,0.3)" }}>
                  Comprar stickers
                  <span style={{ width:"26px", height:"26px", borderRadius:"50%",
                    background:"#000", color:"var(--accent)", display:"flex",
                    alignItems:"center", justifyContent:"center" }}>
                    <ArrowRight size={14} />
                  </span>
                </button>
              </div>
            </div>

            {/* Bases legales */}
            {featured.legal_terms && (
              <details style={{ marginTop:"clamp(40px, 5vw, 64px)",
                padding:"22px 26px", background:"var(--surface)",
                border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
                cursor:"pointer" }}>
                <summary style={{ fontSize:"14px", fontWeight:600,
                  color:"var(--text)", cursor:"pointer", userSelect:"none" }}>
                  Bases y condiciones
                </summary>
                <p style={{ marginTop:"14px", fontSize:"13px",
                  color:"var(--text-2)", lineHeight:1.7,
                  whiteSpace:"pre-wrap" }}>
                  {featured.legal_terms}
                </p>
              </details>
            )}
          </section>
        )}

        {/* ═══════════ OTRAS CAMPAÑAS ACTIVAS ═══════════ */}
        {campaigns.length > 1 && (
          <section data-testid="rewards-more" style={{ padding:0 }}>
            <div style={{ marginBottom:"var(--content-gap)" }}>
              <SectionEyebrow>· Más sorteos</SectionEyebrow>
              <h3 className="display-bold" style={{ fontFamily:"var(--font-display)",
                fontSize:"clamp(1.6rem, 2.4vw, 2.2rem)", fontWeight:800,
                letterSpacing:"-0.03em", lineHeight:1, color:"var(--text)" }}>
                Más campañas activas
              </h3>
            </div>
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",
              gap:"var(--card-gap)",
            }}>
              {campaigns.slice(1).map(c => (
                <div key={c.id} data-testid={`rewards-campaign-${c.id}`} style={{
                  padding:"24px", background:"var(--surface)",
                  border:"1px solid var(--border)",
                  borderRadius:"var(--r-xl)",
                  transition:"border-color 300ms var(--ease), transform 300ms var(--ease)",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(26,255,110,0.28)"; e.currentTarget.style.transform = "translateY(-3px)" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)" }}>
                  <p style={{ fontSize:"11px", color:"var(--accent)",
                    letterSpacing:"0.1em", textTransform:"uppercase",
                    fontWeight:700, marginBottom:"12px" }}>
                    Sorteo · {new Date(c.draw_date).toLocaleDateString("es-CL",
                      { day:"numeric", month:"long" })}
                  </p>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:"18px",
                    fontWeight:700, letterSpacing:"-0.02em", marginBottom:"10px",
                    color:"var(--text)" }}>
                    {c.name}
                  </p>
                  <p style={{ display:"inline-flex", alignItems:"center", gap:"8px",
                    fontSize:"14px", color:"var(--text-2)" }}>
                    <Trophy size={15} color="var(--accent)" /> {c.main_prize}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════ GANADORES HISTÓRICOS ═══════════ */}
        {winners.length > 0 && (
          <section data-testid="rewards-winners" style={{ padding:0 }}>
            <div style={{ marginBottom:"var(--content-gap)" }}>
              <SectionEyebrow>· Historial</SectionEyebrow>
              <h3 data-testid="winners-history-title" className="display-bold" style={{
                fontFamily:"var(--font-display)",
                fontSize:"clamp(1.6rem, 2.4vw, 2.2rem)", fontWeight:800,
                letterSpacing:"-0.03em", lineHeight:1, marginBottom:"10px",
                color:"var(--text)" }}>
                Ganadores anteriores
              </h3>
              <p style={{ fontSize:"14px", color:"var(--text-3)" }}>
                Personas reales, premios reales. Sorteados frente a escribano digital.
              </p>
            </div>
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",
              gap:"var(--card-gap)",
            }}>
              {winners.filter(w => !w.is_backup).map(w => (
                <div key={w.id} data-testid={`winner-${w.id}`} style={{
                  padding:"20px", background:"var(--surface)",
                  border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
                  display:"flex", gap:"14px", alignItems:"center",
                }}>
                  <div style={{
                    width:"46px", height:"46px", borderRadius:"50%",
                    background:"rgba(26,255,110,0.1)",
                    border:"1px solid rgba(26,255,110,0.2)",
                    color:"var(--accent)", flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <Trophy size={20} strokeWidth={2} />
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:"15px", fontWeight:600,
                      color:"var(--text)", marginBottom:"3px" }}>
                      {w.name}
                    </p>
                    <p style={{ fontSize:"12px", color:"var(--text-3)",
                      overflow:"hidden", textOverflow:"ellipsis",
                      whiteSpace:"nowrap" }}>
                      {w.prize}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
      {modalCampaign && (
        <StickerModal campaign={modalCampaign} onClose={() => setModalCampaign(null)} />
      )}
      <style>{`
        @media (max-width: 820px) {
          .rewards-prize-grid { grid-template-columns: 1fr !important; }
          .rewards-prize-grid > div:last-child { max-width: 380px; }
        }
      `}</style>
    </div>
  )
}

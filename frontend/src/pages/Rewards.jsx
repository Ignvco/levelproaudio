// pages/Rewards.jsx — Página pública del módulo LevelPro Rewards
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Trophy, Users, Ticket, ArrowRight } from "lucide-react"
import { getActiveCampaigns, getPublicWinners } from "../api/rewards.api"
import { mediaUrl } from "../utils/mediaUrl"
import ProductCard from "../components/product/ProductCard"

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
// Product card en campaña — usa el ProductCard compartido
// + badge de tickets (info propia de Rewards)
// ─────────────────────────────────────────────────────────────
function RewardProductCard({ product }) {
  const mapped = { ...product, primary_image: product.image }
  return (
    <div style={{ position:"relative" }}>
      <ProductCard product={mapped} />
      {product.entries_per_purchase != null && (
        <span
          data-testid={`reward-tickets-${product.slug}`}
          style={{
            position:"absolute", top:"24px", right:"24px", zIndex:5,
            display:"inline-flex", alignItems:"center", gap:"5px",
            fontSize:"12px", padding:"6px 12px", borderRadius:"9999px",
            background:"var(--accent)", color:"#000", fontWeight:700,
            boxShadow:"0 4px 14px rgba(26,255,110,0.35)",
          }}>
          <Ticket size={13} strokeWidth={2.5} />
          +{product.entries_per_purchase} tickets
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export default function Rewards() {
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
            Cada compra suma participaciones para nuestros sorteos mensuales.
            Sin cargos extra. Sin trampas. Solo comprá lo que te sirve y sumás.
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
                  <Link to="/shop" data-testid="rewards-cta-shop"
                    style={{
                      display:"inline-flex", alignItems:"center", gap:"10px",
                      padding:"14px 12px 14px 24px", borderRadius:"var(--r-full)",
                      background:"var(--accent)", color:"#000",
                      fontSize:"14px", fontWeight:700, textDecoration:"none",
                      fontFamily:"var(--font-sans)",
                      boxShadow:"0 8px 30px rgba(26,255,110,0.3)",
                      transition:"transform 200ms var(--ease)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)" }}>
                    Comprar y participar
                    <span style={{ width:"26px", height:"26px", borderRadius:"50%",
                      background:"#000", color:"var(--accent)", display:"flex",
                      alignItems:"center", justifyContent:"center" }}>
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                  <div style={{ display:"flex", gap:"18px",
                    fontSize:"13px", color:"var(--text-3)" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:"6px" }}>
                      <Users size={15} /> {featured.total_participants} participantes
                    </span>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:"6px" }}>
                      <Ticket size={15} /> {featured.total_entries} participaciones
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Productos participantes */}
            {featured.products?.length > 0 && (
              <div style={{ marginTop:"clamp(48px, 6vw, 80px)" }}>
                <div className="section-header-flex" style={{
                  display:"flex", justifyContent:"space-between",
                  alignItems:"flex-end", marginBottom:"var(--content-gap)",
                  flexWrap:"wrap", gap:"16px" }}>
                  <div>
                    <SectionEyebrow>· Participantes</SectionEyebrow>
                    <h3 className="display-bold" style={{ fontFamily:"var(--font-display)",
                      fontSize:"clamp(1.6rem, 2.4vw, 2.2rem)",
                      fontWeight:800, letterSpacing:"-0.03em",
                      lineHeight:1, color:"var(--text)" }}>
                      Productos participantes
                    </h3>
                  </div>
                  <p style={{ fontSize:"13px", color:"var(--text-3)", maxWidth:"320px" }}>
                    Comprá cualquiera y sumás tickets automáticamente.
                  </p>
                </div>
                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(auto-fill, minmax(280px, 340px))",
                  gap:"var(--card-gap)",
                  justifyContent:"start",
                }} className="rewards-products-grid">
                  {featured.products.map(p => <RewardProductCard key={p.id} product={p} />)}
                </div>
              </div>
            )}

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
    </div>
  )
}

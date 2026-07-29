// pages/Rewards.jsx — Página pública del módulo LevelPro Rewards
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getActiveCampaigns, getPublicWinners } from "../api/rewards.api"
import { mediaUrl } from "../utils/mediaUrl"
import ProductCard from "../components/product/ProductCard"

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
    fontSize:"clamp(1.8rem, 4vw, 2.6rem)",
    fontWeight:600, color:"#fff", lineHeight:1,
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
// Product card en campaña — usa el ProductCard compartido (blanco)
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
            fontSize:"12px", padding:"6px 12px", borderRadius:"9999px",
            background:"var(--accent)", color:"#000", fontWeight:700,
            boxShadow:"0 4px 14px rgba(26,255,110,0.35)",
          }}>
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
      <div style={{ padding:"120px 24px", textAlign:"center" }}>
        <p style={{ color:"var(--text-3)" }}>Cargando campañas…</p>
      </div>
    )
  }

  return (
    <div style={{ background:"var(--bg)", minHeight:"100vh",
      paddingTop:"clamp(80px, 10vw, 120px)" }}>

      {/* ═══════════ HERO ═══════════ */}
      <section style={{
        maxWidth:"var(--container, 1200px)", margin:"0 auto",
        padding:"clamp(40px, 6vw, 80px) clamp(20px, 5vw, 60px)",
      }}>
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
          <span style={{ fontSize:"12px", fontWeight:600,
            color:"var(--accent)", letterSpacing:"0.08em",
            textTransform:"uppercase" }}>
            LevelPro Rewards
          </span>
        </div>

        <h1 data-testid="rewards-hero-title" style={{
          fontFamily:"var(--font-serif)",
          fontSize:"clamp(2.6rem, 6vw, 4.6rem)",
          fontWeight:300, letterSpacing:"-0.02em",
          lineHeight:1.05, marginBottom:"20px",
          maxWidth:"780px",
        }}>
          Comprá y participá<br/>
          por <span style={{ color:"var(--accent)" }}>premios reales</span>.
        </h1>

        <p style={{ fontSize:"clamp(15px, 2vw, 18px)",
          color:"var(--text-2)", lineHeight:1.6, maxWidth:"580px",
          marginBottom:"36px" }}>
          Cada compra suma participaciones para nuestros sorteos mensuales.
          Sin cargos extra. Sin trampas. Solo comprá lo que te sirve y sumás.
        </p>

        {!featured && (
          <div style={{ padding:"40px 32px", background:"var(--surface)",
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
        <section style={{
          maxWidth:"var(--container, 1200px)", margin:"0 auto",
          padding:"0 clamp(20px, 5vw, 60px) clamp(60px, 8vw, 100px)",
        }}>
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
              <p style={{ fontSize:"11px", fontWeight:600,
                color:"var(--accent)", letterSpacing:"0.14em",
                textTransform:"uppercase", marginBottom:"14px" }}>
                Campaña activa
              </p>

              <h2 data-testid="featured-campaign-name" style={{
                fontFamily:"var(--font-serif)",
                fontSize:"clamp(2rem, 4.5vw, 3.4rem)",
                fontWeight:300, letterSpacing:"-0.02em",
                lineHeight:1.08, marginBottom:"20px",
              }}>
                {featured.name}
              </h2>

              <p style={{ fontSize:"20px", color:"#fff", fontWeight:500,
                marginBottom:"12px" }}>
                🏆 <span style={{ color:"var(--accent)" }}>Premio:</span>{" "}
                {featured.main_prize}
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
                    textTransform:"uppercase", fontWeight:600 }}>
                    Sorteo en
                  </p>
                  <Countdown target={featured.draw_date} />
                </div>
              )}

              <div style={{ display:"flex", gap:"12px",
                alignItems:"center", flexWrap:"wrap" }}>
                <Link to="/shop" data-testid="rewards-cta-shop"
                  className="btn btn-accent"
                  style={{ padding:"14px 28px", fontSize:"14px" }}>
                  Comprar y participar →
                </Link>
                <div style={{ display:"flex", gap:"18px",
                  fontSize:"13px", color:"var(--text-3)" }}>
                  <span>👥 {featured.total_participants} participantes</span>
                  <span>🎫 {featured.total_entries} participaciones</span>
                </div>
              </div>
            </div>
          </div>

          {/* Productos participantes */}
          {featured.products?.length > 0 && (
            <div style={{ marginTop:"clamp(48px, 6vw, 80px)" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"end", marginBottom:"28px", flexWrap:"wrap", gap:"12px" }}>
                <h3 style={{ fontFamily:"var(--font-serif)",
                  fontSize:"clamp(1.5rem, 3vw, 2.2rem)",
                  fontWeight:300, letterSpacing:"-0.01em" }}>
                  Productos participantes
                </h3>
                <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
                  Comprá cualquiera y sumás tickets automáticamente.
                </p>
              </div>
              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))",
                gap:"24px",
              }}>
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
              <summary style={{ fontSize:"14px", fontWeight:500,
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
        <section style={{
          maxWidth:"var(--container, 1200px)", margin:"0 auto",
          padding:"0 clamp(20px, 5vw, 60px) clamp(60px, 8vw, 100px)",
        }}>
          <h3 style={{ fontFamily:"var(--font-serif)",
            fontSize:"clamp(1.4rem, 2.5vw, 2rem)", fontWeight:300,
            marginBottom:"28px", letterSpacing:"-0.01em" }}>
            Más campañas activas
          </h3>
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))",
            gap:"20px",
          }}>
            {campaigns.slice(1).map(c => (
              <div key={c.id} style={{
                padding:"24px", background:"var(--surface)",
                border:"1px solid var(--border)",
                borderRadius:"var(--r-xl)",
              }}>
                <p style={{ fontSize:"11px", color:"var(--accent)",
                  letterSpacing:"0.1em", textTransform:"uppercase",
                  fontWeight:600, marginBottom:"10px" }}>
                  Sorteo · {new Date(c.draw_date).toLocaleDateString("es-CL",
                    { day:"numeric", month:"long" })}
                </p>
                <p style={{ fontSize:"17px", fontWeight:500, marginBottom:"8px" }}>
                  {c.name}
                </p>
                <p style={{ fontSize:"14px", color:"var(--text-2)" }}>
                  🏆 {c.main_prize}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ GANADORES HISTÓRICOS ═══════════ */}
      {winners.length > 0 && (
        <section style={{
          maxWidth:"var(--container, 1200px)", margin:"0 auto",
          padding:"0 clamp(20px, 5vw, 60px) clamp(80px, 10vw, 120px)",
        }}>
          <h3 data-testid="winners-history-title" style={{
            fontFamily:"var(--font-serif)",
            fontSize:"clamp(1.6rem, 3vw, 2.4rem)", fontWeight:300,
            marginBottom:"8px", letterSpacing:"-0.01em" }}>
            Ganadores anteriores
          </h3>
          <p style={{ fontSize:"14px", color:"var(--text-3)",
            marginBottom:"32px" }}>
            Personas reales, premios reales. Sorteados frente a escribano digital.
          </p>
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))",
            gap:"14px",
          }}>
            {winners.filter(w => !w.is_backup).map(w => (
              <div key={w.id} style={{
                padding:"20px", background:"var(--surface)",
                border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
                display:"flex", gap:"14px", alignItems:"center",
              }}>
                <div style={{
                  width:"44px", height:"44px", borderRadius:"50%",
                  background:"rgba(26,255,110,0.1)",
                  border:"1px solid rgba(26,255,110,0.2)",
                  color:"var(--accent)", flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"20px",
                }}>🏆</div>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontSize:"14px", fontWeight:500,
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
  )
}

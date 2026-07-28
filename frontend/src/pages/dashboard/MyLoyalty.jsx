// pages/dashboard/MyLoyalty.jsx — Página completa de puntos
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getMyLoyalty } from "../../api/loyalty.api"

const NIVELES = {
  bronze:   { color:"#cd7f32", label:"Bronce",   emoji:"🥉", next: 1000 },
  silver:   { color:"#c0c0c0", label:"Plata",    emoji:"🥈", next: 5000 },
  gold:     { color:"#facc15", label:"Oro",      emoji:"🥇", next: 15000 },
  platinum: { color:"#a8c0d6", label:"Platino",  emoji:"💎", next: null  },
}

const TIPO_STYLE = {
  earn:   { color:"var(--accent)", sign:"+", label:"Ganado"   },
  redeem: { color:"#60a5fa",       sign:"",  label:"Canjeado" },
  expire: { color:"var(--text-3)", sign:"",  label:"Expirado" },
  adjust: { color:"#facc15",       sign:"",  label:"Ajuste"   },
}

export default function MyLoyalty() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-loyalty-full"],
    queryFn:  getMyLoyalty,
  })

  if (isLoading || !data) return (
    <div style={{ padding:"clamp(32px, 5vw, 56px)" }}>
      <p style={{ color:"var(--text-3)" }}>Cargando…</p>
    </div>
  )

  const nivel    = NIVELES[data.nivel] || NIVELES.bronze
  const sigNivel = data.siguiente_nivel ? NIVELES[data.siguiente_nivel] : null

  return (
    <div style={{ padding:"clamp(32px, 5vw, 56px)", maxWidth:"860px" }}>
      {/* Header */}
      <div style={{ marginBottom:"32px" }}>
        <p style={{ fontSize:"12px", color:"var(--accent)",
          fontWeight:600, letterSpacing:"0.08em",
          textTransform:"uppercase", marginBottom:"8px" }}>
          Programa de Fidelización
        </p>
        <h1 style={{ fontFamily:"var(--font-serif)",
          fontSize:"clamp(2rem, 4vw, 3rem)", fontWeight:300,
          letterSpacing:"-0.02em" }}>
          Mis puntos
        </h1>
      </div>

      {/* Card principal */}
      <div style={{
        padding:"clamp(24px, 4vw, 36px)",
        background: `linear-gradient(135deg, ${nivel.color}15 0%, transparent 60%), var(--surface)`,
        border:`1px solid ${nivel.color}40`,
        borderRadius:"var(--r-2xl)",
        marginBottom:"32px",
      }}>
        <div style={{ display:"flex", alignItems:"center",
          justifyContent:"space-between", flexWrap:"wrap", gap:"16px" }}>
          <div style={{ display:"flex", gap:"18px", alignItems:"center" }}>
            <span style={{ fontSize:"56px" }}>{nivel.emoji}</span>
            <div>
              <p style={{ fontSize:"11px", color:"var(--text-3)",
                letterSpacing:"0.1em", textTransform:"uppercase",
                marginBottom:"6px" }}>Nivel actual</p>
              <p style={{ fontSize:"26px", fontWeight:500, color:nivel.color,
                fontFamily:"var(--font-serif)", letterSpacing:"-0.01em" }}>
                {nivel.label}
              </p>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ fontSize:"11px", color:"var(--text-3)",
              letterSpacing:"0.1em", textTransform:"uppercase",
              marginBottom:"6px" }}>Puntos disponibles</p>
            <p style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(2rem, 5vw, 3.4rem)",
              color:"var(--accent)", fontWeight:300, lineHeight:1,
              fontVariantNumeric:"tabular-nums" }}>
              {data.puntos_disponibles.toLocaleString("es-CL")}
            </p>
            <p style={{ fontSize:"13px", color:"var(--text-2)", marginTop:"6px" }}>
              = ${data.valor_disponible.toLocaleString("es-CL")} de descuento
            </p>
          </div>
        </div>

        {sigNivel && (
          <div style={{ marginTop:"28px", paddingTop:"24px",
            borderTop:`1px solid ${nivel.color}30` }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              fontSize:"12px", marginBottom:"10px" }}>
              <span style={{ color:"var(--text-3)" }}>
                Progreso a {sigNivel.emoji} {sigNivel.label}
              </span>
              <span style={{ color:sigNivel.color, fontWeight:600 }}>
                {data.progreso_nivel}%
              </span>
            </div>
            <div style={{ height:"8px", borderRadius:"4px",
              background:"var(--surface-2)", overflow:"hidden" }}>
              <div style={{
                width:`${data.progreso_nivel}%`, height:"100%",
                background:`linear-gradient(90deg, ${nivel.color}, ${sigNivel.color})`,
                transition:"width 0.6s ease",
              }} />
            </div>
            <p style={{ fontSize:"12px", color:"var(--text-3)",
              marginTop:"8px" }}>
              Te faltan{" "}
              <strong style={{ color:sigNivel.color }}>
                {(data.puntos_para_siguiente - data.puntos_totales).toLocaleString("es-CL")} pts
              </strong>{" "}
              para alcanzar {sigNivel.label}.
            </p>
          </div>
        )}
      </div>

      {/* Info stats */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",
        gap:"10px", marginBottom:"32px",
      }}>
        {[
          ["Puntos totales acumulados", data.puntos_totales,   "#fff"],
          ["Puntos canjeados",          data.puntos_canjeados, "#60a5fa"],
          ["Mínimo para canjear",       data.minimo_canje,     "var(--text-3)"],
        ].map(([label, value, color]) => (
          <div key={label} style={{
            padding:"14px 18px", background:"var(--surface)",
            border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
          }}>
            <p style={{ fontSize:"11px", color:"var(--text-3)",
              letterSpacing:"0.08em", textTransform:"uppercase",
              marginBottom:"8px" }}>{label}</p>
            <p style={{ fontSize:"20px", fontWeight:600, color,
              fontVariantNumeric:"tabular-nums" }}>
              {value.toLocaleString("es-CL")}
            </p>
          </div>
        ))}
      </div>

      {/* Historial */}
      <div>
        <h3 style={{ fontSize:"13px", fontWeight:600, color:"var(--text-2)",
          letterSpacing:"0.08em", textTransform:"uppercase",
          marginBottom:"14px" }}>
          Historial reciente
        </h3>

        {data.transactions.length === 0 ? (
          <div style={{ padding:"32px", background:"var(--surface)",
            border:"1px solid var(--border)", borderRadius:"var(--r-lg)",
            textAlign:"center", color:"var(--text-3)" }}>
            <p style={{ marginBottom:"12px", fontSize:"14px" }}>
              Aún no tenés movimientos.
            </p>
            <Link to="/shop" style={{ fontSize:"13px", color:"var(--accent)",
              textDecoration:"none" }}>
              Ir a la tienda para empezar a acumular →
            </Link>
          </div>
        ) : (
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--r-lg)", overflow:"hidden" }}>
            {data.transactions.map((t, i) => {
              const s = TIPO_STYLE[t.tipo] || TIPO_STYLE.adjust
              return (
                <div key={i} style={{
                  padding:"14px 18px",
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  borderBottom: i < data.transactions.length - 1
                    ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <p style={{ fontSize:"13px", color:"var(--text)" }}>
                      {t.descripcion}
                    </p>
                    <p style={{ fontSize:"11px", color:"var(--text-3)",
                      marginTop:"2px" }}>
                      {s.label} · {t.fecha}
                    </p>
                  </div>
                  <p style={{ fontSize:"15px", fontWeight:600,
                    color: s.color, fontVariantNumeric:"tabular-nums" }}>
                    {s.sign}{t.puntos.toLocaleString("es-CL")} pts
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cómo funciona */}
      <details style={{
        marginTop:"32px", padding:"18px 22px",
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-lg)", cursor:"pointer",
      }}>
        <summary style={{ fontSize:"14px", fontWeight:500,
          color:"var(--text-2)", cursor:"pointer" }}>
          ¿Cómo funciona el programa?
        </summary>
        <ul style={{ marginTop:"14px", fontSize:"13px",
          color:"var(--text-2)", lineHeight:1.8, paddingLeft:"20px" }}>
          <li>Cada compra suma puntos automáticamente cuando el pago es confirmado.</li>
          <li>Los puntos se pueden canjear en el carrito antes de pagar.</li>
          <li>Mínimo de canje: {data.minimo_canje} puntos.</li>
          <li>Ascendés de nivel según los puntos totales acumulados históricos.</li>
          <li>Los niveles superiores desbloquean beneficios exclusivos.</li>
        </ul>
      </details>
    </div>
  )
}

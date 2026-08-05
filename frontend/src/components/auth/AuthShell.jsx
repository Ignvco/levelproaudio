// components/auth/AuthShell.jsx — Layout premium split-screen para Login/Register
import { Link } from "react-router-dom"
import { Check } from "lucide-react"
import logo from "../../assets/logo.png"

const STUDIO_IMG = "https://images.unsplash.com/photo-1517273006195-51fa3364bce2?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400"

const FEATURES = [
  "Equipamiento profesional de audio",
  "Academia con cursos y certificaciones",
  "Sorteos exclusivos con LevelPro Rewards",
]

export const authInput = {
  width: "100%", padding: "14px 16px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "14px", color: "var(--text)",
  fontSize: "15px", outline: "none",
  transition: "border-color 200ms var(--ease), background 200ms var(--ease)",
}
const onFocus = e => { e.target.style.borderColor = "rgba(26,255,110,0.5)"; e.target.style.background = "rgba(255,255,255,0.06)" }
const onBlur  = e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.04)" }

export function AuthField({ label, testId, ...props }) {
  return (
    <div>
      {label ? (
        <label style={{ display: "block", fontSize: "13px", fontWeight: 600,
          color: "var(--text)", marginBottom: "9px" }}>
          {label}
        </label>
      ) : null}
      <input {...props} data-testid={testId} style={authInput} onFocus={onFocus} onBlur={onBlur} />
    </div>
  )
}

export default function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "clamp(14px, 3vw, 40px)", background: "#000" }}>
    <div className="auth-shell" style={{ width: "100%", maxWidth: "1360px",
      minHeight: "min(720px, calc(100vh - 40px))", display: "grid",
      gridTemplateColumns: "1fr 1.05fr", background: "var(--bg)",
      borderRadius: "28px", overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>

      {/* Panel del formulario (izquierda) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(32px, 5vw, 60px)", position: "relative", overflowY: "auto",
        background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(26,255,110,0.04) 0%, transparent 70%), var(--bg)" }}>
        <div className="animate-fade-up" style={{ width: "100%", maxWidth: "400px",
          display: "flex", flexDirection: "column", gap: "26px" }}>

          {/* Logo (solo mobile) */}
          <Link to="/" className="auth-mobile-logo" style={{ display: "none", justifyContent: "center" }}>
            <img src={logo} alt="LevelPro Audio" style={{ height: "28px",
              filter: "brightness(0) invert(1)" }} />
          </Link>

          <div>
            {eyebrow && (
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
                textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "12px" }}>
                {eyebrow}
              </p>
            )}
            <h1 className="display-bold" style={{ fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 3.4vw, 2.6rem)", fontWeight: 800,
              letterSpacing: "-0.03em", lineHeight: 1, color: "var(--text)", marginBottom: "10px" }}>
              {title}
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: "14.5px", lineHeight: 1.6 }}>
              {subtitle}
            </p>
          </div>

          {children}

          {footer && (
            <p style={{ textAlign: "center", fontSize: "14px", color: "var(--text-3)" }}>
              {footer}
            </p>
          )}
        </div>
      </div>

      {/* Panel de marca (derecha, desktop) */}
      <div className="auth-brand" style={{ position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "clamp(40px, 4vw, 64px)" }}>
        <img src={STUDIO_IMG} alt="" style={{ position: "absolute", inset: 0,
          width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0,
          background: "linear-gradient(160deg, rgba(8,8,8,0.82) 0%, rgba(8,8,8,0.72) 40%, rgba(8,8,8,0.92) 100%)" }} />
        <div style={{ position: "absolute", inset: 0,
          boxShadow: "inset 0 0 200px rgba(26,255,110,0.08)" }} />

        <Link to="/" style={{ position: "relative", zIndex: 1 }}>
          <img src={logo} alt="LevelPro Audio" style={{ height: "30px",
            filter: "brightness(0) invert(1)" }} />
        </Link>

        <div style={{ position: "relative", zIndex: 1, maxWidth: "440px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)",
            textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "20px" }}>
            · Audio Profesional · Chile & Argentina
          </p>
          <h2 className="display-bold" style={{ fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 3vw, 2.9rem)", fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1.02, color: "#fff", marginBottom: "28px" }}>
            Llevá tu sonido al nivel <span style={{ color: "var(--accent)", fontStyle: "italic" }}>profesional</span>.
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ width: "24px", height: "24px", borderRadius: "50%",
                  background: "rgba(26,255,110,0.12)", border: "1px solid rgba(26,255,110,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)", flexShrink: 0 }}>
                  <Check size={13} strokeWidth={3} />
                </span>
                <span style={{ fontSize: "14.5px", color: "rgba(255,255,255,0.82)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .auth-shell { grid-template-columns: 1fr !important; min-height: auto !important; }
          .auth-brand { display: none !important; }
          .auth-mobile-logo { display: flex !important; margin-bottom: 4px; }
        }
      `}</style>
    </div>
    </div>
  )
}

export function AuthDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "2px 0" }}>
      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
      <span style={{ fontSize: "12.5px", color: "var(--text-3)", fontWeight: 600 }}>o</span>
      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
    </div>
  )
}

export function AuthSubmit({ loading, children }) {
  return (
    <button type="submit" data-testid="auth-submit" disabled={loading}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
        width: "100%", padding: "15px", borderRadius: "var(--r-full)",
        background: "var(--accent)", color: "#000", border: "none",
        fontSize: "15px", fontWeight: 700, cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.7 : 1, marginTop: "2px",
        boxShadow: "0 8px 30px rgba(26,255,110,0.28)",
        transition: "transform 200ms var(--ease)" }}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-2px)" }}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
      {children}
    </button>
  )
}

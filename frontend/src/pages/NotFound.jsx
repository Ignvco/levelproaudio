// pages/NotFound.jsx
import { Link, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"

export default function NotFound() {
  const navigate    = useNavigate()
  const [count, setCount] = useState(5)

  useEffect(() => {
    const t = setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearInterval(t); navigate("/"); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      minHeight:      "100vh",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "clamp(24px, 5vw, 60px)",
      background:     "var(--bg)",
      textAlign:      "center",
      position:       "relative",
      overflow:       "hidden",
    }}>
      {/* Glow de fondo */}
      <div style={{
        position:     "absolute",
        width:        "600px",
        height:       "600px",
        borderRadius: "50%",
        background:   "radial-gradient(circle, rgba(26,255,110,0.04), transparent 70%)",
        top:          "50%",
        left:         "50%",
        transform:    "translate(-50%, -50%)",
        pointerEvents:"none",
      }} />

      <div style={{ position: "relative", zIndex: 1 }} className="animate-fade-up">

        {/* Número 404 gigante */}
        <div style={{ position: "relative", marginBottom: "32px" }}>
          <p style={{
            fontFamily:    "var(--font-serif)",
            fontSize:      "clamp(8rem, 20vw, 18rem)",
            fontWeight:    300,
            lineHeight:    0.9,
            letterSpacing: "-0.04em",
            background:    "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            userSelect:    "none",
          }}>
            404
          </p>
          {/* Acento verde sobre el 404 */}
          <div style={{
            position:     "absolute",
            bottom:       "20px",
            left:         "50%",
            transform:    "translateX(-50%)",
            width:        "60px",
            height:       "3px",
            background:   "var(--accent)",
            borderRadius: "2px",
          }} />
        </div>

        <h1 style={{
          fontFamily:    "var(--font-serif)",
          fontSize:      "clamp(1.8rem, 4vw, 3rem)",
          fontWeight:    300,
          letterSpacing: "-0.02em",
          marginBottom:  "14px",
        }}>
          Página no encontrada
        </h1>

        <p style={{
          fontSize:     "16px",
          color:        "var(--text-3)",
          lineHeight:   1.7,
          maxWidth:     "400px",
          margin:       "0 auto 32px",
        }}>
          La página que buscás no existe o fue movida.
          Te redirigimos al inicio en{" "}
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>{count}s</span>
        </p>

        <div style={{ display: "flex", gap: "12px",
          justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/" className="btn btn-accent"
            style={{ fontSize: "15px", padding: "13px 28px" }}>
            Ir al inicio
          </Link>
          <Link to="/shop" className="btn btn-ghost"
            style={{ fontSize: "15px", padding: "13px 28px" }}>
            Ver tienda
          </Link>
        </div>

        {/* Links útiles */}
        <div style={{ marginTop: "48px", display: "flex", gap: "24px",
          justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { to: "/academy",  label: "Academia"  },
            { to: "/services", label: "Servicios" },
            { to: "/dashboard",label: "Mi cuenta" },
          ].map(({ to, label }) => (
            <Link key={to} to={to} style={{
              fontSize: "13px", color: "var(--text-3)",
              transition: "color var(--dur)",
            }}
              className="hover-accent"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
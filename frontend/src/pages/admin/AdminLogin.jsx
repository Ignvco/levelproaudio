// pages/admin/AdminLogin.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../../store/authStore"
import logo from "../../assets/logo.png"
import { useSiteSettings } from "../../hooks/useSiteSettings"

export default function AdminLogin() {
  const { siteName, logoUrl } = useSiteSettings()
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const { login }               = useAuthStore()
  const navigate                = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      const user = await login(email, password)
      if (!user?.is_staff) {
        setError("No tenés permisos de administrador.")
        return
      }
      navigate("/admin")
    } catch {
      setError("Credenciales incorrectas.")
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "clamp(24px, 5vw, 60px)",
      background: `radial-gradient(ellipse 55% 45% at 50% 22%,
        rgba(26,255,110,0.08) 0%, transparent 70%), #0A0B0D`,
    }}>
      <div style={{
        width: "100%", maxWidth: "400px",
        background: "#13161B",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "24px",
        padding: "36px 32px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
      }} className="animate-fade-up">

        {/* Logo + Badge */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <img src={logoUrl || logo} alt={siteName}
            style={{ height: "32px", margin: "0 auto 14px" }} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "5px 12px", borderRadius: "9999px",
            background: "rgba(26,255,110,0.1)", border: "1px solid rgba(26,255,110,0.25)" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%",
              background: "#1AFF6E", boxShadow: "0 0 8px #1AFF6E", display: "inline-block" }} />
            <span style={{ fontSize: "10.5px", fontWeight: 800,
              color: "#1AFF6E", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
              LP AUDIO · PANEL ADMIN
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div style={{ padding: "12px 16px", borderRadius: "12px",
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)",
              color: "#F87171", fontSize: "13px", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700,
              color: "rgba(255,255,255,0.7)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
            <input type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              className="input" placeholder="admin@levelproaudio.com"
              required autoComplete="email" />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700,
              color: "rgba(255,255,255,0.7)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Contraseña</label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="input" placeholder="••••••••"
              required autoComplete="current-password" />
          </div>

          <button type="submit" disabled={loading} className="btn btn-accent"
            style={{ justifyContent: "center", padding: "14px", borderRadius: "9999px",
              fontSize: "14px", fontWeight: 700, marginTop: "6px", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Verificando..." : "Ingresar al admin"}
          </button>
        </form>
      </div>
    </div>
  )
}
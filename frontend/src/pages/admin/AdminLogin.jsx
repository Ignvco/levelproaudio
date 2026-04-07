// pages/admin/AdminLogin.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../../store/authStore"

export default function AdminLogin() {
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
      background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "clamp(24px, 5vw, 60px)",
      background: `radial-gradient(ellipse 50% 50% at 50% 30%,
        rgba(26,255,110,0.05) 0%, transparent 70%), var(--bg)`,
    }}>
      <div style={{ width: "100%", maxWidth: "360px" }} className="animate-fade-up">

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <img src="/src/assets/logo.png" alt="LevelPro"
            style={{ height: "32px", margin: "0 auto 16px" }} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "4px 12px", borderRadius: "var(--r-full)",
            background: "var(--accent-dim)", border: "1px solid var(--accent-glow)" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--accent)", display: "inline-block" }} />
            <span style={{ fontSize: "11px", fontWeight: 600,
              color: "var(--accent)", letterSpacing: "0.08em" }}>
              PANEL ADMIN
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ padding: "12px 16px", borderRadius: "var(--r-md)",
              background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
              color: "var(--danger)", fontSize: "13px" }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "8px" }}>Email</label>
            <input type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              className="input" placeholder="admin@levelproaudio.com"
              required autoComplete="email" />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500,
              color: "var(--text-2)", marginBottom: "8px" }}>Contraseña</label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="input" placeholder="••••••••"
              required autoComplete="current-password" />
          </div>

          <button type="submit" disabled={loading} className="btn btn-accent"
            style={{ justifyContent: "center", padding: "14px",
              fontSize: "14px", marginTop: "4px", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Verificando..." : "Ingresar al admin"}
          </button>
        </form>
      </div>
    </div>
  )
}
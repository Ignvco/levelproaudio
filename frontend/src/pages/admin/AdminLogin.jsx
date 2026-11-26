// pages/admin/AdminLogin.jsx — LevelPro Precision Nimbus Login Template
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Lock } from "lucide-react"
import { useAuthStore } from "../../store/authStore"
import logo from "../../assets/logo.png"
import { useSiteSettings } from "../../hooks/useSiteSettings"
import { FormField, formInputStyle, PrimaryButton, CalloutCard } from "../../components/admin/ui"

export default function AdminLogin() {
  const { siteName, logoUrl } = useSiteSettings()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const user = await login(email, password)
      if (!user?.is_staff && !user?.is_superuser) {
        setError("No tenés permisos de administrador.")
        return
      }
      navigate("/admin")
    } catch {
      setError("Credenciales incorrectas.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="admin-root admin-precision"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "#F5F5F5",
      }}
    >
      <div
        className="au-card"
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "32px 28px",
          background: "#FFFFFF",
          border: "1px solid #E4E4E7",
          borderRadius: 12,
        }}
      >
        {/* Official Positive Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            {logoUrl ? (
              <img src={logoUrl} alt={siteName || "LevelPro Audio"} style={{ height: 28, objectFit: "contain" }} />
            ) : (
              <span
                className="lp-brand-logo-positive"
                role="img"
                aria-label={siteName || "LevelPro Audio"}
                style={{
                  height: 30,
                  width: 100,
                  backgroundPosition: "center",
                  WebkitMaskImage: `url(${logo})`,
                  maskImage: `url(${logo})`,
                }}
              />
            )}
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 600, color: "#09090B", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Acceso Administrativo
          </h1>
          <p style={{ fontSize: 13, color: "#71717A", margin: 0 }}>
            Ingresa con tu cuenta de operador autorizado
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <CalloutCard tone="danger" description={error} />}

          <FormField label="Email corporativo" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={formInputStyle}
              placeholder="admin@levelproaudio.com"
              required
              autoComplete="email"
            />
          </FormField>

          <FormField label="Contraseña" required>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={formInputStyle}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </FormField>

          <PrimaryButton
            type="submit"
            loading={loading}
            disabled={loading}
            icon={Lock}
            style={{ width: "100%", height: 40, marginTop: 4 }}
          >
            {loading ? "Verificando..." : "Ingresar al administrador"}
          </PrimaryButton>
        </form>
      </div>
    </div>
  )
}

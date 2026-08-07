// pages/ForgotPassword.jsx — Solicitud de enlace de recuperación
import { useState } from "react"
import { Link } from "react-router-dom"
import { MailCheck } from "lucide-react"
import api from "../api/client"
import AuthShell, { AuthField, AuthSubmit } from "../components/auth/AuthShell"

export default function ForgotPassword() {
  const [email, setEmail]   = useState("")
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await api.post("/auth/password/reset/", { email })
      setSent(true)
    } catch {
      setError("No pudimos procesar la solicitud. Intentá de nuevo en unos minutos.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        eyebrow="· Revisá tu correo"
        title="Enlace enviado"
        subtitle="Si el email está registrado, te mandamos un enlace para restablecer tu contraseña. Revisá también la carpeta de spam."
        footer={<>¿Recordaste tu contraseña?{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Iniciá sesión</Link>
        </>}
      >
        <div data-testid="forgot-sent-box" style={{ display: "flex", alignItems: "center", gap: "14px",
          padding: "18px 20px", borderRadius: "16px",
          background: "rgba(26,255,110,0.06)", border: "1px solid rgba(26,255,110,0.22)" }}>
          <span style={{ width: "42px", height: "42px", borderRadius: "50%", flexShrink: 0,
            background: "rgba(26,255,110,0.12)", display: "flex", alignItems: "center",
            justifyContent: "center", color: "var(--accent)" }}>
            <MailCheck size={20} strokeWidth={2.2} />
          </span>
          <div>
            <p style={{ color: "var(--text)", fontSize: "14.5px", fontWeight: 600, marginBottom: "2px" }}>
              Revisá <span style={{ color: "var(--accent)" }}>{email}</span>
            </p>
            <p style={{ color: "var(--text-3)", fontSize: "13px" }}>El enlace vence en 1 hora.</p>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="· Recuperar acceso"
      title="Olvidé mi contraseña"
      subtitle="Ingresá tu email y te enviaremos un enlace para crear una nueva contraseña."
      footer={<>¿Recordaste tu contraseña?{" "}
        <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Iniciá sesión</Link>
      </>}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && (
          <div data-testid="forgot-error" style={{ padding: "12px 16px", borderRadius: "14px",
            background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.2)",
            color: "var(--danger)", fontSize: "14px" }}>
            {error}
          </div>
        )}

        <AuthField label="Email" testId="forgot-email" type="email" value={email}
          onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"
          required autoComplete="email" autoFocus />

        <AuthSubmit loading={loading}>
          {loading ? "Enviando..." : "Enviar enlace"}
        </AuthSubmit>
      </form>
    </AuthShell>
  )
}

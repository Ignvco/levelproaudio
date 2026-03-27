// pages/Login.jsx

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate, Link } from "react-router-dom"
import api from "../api/client"
import { useAuthStore } from "../store/authStore"
import iconImg from "../assets/icon.png"

const schema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(1, "Requerido"),
})

export default function Login() {
  const [error, setError]     = useState("")
  const [loading, setLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const navigate               = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    setError("")
    try {
      const { data: tokens } = await api.post("/auth/login/", data)
      setTokens(tokens.access, tokens.refresh)
      const { data: profile } = await api.get("/auth/profile/")
      setUser(profile)
      navigate("/dashboard")
    } catch {
      setError("Credenciales incorrectas.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "var(--bg)",
    }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
            <img src={iconImg} alt="" style={{ width: "32px", filter: "brightness(0) invert(1)" }} />
          </Link>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2rem",
            marginTop: "16px",
            marginBottom: "8px",
          }}>
            Bienvenido
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-2)" }}>
            Ingresa a tu cuenta de LevelPro Audio
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: "32px",
        }}>
          {error && (
            <div style={{
              padding: "12px 16px",
              borderRadius: "var(--r-md)",
              background: "rgba(255,59,59,0.08)",
              border: "1px solid rgba(255,59,59,0.2)",
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "20px",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-2)", marginBottom: "8px", fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email"
                {...register("email")}
                placeholder="tu@email.com"
                className={`input ${errors.email ? "error" : ""}`}
              />
              {errors.email && (
                <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-2)", marginBottom: "8px", fontWeight: 500 }}>
                Contraseña
              </label>
              <input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className={`input ${errors.password ? "error" : ""}`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-accent"
              style={{ width: "100%", justifyContent: "center", marginTop: "8px", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-3)", marginTop: "20px" }}>
            ¿No tienes cuenta?{" "}
            <Link to="/register" style={{ color: "var(--text-2)", transition: "color var(--dur)" }}
              className="hover:text-white"
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
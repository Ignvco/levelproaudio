// pages/Login.jsx
// Formulario de login con validación (zod) y manejo de estado (react-hook-form)
// Al autenticarse guarda los tokens en Zustand (persistido en localStorage)

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate, Link } from "react-router-dom"
import api from "../api/client"
import { useAuthStore } from "../store/authStore"

// ── Schema de validación ─────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
})

// ── Login page ───────────────────────────────────────────────
export default function Login() {
  const [serverError, setServerError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    setServerError("")

    try {
      // 1 — Login → obtiene tokens
      const { data: tokens } = await api.post("/auth/login/", {
        email: data.email,
        password: data.password,
      })

      setTokens(tokens.access, tokens.refresh)

      // 2 — Obtiene perfil del usuario
      const { data: profile } = await api.get("/auth/profile/")
      setUser(profile)

      navigate("/dashboard")

    } catch (err) {
      const msg = err.response?.data?.detail
      setServerError(msg || "Credenciales incorrectas. Verifica tu email y contraseña.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/">
            <span
              className="text-2xl font-black tracking-tight"
              style={{ color: "var(--color-accent)" }}
            >
              LEVEL<span style={{ color: "var(--color-text)" }}>PRO</span>
            </span>
          </Link>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Ingresa a tu cuenta
          </p>
        </div>

        {/* Error del servidor */}
        {serverError && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: "rgba(255,68,68,0.1)",
              border: "1px solid var(--color-danger)",
              color: "var(--color-danger)",
            }}
          >
            {serverError}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Email */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Email
            </label>
            <input
              type="email"
              placeholder="tu@email.com"
              {...register("email")}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: `1px solid ${errors.email ? "var(--color-danger)" : "var(--color-border)"}`,
                color: "var(--color-text)",
              }}
            />
            {errors.email && (
              <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-text-muted)" }}>
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: `1px solid ${errors.password ? "var(--color-danger)" : "var(--color-border)"}`,
                color: "var(--color-text)",
              }}
            />
            {errors.password && (
              <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50 mt-2"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            {isLoading ? "Ingresando..." : "Ingresar"}
          </button>

        </form>

        {/* Footer del form */}
        <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          ¿No tienes cuenta?{" "}
          <Link
            to="/register"
            style={{ color: "var(--color-accent)" }}
            className="font-medium"
          >
            Regístrate
          </Link>
        </p>

      </div>
    </div>
  )
}
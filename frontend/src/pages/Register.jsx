// pages/Register.jsx
// Formulario de registro de nuevos usuarios

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate, Link } from "react-router-dom"
import api from "../api/client"
import { useAuthStore } from "../store/authStore"

const registerSchema = z.object({
  first_name: z.string().min(1, "Requerido"),
  last_name:  z.string().min(1, "Requerido"),
  email:      z.string().email("Email inválido"),
  username:   z.string().min(3, "Mínimo 3 caracteres"),
  password:   z.string().min(8, "Mínimo 8 caracteres"),
  password2:  z.string().min(1, "Requerido"),
}).refine(data => data.password === data.password2, {
  message: "Las contraseñas no coinciden",
  path: ["password2"],
})

export default function Register() {
  const [serverError, setServerError] = useState("")
  const [isLoading, setIsLoading]     = useState(false)
  const { setTokens, setUser }        = useAuthStore()
  const navigate                      = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data) => {
    setIsLoading(true)
    setServerError("")

    try {
      // 1 — Registra el usuario
      await api.post("/auth/register/", {
        first_name: data.first_name,
        last_name:  data.last_name,
        email:      data.email,
        username:   data.username,
        password:   data.password,
        password2:  data.password2,
      })

      // 2 — Login automático
      const { data: tokens } = await api.post("/auth/login/", {
        email:    data.email,
        password: data.password,
      })
      setTokens(tokens.access, tokens.refresh)

      // 3 — Obtiene perfil
      const { data: profile } = await api.get("/auth/profile/")
      setUser(profile)

      navigate("/dashboard")

    } catch (err) {
      const errors = err.response?.data
      if (errors?.email)    setServerError(`Email: ${errors.email[0]}`)
      else if (errors?.username) setServerError(`Username: ${errors.username[0]}`)
      else setServerError("Error al registrarse. Intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const inputStyle = (hasError) => ({
    backgroundColor: "var(--color-surface-2)",
    border: `1px solid ${hasError ? "var(--color-danger)" : "var(--color-border)"}`,
    color: "var(--color-text)",
  })

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
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
            <span className="text-2xl font-black tracking-tight"
              style={{ color: "var(--color-accent)" }}
            >
              LEVEL<span style={{ color: "var(--color-text)" }}>PRO</span>
            </span>
          </Link>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Crea tu cuenta
          </p>
        </div>

        {/* Error servidor */}
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-text-muted)" }}
              >
                Nombre
              </label>
              <input
                {...register("first_name")}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={inputStyle(errors.first_name)}
              />
              {errors.first_name && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                  {errors.first_name.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-text-muted)" }}
              >
                Apellido
              </label>
              <input
                {...register("last_name")}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={inputStyle(errors.last_name)}
              />
              {errors.last_name && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Email
            </label>
            <input
              type="email"
              {...register("email")}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle(errors.email)}
            />
            {errors.email && (
              <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Nombre de usuario
            </label>
            <input
              {...register("username")}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle(errors.username)}
            />
            {errors.username && (
              <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                {errors.username.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Contraseña
            </label>
            <input
              type="password"
              {...register("password")}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle(errors.password)}
            />
            {errors.password && (
              <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Confirmar contraseña
            </label>
            <input
              type="password"
              {...register("password2")}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle(errors.password2)}
            />
            {errors.password2 && (
              <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                {errors.password2.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50 mt-2"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            {isLoading ? "Creando cuenta..." : "Crear cuenta"}
          </button>

        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" style={{ color: "var(--color-accent)" }} className="font-medium">
            Ingresar
          </Link>
        </p>
      </div>
    </div>
  )
}
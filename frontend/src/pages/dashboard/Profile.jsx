// pages/dashboard/Profile.jsx
// Edición del perfil del usuario

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "../../store/authStore"
import api from "../../api/client"

const profileSchema = z.object({
  first_name:       z.string().min(1, "Requerido"),
  last_name:        z.string().optional(),
  phone:            z.string().optional(),
  address_street:   z.string().optional(),
  address_city:     z.string().optional(),
  address_province: z.string().optional(),
})

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name:       user?.first_name || "",
      last_name:        user?.last_name  || "",
      phone:            user?.phone      || "",
      address_street:   user?.address_street   || "",
      address_city:     user?.address_city     || "",
      address_province: user?.address_province || "",
    },
  })

  // Sincroniza el form si el user cambia
  useEffect(() => {
    if (user) reset(user)
  }, [user, reset])

  const mutation = useMutation({
    mutationFn: (data) => api.patch("/auth/profile/", data),
    onSuccess: ({ data }) => {
      setUser(data)
      queryClient.invalidateQueries(["profile"])
    },
  })

  const inputStyle = (hasError) => ({
    backgroundColor: "var(--color-surface-2)",
    border: `1px solid ${hasError ? "var(--color-danger)" : "var(--color-border)"}`,
    color: "var(--color-text)",
  })

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-black mb-8">Mi perfil</h1>

      <form onSubmit={handleSubmit(data => mutation.mutate(data))}>
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          {/* Email — solo lectura */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Email
            </label>
            <input
              value={user?.email || ""}
              disabled
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none opacity-50 cursor-not-allowed"
              style={inputStyle(false)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" error={errors.first_name?.message}>
              <input
                {...register("first_name")}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={inputStyle(errors.first_name)}
              />
            </Field>
            <Field label="Apellido">
              <input
                {...register("last_name")}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={inputStyle(false)}
              />
            </Field>
          </div>

          <Field label="Teléfono">
            <input
              {...register("phone")}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle(false)}
            />
          </Field>

          <div
            className="pt-4 border-t"
            style={{ borderColor: "var(--color-border)" }}
          >
            <p className="text-sm font-semibold mb-4">Dirección de envío</p>
            <div className="space-y-4">
              <Field label="Calle y número">
                <input
                  {...register("address_street")}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={inputStyle(false)}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Ciudad">
                  <input
                    {...register("address_city")}
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                    style={inputStyle(false)}
                  />
                </Field>
                <Field label="Región">
                  <input
                    {...register("address_province")}
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                    style={inputStyle(false)}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Feedback */}
          {mutation.isSuccess && (
            <p className="text-sm" style={{ color: "var(--color-accent)" }}>
              ✓ Perfil actualizado correctamente.
            </p>
          )}
          {mutation.isError && (
            <p className="text-sm" style={{ color: "var(--color-danger)" }}>
              Error al guardar. Intenta de nuevo.
            </p>
          )}

          <button
            type="submit"
            disabled={!isDirty || mutation.isPending}
            className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
          >
            {mutation.isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  )
}
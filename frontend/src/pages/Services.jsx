// pages/Services.jsx
import { useQuery } from "@tanstack/react-query"
import api from "../api/client"

function ServiceCard({ service }) {
  return (
    <div
      className="rounded-xl p-6 transition-all hover:-translate-y-1"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <h3 className="font-bold text-lg mb-2">{service.name}</h3>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {service.description}
      </p>
      <div className="flex items-center justify-between">
        <span className="font-black text-lg" style={{ color: "var(--color-accent)" }}>
          {service.price
            ? `$${Number(service.price).toLocaleString("es-CL")}`
            : "Consultar precio"
          }
        </span><a
        
          href="https://wa.me/5492622635045"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
        >
          Consultar
        </a>
      </div>
    </div>
  )
}

export default function Services() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await api.get("/services/")
      return res.data
    },
  })

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>

      {/* Header */}
      <div
        className="py-16 px-4 border-b"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase mb-3 px-3 py-1 rounded-full"
            style={{
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              backgroundColor: "rgba(0,230,118,0.05)"
            }}
          >
            Servicios Profesionales
          </span>
          <h1 className="text-4xl font-black mb-3">¿En qué te podemos ayudar?</h1>
          <p className="text-lg" style={{ color: "var(--color-text-muted)" }}>
            Producción musical, grabación, mezcla, eventos y más.
          </p>
        </div>
      </div>

      {/* Servicios */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl animate-pulse"
                style={{ backgroundColor: "var(--color-surface)" }}
              />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-center py-20" style={{ color: "var(--color-text-muted)" }}>
            Error al cargar los servicios.
          </p>
        )}

        {!isLoading && data?.results?.length === 0 && (
          <div className="text-center py-20">
            <span className="text-5xl mb-4 block">🎛️</span>
            <p className="text-lg font-bold mb-2">Próximamente</p>
            <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
              Estamos preparando nuestros servicios. Contáctanos por WhatsApp.
            </p><a
            
              href="https://wa.me/5492622635045"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-lg font-semibold text-sm"
              style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
            >
              Contactar por WhatsApp
            </a>
          </div>
        )}

        {!isLoading && data?.results && data.results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.results.map(service => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
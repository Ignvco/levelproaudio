// pages/OrderConfirmationVerified.jsx — estado de pedido respaldado por GET autenticado.
// Esta pantalla jamás captura pagos ni crea pedidos. No declara éxito por el ID en la URL.
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Button from "../components/ui/Button"
import { getOrder } from "../api/orders.api"
import { orderConfirmationView, isOrderId } from "../utils/orderConfirmationView"

export default function OrderConfirmation() {
  const { id } = useParams()
  const validId = isOrderId(id)
  const { data: order, isPending, isError, refetch, isFetching, isFetchedAfterMount } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
    enabled: validId,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  })

  // Evitar celebrar un pago desde una respuesta antigua en la caché de React Query.
  const verifying = validId && (isPending || !isFetchedAfterMount)
  const unavailable = !validId || (isFetchedAfterMount && (isError || !order))
  const state = unavailable ? orderConfirmationView(null)
    : verifying ? { kind: "loading", title: "Verificando pedido…", detail: "Consultando el estado del pedido.", icon: "…", color: "var(--text-2)" }
    : orderConfirmationView(order)

  return (
    <main data-testid="order-confirmation-page" style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "clamp(18px, 5vw, 40px) 14px",
      background: "var(--bg)",
    }}>
      <section aria-live="polite" aria-busy={verifying || isFetching} style={{
        width: "100%", maxWidth: "460px", textAlign: "center",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", padding: "clamp(24px, 6vw, 44px) clamp(16px, 5vw, 34px)",
        boxSizing: "border-box",
      }}>
        <div aria-hidden="true" style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: "var(--surface-2)", border: `1px solid ${state.color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", margin: "0 auto 24px", color: state.color, fontWeight: 700,
        }}>{state.icon}</div>

        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.55rem, 6vw, 2rem)",
          lineHeight: 1.2, marginBottom: "12px", overflowWrap: "break-word" }}>
          {state.title}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.7, marginBottom: "20px" }}>
          {state.detail}
        </p>

        {validId && <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "8px" }}>
            Número de pedido
          </p>
          <p style={{ fontFamily: "monospace", fontSize: "11px", overflowWrap: "anywhere",
            padding: "10px", borderRadius: "var(--r-md)",
            background: "var(--surface-2)", border: "1px solid var(--border)",
            color: "var(--text-2)", margin: 0 }}>
            {id}
          </p>
        </div>}

        {unavailable && validId && <button type="button" onClick={() => refetch()}
          disabled={isFetching} style={{ border: "1px solid var(--border)",
            background: "var(--surface-2)", color: "var(--text)", borderRadius: "999px",
            padding: "12px 22px", marginBottom: "16px", fontWeight: 600,
            cursor: isFetching ? "wait" : "pointer" }}>
          {isFetching ? "Consultando…" : "Reintentar consulta"}
        </button>}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {state.kind === "pending" && <Button to={`/dashboard/orders/${id}`} variant="green" size="sm"
            style={{ width: "100%", justifyContent: "center", whiteSpace: "normal" }}>
            Ver pedido y opciones de pago
          </Button>}
          <Button to="/dashboard/orders" variant={state.kind === "pending" ? "light" : "green"} size="sm"
            style={{ width: "100%", justifyContent: "center" }}>
            Ver mis pedidos
          </Button>
          <Button to="/shop" variant="light" size="sm" style={{ width: "100%", justifyContent: "center" }}>
            Seguir comprando
          </Button>
        </div>
      </section>
    </main>
  )
}

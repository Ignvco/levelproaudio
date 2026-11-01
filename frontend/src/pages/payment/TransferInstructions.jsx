import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Landmark, MessageCircle, ArrowRight, RefreshCw } from "lucide-react"
import { getTransferInstructions } from "../../api/payments.api"
import { useSiteSettings } from "../../hooks/useSiteSettings"
import { useAuthStore } from "../../store/authStore"
import { validOrderId } from "./paymentReturn"

const messages = {
  loading: ["Consultando tu pedido", "Estamos recuperando las instrucciones de transferencia."],
  invalid: ["Pedido no válido", "Abrí el pedido desde tu cuenta para consultar su estado."],
  error: ["No pudimos consultar el pedido", "Actualizá el estado antes de transferir. Si ya pagaste, contactanos con el comprobante."],
  ready: ["Instrucciones de transferencia", "Completá el pago siguiendo estos pasos. Tu pedido se activará una vez confirmada la transferencia."],
  confirmed: ["Tu pedido ya está confirmado", "No hace falta realizar otra transferencia. Podés ver el detalle en tu cuenta."],
  cancelled: ["Pedido cancelado", "No realices una transferencia para este pedido. Si ya pagaste, contactanos con el comprobante."],
  refunded: ["Pago reembolsado", "Consultá el detalle del pedido o contactanos si necesitás ayuda."],
  review: ["Pago en revisión", "Estamos revisando el pago. No vuelvas a transferir mientras se resuelve."],
  unavailable: ["Instrucciones no disponibles", "Consultá el pedido o contactanos antes de transferir. No hay una cuenta habilitada para este pago."],
}
const card = { background: "#121212", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "var(--r-2xl)", overflow: "hidden" }

export default function TransferInstructions() {
  const { whatsappUrl } = useSiteSettings()
  const { id } = useParams()
  const userId = useAuthStore(s => s.user?.id)
  const orderId = validOrderId(id) ? id.toLowerCase() : null
  const query = useQuery({
    queryKey: ["transfer-instructions", userId, orderId],
    queryFn: () => getTransferInstructions(orderId), enabled: !!orderId,
    staleTime: 0, retry: false, refetchOnMount: "always", refetchOnWindowFocus: true,
    refetchInterval: q => q.state.status !== "error" && ["ready", "review"].includes(q.state.data?.state) ? 15000 : false,
  })
  const data = !query.isError && query.isFetchedAfterMount ? query.data : null
  const state = !orderId ? "invalid" : query.isError ? "error" : !data ? "loading" : (messages[data.state] ? data.state : "unavailable")
  const ready = state === "ready" && data.bank_accounts?.length > 0
  const [title, description] = messages[state]
  const amount = ready ? new Intl.NumberFormat("es-CL", { style: "currency", currency: data.currency }).format(Number(data.amount)) : ""
  const steps = [
    ["Realizá la transferencia", `Transferí exactamente ${amount} ${data?.currency || ""} a una de las cuentas indicadas.`],
    ["Incluí la referencia", `En el comentario de la transferencia escribí: ${data?.reference || ""}`],
    ["Envianos el comprobante", "Mandanos el comprobante por WhatsApp o al email de la cuenta para que podamos verificar tu pago."],
  ]
  return (
    <div data-testid="transfer-page" data-transfer-state={state} style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "clamp(104px, 12vw, 130px) clamp(20px, 5vw, 60px) clamp(60px, 8vw, 90px)",
      background: "radial-gradient(ellipse 60% 50% at 50% 20%, rgba(96,165,250,0.06) 0%, transparent 70%), var(--bg)",
    }}>
      <div style={{ width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ ...card, borderColor: "rgba(96,165,250,0.2)", padding: "clamp(32px, 5vw, 48px)", textAlign: "center" }} aria-live="polite">
          <Landmark size={30} style={{ color: "#60a5fa", margin: "0 auto 24px" }} />
          <h1 className="display-bold" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.7rem, 3.6vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "12px" }}>{title}</h1>
          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.7 }}>{description}</p>
        </div>
        {ready && data.bank_accounts.map(acc => (
          <div key={acc.id} style={card} data-testid="transfer-account">
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.15em" }}>· {acc.label}</p>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{data.currency}</span>
            </div>
            <div style={{ padding: "8px 24px 16px" }}>
              {[
                ["Banco", acc.bank_name], ["Tipo de cuenta", acc.account_type],
                [data.provider === "global66" ? "Alias / Cuenta" : "N° de cuenta", acc.account_number],
                ["Titular", acc.holder_name], ["RUT/CUIT", acc.holder_id], ["Email", acc.email],
                ["Monto exacto", amount], ["Referencia", data.reference],
              ].filter(([, value]) => value).map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", gap: "16px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-3)", flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, textAlign: "right", overflowWrap: "anywhere", minWidth: 0, color: label === "Monto exacto" ? "var(--accent)" : "var(--text)" }}>{value}</span>
                </div>
              ))}
              {acc.instructions && <p style={{ fontSize: "13px", color: "var(--text-3)", lineHeight: 1.6, paddingTop: "12px", whiteSpace: "pre-line" }}>{acc.instructions}</p>}
            </div>
          </div>
        ))}
        {ready && <div style={{ ...card, padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          {steps.map(([heading, text], i) => <div key={heading} style={{ display: "flex", gap: "16px" }}>
            <span style={{ color: "var(--accent)", fontWeight: 800 }}>{i + 1}</span>
            <div><p style={{ fontWeight: 700, marginBottom: "4px" }}>{heading}</p><p style={{ fontSize: "13px", color: "var(--text-3)", lineHeight: 1.6 }}>{text}</p></div>
          </div>)}
        </div>}
        {orderId && <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="btn btn-secondary" style={{ justifyContent: "center", gap: "8px" }}>
          <RefreshCw size={15} /> {query.isFetching ? "Consultando…" : "Actualizar estado"}
        </button>}
        <a href={whatsappUrl} target="_blank" rel="noreferrer" data-testid="transfer-whatsapp" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "16px 24px", borderRadius: "var(--r-full)", background: "var(--accent)", color: "#000", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>
          <MessageCircle size={17} /> {ready ? "Enviar comprobante por WhatsApp" : "Contactar a LevelPro"}<ArrowRight size={14} />
        </a>
        <Link to={orderId ? `/dashboard/orders/${orderId}` : "/dashboard/orders"} style={{ textAlign: "center", fontSize: "13px", color: "var(--text-3)", padding: "8px" }}>Ver mi pedido</Link>
      </div>
    </div>
  )
}

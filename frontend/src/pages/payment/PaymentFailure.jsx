import PaymentSuccess from "./PaymentSuccess"

// A return URL alone does not prove whether a charge occurred.
// Reuse the server-backed screen without executing a PayPal capture.
export default function PaymentFailure() {
  return <PaymentSuccess cancelledReturn />
}

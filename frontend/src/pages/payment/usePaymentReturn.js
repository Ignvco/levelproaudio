import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getOrder } from "../../api/orders.api"
import { capturePayPal } from "../../api/payments.api"
import { useAuthStore } from "../../store/authStore"
import { useCartStore } from "../../store/cartStore"
import {
  validOrderId, getOrderPaymentState, getPaymentReturnState,
  paymentPollInterval, captureErrorReference, consumeConfirmedCheckout,
} from "./paymentReturn"

export function usePaymentReturn(cancelledReturn = false) {
  const [params, setParams] = useSearchParams()
  const rawOrderId = params.get("order")
  const orderId = validOrderId(rawOrderId) ? rawOrderId.toLowerCase() : null
  const paymentId = params.get("paymentId")
  const payerId = params.get("PayerID")
  const validReference = value => typeof value === "string" && value.trim().length > 0 && value.length <= 255
  const hasPayPal = validReference(paymentId) && validReference(payerId)
  const incompletePayPal = !cancelledReturn && (params.has("paymentId") || params.has("PayerID")) && !hasPayPal
  const userId = useAuthStore(state => state.user?.id)
  const queryClient = useQueryClient()
  const attempts = useRef(new Map())
  const [capture, setCapture] = useState(null)
  const captureStatus = capture?.orderId === orderId ? capture.status : "idle"

  const query = useQuery({
    queryKey: ["payment-return-order", userId, orderId],
    queryFn: () => getOrder(orderId),
    enabled: !!orderId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
    refetchInterval: paymentPollInterval,
  })
  // Never capture against an inaccessible, cached-only or terminal order.
  const canCapture = !cancelledReturn && hasPayPal && query.isFetchedAfterMount &&
    !query.isError && getOrderPaymentState(query.data) === "pending"
  const { refetch } = query

  useEffect(() => {
    if (!canCapture) return
    let active = true
    const key = JSON.stringify([userId, orderId, paymentId, payerId])
    let attempt = attempts.current.get(key)
    if (!attempt) {
      attempt = capturePayPal(paymentId, payerId).then(
        result => ({ status: result?.status === "approved" ? "done" : "error", errorId: null }),
        error => ({ status: "error", errorId: captureErrorReference(error) }),
      )
      attempts.current.set(key, attempt)
    }
    setCapture({ orderId, status: "capturing", errorId: null })
    // StrictMode's setup/cleanup/setup subscribes to the same promise.
    attempt.then(result => {
      if (!active) return
      setCapture({ orderId, ...result })
      // Remove capture credentials from this history entry after the attempt.
      // Refreshing or checking status must not repeat an uncertain charge.
      setParams(current => {
        const next = new URLSearchParams(current)
        next.delete("paymentId")
        next.delete("PayerID")
        next.delete("token")
        return next
      }, { replace: true })
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] })
      void refetch()
    })
    return () => { active = false }
  }, [canCapture, userId, orderId, paymentId, payerId, queryClient, refetch, setParams])

  const state = !orderId ? "missing" : getPaymentReturnState({
    order: query.data,
    hasFetched: query.isFetchedAfterMount,
    error: query.error,
    captureStatus: canCapture && captureStatus === "idle" ? "capturing" : captureStatus,
    incompletePayPal,
  })

  useEffect(() => {
    if (state !== "confirmed") return
    const cart = useCartStore.getState()
    if (consumeConfirmedCheckout(orderId, cart)) cart.clearCart()
  }, [state, orderId])

  return {
    state,
    // Do not render another session's cached personal order data after an error.
    order: query.isFetchedAfterMount && !query.isError ? query.data : null,
    isFetching: query.isFetching,
    refresh: () => refetch(), // GET only; never retry a capture from this button.
    errorId: state === "capture_error" && capture?.orderId === orderId ? capture.errorId : null,
    unauthorized: [401, 403].includes(query.error?.response?.status),
  }
}

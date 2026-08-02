// loyalty.api.js — para el cliente
import api from "./client"

export const getMyLoyalty  = () =>
  api.get("/loyalty/me/").then(r => r.data)

export const redeemPoints  = (puntos) =>
  api.post("/loyalty/redeem/", { puntos }).then(r => r.data)

export const getLoyaltyTransactions = (nextUrl) => {
  const query = nextUrl ? nextUrl.split("?")[1] : null
  return api.get(query ? `/loyalty/transactions/?${query}` : "/loyalty/transactions/").then(r => r.data)
}
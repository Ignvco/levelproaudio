// loyalty.api.js — para el cliente
import api from "./client"

export const getMyLoyalty  = () =>
  api.get("/loyalty/me/").then(r => r.data)

export const redeemPoints  = (puntos) =>
  api.post("/loyalty/redeem/", { puntos }).then(r => r.data)
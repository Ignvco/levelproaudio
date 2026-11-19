// api/shipping.api.js — Logística regional (CL/AR) y validación fiscal RUT/CUIT (V3.3)
import api from "./client"

export const estimateShipping = ({ country, city, weight_kg = 1.0, currency }) =>
  api.post("/billing/shipping/estimate/", {
    country,
    city,
    weight_kg,
    currency,
  }).then(r => r.data)

export const validateTaxId = ({ country, tax_id }) =>
  api.post("/billing/tax/validate/", { country, tax_id }).then(r => r.data)

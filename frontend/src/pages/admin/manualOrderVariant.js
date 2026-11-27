// OMS ISS-10 — helpers puros para ventas manuales, sin ampliar contratos backend.
// Los metadatos de presentación nunca se envían al endpoint de creación.
export function manualProductRequiresVariant(product) {
  return Boolean(product && (
    product.has_variants === true
    || Number(product.variants_count || 0) > 0
    || (Array.isArray(product.variants) && product.variants.length > 0)
    || (Array.isArray(product.admin_variants) && product.admin_variants.length > 0)
  ))
}

export function availableManualVariants(product) {
  if (!product) return []
  const variants = Array.isArray(product.variants) && product.variants.length
    ? product.variants
    : (Array.isArray(product.admin_variants) ? product.admin_variants : [])
  return variants.filter((variant) => variant?.id != null && variant.is_active !== false)
}

export function manualVariantPrice(variant, currency) {
  const perCurrency = variant?.prices?.[currency]
  if (perCurrency != null && perCurrency !== "") return perCurrency
  if (currency === "CLP") return variant?.effective_price ?? variant?.price ?? null
  const explicit = currency === "USD" ? variant?.price_usd : currency === "ARS" ? variant?.price_ars : null
  return explicit ?? null
}

export function makeManualDraftLine({ product, variantId = "", quantity = 1, authorizedUnitPrice = "", currency = "CLP" }) {
  if (!product?.id) throw new Error("Selecciona un producto del catálogo.")
  const qty = Number(quantity)
  if (!Number.isSafeInteger(qty) || qty < 1) throw new Error("Introduce una cantidad entera positiva.")

  const requiresVariant = manualProductRequiresVariant(product)
  const variants = availableManualVariants(product)
  const variant = String(variantId).trim()
    ? variants.find((item) => String(item.id) === String(variantId))
    : null

  if (requiresVariant && variants.length === 0) {
    throw new Error("El producto requiere variante, pero no tiene variantes activas disponibles.")
  }
  if (requiresVariant && !variant) {
    throw new Error("Selecciona una variante activa para este producto.")
  }
  if (!requiresVariant && String(variantId).trim()) {
    throw new Error("El producto simple no admite una variante.")
  }

  const custom = String(authorizedUnitPrice ?? "").trim()
  if (custom && (!/^\d+(?:\.\d{1,2})?$/.test(custom) || Number(custom) <= 0)) {
    throw new Error("Introduce un precio autorizado válido, mayor que cero.")
  }

  return {
    product_id: product.id,
    ...(variant ? { variant_id: variant.id } : {}),
    quantity: qty,
    ...(custom ? { authorized_unit_price: custom } : {}),
    // Datos solo para la visualización de las líneas, nunca para el POST.
    product_name: product.name,
    variant_name: variant?.name || "",
    sku: variant?.sku || product.sku || "SKU",
    currency,
  }
}

export function toManualOrderPayloadLine(line) {
  return {
    product_id: line.product_id,
    ...(line.variant_id != null && String(line.variant_id) !== "" ? { variant_id: line.variant_id } : {}),
    quantity: line.quantity,
    ...(line.authorized_unit_price != null && String(line.authorized_unit_price) !== ""
      ? { authorized_unit_price: line.authorized_unit_price }
      : {}),
  }
}

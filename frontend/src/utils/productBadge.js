// utils/productBadge.js
//
// Un producto puede calificar para varias etiquetas a la vez (ej: con
// descuento Y poco stock) — mostramos UNA sola, la más relevante para
// la decisión de compra en ese momento. Prioridad, de más a menos
// urgente para el comprador:
//
//   1. Descuento activo       — la oferta real, siempre gana
//   2. Últimas unidades       — urgencia genuina (calculado en el
//                                backend, nunca revela el umbral real)
//   3. Preventa / A pedido    — expectativa de entrega distinta
//   4. Etiqueta curada        — Best Seller / Recomendado / etc.
//                                (elegida a mano en el admin)
//   5. Destacado              — el catch-all de siempre
export function getProductBadge(product) {
  const hasDiscount = product.compare_price && Number(product.compare_price) > Number(product.price)
  if (hasDiscount) {
    const pct = Math.round((1 - Number(product.price) / Number(product.compare_price)) * 100)
    return { label: `-${pct}%`, tone: "discount" }
  }
  if (product.is_low_stock) {
    return { label: "🚨 Últimas unidades", tone: "urgent" }
  }
  if (product.stock === 0 && product.product_type === "preorder") {
    return { label: "Preventa", tone: "neutral" }
  }
  if (product.stock === 0 && product.product_type === "on_demand") {
    return { label: "A pedido", tone: "neutral" }
  }
  if (product.badge && product.badge_display) {
    return { label: product.badge_display, tone: "curated" }
  }
  if (product.is_featured) {
    return { label: "Destacado", tone: "neutral" }
  }
  return null
}

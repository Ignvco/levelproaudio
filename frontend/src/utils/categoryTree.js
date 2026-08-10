// utils/categoryTree.js
//
// Arma el árbol padre → hijas a partir del listado plano que devuelve
// la API — así cualquier lugar que lo use refleja SIEMPRE las
// categorías reales del admin, sin tener que tocar código cada vez
// que se agrega una nueva. Antes vivía duplicado en MainLayout (mega
// menu) — ahora es un solo lugar, reusado también en el sidebar de
// filtros de la tienda.
//
// Categorías sin productos (ni propios ni de sus hijas) se ocultan,
// para no ofrecer un filtro que lleva a resultados vacíos.
export function buildCategoryTree(categories) {
  if (!categories?.length) return []
  const byParent = {}
  categories.forEach(c => {
    const key = c.parent || "root"
    if (!byParent[key]) byParent[key] = []
    byParent[key].push(c)
  })
  const withProducts = (cat) => {
    const children = byParent[cat.id] || []
    const childCount = children.reduce((sum, ch) => sum + ch.product_count, 0)
    return cat.product_count > 0 || childCount > 0
  }
  return (byParent.root || [])
    .filter(withProducts)
    .map(top => ({ ...top, children: (byParent[top.id] || []).filter(c => c.product_count > 0) }))
}

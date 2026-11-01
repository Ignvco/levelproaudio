// One owner for document metadata, including tags delivered in the initial HTML.
// Page records override the route fallback; unmounting removes stale metadata.
const records = new Map()
const staticTitles = {
  "/": undefined, "/shop": "Tienda", "/academy": "Academia", "/services": "Servicios",
  "/bajo-pedido": "Equipos bajo pedido", "/rewards": "Rewards",
  "/terminos": "Términos y condiciones", "/privacidad": "Política de privacidad",
  "/bases-sorteo": "Bases de los sorteos", "/garantia": "Garantías y devoluciones", "/envios": "Política de envíos",
}
export function routeSeo(pathname) {
  const path = pathname.replace(/\/$/, "") || "/"
  if (Object.hasOwn(staticTitles, path)) return { title: staticTitles[path], noindex: false }
  if (/^\/(shop|academy|services)\/[^/]+$/.test(path)) return { title: "Consultando contenido", noindex: true }
  return { title: "LevelPro Audio", noindex: true }
}
export function isPublicSeoPath(pathname) {
  const path = pathname.replace(/\/$/, "") || "/"
  return Object.hasOwn(staticTitles, path) || /^\/(shop|academy|services)\/[^/]+$/.test(path)
}

function upsert(doc, selector, tag, attributes, text) {
  const matches = [...doc.head.querySelectorAll(selector)]
  const element = matches.shift() || doc.createElement(tag)
  for (const duplicate of matches) duplicate.remove()
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
  element.removeAttribute("data-initial-seo")
  element.setAttribute("data-managed-seo", "")
  if (text !== undefined) element.textContent = text
  if (!element.isConnected) doc.head.append(element)
}

export function applyHead(metadata, doc = document) {
  upsert(doc, "title", "title", {}, metadata.title)
  upsert(doc, 'link[rel="canonical"]', "link", { rel: "canonical", href: metadata.canonical })
  for (const [name, content] of Object.entries({
    description: metadata.description, robots: metadata.noindex ? "noindex, nofollow" : "index, follow",
    "twitter:card": "summary_large_image", "twitter:title": metadata.title,
    "twitter:description": metadata.description, "twitter:image": metadata.image,
  })) upsert(doc, `meta[name="${name}"]`, "meta", { name, content })
  for (const [property, content] of Object.entries({
    "og:site_name": metadata.siteName, "og:title": metadata.title,
    "og:description": metadata.description, "og:image": metadata.image,
    "og:type": metadata.type, "og:url": metadata.canonical,
  })) upsert(doc, `meta[property="${property}"]`, "meta", { property, content })
}

export function registerHead(metadata, priority = 10) {
  const id = Symbol("seo")
  const refresh = () => {
    const winner = [...records.values()].sort((a, b) => b.priority - a.priority)[0]
    if (winner) applyHead(winner.metadata)
  }
  records.set(id, { metadata, priority })
  refresh()
  return () => { records.delete(id); refresh() }
}

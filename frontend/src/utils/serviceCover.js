// utils/serviceCover.js
// Portada del servicio: usa la imagen subida (thumbnail) si existe;
// si no, cae a una portada real curada por slug / categoría, para que la
// card luzca como la referencia aún sin imagen cargada en la BD.
import { mediaUrl } from "./mediaUrl"

const W = "&w=900&q=80"

// Por slug de servicio (portadas distintas para cada uno)
const BY_SLUG = {
  "asesoria-estudio": "https://images.unsplash.com/photo-1691244426900-a2afecb27766?crop=entropy&cs=srgb&fm=jpg" + W,
  "mastering":        "https://images.unsplash.com/photo-1618609377864-68609b857e90?crop=entropy&cs=srgb&fm=jpg" + W,
  "mezcla-pro":       "https://images.unsplash.com/photo-1518972559570-7cc1309f3229?crop=entropy&cs=srgb&fm=jpg" + W,
  "operador-vivo":    "https://images.unsplash.com/photo-1504904126298-3fde501c9b31?crop=entropy&cs=srgb&fm=jpg" + W,
}

// Por slug de categoría (fallback general)
const BY_CATEGORY = {
  "estudio": "https://images.unsplash.com/photo-1535406208535-1429839cfd13?crop=entropy&cs=srgb&fm=jpg" + W,
  "live":    "https://images.unsplash.com/photo-1563841930606-67e2bce48b78?crop=entropy&cs=srgb&fm=jpg" + W,
}

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?crop=entropy&cs=srgb&fm=jpg" + W

export function serviceCover(service) {
  if (service?.thumbnail) return mediaUrl(service.thumbnail)
  if (service?.slug && BY_SLUG[service.slug]) return BY_SLUG[service.slug]
  const catSlug = service?.category?.slug || service?.category_slug
  if (catSlug && BY_CATEGORY[catSlug]) return BY_CATEGORY[catSlug]
  return DEFAULT_COVER
}

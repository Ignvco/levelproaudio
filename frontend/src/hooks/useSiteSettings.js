// hooks/useSiteSettings.js
//
// Antes, varios componentes tenían el número de WhatsApp (y otros
// datos de contacto) pegados a mano en el código — cambiar el número
// desde el admin no movía nada en el sitio real. Este hook centraliza
// el acceso a la configuración real, con React Query cacheando el
// resultado entre todos los componentes que lo usen (una sola llamada
// de red, sin importar cuántos componentes lo pidan en la misma página).
//
// OJO: contact_whatsapp guarda el NÚMERO ("+5492622635045"), no la URL
// completa. contact_instagram guarda el USUARIO ("levelproar"), no la
// URL. Este hook arma las URLs reales a partir de esos valores crudos.
import { useQuery } from "@tanstack/react-query"
import { getSiteSettings } from "../api/siteSettings.api"

// Fallbacks — se usan solo si la configuración todavía no cargó, o si
// el campo está vacío en el admin.
const FALLBACK_WHATSAPP_NUMBER = "+5492622635045"
const FALLBACK_INSTAGRAM_USER  = "levelproar"
const FALLBACK_EMAIL           = "ventas@levelproaudio.com"
const FALLBACK_SITE_NAME       = "LevelPro Audio"

export function useSiteSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: getSiteSettings,
    staleTime: 5 * 60 * 1000, // 5 min — no hace falta refrescar más seguido
  })

  const whatsappNumber = data?.contact_whatsapp || FALLBACK_WHATSAPP_NUMBER
  const instagramUser  = data?.contact_instagram || FALLBACK_INSTAGRAM_USER
  const contactEmail   = data?.contact_email || FALLBACK_EMAIL

  return {
    settings: data,
    isLoading,
    // wa.me necesita el número SIN el "+" ni espacios/guiones
    whatsappUrl: `https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}`,
    instagramUrl: `https://instagram.com/${instagramUser.replace(/^@/, "")}`,
    contactEmail,
    siteName: data?.site_name || FALLBACK_SITE_NAME,
    tagline: data?.tagline || "",
    // logoUrl es null si nunca se subió un logo propio — cada lugar que
    // lo use decide su propio fallback (el logo estático de siempre),
    // porque el fallback correcto depende del contexto (fondo claro vs
    // oscuro, tamaño, etc.)
    logoUrl: data?.logo_url || null,
  }
}

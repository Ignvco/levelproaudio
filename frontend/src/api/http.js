import axios from "axios"

const options = {
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
}

// Sin interceptores de sesión: puede inicializar CSRF con el access expirado.
const csrfClient = axios.create(options)
let csrfRequest = null

function hasCsrfCookie() {
  return document.cookie.split(";").some((cookie) =>
    cookie.trim().startsWith("csrftoken=") && cookie.trim() !== "csrftoken="
  )
}

export function createApiClient() {
  const client = axios.create(options)
  client.interceptors.request.use(async (config) => {
    const method = (config.method || "get").toUpperCase()
    if (["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) return config

    const target = new URL(client.getUri(config), window.location.href)
    if (target.origin !== window.location.origin) return config

    // Sesiones previas al patch y visitas nuevas obtienen la cookie antes de escribir.
    // Una sola petición compartida evita carreras al emitir varias escrituras juntas.
    if (!hasCsrfCookie()) {
      if (!csrfRequest) {
        csrfRequest = csrfClient.get("/auth/csrf/").finally(() => {
          csrfRequest = null
        })
      }
      await csrfRequest
    }
    // Axios lee la cookie actual al enviar: incluye la rotación después del login.
    return config
  })
  return client
}

export const authClient = createApiClient()

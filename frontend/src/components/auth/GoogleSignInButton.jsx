// components/auth/GoogleSignInButton.jsx
//
// Carga el script real de Google Identity Services y renderiza el
// botón oficial de Google. Cuando el usuario elige su cuenta, Google
// nos da un ID token firmado — lo mandamos tal cual al backend, que es
// quien lo verifica de verdad contra Google (acá nunca confiamos en
// nada que pudiera venir manipulado del lado del cliente).
import { useEffect, useRef, useState } from "react"

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCRIPT_SRC = "https://accounts.google.com/gsi/client"

let scriptLoadingPromise = null
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return scriptLoadingPromise
}

export default function GoogleSignInButton({ onSuccess, onError, text = "continue_with" }) {
  const buttonRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return  // sin credenciales configuradas, no renderiza nada
    let cancelled = false

    loadGoogleScript().then(() => {
      if (cancelled || !buttonRef.current) return
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => {
          if (response?.credential) onSuccess(response.credential)
          else onError?.(new Error("Google no devolvió credenciales."))
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text,
        width: 360,
      })
      setReady(true)
    }).catch(() => onError?.(new Error("No se pudo cargar Google Sign-In.")))

    return () => { cancelled = true }
  }, [onSuccess, onError, text])

  if (!CLIENT_ID) return null  // feature apagada si no hay Client ID configurado

  return (
    <div style={{ display: "flex", justifyContent: "center", minHeight: ready ? "auto" : "44px" }}>
      <div ref={buttonRef} data-testid="google-signin-button" />
    </div>
  )
}

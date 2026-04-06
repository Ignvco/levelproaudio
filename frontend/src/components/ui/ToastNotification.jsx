// components/ui/ToastNotification.jsx
import { useEffect, useState } from "react"

let toastTimeout

export function showToast(message, type = "success") {
  window.dispatchEvent(new CustomEvent("show-toast", {
    detail: { message, type }
  }))
}

export default function ToastNotification() {
  const [toast, setToast]     = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      setToast(e.detail)
      setVisible(true)
      clearTimeout(toastTimeout)
      toastTimeout = setTimeout(() => setVisible(false), 3000)
    }
    window.addEventListener("show-toast", handler)
    return () => window.removeEventListener("show-toast", handler)
  }, [])

  if (!toast) return null

  const colors = {
    success: { bg: "var(--accent)",  text: "#000"           },
    error:   { bg: "var(--danger)",  text: "#fff"           },
    info:    { bg: "var(--surface)", text: "var(--text)"    },
  }
  const c = colors[toast.type] || colors.info

  return (
    <div style={{
      position:     "fixed",
      bottom:       "28px",
      left:         "50%",
      transform:    `translateX(-50%) translateY(${visible ? "0" : "12px"})`,
      opacity:      visible ? 1 : 0,
      zIndex:       99990,
      pointerEvents:"none",
      transition:   "all 350ms cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      <div style={{
        background:    c.bg,
        color:         c.text,
        padding:       "12px 22px",
        borderRadius:  "var(--r-full)",
        fontSize:      "14px",
        fontWeight:    500,
        boxShadow:     "0 8px 32px rgba(0,0,0,0.4)",
        whiteSpace:    "nowrap",
        display:       "flex",
        alignItems:    "center",
        gap:           "8px",
      }}>
        {toast.type === "success" && "✓"}
        {toast.message}
      </div>
    </div>
  )
}
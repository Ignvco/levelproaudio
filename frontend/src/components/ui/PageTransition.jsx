// components/ui/PageTransition.jsx
import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

export default function PageTransition({ children }) {
  const location = useLocation()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => {
      setVisible(true)
    }, 80)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <div style={{
      opacity:    visible ? 1 : 0,
      // A transformed app root makes fixed dialogs relative to page height.
      // Keep the fade without moving fixed navigation or modal actions offscreen.
      transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      {children}
    </div>
  )
}

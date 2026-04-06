// components/ui/PageTransition.jsx
import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

export default function PageTransition({ children }) {
  const location = useLocation()
  const [visible, setVisible] = useState(true)
  const [key, setKey]         = useState(location.pathname)

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => {
      setKey(location.pathname)
      setVisible(true)
    }, 80)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <div style={{
      opacity:    visible ? 1 : 0,
      transform:  visible ? "translateY(0)" : "translateY(8px)",
      transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      {children}
    </div>
  )
}
// components/ErrorBoundary.jsx
//
// Atrapa errores de render en el árbol de componentes y muestra un
// fallback en vez de dejar la pantalla en blanco. Sin esto, cualquier
// excepción no controlada en un componente tumba toda la app en producción.
import { Component } from "react"

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Acá es el lugar natural para mandar el error a un servicio de
    // monitoreo (Sentry, etc.) si en algún momento se agrega uno.
    console.error("[ErrorBoundary]", error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.href = "/"
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            textAlign: "center",
            padding: "32px",
            color: "var(--text)",
            fontFamily: "var(--font-sans)",
          }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 600 }}>
            Algo salió mal
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-2)", maxWidth: "40ch" }}>
            Ocurrió un error inesperado. Podés intentar recargar la página o
            volver al inicio.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: "10px 20px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "var(--bg)",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Volver al inicio
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

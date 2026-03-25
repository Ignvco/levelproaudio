// App.jsx
// Definición de todas las rutas de la aplicación
// ProtectedRoute redirige al login si el usuario no está autenticado

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "./store/authStore"

// Layouts
import MainLayout from "./layouts/MainLayout"
import DashboardLayout from "./layouts/DashboardLayout"

// Páginas públicas
import Home from "./pages/Home"
import Shop from "./pages/Shop"
import ProductDetail from "./pages/ProductDetail"
import Login from "./pages/Login"

// Páginas protegidas
import Dashboard from "./pages/Dashboard"

// ── Rutas protegidas ────────────────────────────────────────
// Si el usuario no está autenticado, redirige al login
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// ── App ─────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Rutas públicas con MainLayout ── */}
        <Route
          path="/"
          element={
            <MainLayout>
              <Home />
            </MainLayout>
          }
        />
        <Route
          path="/shop"
          element={
            <MainLayout>
              <Shop />
            </MainLayout>
          }
        />
        <Route
          path="/shop/:slug"
          element={
            <MainLayout>
              <ProductDetail />
            </MainLayout>
          }
        />

        {/* ── Auth ── */}
        <Route path="/login" element={<Login />} />

        {/* ── Rutas protegidas con DashboardLayout ── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* ── 404 → redirige al inicio ── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  )
}

// App.jsx — agrega estos imports arriba
import Cart from "./pages/Cart"
import Checkout from "./pages/Checkout"
import OrderConfirmation from "./pages/OrderConfirmation"

// Y estas rutas dentro de <Routes>

{/* Carrito — público pero usa auth en checkout */}
<Route
  path="/cart"
  element={
    <MainLayout>
      <Cart />
    </MainLayout>
  }
/>

{/* Checkout — protegido */}
<Route
  path="/checkout"
  element={
    <ProtectedRoute>
      <MainLayout>
        <Checkout />
      </MainLayout>
    </ProtectedRoute>
  }
/>

{/* Confirmación de orden */}
<Route
  path="/order-confirmation/:id"
  element={
    <ProtectedRoute>
      <MainLayout>
        <OrderConfirmation />
      </MainLayout>
    </ProtectedRoute>
  }
/>


export default App


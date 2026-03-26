// App.jsx
// Definición de todas las rutas de la aplicación
// ProtectedRoute redirige al login si el usuario no está autenticado

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "./store/authStore"

import Orders from "./pages/dashboard/Orders"
import OrderDetail from "./pages/dashboard/OrderDetail"
import Profile from "./pages/dashboard/Profile"

// Layouts
import MainLayout from "./layouts/MainLayout"
import DashboardLayout from "./layouts/DashboardLayout"

// Páginas públicas
import Home from "./pages/Home"
import Shop from "./pages/Shop"
import ProductDetail from "./pages/ProductDetail"
import Login from "./pages/Login"
import Academy from "./pages/Academy"
import Services from "./pages/Services"
import Cart from "./pages/Cart"

// Páginas protegidas
import Dashboard from "./pages/Dashboard"
import Checkout from "./pages/Checkout"
import OrderConfirmation from "./pages/OrderConfirmation"


//aCADEMY
// Imports nuevos
import CourseDetail from "./pages/CourseDetail"
import MyCourses from "./pages/dashboard/MyCourses"

// ── Rutas protegidas ────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// ── App ─────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Públicas ── */}
        <Route path="/" element={<MainLayout><Home /></MainLayout>} />
        <Route path="/shop" element={<MainLayout><Shop /></MainLayout>} />
        <Route path="/shop/:slug" element={<MainLayout><ProductDetail /></MainLayout>} />
        <Route path="/academy" element={<MainLayout><Academy /></MainLayout>} />
        <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
        <Route path="/cart" element={<MainLayout><Cart /></MainLayout>} />    
        <Route path="/academy" element={<MainLayout><Academy /></MainLayout>}/>  
        <Route path="/academy/:slug" element={<MainLayout><CourseDetail /></MainLayout>}/>  
        {/* ── Auth ── */}
        <Route path="/login" element={<Login />} />

        {/* ── Protegidas ── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout><Dashboard /></DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/orders"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Orders />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/orders/:id"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <OrderDetail />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/profile"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Profile />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/courses"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MyCourses />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <MainLayout><Checkout /></MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-confirmation/:id"
          element={
            <ProtectedRoute>
              <MainLayout><OrderConfirmation /></MainLayout>
            </ProtectedRoute>
          }
        />

        {/* ── 404 ── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App
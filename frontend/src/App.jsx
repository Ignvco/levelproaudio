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
import Register from "./pages/Register"

// Páginas protegidas
import Dashboard from "./pages/Dashboard"
import Checkout from "./pages/Checkout"
import OrderConfirmation from "./pages/OrderConfirmation"


//aCADEMY
// Imports nuevos
import CourseDetail from "./pages/CourseDetail"
import MyCourses from "./pages/dashboard/MyCourses"

import ServiceDetail from "./pages/ServiceDetail"
import MyServices from "./pages/dashboard/MyServices"

// Imports nuevos
import PaymentSuccess from "./pages/payment/PaymentSuccess"
import PaymentFailure from "./pages/payment/PaymentFailure"
import TransferInstructions from "./pages/payment/TransferInstructions"
import NotFound from "./pages/NotFound"



import AdminLayout      from "./layouts/AdminLayout"
import AdminDashboard   from "./pages/admin/AdminDashboard"
import AdminOrders      from "./pages/admin/AdminOrders"
import AdminProducts    from "./pages/admin/AdminProducts"
import AdminUsers       from "./pages/admin/AdminUsers"
import AdminPayments    from "./pages/admin/AdminPayments"
import AdminAcademy     from "./pages/admin/AdminAcademy"
import AdminServices    from "./pages/admin/AdminServices"
import AdminAnalytics from "./pages/admin/AdminAnalytics"

// ── Rutas protegidas ────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}


// Agrega después de ProtectedRoute en App.jsx
function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Agrega console.log para debug
  console.log("user admin check:", user?.is_staff, user?.is_superuser)
  if (!user?.is_staff && !user?.is_superuser) return <Navigate to="/" replace />
  return children
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
        <Route path="/academy" element={<MainLayout><Academy /></MainLayout>} />
        <Route path="/academy/:slug" element={<MainLayout><CourseDetail /></MainLayout>} />
        <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
        <Route path="/services/:slug" element={<MainLayout><ServiceDetail /></MainLayout>} />

        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index         element={<AdminDashboard />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="orders"   element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="users"    element={<AdminUsers />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="academy"  element={<AdminAcademy />} />
          <Route path="services" element={<AdminServices />} />
        </Route>

        {/* ── Auth ── */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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
          path="/dashboard/services"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MyServices />
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
        <Route path="/payment/success"
          element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>}
        />
        <Route path="/payment/failure"
          element={<PaymentFailure />}
        />
        <Route path="/payment/pending"
          element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>}
        />
        <Route path="/payment/transfer/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TransferInstructions />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* ── 404 ── */}
       <Route path="*" element={<NotFound />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App
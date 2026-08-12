// App.jsx
// Definición de todas las rutas de la aplicación
// ProtectedRoute redirige al login si el usuario no está autenticado
// components/ui/PageTransition"
import PageTransition from "./components/ui/PageTransition"
import { Routes, Route, Navigate } from "react-router-dom"
import { useEffect, Suspense, lazy } from "react"
import { useAuthStore } from "./store/authStore"
import SeoGlobal from "./components/SeoGlobal"
import Analytics from "./components/Analytics"


import Orders from "./pages/dashboard/Orders"
import OrderDetail from "./pages/dashboard/OrderDetail"
import Profile from "./pages/dashboard/Profile"
import AdminLogin from "./pages/admin/AdminLogin"



// Layouts
import MainLayout from "./layouts/MainLayout"
import DashboardLayout from "./layouts/DashboardLayout"

// Páginas públicas
import Home from "./pages/Home"
import Shop from "./pages/Shop"
import ProductDetail from "./pages/ProductDetail"
import Login from "./pages/Login"
import Academy from "./pages/Academy"
import Blog from "./pages/Blog"
import BlogArticle from "./pages/BlogArticle"
import Services from "./pages/Services"
import Cart from "./pages/Cart"
import Register from "./pages/Register"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Terminos from "./pages/legal/Terminos"
import Privacidad from "./pages/legal/Privacidad"
import BasesSorteo from "./pages/legal/BasesSorteo"
import PoliticaGarantia from "./pages/legal/PoliticaGarantia"
import PoliticaEnvios from "./pages/legal/PoliticaEnvios"

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
import MyBookings from "./pages/dashboard/MyBookings"

// Imports nuevos
import PaymentSuccess from "./pages/payment/PaymentSuccess"
import PaymentFailure from "./pages/payment/PaymentFailure"
import TransferInstructions from "./pages/payment/TransferInstructions"
import NotFound from "./pages/NotFound"



// Panel de admin: code-splitting — solo lo descarga quien entra a /admin,
// los visitantes de la tienda pública nunca bajan este código.
const AdminLayout                  = lazy(() => import("./layouts/AdminLayout"))
const AdminDashboard               = lazy(() => import("./pages/admin/AdminDashboard"))
const AdminOrders                  = lazy(() => import("./pages/admin/AdminOrders"))
const AdminProducts                = lazy(() => import("./pages/admin/AdminProducts"))
const AdminUsers                   = lazy(() => import("./pages/admin/AdminUsers"))
const AdminPayments                = lazy(() => import("./pages/admin/AdminPayments"))
const AdminAcademy                 = lazy(() => import("./pages/admin/AdminAcademy"))
const AdminServices                = lazy(() => import("./pages/admin/AdminServices"))
const AdminAnalytics               = lazy(() => import("./pages/admin/AdminAnalytics"))
const AdminCategories              = lazy(() => import("./pages/admin/AdminCategories"))
const AdminBrands                  = lazy(() => import("./pages/admin/AdminBrands"))
const AdminSettings                = lazy(() => import("./pages/admin/AdminSettings"))
const AdminModules                 = lazy(() => import("./pages/admin/AdminModules"))
const AdminLessons                 = lazy(() => import("./pages/admin/AdminLessons"))
const AdminEnrollments             = lazy(() => import("./pages/admin/AdminEnrollments"))
const AdminProductImport           = lazy(() => import("./pages/admin/AdminProductImport"))
const AdminFinance                 = lazy(() => import("./pages/admin/AdminFinance"))
const AdminInventory               = lazy(() => import("./pages/admin/AdminInventory"))
const ExecutiveDashboard           = lazy(() => import("./pages/admin/ExecutiveDashboard"))
const AdminLoyalty                 = lazy(() => import("./pages/admin/AdminLoyalty"))
const AdminBilling                 = lazy(() => import("./pages/admin/AdminBilling"))

// Rewards
import Rewards from "./pages/Rewards"
import MyEntries from "./pages/dashboard/MyEntries"
import MyLoyalty from "./pages/dashboard/MyLoyalty"
import MyFavorites from "./pages/dashboard/MyFavorites"
const AdminRewards                 = lazy(() => import("./pages/admin/AdminRewards"))
const AdminRewardsCampaigns        = lazy(() => import("./pages/admin/AdminRewardsCampaigns"))
const AdminRewardsCampaignDetail   = lazy(() => import("./pages/admin/AdminRewardsCampaignDetail"))
const AdminRewardsEntries          = lazy(() => import("./pages/admin/AdminRewardsEntries"))
const AdminRewardsWinners          = lazy(() => import("./pages/admin/AdminRewardsWinners"))

// Fallback simple mientras carga el chunk del panel de admin
function AdminLoading() {
  return (
    <div style={{
      minHeight: "60vh", display: "flex", alignItems: "center",
      justifyContent: "center", color: "var(--text-2)", fontSize: "14px",
    }}>
      Cargando panel…
    </div>
  )
}

// ── Rutas protegidas ────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Si es admin, lo mandamos al panel admin, no al dashboard de usuario
  if (user?.is_staff || user?.is_superuser) return <Navigate to="/admin" replace />
  return children
}


function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_staff && !user?.is_superuser) return <Navigate to="/" replace />
  return children
}
// ── App ─────────────────────────────────────────────────────
function App() {
  // Valida la sesión contra la cookie HTTPOnly al cargar la app.
  useEffect(() => {
    useAuthStore.getState().checkAuth()
  }, [])

  return (
    
    <PageTransition>
      <SeoGlobal />
      <Analytics />
      <Routes>

        <Route path="/admin/login" element={<AdminLogin />} />

        {/* ── Públicas ── */}
        <Route path="/" element={<MainLayout><Home /></MainLayout>} />
        <Route path="/shop" element={<MainLayout><Shop /></MainLayout>} />
        <Route path="/shop/:slug" element={<MainLayout><ProductDetail /></MainLayout>} />
        <Route path="/cart" element={<MainLayout><Cart /></MainLayout>} />
        <Route path="/academy" element={<MainLayout><Academy /></MainLayout>} />
        <Route path="/academy/:slug" element={<MainLayout><CourseDetail /></MainLayout>} />
        <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
        <Route path="/services/:slug" element={<MainLayout><ServiceDetail /></MainLayout>} />
        <Route path="/blog" element={<MainLayout><Blog /></MainLayout>} />
        <Route path="/blog/:slug" element={<MainLayout><BlogArticle /></MainLayout>} />

        {/* Rewards público */}
        <Route path="/rewards" element={<MainLayout><Rewards /></MainLayout>} />

        {/* Legales */}
        <Route path="/terminos" element={<MainLayout><Terminos /></MainLayout>} />
        <Route path="/privacidad" element={<MainLayout><Privacidad /></MainLayout>} />
        <Route path="/bases-sorteo" element={<MainLayout><BasesSorteo /></MainLayout>} />
        <Route path="/garantia" element={<MainLayout><PoliticaGarantia /></MainLayout>} />
        <Route path="/envios" element={<MainLayout><PoliticaEnvios /></MainLayout>} />

        <Route path="/admin" element={<AdminRoute><Suspense fallback={<AdminLoading />}><AdminLayout /></Suspense></AdminRoute>}>
          <Route index element={<Suspense fallback={<AdminLoading />}><AdminDashboard /></Suspense>} />
          <Route path="analytics" element={<Suspense fallback={<AdminLoading />}><AdminAnalytics /></Suspense>} />
          <Route path="/admin/executive" element={<Suspense fallback={<AdminLoading />}><ExecutiveDashboard /></Suspense>} />
          <Route path="/admin/finance" element={<Suspense fallback={<AdminLoading />}><AdminFinance /></Suspense>} />
          <Route path="/admin/billing" element={<Suspense fallback={<AdminLoading />}><AdminBilling /></Suspense>} />
          <Route path="/admin/loyalty" element={<Suspense fallback={<AdminLoading />}><AdminLoyalty /></Suspense>} />
          <Route path="orders" element={<Suspense fallback={<AdminLoading />}><AdminOrders /></Suspense>} />
          <Route path="products" element={<Suspense fallback={<AdminLoading />}><AdminProducts /></Suspense>} />
          <Route path="products/import" element={<Suspense fallback={<AdminLoading />}><AdminProductImport /></Suspense>} />
          <Route path="/admin/inventory" element={<Suspense fallback={<AdminLoading />}><AdminInventory /></Suspense>} />
          <Route path="brands"     element={<Suspense fallback={<AdminLoading />}><AdminBrands /></Suspense>} />
          <Route path="categories" element={<Suspense fallback={<AdminLoading />}><AdminCategories /></Suspense>} />
          <Route path="users" element={<Suspense fallback={<AdminLoading />}><AdminUsers /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={<AdminLoading />}><AdminPayments /></Suspense>} />
          <Route path="academy" element={<Suspense fallback={<AdminLoading />}><AdminAcademy /></Suspense>} />
          <Route path="academy/modules"     element={<Suspense fallback={<AdminLoading />}><AdminModules /></Suspense>} />
          <Route path="academy/lessons"     element={<Suspense fallback={<AdminLoading />}><AdminLessons /></Suspense>} />
          <Route path="services" element={<Suspense fallback={<AdminLoading />}><AdminServices /></Suspense>} />
          <Route path="academy/enrollments" element={<Suspense fallback={<AdminLoading />}><AdminEnrollments /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<AdminLoading />}><AdminSettings /></Suspense>} />

          {/* Rewards */}
          <Route path="rewards"                       element={<Suspense fallback={<AdminLoading />}><AdminRewards /></Suspense>} />
          <Route path="rewards/campaigns"             element={<Suspense fallback={<AdminLoading />}><AdminRewardsCampaigns /></Suspense>} />
          <Route path="rewards/campaigns/:id"         element={<Suspense fallback={<AdminLoading />}><AdminRewardsCampaignDetail /></Suspense>} />
          <Route path="rewards/entries"               element={<Suspense fallback={<AdminLoading />}><AdminRewardsEntries /></Suspense>} />
          <Route path="rewards/winners"               element={<Suspense fallback={<AdminLoading />}><AdminRewardsWinners /></Suspense>} />
        </Route>

        {/* ── Auth ── */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ── Protegidas ── */}
        <Route path="/dashboard" element={<ProtectedRoute>
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
          path="/dashboard/bookings"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MyBookings />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/rewards"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MyEntries />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/loyalty"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MyLoyalty />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/favorites"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <MyFavorites />
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
      </PageTransition>
   
  )
}

export default App
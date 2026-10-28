import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Layouts
import PublicLayout from './layouts/PublicLayout'
import CustomerLayout from './layouts/CustomerLayout'
import StaffLayout from './layouts/StaffLayout'
import AdminLayout from './layouts/AdminLayout'

// Pages – Auth
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ProfilePage from './pages/auth/ProfilePage'

// Pages – Public
import HomePage from './pages/HomePage'

// Pages – Customer
import PetsPage from './pages/customer/PetsPage'
import ServiceCatalogPage from './pages/customer/ServiceCatalogPage'

// Pages – Staff
import StaffDashboard from './pages/staff/StaffDashboard'
import PetsManagePage from './pages/staff/PetsManagePage'
import MyShiftsPage from './pages/staff/MyShiftsPage'

// Pages – Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import ServicesAdminPage from './pages/admin/ServicesAdminPage'
import UsersManagePage from './pages/admin/UsersManagePage'
import ShiftsManagePage from './pages/admin/ShiftsManagePage'

// Pages – Public & Shared
import EmployeesPage from './pages/public/EmployeesPage'

// Pages – 404
import NotFoundPage from './pages/NotFoundPage'

/**
 * ProfileRoute: Route /profile hiển thị trong layout tương ứng với role hiện tại
 */
const ProfileRoute = () => {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  const layoutMap = {
    admin: <AdminLayout />,
    staff: <StaffLayout />,
    customer: <CustomerLayout />,
  }
  const Layout = () => layoutMap[user.role_name] || <CustomerLayout />

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public routes (không cần đăng nhập) ─────────────────── */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* ── /profile: cho phép cả 3 role, layout theo role ────────── */}
          <Route element={<ProtectedRoute allowedRoles={['customer', 'staff', 'admin']} />}>
            <Route path="/profile" element={<ProfileRoute />}>
              <Route index element={<ProfilePage />} />
            </Route>
          </Route>

          {/* ── Customer routes ────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
            <Route element={<CustomerLayout />}>
              <Route path="/pets" element={<PetsPage />} />
              <Route path="/services" element={<ServiceCatalogPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
            </Route>
          </Route>

          {/* ── Staff routes ───────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['staff']} />}>
            <Route element={<StaffLayout />}>
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/staff/pets" element={<PetsManagePage />} />
              <Route path="/staff/shifts" element={<MyShiftsPage />} />
              <Route path="/staff/services" element={<ServiceCatalogPage />} />
            </Route>
          </Route>

          {/* ── Admin routes ───────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UsersManagePage />} />
              <Route path="/admin/shifts" element={<ShiftsManagePage />} />
              <Route path="/admin/services" element={<ServicesAdminPage />} />
              <Route path="/admin/pets" element={<PetsManagePage />} />
            </Route>
          </Route>

          {/* ── 404 ────────────────────────────────────────────────────── */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
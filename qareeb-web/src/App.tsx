import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/store/AuthContext'
import { RideProvider } from '@/store/RideContext'
import { DriverProvider } from '@/store/DriverContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminRoute from '@/components/AdminRoute'
import DriverRoute from '@/components/DriverRoute'

// العميل
import Onboarding from '@/pages/customer/Onboarding'
import Auth from '@/pages/customer/Auth'
import Home from '@/pages/customer/Home'
import SelectLocation from '@/pages/customer/SelectLocation'
import FindDriver from '@/pages/customer/FindDriver'
import Trip from '@/pages/customer/Trip'
import Rate from '@/pages/customer/Rate'
import Wallet from '@/pages/customer/Wallet'
import Commute from '@/pages/customer/Commute'
import CommuteOrder from '@/pages/customer/CommuteOrder'
import CommuteJoin from '@/pages/customer/CommuteJoin'
import Rides from '@/pages/customer/Rides'
import Profile from '@/pages/customer/Profile'

// السائق
import DriverHome from '@/pages/driver/DriverHome'
import DriverTrip from '@/pages/driver/DriverTrip'
import DriverWallet from '@/pages/driver/DriverWallet'
import DriverCommute from '@/pages/driver/DriverCommute'
import DriverProfile from '@/pages/driver/DriverProfile'

// الأدمن — النسخة الاحترافية
import AdminDashboard from '@/admin/pages/AdminDashboard'
import AdminRides from '@/admin/pages/AdminRides'
import AdminDrivers from '@/admin/pages/AdminDrivers'
import AdminCustomers from '@/admin/pages/AdminCustomers'
import AdminWallets from '@/admin/pages/AdminWallets'
import AdminCommute from '@/admin/pages/AdminCommute'
import AdminReports from '@/admin/pages/AdminReports'
import AdminPricing from '@/admin/pages/AdminPricing'
import AdminSettings from '@/admin/pages/AdminSettings'
import AdminSOS from '@/admin/pages/AdminSOS'

/** يلفّ مسارات العميل بحارس المصادقة. */
function guard(el: React.ReactNode) {
  return <ProtectedRoute>{el}</ProtectedRoute>
}

/** يلفّ مسارات السائق بحارس دور السائق. */
function driverGuard(el: React.ReactNode) {
  return <DriverRoute>{el}</DriverRoute>
}

/** يلفّ مسارات الأدمن بحارس دور الأدمن. */
function adminGuard(el: React.ReactNode) {
  return (
    <AdminRoute>
      {el}
    </AdminRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <RideProvider>
        <DriverProvider>
          <Routes>
            {/* عامّة */}
            <Route path="/" element={<Onboarding />} />
            <Route path="/auth" element={<Auth />} />

            {/* العميل (محمي) */}
            <Route path="/home" element={guard(<Home />)} />
            <Route path="/select-location" element={guard(<SelectLocation />)} />
            <Route path="/find-driver" element={guard(<FindDriver />)} />
            <Route path="/trip" element={guard(<Trip />)} />
            <Route path="/rate" element={guard(<Rate />)} />
            <Route path="/wallet" element={guard(<Wallet />)} />
            <Route path="/commute" element={guard(<Commute />)} />
            <Route path="/commute/join/:code" element={guard(<CommuteJoin />)} />
            <Route path="/commute/:id" element={guard(<CommuteOrder />)} />
            <Route path="/rides" element={guard(<Rides />)} />
            <Route path="/profile" element={guard(<Profile />)} />

            {/* السائق (محمي بدور driver) */}
            <Route path="/driver" element={driverGuard(<DriverHome />)} />
            <Route path="/driver/trip" element={driverGuard(<DriverTrip />)} />
            <Route path="/driver/commute" element={driverGuard(<DriverCommute />)} />
            <Route path="/driver/wallet" element={driverGuard(<DriverWallet />)} />
            <Route path="/driver/profile" element={driverGuard(<DriverProfile />)} />

            {/* الأدمن — لوحة تحكم احترافية (محمي بدور admin) */}
            <Route path="/admin" element={adminGuard(<AdminDashboard />)} />
            <Route path="/admin/rides" element={adminGuard(<AdminRides />)} />
            <Route path="/admin/drivers" element={adminGuard(<AdminDrivers />)} />
            <Route path="/admin/customers" element={adminGuard(<AdminCustomers />)} />
            <Route path="/admin/wallets" element={adminGuard(<AdminWallets />)} />
            <Route path="/admin/commute" element={adminGuard(<AdminCommute />)} />
            <Route path="/admin/reports" element={adminGuard(<AdminReports />)} />
            <Route path="/admin/pricing" element={adminGuard(<AdminPricing />)} />
            <Route path="/admin/settings" element={adminGuard(<AdminSettings />)} />
            <Route path="/admin/sos" element={adminGuard(<AdminSOS />)} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DriverProvider>
      </RideProvider>
    </AuthProvider>
  )
}

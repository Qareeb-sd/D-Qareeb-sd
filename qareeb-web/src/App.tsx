import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/store/AuthContext'
import { RideProvider } from '@/store/RideContext'
import { DriverProvider } from '@/store/DriverContext'
import ProtectedRoute from '@/components/ProtectedRoute'

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
import Rides from '@/pages/customer/Rides'
import Profile from '@/pages/customer/Profile'

// السائق
import DriverHome from '@/pages/driver/DriverHome'
import DriverTrip from '@/pages/driver/DriverTrip'
import DriverWallet from '@/pages/driver/DriverWallet'
import DriverProfile from '@/pages/driver/DriverProfile'

// الأدمن
import AdminDashboard from '@/pages/admin/AdminDashboard'

/** يلفّ مسارات العميل بحارس المصادقة. */
function guard(el: React.ReactNode) {
  return <ProtectedRoute>{el}</ProtectedRoute>
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
          <Route path="/rides" element={guard(<Rides />)} />
          <Route path="/profile" element={guard(<Profile />)} />

          {/* السائق */}
          <Route path="/driver" element={<DriverHome />} />
          <Route path="/driver/trip" element={<DriverTrip />} />
          <Route path="/driver/wallet" element={<DriverWallet />} />
          <Route path="/driver/profile" element={<DriverProfile />} />

          {/* الأدمن */}
          <Route path="/admin" element={<AdminDashboard />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </DriverProvider>
      </RideProvider>
    </AuthProvider>
  )
}

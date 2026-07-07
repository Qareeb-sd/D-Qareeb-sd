import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/store/AuthContext'
import { RideProvider } from '@/store/RideContext'
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
import Profile from '@/pages/customer/Profile'

// السائق والأدمن
import DriverHome from '@/pages/driver/DriverHome'
import AdminDashboard from '@/pages/admin/AdminDashboard'

/** يلفّ مسارات العميل بحارس المصادقة. */
function guard(el: React.ReactNode) {
  return <ProtectedRoute>{el}</ProtectedRoute>
}

export default function App() {
  return (
    <AuthProvider>
      <RideProvider>
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
          <Route path="/profile" element={guard(<Profile />)} />

          {/* السائق */}
          <Route path="/driver" element={<DriverHome />} />

          {/* الأدمن */}
          <Route path="/admin" element={<AdminDashboard />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RideProvider>
    </AuthProvider>
  )
}

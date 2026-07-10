import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminRoute from '@/components/AdminRoute'

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

// الأدمن (يُنشر مع نسخة العميل/الويب فقط)
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminDashboard from '@/pages/admin/AdminDashboard'

const guard = (el: React.ReactNode) => <ProtectedRoute>{el}</ProtectedRoute>

/** مسارات تطبيق العميل «قريب» (+ لوحة الإدارة على الويب). */
export default function CustomerRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/auth" element={<Auth />} />

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

      {/* لوحة الإدارة (مستقلة) */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

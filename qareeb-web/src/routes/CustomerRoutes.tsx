import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'

// العميل
import Onboarding from '@/pages/customer/Onboarding'
import Auth from '@/pages/customer/Auth'
import Register from '@/pages/customer/Register'
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
import TrackRide from '@/pages/shared/TrackRide'

const guard = (el: React.ReactNode) => <ProtectedRoute>{el}</ProtectedRoute>

/** مسارات تطبيق العميل «قريب» (+ لوحة الإدارة على الويب). */
export default function CustomerRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/register" element={<Register />} />

      {/* تتبّع رحلة مُشارَكة (عام — يفتحه متابِع لديه التطبيق) */}
      <Route path="/track" element={<TrackRide />} />
      <Route path="/track/:token" element={<TrackRide />} />

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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

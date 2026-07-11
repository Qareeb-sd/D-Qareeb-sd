import { Routes, Route, Navigate } from 'react-router-dom'
import DriverRoute from '@/components/DriverRoute'

import DriverOnboarding from '@/pages/driver/DriverOnboarding'
import DriverLogin from '@/pages/driver/DriverLogin'
import DriverRegister from '@/pages/driver/DriverRegister'
import DriverHome from '@/pages/driver/DriverHome'
import DriverTrip from '@/pages/driver/DriverTrip'
import DriverRate from '@/pages/driver/DriverRate'
import DriverWallet from '@/pages/driver/DriverWallet'
import DriverCommute from '@/pages/driver/DriverCommute'
import DriverProfile from '@/pages/driver/DriverProfile'

const driverGuard = (el: React.ReactNode) => <DriverRoute>{el}</DriverRoute>

/** مسارات تطبيق «قريب كابتن» (السائق) — مستقلّ عن تطبيق العميل. */
export default function DriverRoutes() {
  return (
    <Routes>
      {/* جذر التطبيق = صفحة ترحيب السائق (خريطة السودان) */}
      <Route path="/" element={<DriverOnboarding />} />
      <Route path="/driver/login" element={<DriverLogin />} />
      {/* التسجيل يحمي نفسه: يوجّه غير المسجّل إلى /driver/login */}
      <Route path="/driver/register" element={<DriverRegister />} />
      <Route path="/driver" element={driverGuard(<DriverHome />)} />
      <Route path="/driver/trip" element={driverGuard(<DriverTrip />)} />
      <Route path="/driver/rate" element={driverGuard(<DriverRate />)} />
      <Route path="/driver/commute" element={driverGuard(<DriverCommute />)} />
      <Route path="/driver/wallet" element={driverGuard(<DriverWallet />)} />
      <Route path="/driver/profile" element={driverGuard(<DriverProfile />)} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

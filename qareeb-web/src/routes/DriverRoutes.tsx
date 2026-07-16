import { Routes, Route, Navigate } from 'react-router-dom'
import DriverRoute from '@/components/DriverRoute'

import DriverOnboarding from '@/pages/driver/DriverOnboarding'
import DriverLogin from '@/pages/driver/DriverLogin'
import DriverRegister from '@/pages/driver/DriverRegister'
import DriverHome from '@/pages/driver/DriverHome'
import DriverTrip from '@/pages/driver/DriverTrip'
import DriverRate from '@/pages/driver/DriverRate'
import DriverWallet from '@/pages/driver/DriverWallet'
import DriverIncentives from '@/pages/driver/DriverIncentives'
import DriverDemand from '@/pages/driver/DriverDemand'
import DriverCommute from '@/pages/driver/DriverCommute'
import DriverProfile from '@/pages/driver/DriverProfile'
import TrackRide from '@/pages/shared/TrackRide'

const driverGuard = (el: React.ReactNode) => <DriverRoute>{el}</DriverRoute>

/** مسارات تطبيق «قريب كابتن» (السائق) — مستقلّ عن تطبيق العميل. */
export default function DriverRoutes() {
  return (
    <div className="font-plex">
    <Routes>
      {/* جذر التطبيق = صفحة ترحيب السائق (خريطة السودان) */}
      <Route path="/" element={<DriverOnboarding />} />
      <Route path="/driver/login" element={<DriverLogin />} />

      {/* تتبّع رحلة مُشارَكة (عام) */}
      <Route path="/track" element={<TrackRide />} />
      <Route path="/track/:token" element={<TrackRide />} />
      {/* التسجيل يحمي نفسه: يوجّه غير المسجّل إلى /driver/login */}
      <Route path="/driver/register" element={<DriverRegister />} />
      <Route path="/driver" element={driverGuard(<DriverHome />)} />
      <Route path="/driver/trip" element={driverGuard(<DriverTrip />)} />
      <Route path="/driver/rate" element={driverGuard(<DriverRate />)} />
      <Route path="/driver/commute" element={driverGuard(<DriverCommute />)} />
      <Route path="/driver/wallet" element={driverGuard(<DriverWallet />)} />
      <Route path="/driver/incentives" element={driverGuard(<DriverIncentives />)} />
      <Route path="/driver/demand" element={driverGuard(<DriverDemand />)} />
      <Route path="/driver/profile" element={driverGuard(<DriverProfile />)} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </div>
  )
}

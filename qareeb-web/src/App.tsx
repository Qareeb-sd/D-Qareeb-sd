import { Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/store/AuthContext'
import { RideProvider } from '@/store/RideContext'
import { DriverProvider } from '@/store/DriverContext'
import { MapsProvider } from '@/store/MapsContext'
import ErrorBoundary from '@/components/ErrorBoundary'
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
import BecomeDriver from '@/pages/customer/BecomeDriver'

// السائق
import DriverHome from '@/pages/driver/DriverHome'
import DriverTrip from '@/pages/driver/DriverTrip'
import DriverWallet from '@/pages/driver/DriverWallet'
import DriverCommute from '@/pages/driver/DriverCommute'
import DriverProfile from '@/pages/driver/DriverProfile'

// الأدمن
import AdminDashboard from '@/pages/admin/AdminDashboard'

/** يلفّ مسارات العميل بحارس المصادقة. */
function guard(el: React.ReactNode) {
  return <ProtectedRoute>{el}</ProtectedRoute>
}

/** يلفّ مسارات السائق بحارس دور السائق. */
function driverGuard(el: React.ReactNode) {
  return <DriverRoute>{el}</DriverRoute>
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MapsProvider>
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
          <Route path="/become-driver" element={guard(<BecomeDriver />)} />

          {/* السائق (محمي بدور driver) */}
          <Route path="/driver" element={driverGuard(<DriverHome />)} />
          <Route path="/driver/trip" element={driverGuard(<DriverTrip />)} />
          <Route path="/driver/commute" element={driverGuard(<DriverCommute />)} />
          <Route path="/driver/wallet" element={driverGuard(<DriverWallet />)} />
          <Route path="/driver/profile" element={driverGuard(<DriverProfile />)} />

          {/* الأدمن (محمي بدور admin) */}
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
              </DriverProvider>
            </RideProvider>
          </AuthProvider>
        </MapsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

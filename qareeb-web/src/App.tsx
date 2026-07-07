import { Routes, Route, Navigate } from 'react-router-dom'
import { RideProvider } from '@/store/RideContext'

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

export default function App() {
  return (
    <RideProvider>
      <Routes>
        {/* العميل */}
        <Route path="/" element={<Onboarding />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/home" element={<Home />} />
        <Route path="/select-location" element={<SelectLocation />} />
        <Route path="/find-driver" element={<FindDriver />} />
        <Route path="/trip" element={<Trip />} />
        <Route path="/rate" element={<Rate />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/commute" element={<Commute />} />
        <Route path="/profile" element={<Profile />} />

        {/* السائق */}
        <Route path="/driver" element={<DriverHome />} />

        {/* الأدمن */}
        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RideProvider>
  )
}

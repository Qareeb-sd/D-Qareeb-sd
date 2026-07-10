import { Routes, Route, Navigate } from 'react-router-dom'
import AdminRoute from '@/components/AdminRoute'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminDashboard from '@/pages/admin/AdminDashboard'

/** موقع لوحة الإدارة «قريب» — مستقلّ عن تطبيقَي العميل والسائق (ويب فقط). */
export default function AdminRoutes() {
  return (
    <Routes>
      {/* جذر الموقع = دخول الإدارة */}
      <Route path="/" element={<AdminLogin />} />
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

import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthContext'

/** يحمي مسارات العميل: يوجّه غير المسجّلين إلى /auth. */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-soft border-t-green" />
      </div>
    )
  }

  if (!session) return <Navigate to="/auth" replace />

  return <>{children}</>
}

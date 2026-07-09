import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * يحمي تطبيق السائق: يتطلّب تسجيل الدخول + دور "driver".
 * من ليس سائقاً بعد يُوجَّه لصفحة التسجيل/المراجعة (/driver/register).
 * الأمان الفعلي مفروض أيضاً على مستوى قاعدة البيانات (RLS)، وهذا حارس الواجهة.
 * في وضع المعاينة (بدون Supabase) يُسمح بالوصول لتجربة الواجهة.
 */
export default function DriverRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <Spinner />

  if (!isSupabaseConfigured) return <>{children}</>

  if (!session) return <Navigate to="/driver/login" replace />

  if (!profile) return <Spinner />

  if (profile.role !== 'driver') return <Navigate to="/driver/register" replace />

  return <>{children}</>
}

function Spinner() {
  return (
    <div className="screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-soft border-t-green" />
    </div>
  )
}

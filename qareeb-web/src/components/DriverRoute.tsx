import type { ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import Logo from './Logo'

/**
 * يحمي تطبيق السائق: يتطلّب تسجيل الدخول + دور "driver".
 * الأمان الفعلي مفروض أيضاً على مستوى قاعدة البيانات (RLS)، وهذا حارس الواجهة.
 * في وضع المعاينة (بدون Supabase) يُسمح بالوصول لتجربة الواجهة.
 */
export default function DriverRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <Spinner />

  if (!isSupabaseConfigured) return <>{children}</>

  if (!session) return <Navigate to="/auth" replace />

  if (!profile) return <Spinner />

  if (profile.role !== 'driver') return <NotAuthorized />

  return <>{children}</>
}

function Spinner() {
  return (
    <div className="screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-soft border-t-green" />
    </div>
  )
}

function NotAuthorized() {
  const navigate = useNavigate()
  return (
    <div className="screen items-center justify-center gap-4 p-8 text-center">
      <Logo variant="driver" size={72} rounded={20} />
      <div className="text-4xl">🔒</div>
      <h1 className="text-xl font-extrabold text-green">واجهة السائق</h1>
      <p className="text-ink-soft">هذه الواجهة مخصّصة للسائقين المسجّلين فقط.</p>
      <button className="btn-primary" onClick={() => navigate('/home')}>
        العودة للرئيسية
      </button>
    </div>
  )
}

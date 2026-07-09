import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import Logo from './Logo'

/**
 * يحمي لوحة الأدمن: يتطلّب تسجيل الدخول + دور "admin".
 * الأمان الفعلي مفروض أيضاً على مستوى قاعدة البيانات (RLS)، وهذا حارس الواجهة.
 * في وضع المعاينة (بدون Supabase) يُسمح بالوصول لتجربة اللوحة.
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <Spinner />

  // وضع معاينة: لا يوجد backend، نسمح بالوصول للتجربة فقط.
  if (!isSupabaseConfigured) return <>{children}</>

  if (!session) return <Navigate to="/admin/login" replace />

  // الجلسة موجودة لكن الملف لم يُحمّل بعد.
  if (!profile) return <Spinner />

  if (profile.role !== 'admin') return <NotAuthorized />

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
  const { signOut } = useAuth()
  return (
    <div className="screen items-center justify-center gap-4 p-8 text-center">
      <Logo size={72} rounded={20} />
      <div className="text-4xl">🔒</div>
      <h1 className="text-xl font-extrabold text-green">صفحة الإدارة</h1>
      <p className="text-ink-soft">هذه اللوحة مخصّصة للإدارة فقط. حسابك لا يملك صلاحية الوصول.</p>
      <button className="btn-outline text-danger" onClick={() => void signOut()}>
        تسجيل الخروج
      </button>
    </div>
  )
}

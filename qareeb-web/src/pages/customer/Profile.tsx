import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/store/AuthContext'

const links = [
  { label: 'رحلاتي السابقة', icon: '🧾', to: '/rides' },
  { label: 'العناوين المحفوظة', icon: '📍' },
  { label: 'الإشعارات', icon: '🔔' },
  { label: 'المساعدة والدعم', icon: '💬' },
  { label: 'عن قريب', icon: 'ℹ️' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const logout = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="screen">
      <header className="px-4 py-4">
        <h1 className="text-lg font-bold">حسابي</h1>
      </header>

      <main className="flex-1 px-4 pb-24">
        <div className="card flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-green-soft text-2xl">
            🧑🏽
          </div>
          <div>
            <p className="font-bold">{profile?.full_name ?? 'مستخدم قريب'}</p>
            <p className="text-sm text-ink-soft" dir="ltr">
              {profile?.phone ?? '—'}
            </p>
          </div>
        </div>

        <div className="card mt-4 divide-y divide-hairline p-0">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={() => l.to && navigate(l.to)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-right"
            >
              <span className="text-xl">{l.icon}</span>
              <span className="flex-1 font-medium">{l.label}</span>
              <span className="text-ink-muted">‹</span>
            </button>
          ))}
        </div>

        {/* السائق: تسجيل كسائق أو الدخول لواجهة السائق */}
        <button
          onClick={() => navigate(profile?.role === 'driver' ? '/driver' : '/become-driver')}
          className="card mt-4 flex w-full items-center gap-3 border border-green/30 bg-green-soft p-4 text-right"
        >
          <span className="text-2xl">🧑🏽‍✈️</span>
          <div className="flex-1">
            <p className="font-bold text-green">
              {profile?.role === 'driver' ? 'واجهة السائق' : 'كن سائقاً مع قريب'}
            </p>
            <p className="text-xs text-ink-soft">
              {profile?.role === 'driver'
                ? 'استقبل الطلبات وتابع أرباحك'
                : 'سجّل مركبتك وابدأ كسب الدخل'}
            </p>
          </div>
          <span className="text-ink-muted">‹</span>
        </button>

        <button onClick={logout} className="btn-outline mt-6 w-full text-danger">
          تسجيل الخروج
        </button>
      </main>

      <BottomNav />
    </div>
  )
}

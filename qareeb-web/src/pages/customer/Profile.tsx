import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'

const links = [
  { label: 'رحلاتي السابقة', icon: '🧾' },
  { label: 'العناوين المحفوظة', icon: '📍' },
  { label: 'الإشعارات', icon: '🔔' },
  { label: 'المساعدة والدعم', icon: '💬' },
  { label: 'عن قريب', icon: 'ℹ️' },
]

export default function Profile() {
  const navigate = useNavigate()

  return (
    <div className="screen">
      <header className="px-4 py-4">
        <h1 className="text-lg font-bold">حسابي</h1>
      </header>

      <main className="flex-1 px-4 pb-4">
        <div className="card flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-green-soft text-2xl">
            🧑🏽
          </div>
          <div>
            <p className="font-bold">محمد أحمد</p>
            <p className="text-sm text-ink-soft" dir="ltr">
              +249 91 234 5678
            </p>
          </div>
        </div>

        <div className="card mt-4 divide-y divide-hairline p-0">
          {links.map((l) => (
            <button
              key={l.label}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-right"
            >
              <span className="text-xl">{l.icon}</span>
              <span className="flex-1 font-medium">{l.label}</span>
              <span className="text-ink-muted">‹</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('/auth')}
          className="btn-outline mt-6 w-full text-danger"
        >
          تسجيل الخروج
        </button>
      </main>

      <BottomNav />
    </div>
  )
}

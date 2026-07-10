import { NavLink } from 'react-router-dom'
import Logo from '@/components/Logo'

interface SidebarItem {
  to: string
  label: string
  icon: string
  badge?: number
}

const mainItems: SidebarItem[] = [
  { to: '/admin', label: 'لوحة التحكم', icon: '📊' },
  { to: '/admin/rides', label: 'الرحلات', icon: '🚗' },
  { to: '/admin/drivers', label: 'السائقين', icon: '👨🏾‍✈️' },
  { to: '/admin/customers', label: 'العملاء', icon: '👥' },
  { to: '/admin/wallets', label: 'المحافظ والتعبئات', icon: '💰' },
  { to: '/admin/commute', label: 'ترحيل يومي', icon: '🚌' },
]

const secondaryItems: SidebarItem[] = [
  { to: '/admin/reports', label: 'التقارير والإحصائيات', icon: '📈' },
  { to: '/admin/pricing', label: 'التسعير', icon: '⚙️' },
  { to: '/admin/settings', label: 'الإعدادات', icon: '🔧' },
  { to: '/admin/sos', label: 'طوارئ SOS', icon: '🚨', badge: 0 },
]

export default function AdminSidebar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
      isActive
        ? 'bg-green text-white shadow-card'
        : 'text-ink-soft hover:bg-green-soft hover:text-green'
    }`

  return (
    <aside className="fixed right-0 top-0 z-20 flex h-screen w-64 flex-col border-l border-hairline bg-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-hairline px-6 py-4">
        <Logo size={40} rounded={12} />
        <div>
          <p className="font-extrabold text-green">قريب</p>
          <p className="text-[11px] text-ink-muted">لوحة التحكم</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          الرئيسية
        </p>
        {mainItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className={linkClass}>
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="my-4 border-t border-hairline" />

        <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          إدارة وإعدادات
        </p>
        {secondaryItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            <span className="text-lg">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-hairline px-4 py-3">
        <div className="flex items-center gap-3 rounded-xl bg-bg px-3 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-green-soft text-sm">
            🧑🏽
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-bold">مدير المنصة</p>
            <p className="truncate text-[10px] text-ink-muted">admin@qareeb.sd</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

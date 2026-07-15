import { NavLink } from 'react-router-dom'
import { LayoutList, Repeat, Wallet, UserRound, type LucideIcon } from 'lucide-react'

const items: { to: string; label: string; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/driver', label: 'الطلبات', Icon: LayoutList, end: true },
  { to: '/driver/commute', label: 'ترحيل', Icon: Repeat },
  { to: '/driver/wallet', label: 'محفظتي', Icon: Wallet },
  { to: '/driver/profile', label: 'حسابي', Icon: UserRound },
]

/**
 * شريط تنقّل الكابتن — هوية «الواحة الملكية»: زمردي عميق + حبّة ذهبية للنشط،
 * موحّد بصرياً مع تطبيق العميل مع لمسة ذهبية تميّز الكابتن.
 */
export default function DriverNav() {
  return (
    <nav
      className="sticky bottom-0 z-10 mx-auto flex w-full max-w-md items-stretch border-t border-hairline bg-white/90 backdrop-blur-md font-plex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-bold transition ${
              isActive ? 'text-royal' : 'text-ink-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`grid h-8 w-12 place-items-center rounded-full transition ${
                  isActive ? 'bg-sand/25' : ''
                }`}
              >
                <Icon
                  className="h-[22px] w-[22px]"
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

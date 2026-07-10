import { NavLink } from 'react-router-dom'
import { HomeIcon, WalletIcon, UserIcon, CommuteIcon } from './Icons'
import type { ComponentType, SVGProps } from 'react'

const items: {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}[] = [
  { to: '/driver', label: 'الطلبات', Icon: HomeIcon, end: true },
  { to: '/driver/commute', label: 'ترحيل', Icon: CommuteIcon },
  { to: '/driver/wallet', label: 'محفظتي', Icon: WalletIcon },
  { to: '/driver/profile', label: 'حسابي', Icon: UserIcon },
]

/** شريط تنقّل تطبيق السائق — بالهوية الليمونية (مميّز عن العميل). */
export default function DriverNav() {
  return (
    <nav
      className="sticky bottom-0 z-10 mx-auto flex w-full max-w-md items-stretch border-t-2 border-lemon bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-bold transition ${
              isActive ? 'text-green-dark' : 'text-ink-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`grid h-8 w-12 place-items-center rounded-full transition ${
                  isActive ? 'bg-lemon' : ''
                }`}
              >
                <Icon width={22} height={22} />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

import { NavLink } from 'react-router-dom'
import { HomeIcon, WalletIcon, UserIcon } from './Icons'
import type { ComponentType, SVGProps } from 'react'

const items: {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}[] = [
  { to: '/driver', label: 'الطلبات', Icon: HomeIcon, end: true },
  { to: '/driver/wallet', label: 'محفظتي', Icon: WalletIcon },
  { to: '/driver/profile', label: 'حسابي', Icon: UserIcon },
]

/** شريط تنقّل تطبيق السائق. */
export default function DriverNav() {
  return (
    <nav className="sticky bottom-0 z-10 mx-auto flex w-full max-w-md items-stretch border-t border-hairline bg-white">
      {items.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${
              isActive ? 'text-green' : 'text-ink-muted'
            }`
          }
        >
          <Icon width={22} height={22} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

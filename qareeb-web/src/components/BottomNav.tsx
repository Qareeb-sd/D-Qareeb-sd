import { NavLink } from 'react-router-dom'
import { HomeIcon, CommuteIcon, WalletIcon, UserIcon } from './Icons'
import type { ComponentType, SVGProps } from 'react'

const items: {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}[] = [
  { to: '/home', label: 'الرئيسية', Icon: HomeIcon },
  { to: '/commute', label: 'ترحيل', Icon: CommuteIcon },
  { to: '/wallet', label: 'المحفظة', Icon: WalletIcon },
  { to: '/profile', label: 'حسابي', Icon: UserIcon },
]

export default function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-10 mx-auto flex w-full max-w-md items-stretch border-t border-hairline bg-white">
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
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

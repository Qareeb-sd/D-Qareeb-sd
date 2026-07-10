import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  HomeIconFilled,
  CommuteIcon,
  CommuteIconFilled,
  WalletIcon,
  WalletIconFilled,
  UserIcon,
  UserIconFilled,
} from './Icons'
import type { ComponentType, SVGProps } from 'react'

interface NavItem {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  IconActive: ComponentType<SVGProps<SVGSVGElement>>
}

const items: NavItem[] = [
  { to: '/home', label: 'الرئيسية', Icon: HomeIcon, IconActive: HomeIconFilled },
  { to: '/commute', label: 'ترحيل', Icon: CommuteIcon, IconActive: CommuteIconFilled },
  { to: '/wallet', label: 'المحفظة', Icon: WalletIcon, IconActive: WalletIconFilled },
  { to: '/profile', label: 'حسابي', Icon: UserIcon, IconActive: UserIconFilled },
]

export default function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-10 mx-auto flex w-full max-w-md items-stretch border-t border-hairline bg-white/90 backdrop-blur-md"
      // مسافة أمان أسفل الشريط حتى لا يغطّي شريط تنقّل الهاتف الأيقونات
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ to, label, Icon, IconActive }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-bold transition ${
              isActive ? 'text-green' : 'text-ink-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? <IconActive width={24} height={24} /> : <Icon width={24} height={24} />}
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

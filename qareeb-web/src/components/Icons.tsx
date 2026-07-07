/** أيقونات خفيفة (خطية) — stroke يرث اللون من currentColor. */
import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
)

export const WalletIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

export const CommuteIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 3v4M16 3v4" />
    <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17" />
    <path d="M12 13v4M9.5 14.5l5 1" />
  </svg>
)

export const UserIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
  </svg>
)

export const PinIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)

export const BackIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    {/* RTL: السهم للأمام يشير لليمين */}
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export const StarIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19l1-5.8L3.5 9.2l5.9-.9L12 3Z" />
  </svg>
)

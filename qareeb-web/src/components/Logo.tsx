/**
 * شعار "قريب": دبوس موقع بهدف في المنتصف (دائرة + حلقة + نقطة) داخل مربع بلون الهوية.
 * variant="customer" → مربع أخضر / دبوس أبيض.
 * variant="driver"   → مربع ليموني / دبوس أخضر داكن.
 */
interface LogoProps {
  variant?: 'customer' | 'driver'
  size?: number
  rounded?: number
  className?: string
}

export default function Logo({
  variant = 'customer',
  size = 64,
  rounded = 16,
  className,
}: LogoProps) {
  const box = variant === 'driver' ? '#F2E21C' : '#1B6B3F'
  const pin = variant === 'driver' ? '#125531' : '#FFFFFF'
  const dot = variant === 'driver' ? '#F2E21C' : '#1B6B3F'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="قريب"
    >
      <rect width="64" height="64" rx={rounded} fill={box} />
      {/* دبوس الموقع */}
      <path
        d="M32 14c-7.2 0-13 5.6-13 12.6 0 8.9 11.3 19.7 12.3 20.6a1 1 0 0 0 1.4 0c1-.9 12.3-11.7 12.3-20.6C45 19.6 39.2 14 32 14Z"
        fill={pin}
      />
      {/* حلقة الهدف */}
      <circle cx="32" cy="26.5" r="6.6" fill="none" stroke={dot} strokeWidth="2.4" />
      {/* نقطة المركز */}
      <circle cx="32" cy="26.5" r="2.6" fill={dot} />
    </svg>
  )
}

/**
 * دبوس ثابت في منتصف الخريطة — طرفه السفلي يقع على مركز الخريطة بالضبط،
 * مع نقطة دقيقة عند المركز. يحلّ محلّ الإيموجي (📍) الذي كان يظهر في مكان غير دقيق.
 * لا يلتقط الأحداث (pointer-events-none) حتى تبقى الخريطة قابلة للسحب.
 */
export default function MapPin({ variant = 'dropoff' }: { variant?: 'pickup' | 'dropoff' }) {
  const color = variant === 'pickup' ? '#0F7B3F' : '#E11D48'
  return (
    <div className="pointer-events-none absolute inset-0 z-[500]">
      {/* الدبوس: طرفه السفلي عند مركز الخريطة تماماً */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-md">
        <svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 42 15 42s15-16.1 15-27.2C30 6.6 23.3 0 15 0Z"
            fill={color}
          />
          <circle cx="15" cy="14.5" r="5.5" fill="#fff" />
        </svg>
      </div>
      {/* نقطة دقيقة عند المركز */}
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-black/40" />
    </div>
  )
}

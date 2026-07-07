import type { VehicleArt as Shape } from '@/data/services'

/**
 * رسوم SVG مبسّطة لكل نوع مركبة، تُطابق مراجع "قريب":
 * sedan=يارس أبيض · taxi=ترحيل · luxury=VIP داكن · van=هايس فضي ·
 * microbus=أمجاد (داماس أزرق) · rickshaw=توك‑توك أسود/ذهبي.
 * تُستخدم كبديل عن الصورة الفوتوغرافية حين تغيب.
 */

const WHEEL = '#26292A'
const HUB = '#C7CCC9'
const GLASS = '#B8D2E4'
const STROKE = 'rgba(0,0,0,0.14)'
const GOLD = '#C9A138'

function Wheels({ xs, y = 60 }: { xs: number[]; y?: number }) {
  return (
    <>
      {xs.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={y} r="10" fill={WHEEL} />
          <circle cx={cx} cy={y} r="3.6" fill={HUB} />
        </g>
      ))}
    </>
  )
}

function Sedan({ tint, luxury = false }: { tint: string; luxury?: boolean }) {
  const top = luxury ? 26 : 24
  return (
    <>
      {/* الهيكل */}
      <rect x="12" y="40" width="104" height="15" rx="7" fill={tint} stroke={STROKE} />
      {/* السقف والكابينة */}
      <path
        d={`M42 41 L54 ${top} Q56 ${top - 3} 61 ${top - 3} L80 ${top - 3} Q86 ${top - 3} 90 ${top + 1} L100 41 Z`}
        fill={tint}
        stroke={STROKE}
      />
      {/* الزجاج */}
      <path d={`M56 39 L63 ${top + 1} L74 ${top + 1} L74 39 Z`} fill={GLASS} />
      <path d={`M77 39 L77 ${top + 1} L82 ${top + 1} Q86 ${top + 1} 88 39 Z`} fill={GLASS} />
      {/* مصباح أمامي */}
      <rect x="110" y="43" width="6" height="5" rx="2" fill="#F4D35E" />
      <Wheels xs={[38, 92]} />
    </>
  )
}

function shape(art: Shape, tint: string) {
  switch (art) {
    case 'sedan':
      return <Sedan tint={tint} />

    case 'ladies':
      return (
        <>
          <Sedan tint={tint} />
          {/* قلب صغير يميّز الخدمة النسائية */}
          <path
            d="M64 44c-1-1.6-3.6-1.4-3.6.7 0 1.4 2.2 2.9 3.6 3.8 1.4-.9 3.6-2.4 3.6-3.8 0-2.1-2.6-2.3-3.6-.7Z"
            fill="#FFFFFF"
          />
        </>
      )

    case 'tow':
      return (
        <>
          {/* منصّة السطحة (flatbed) */}
          <path d="M50 44 L112 44 L116 48 L116 52 L50 52 Z" fill={tint} stroke={STROKE} />
          <rect x="50" y="41" width="4" height="11" fill={STROKE} opacity="0.6" />
          {/* المقصورة الأمامية */}
          <path
            d="M12 24 Q12 20 18 20 L40 20 Q46 20 48 26 L50 44 L14 44 Q12 44 12 40 Z"
            fill={tint}
            stroke={STROKE}
          />
          {/* زجاج المقصورة */}
          <path d="M18 26 L38 26 Q42 26 44 33 L44 38 L18 38 Z" fill={GLASS} />
          {/* ضوء علوي (إنقاذ) */}
          <rect x="24" y="16" width="12" height="4" rx="1.5" fill={GOLD} />
          <rect x="108" y="46" width="6" height="4" rx="2" fill="#F4D35E" />
          <Wheels xs={[30, 92, 106]} />
        </>
      )

    case 'van':
      return (
        <>
          {/* هيكل الفان الطويل */}
          <path
            d="M12 30 Q12 22 22 22 L96 22 Q108 22 114 32 L116 40 L116 52 Q116 55 112 55 L16 55 Q12 55 12 52 Z"
            fill={tint}
            stroke={STROKE}
          />
          {/* شريط نوافذ */}
          <rect x="20" y="27" width="52" height="13" rx="2" fill={GLASS} />
          {/* الزجاج الأمامي */}
          <path d="M78 27 L96 27 Q106 27 110 35 L110 40 L78 40 Z" fill={GLASS} />
          {/* خط الباب */}
          <rect x="45" y="40" width="1.5" height="15" fill={STROKE} />
          <rect x="108" y="44" width="6" height="5" rx="2" fill="#F4D35E" />
          <Wheels xs={[36, 94]} />
        </>
      )

    case 'microbus':
      return (
        <>
          {/* داماس: قصير وأعلى وأكثر تكعيباً */}
          <path
            d="M22 20 Q22 15 30 15 L92 15 Q102 15 104 24 L106 34 L106 52 Q106 55 102 55 L26 55 Q22 55 22 52 Z"
            fill={tint}
            stroke={STROKE}
          />
          {/* نوافذ جانبية */}
          <rect x="30" y="21" width="28" height="14" rx="2" fill={GLASS} />
          <rect x="62" y="21" width="20" height="14" rx="2" fill={GLASS} />
          {/* الزجاج الأمامي المنتصب */}
          <path d="M86 21 L98 21 Q103 21 104 28 L104 35 L86 35 Z" fill={GLASS} />
          <rect x="59" y="35" width="1.5" height="20" fill={STROKE} />
          <rect x="99" y="44" width="6" height="5" rx="2" fill="#F4D35E" />
          <Wheels xs={[40, 92]} />
        </>
      )

    case 'rickshaw':
      return (
        <>
          {/* المظلّة/الكابينة */}
          <path
            d="M40 22 Q52 12 70 14 Q86 16 90 34 L92 48 L34 48 L34 34 Q34 26 40 22 Z"
            fill={tint}
            stroke={STROKE}
          />
          {/* فتحة الراكب */}
          <path d="M44 30 Q54 22 68 24 Q80 26 82 40 L46 40 Z" fill={GLASS} opacity="0.55" />
          {/* شريط ذهبي (طراز سوداني) */}
          <rect x="34" y="43" width="58" height="5" fill={GOLD} />
          {/* مقدمة/كشّاف */}
          <path d="M30 40 L34 40 L34 50 L26 50 Q24 50 24 47 Z" fill={tint} stroke={STROKE} />
          <circle cx="28" cy="45" r="2" fill="#F4D35E" />
          {/* عجلة أمامية صغيرة + خلفية */}
          <Wheels xs={[30]} y={58} />
          <Wheels xs={[80]} />
        </>
      )
  }
}

export default function VehicleArt({
  art,
  tint,
  className,
}: {
  art: Shape
  tint: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 128 72"
      className={className}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {shape(art, tint)}
    </svg>
  )
}

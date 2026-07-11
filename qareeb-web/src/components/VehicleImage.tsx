import { useState } from 'react'
import type { Service } from '@/data/services'
import VehicleArt from './VehicleArt'

/**
 * صورة المركبة: تعرض الصورة الفوتوغرافية الحقيقية من public/vehicles/ إن وُجدت،
 * وإلا تعرض رسم SVG مميّزاً لنوع المركبة (بديل أنيق بدل صورة عامّة).
 * الحجم موحّد بـ aspect-ratio لضمان تناسق البطاقات.
 */
export default function VehicleImage({
  service,
  className,
  brand = true,
}: {
  service: Service
  className?: string
  /** إظهار شعار «قريب» فوق المركبة (كديكور الأبواب). */
  brand?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`flex items-center justify-center ${className ?? ''}`}>
        <VehicleArt
          art={service.art}
          tint={service.tint}
          className="h-full w-full"
        />
      </div>
    )
  }

  // السحّاب شاحنة نقل — لا يحمل شعار الركاب.
  const showBrand = brand && service.id !== 'tow'

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className ?? ''}`}
      style={{ containerType: 'inline-size' }}
    >
      {/* object-contain: تُعرض المركبة كاملة دون قصّ */}
      <img
        src={service.image}
        alt={service.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
      {showBrand && (
        <span
          className="pointer-events-none absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 font-extrabold leading-none"
          style={{
            fontSize: '12cqw',
            color: service.femaleDriver ? '#C13584' : '#0F7B3F',
            textShadow: '0 1px 3px rgba(255,255,255,0.85)',
          }}
        >
          قريب
        </span>
      )}
    </div>
  )
}

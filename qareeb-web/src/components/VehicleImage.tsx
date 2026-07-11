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
  const pink = Boolean(service.femaleDriver)
  const accent = pink ? '#C13584' : '#1B6B3F'

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
      {/* ملصق العلامة على باب المركبة — دبوس الشعار + «قريب» بخط الهوية */}
      {showBrand && (
        <span
          className="pointer-events-none absolute left-1/2 top-[55%]"
          style={{ transform: 'translate(-50%, -50%) skewX(-4deg)' }}
        >
          <span
            className="inline-flex items-center leading-none"
            style={{
              gap: '1.5cqw',
              background: 'rgba(255,255,255,0.92)',
              border: `0.4cqw solid ${accent}22`,
              borderRadius: '999px',
              padding: pink ? '1.2cqw 3cqw' : '1.2cqw 3.5cqw',
              boxShadow: '0 0.5cqw 2cqw rgba(0,0,0,0.18)',
            }}
          >
            <svg viewBox="0 0 64 64" style={{ width: '7cqw', height: '7cqw' }} aria-hidden>
              <path
                d="M32 6C19.8 6 10 15.5 10 27.4 10 42.5 29.1 60.8 30.8 62.4a1.7 1.7 0 0 0 2.4 0C34.9 60.8 54 42.5 54 27.4 54 15.5 44.2 6 32 6Z"
                fill={accent}
              />
              <circle cx="32" cy="27" r="11" fill="none" stroke="#fff" strokeWidth="4.5" />
              <circle cx="32" cy="27" r="4.5" fill="#fff" />
            </svg>
            <span
              className="whitespace-nowrap font-extrabold"
              style={{ fontSize: pink ? '6.5cqw' : '9.5cqw', color: accent }}
            >
              {pink ? 'قريب نسائي' : 'قريب'}
            </span>
          </span>
        </span>
      )}
    </div>
  )
}

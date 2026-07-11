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

  // أسلوب الكتابة على جسم المركبة حسب لون الهيكل (بلا خلفية — كطلاء على الباب، كالصورة المرجعية).
  const paint = pink
    ? { color: '#E85C9E', size: '8cqw', shadow: '0 0.3cqw 1.2cqw rgba(255,255,255,0.9)' } // وردي على الأبيض
    : service.id === 'amjad'
      ? { color: '#FFFFFF', size: '10cqw', shadow: '0 0.4cqw 1.5cqw rgba(0,40,90,0.5)' } // أبيض على الأزرق
      : service.id === 'rickshaw'
        ? { color: '#F2E21C', size: '9cqw', shadow: '0 0.4cqw 1.5cqw rgba(0,0,0,0.55)' } // ليموني على الأسود
        : { color: '#1B6B3F', size: '12.5cqw', shadow: '0 0.3cqw 1.2cqw rgba(255,255,255,0.9)' } // أخضر على الأبيض

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
      {/* «قريب» مكتوبة مباشرة على باب المركبة بخط مستدير (كالطلاء) */}
      {showBrand && (
        <span
          className="pointer-events-none absolute left-1/2 top-[56%] text-center leading-[0.95]"
          style={{
            transform: 'translate(-50%, -50%) rotate(-3deg)',
            fontFamily: "'Baloo Bhaijaan 2', 'Tajawal', sans-serif",
            fontWeight: 800,
            fontSize: paint.size,
            color: paint.color,
            textShadow: paint.shadow,
            whiteSpace: 'nowrap',
          }}
        >
          {pink ? (
            <>
              قريب
              <br />
              نسائي
            </>
          ) : (
            'قريب'
          )}
        </span>
      )}
    </div>
  )
}

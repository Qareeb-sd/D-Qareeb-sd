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

  // أسلوب الكتابة على جسم المركبة: لون وحجم وموضع مضبوط على باب كل مركبة (كالصورة المرجعية).
  const paint = pink
    ? { color: '#E85C9E', size: '7.5cqw', left: '47%', top: '58%', shadow: '0 0.3cqw 1.2cqw rgba(255,255,255,0.95)' } // وردي على الأبيض
    : service.id === 'amjad'
      ? { color: '#FFFFFF', size: '12cqw', left: '56%', top: '56%', shadow: '0 0.4cqw 1.5cqw rgba(0,40,90,0.55)' } // أبيض على الأزرق
      : service.id === 'rickshaw'
        ? { color: '#F2E21C', size: '10cqw', left: '58%', top: '42%', shadow: '0 0.4cqw 1.5cqw rgba(0,0,0,0.6)' } // ليموني على الكنبوش الأسود
        : service.id === 'hiace'
          ? { color: '#1B6B3F', size: '14cqw', left: '55%', top: '56%', shadow: '0 0.3cqw 1.2cqw rgba(255,255,255,0.95)' } // أخضر على جنب الهايس
          : { color: '#1B6B3F', size: '15cqw', left: '47%', top: '58%', shadow: '0 0.3cqw 1.2cqw rgba(255,255,255,0.95)' } // أخضر على باب السيدان

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
          className="pointer-events-none absolute text-center leading-[0.95]"
          style={{
            left: paint.left,
            top: paint.top,
            transform: 'translate(-50%, -50%) rotate(-3deg)',
            fontFamily: "'Baloo Bhaijaan 2', 'Tajawal', sans-serif",
            fontWeight: 800,
            fontSize: paint.size,
            color: paint.color,
            textShadow: paint.shadow,
            whiteSpace: 'nowrap',
          }}
        >
          {pink ? 'قريب نسائي' : 'قريب'}
        </span>
      )}
    </div>
  )
}

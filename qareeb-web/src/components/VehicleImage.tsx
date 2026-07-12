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
}: {
  service: Service
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  // تُفضّل الصورة المرفوعة من لوحة الأدمن (imageUrl) على الصورة المحلّية.
  const src = service.imageUrl || service.image

  if (failed) {
    return (
      <div className={`flex items-center justify-center ${className ?? ''}`}>
        <VehicleArt art={service.art} tint={service.tint} className="h-full w-full" />
      </div>
    )
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className ?? ''}`}>
      {/* object-contain: تُعرض المركبة كاملة دون قصّ */}
      <img
        src={src}
        alt={service.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    </div>
  )
}

import { useState } from 'react'
import type { Service } from '@/data/services'
import VehicleArt from './VehicleArt'

/**
 * صورة المركبة: تعرض الصورة الفوتوغرافية الحقيقية من public/vehicles/ إن وُجدت،
 * وإلا تعرض رسم SVG مميّزاً لنوع المركبة (بديل أنيق بدل صورة عامّة).
 */
export default function VehicleImage({
  service,
  className,
}: {
  service: Service
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <VehicleArt
        art={service.art}
        tint={service.tint}
        className={`h-full w-full ${className ?? ''}`}
      />
    )
  }

  return (
    <img
      src={service.image}
      alt={service.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-contain ${className ?? ''}`}
    />
  )
}

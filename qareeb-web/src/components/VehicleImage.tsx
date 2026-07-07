import { useState } from 'react'
import type { Service } from '@/data/services'

/**
 * صورة المركبة مع بديل رسومي عند غياب الملف الحقيقي.
 * (صور المركبات الحقيقية تُوضع في public/vehicles/.)
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
      <div
        className={`grid place-items-center rounded-xl bg-green-mint text-green ${className ?? ''}`}
      >
        <span className="text-2xl">🚗</span>
      </div>
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

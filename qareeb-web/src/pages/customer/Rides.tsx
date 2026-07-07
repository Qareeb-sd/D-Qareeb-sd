import { useEffect, useState } from 'react'
import Screen from '@/components/Screen'
import { StarIcon } from '@/components/Icons'
import { useAuth } from '@/store/AuthContext'
import { listRides } from '@/lib/api'
import { getService } from '@/data/services'
import { money } from '@/lib/format'
import type { Ride } from '@/lib/types'

/** رحلاتي السابقة. */
export default function Rides() {
  const { profile } = useAuth()
  const [rides, setRides] = useState<Ride[] | null>(null)

  useEffect(() => {
    void listRides(profile?.id ?? 'demo-user').then(setRides)
  }, [profile?.id])

  return (
    <Screen title="رحلاتي السابقة" back>
      {rides === null ? (
        <div className="card h-24 animate-pulse" />
      ) : rides.length === 0 ? (
        <p className="card p-6 text-center text-sm text-ink-muted">لا توجد رحلات بعد</p>
      ) : (
        <div className="space-y-3">
          {rides.map((r) => {
            const service = getService(r.service_id)
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{service?.name ?? r.service_id}</p>
                  <p className="font-extrabold text-green">{money(r.fare ?? 0)}</p>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {r.pickup_address ?? '—'} ← {r.dropoff_address ?? '—'}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                  <span>{new Date(r.created_at).toLocaleDateString('ar-SD')}</span>
                  {r.rating && (
                    <span className="flex items-center gap-1 text-gold">
                      <StarIcon width={14} height={14} fill="#C9A138" />
                      {r.rating}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Screen>
  )
}

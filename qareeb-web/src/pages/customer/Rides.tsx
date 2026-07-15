import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import Screen from '@/components/Screen'
import { useAuth } from '@/store/AuthContext'
import { listRides } from '@/lib/api'
import { getService } from '@/data/services'
import { money } from '@/lib/format'

/** رحلاتي السابقة. */
export default function Rides() {
  const { profile } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const { data: rides } = useQuery({
    queryKey: ['rides', userId],
    queryFn: () => listRides(userId),
  })

  return (
    <Screen title="رحلاتي السابقة" back>
      {rides === undefined ? (
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
                  <p className="font-bold text-royal">{service?.name ?? r.service_id}</p>
                  <p className="font-extrabold text-royal">{money(r.fare ?? 0)}</p>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {r.pickup_address ?? '—'} ← {r.dropoff_address ?? '—'}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                  <span>{new Date(r.created_at).toLocaleDateString('ar-SD')}</span>
                  {r.rating && (
                    <span className="flex items-center gap-1 text-sand-ink">
                      <Star className="h-3.5 w-3.5 fill-sand text-sand" />
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

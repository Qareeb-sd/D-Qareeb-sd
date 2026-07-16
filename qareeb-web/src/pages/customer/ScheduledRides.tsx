import { useEffect, useState } from 'react'
import { Clock4, MapPin, X, CheckCircle2 } from 'lucide-react'
import Screen from '@/components/Screen'
import { useAuth } from '@/store/AuthContext'
import { listScheduledRides, cancelScheduledRide } from '@/lib/api'
import { getService } from '@/data/services'
import { money } from '@/lib/format'
import type { ScheduledRide } from '@/lib/types'

/** رحلاتي المجدولة — عرض وإلغاء الحجوزات القادمة. */
export default function ScheduledRides() {
  const { profile } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const [rides, setRides] = useState<ScheduledRide[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => void listScheduledRides(userId).then(setRides)
  useEffect(load, [userId])

  const cancel = async (id: string) => {
    setBusyId(id)
    await cancelScheduledRide(id)
    setBusyId(null)
    load()
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('ar-SD', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <Screen title="رحلاتي المجدولة" back>
      {rides === null ? (
        <div className="card h-24 animate-pulse" />
      ) : rides.length === 0 ? (
        <p className="card p-6 text-center text-sm text-ink-muted">
          لا توجد رحلات مجدولة. يمكنك جدولة رحلة من شاشة تحديد الرحلة.
        </p>
      ) : (
        <div className="space-y-3">
          {rides.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-bold text-royal">
                  <Clock4 className="h-4 w-4 text-sand-ink" strokeWidth={2} />
                  {fmt(r.scheduled_at)}
                </p>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-soft">
                <MapPin className="h-4 w-4 shrink-0 text-green" strokeWidth={1.9} />
                <span className="truncate">
                  {r.pickup_address ?? 'الانطلاق'} ← {r.dropoff_address ?? 'الوجهة'}
                </span>
              </p>
              <div className="mt-1.5 flex items-center justify-between text-xs text-ink-muted">
                <span>{getService(r.service_id)?.name ?? r.service_id}</span>
                {r.fare != null && <span className="font-bold text-green">{money(r.fare)}</span>}
              </div>
              {r.status === 'pending' && (
                <button
                  onClick={() => cancel(r.id)}
                  disabled={busyId === r.id}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-hairline py-2.5 text-sm font-bold text-danger disabled:opacity-60"
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                  {busyId === r.id ? '…' : 'إلغاء الجدولة'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}

function StatusBadge({ status }: { status: ScheduledRide['status'] }) {
  if (status === 'dispatched')
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-green">
        <CheckCircle2 className="h-4 w-4" /> أُرسلت
      </span>
    )
  if (status === 'cancelled')
    return <span className="text-xs font-bold text-ink-muted">ملغاة</span>
  return (
    <span className="chip bg-sand-soft text-sand-ink">قادمة</span>
  )
}

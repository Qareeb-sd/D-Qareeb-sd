import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Star, RotateCcw, Share2, MessageCircle } from 'lucide-react'
import Screen from '@/components/Screen'
import { useAuth } from '@/store/AuthContext'
import { useRide } from '@/store/RideContext'
import { listRides } from '@/lib/api'
import { getService } from '@/data/services'
import { money } from '@/lib/format'
import { shareRideReceipt, shareReceiptWhatsApp } from '@/lib/receipt'
import type { Ride } from '@/lib/types'

/** رحلاتي السابقة. */
export default function Rides() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { setServiceId } = useRide()
  const userId = profile?.id ?? 'demo-user'
  const {
    data: rides,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['rides', userId],
    queryFn: () => listRides(userId),
  })

  // إعادة الطلب: نفس الخدمة والوجهة، والانطلاق من الموقع الحالي.
  const rebook = (r: Ride) => {
    setServiceId(r.service_id)
    navigate('/select-location', {
      state: {
        rebook: {
          dropoffPos:
            r.dropoff_lat != null && r.dropoff_lng != null
              ? { lat: r.dropoff_lat, lng: r.dropoff_lng }
              : null,
          dropoffAddr: r.dropoff_address ?? '',
        },
      },
    })
  }

  return (
    <Screen title="رحلاتي السابقة" back>
      {isError ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-soft">تعذّر تحميل الرحلات.</p>
          <button onClick={() => void refetch()} className="mt-3 text-sm font-bold text-royal">
            إعادة المحاولة
          </button>
        </div>
      ) : rides === undefined ? (
        <div className="card h-24 animate-pulse" />
      ) : rides.length === 0 ? (
        <p className="card p-6 text-center text-sm text-ink-muted">لا توجد رحلات بعد</p>
      ) : (
        <div className="space-y-3">
          {rides.map((r) => {
            const service = getService(r.service_id)
            const isCancelled = r.status === 'cancelled'
            const isCompleted = r.status === 'completed'
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-royal">{service?.name ?? r.service_id}</p>
                  <p
                    className={`font-extrabold ${isCancelled ? 'text-ink-muted line-through' : 'text-royal'}`}
                  >
                    {money(r.fare ?? 0)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {r.pickup_address ?? '—'} ← {r.dropoff_address ?? '—'}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                  <span className="flex items-center gap-2">
                    {new Date(r.created_at).toLocaleDateString('ar-SD')}
                    <RideStatusBadge status={r.status} />
                  </span>
                  {r.rating && (
                    <span className="flex items-center gap-1 text-sand-ink">
                      <Star className="h-3.5 w-3.5 fill-sand text-sand" />
                      {r.rating}
                    </span>
                  )}
                </div>
                {/* الإيصال/إعادة الطلب للرحلات المكتملة فقط — لا معنى لهما للملغاة */}
                {!isCancelled && (
                  <div className="mt-3 flex gap-2">
                    {(r.dropoff_lat != null || r.dropoff_address) && (
                      <button
                        onClick={() => rebook(r)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-green/40 bg-green-mint py-2.5 text-sm font-bold text-green"
                      >
                        <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
                        إعادة الطلب
                      </button>
                    )}
                    {isCompleted && (
                      <>
                        <button
                          onClick={() => void shareRideReceipt(r, service?.name ?? r.service_id)}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-hairline px-4 py-2.5 text-sm font-bold text-royal"
                        >
                          <Share2 className="h-4 w-4" strokeWidth={2} />
                          الإيصال
                        </button>
                        <button
                          onClick={() => shareReceiptWhatsApp(r, service?.name ?? r.service_id)}
                          aria-label="مشاركة عبر واتساب"
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-green/40 bg-green-mint px-4 py-2.5 text-sm font-bold text-green"
                        >
                          <MessageCircle className="h-4 w-4" strokeWidth={2.2} />
                          واتساب
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Screen>
  )
}

/** شارة حالة الرحلة في السجلّ (مكتملة/ملغاة/جارية). */
function RideStatusBadge({ status }: { status: Ride['status'] }) {
  if (status === 'cancelled')
    return <span className="rounded-md bg-danger/10 px-1.5 py-0.5 font-bold text-danger">ملغاة</span>
  if (status === 'completed')
    return <span className="rounded-md bg-green/10 px-1.5 py-0.5 font-bold text-green">مكتملة</span>
  return <span className="rounded-md bg-sand-soft px-1.5 py-0.5 font-bold text-sand-ink">جارية</span>
}

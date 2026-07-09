import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import VehicleImage from '@/components/VehicleImage'
import { useRide } from '@/store/RideContext'
import { useAuth } from '@/store/AuthContext'
import { getService } from '@/data/services'
import { subscribeToRide } from '@/lib/realtime'
import { getRideDriver, getActiveCustomerRide, type RideDriverInfo } from '@/lib/api'
import { isSupabaseConfigured } from '@/lib/supabase'
import { money } from '@/lib/format'
import type { PaymentMethod, RideStatus } from '@/lib/types'

const payments: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'cash', label: 'كاش', icon: '💵' },
  { id: 'bank_transfer', label: 'تحويل بنكي', icon: '🏦' },
  { id: 'wallet', label: 'محفظة قريب', icon: '👛' },
]

/** رسالة حالة الرحلة كما يراها الراكب. */
const statusInfo: Partial<Record<RideStatus, { emoji: string; text: string }>> = {
  accepted: { emoji: '🚗', text: 'السائق في الطريق إليك' },
  arrived: { emoji: '📍', text: 'وصل السائق — بانتظارك' },
  in_progress: { emoji: '🛣️', text: 'الرحلة جارية — في الطريق لوجهتك' },
}

/** شاشة الرحلة الجارية — بيانات السائق، الوجهة، طريقة الدفع. */
export default function Trip() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { rideId, serviceId, dropoff, payment, setPayment, fare, restore } = useRide()
  const service = serviceId ? getService(serviceId) : undefined
  const total = fare ?? 0
  const [driver, setDriver] = useState<RideDriverInfo | null>(null)
  const [status, setStatus] = useState<RideStatus | null>(null)

  // استرجاع الرحلة الجارية بعد تحديث الصفحة (تُفقد الحالة من الذاكرة).
  useEffect(() => {
    if (rideId || !profile?.id) return
    void getActiveCustomerRide(profile.id).then((ride) => {
      if (ride) {
        restore(ride)
        setStatus(ride.status)
      } else navigate('/home')
    })
  }, [rideId, profile?.id, restore, navigate])

  // جلب بيانات السائق المُسنَد فعلياً.
  useEffect(() => {
    if (!rideId) return
    void getRideDriver(rideId).then(setDriver)
  }, [rideId])

  // تهيئة حالة الرحلة أول مرة (قبل وصول أي حدث Realtime).
  useEffect(() => {
    if (status || !profile?.id) return
    void getActiveCustomerRide(profile.id).then((r) => {
      if (r) setStatus(r.status)
    })
  }, [status, profile?.id])

  // Realtime: تابع تقدّم الرحلة، وانتقل للتقييم لحظة إنهاء السائق لها.
  useEffect(() => {
    const unsub = subscribeToRide(rideId ?? '', (ride) => {
      setStatus(ride.status)
      if (ride.status === 'completed') navigate('/rate')
    })
    return unsub
  }, [rideId, navigate])

  const banner = status ? statusInfo[status] : undefined

  return (
    <Screen title="رحلتك الآن" bare>
      <div className="flex h-full flex-col">
        <MapView marker={dropoff?.pos} className="h-56 w-full" />

        <div className="flex-1 space-y-4 p-4">
          {/* حالة الرحلة */}
          {banner && (
            <div className="flex items-center gap-3 rounded-2xl border border-green/25 bg-green-soft p-3.5">
              <span className="text-2xl">{banner.emoji}</span>
              <p className="font-bold text-green">{banner.text}</p>
            </div>
          )}

          {/* السائق */}
          <div className="card flex items-center gap-3 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-green-soft text-xl">
              🧑🏽‍✈️
            </div>
            <div className="flex-1">
              <p className="font-bold">{driver?.full_name ?? 'سائق قريب'}</p>
              <p className="text-sm text-ink-soft">
                {service?.name}
                {driver?.rating != null ? ` · ⭐ ${driver.rating}` : ''}
                {driver?.plate_number ? ` · ${driver.plate_number}` : ''}
              </p>
            </div>
            <a
              href={`tel:${driver?.phone ?? ''}`}
              className={`btn-ghost px-4 py-2 text-sm ${driver?.phone ? '' : 'pointer-events-none opacity-40'}`}
            >
              اتصال
            </a>
          </div>

          {/* المركبة والوجهة */}
          <div className="card flex items-center gap-3 p-4">
            {service && <VehicleImage service={service} className="h-14 w-20" />}
            <div className="flex-1 text-sm">
              <p className="text-ink-muted">الوجهة</p>
              <p className="font-medium">{dropoff?.address ?? '—'}</p>
            </div>
            <p className="font-extrabold text-green">{money(total)}</p>
          </div>

          {/* طريقة الدفع */}
          <div>
            <p className="label">طريقة الدفع</p>
            <div className="grid grid-cols-3 gap-2">
              {payments.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPayment(p.id)}
                  className={`rounded-2xl border p-3 text-center text-sm transition ${
                    payment === p.id
                      ? 'border-green bg-green-soft font-bold text-green'
                      : 'border-hairline bg-white text-ink-soft'
                  }`}
                >
                  <div className="text-xl">{p.icon}</div>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-hairline p-4">
          {isSupabaseConfigured ? (
            <p className="text-center text-sm text-ink-soft">
              الرحلة جارية — سيُنهيها السائق عند الوصول.
            </p>
          ) : (
            <button className="btn-primary w-full" onClick={() => navigate('/rate')}>
              إنهاء الرحلة (معاينة)
            </button>
          )}
        </div>
      </div>
    </Screen>
  )
}

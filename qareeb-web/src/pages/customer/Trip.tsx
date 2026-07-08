import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import VehicleImage from '@/components/VehicleImage'
import SosButton from '@/components/SosButton'
import { useRide } from '@/store/RideContext'
import { getService } from '@/data/services'
import { getRide } from '@/lib/api'
import { subscribeToRide } from '@/lib/realtime'
import { estimateRoute } from '@/lib/pricing'
import { km, mins, money } from '@/lib/format'
import type { PaymentMethod, Ride } from '@/lib/types'

const payments: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'cash', label: 'كاش', icon: '💵' },
  { id: 'bank_transfer', label: 'تحويل بنكي', icon: '🏦' },
  { id: 'wallet', label: 'محفظة قريب', icon: '👛' },
]

const driverPosOf = (r: Ride | null): google.maps.LatLngLiteral | null =>
  r && r.driver_lat != null && r.driver_lng != null
    ? { lat: r.driver_lat, lng: r.driver_lng }
    : null

/** شاشة الرحلة الجارية — تتبّع السائق المباشر، بيانات السائق، الوجهة، والدفع. */
export default function Trip() {
  const navigate = useNavigate()
  const { rideId, serviceId, pickup, dropoff, payment, setPayment, fare } = useRide()
  const service = serviceId ? getService(serviceId) : undefined
  const total = fare ?? 0

  const [driverPos, setDriverPos] = useState<google.maps.LatLngLiteral | null>(null)

  // موقع مبدئي للسائق (إن وُجد) فور فتح الشاشة.
  useEffect(() => {
    if (!rideId) return
    void getRide(rideId).then((r) => {
      const pos = driverPosOf(r)
      if (pos) setDriverPos(pos)
    })
  }, [rideId])

  // Realtime: يتحرّك دبوس السائق مع كل تحديث موقع (بلا أي طلب لخرائط قوقل)،
  // والانتقال للتقييم لحظة إنهاء السائق للرحلة.
  useEffect(() => {
    const unsub = subscribeToRide(rideId ?? '', (ride) => {
      const pos = driverPosOf(ride)
      if (pos) setDriverPos(pos)
      if (ride.status === 'completed') navigate('/rate')
    })
    return unsub
  }, [rideId, navigate])

  // مسافة/زمن تقديريان (Haversine مجاني) من السائق إليك.
  const eta = driverPos ? estimateRoute(driverPos, pickup.pos) : null

  return (
    <Screen title="رحلتك الآن" bare>
      <div className="flex h-full flex-col">
        <MapView
          center={driverPos ?? dropoff?.pos ?? pickup.pos}
          driver={driverPos ?? undefined}
          marker={dropoff?.pos ?? pickup.pos}
          line={driverPos ? [driverPos, pickup.pos] : undefined}
          className="h-56 w-full"
        />

        <div className="flex-1 space-y-4 p-4">
          {/* حالة التتبع */}
          <div className="card flex items-center gap-3 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-green-soft">
              📍
            </span>
            {driverPos ? (
              <p className="flex-1 text-sm font-bold text-green">
                السائق في الطريق إليك · {km(eta!.distanceKm)} · ~{mins(eta!.durationMin)}
              </p>
            ) : (
              <p className="flex-1 text-sm text-ink-soft">في انتظار بدء تتبّع السائق…</p>
            )}
          </div>

          {/* السائق */}
          <div className="card flex items-center gap-3 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-green-soft text-xl">
              🧑🏽‍✈️
            </div>
            <div className="flex-1">
              <p className="font-bold">عثمان الطيب</p>
              <p className="text-sm text-ink-soft">
                {service?.name} · ⭐ 4.9
              </p>
            </div>
            <a href="tel:+249900000000" className="btn-ghost px-4 py-2 text-sm">
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
          <button className="btn-primary w-full" onClick={() => navigate('/rate')}>
            إنهاء الرحلة
          </button>
        </div>
      </div>

      <SosButton rideId={rideId} role="customer" />
    </Screen>
  )
}

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import VehicleImage from '@/components/VehicleImage'
import { useRide } from '@/store/RideContext'
import { getService } from '@/data/services'
import { subscribeToRide } from '@/lib/realtime'
import { money } from '@/lib/format'
import type { PaymentMethod } from '@/lib/types'

const payments: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'cash', label: 'كاش', icon: '💵' },
  { id: 'bank_transfer', label: 'تحويل بنكي', icon: '🏦' },
  { id: 'wallet', label: 'محفظة قريب', icon: '👛' },
]

/** شاشة الرحلة الجارية — بيانات السائق، الوجهة، طريقة الدفع، والإنهاء. */
export default function Trip() {
  const navigate = useNavigate()
  const { rideId, serviceId, dropoff, payment, setPayment, fare, passengers } = useRide()
  const service = serviceId ? getService(serviceId) : undefined
  const total = fare ?? 0

  // Realtime: انتقل للتقييم لحظة إنهاء السائق للرحلة (تسويتها).
  useEffect(() => {
    const unsub = subscribeToRide(rideId ?? '', (ride) => {
      if (ride.status === 'completed') navigate('/rate')
    })
    return unsub
  }, [rideId, navigate])

  return (
    <Screen title="رحلتك الآن" bare>
      <div className="flex h-full flex-col">
        <MapView marker={dropoff?.pos} className="h-56 w-full" />

        <div className="flex-1 space-y-4 p-4">
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
              {passengers > 0 && (
                <p className="mt-0.5 text-xs text-ink-soft">👥 {passengers} راكب</p>
              )}
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
    </Screen>
  )
}

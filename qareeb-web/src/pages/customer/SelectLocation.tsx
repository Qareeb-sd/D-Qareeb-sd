import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import { useRide } from '@/store/RideContext'
import { useAuth } from '@/store/AuthContext'
import { DEFAULT_SERVICE_ID } from '@/data/services'
import { createRide, getServicePricing, getSettings } from '@/lib/api'
import { estimateFare, estimateRoute } from '@/lib/pricing'
import { KHARTOUM } from '@/theme'

/** تحديد موقع الوجهة على الخريطة. المؤشّر ثابت في المنتصف والخريطة تتحرك تحته. */
export default function SelectLocation() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { serviceId, pickup, setDropoff, setFare, setRideId } = useRide()
  const [center, setCenter] = useState<google.maps.LatLngLiteral>(pickup.pos ?? KHARTOUM)
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    const dropoff = { pos: center, address: address || 'وجهة على الخريطة' }
    setDropoff(dropoff)

    const sid = serviceId ?? DEFAULT_SERVICE_ID

    // حساب الأجرة من محرّك التسعير (تسعيرة النوع + إعدادات المنصة).
    // المسافة/الزمن تقديريان الآن (Haversine) — يُستبدلان بـ Directions API لاحقاً.
    const [pricing, settings] = await Promise.all([getServicePricing(sid), getSettings()])
    let fare = 0
    if (pricing) {
      const { distanceKm, durationMin } = estimateRoute(pickup.pos, dropoff.pos)
      fare = estimateFare({ distanceKm, durationMin, pricing, settings }).total
    }
    setFare(fare)

    // أنشئ سجل الرحلة (يُتجاهل بلا أثر في وضع المعاينة).
    const { id } = await createRide({
      customer_id: profile?.id,
      service_id: sid,
      status: 'searching',
      pickup_lat: pickup.pos.lat,
      pickup_lng: pickup.pos.lng,
      pickup_address: pickup.address,
      dropoff_lat: dropoff.pos.lat,
      dropoff_lng: dropoff.pos.lng,
      dropoff_address: dropoff.address,
      fare,
    })
    setRideId(id ?? null)

    setBusy(false)
    navigate('/find-driver')
  }

  return (
    <Screen title="حدد الوجهة" back bare>
      <div className="relative flex h-full flex-col">
        <div className="relative flex-1">
          <MapView center={center} onCenterChanged={setCenter} className="h-full w-full" />
          {/* المؤشّر الثابت في المنتصف */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="-mt-6 text-4xl">📍</div>
          </div>
        </div>

        <div className="space-y-3 border-t border-hairline bg-bg p-4">
          <input
            className="field"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="اسم المكان (اختياري)"
          />
          <button className="btn-primary w-full" onClick={confirm} disabled={busy}>
            {busy ? '…' : 'تأكيد الوجهة'}
          </button>
        </div>
      </div>
    </Screen>
  )
}

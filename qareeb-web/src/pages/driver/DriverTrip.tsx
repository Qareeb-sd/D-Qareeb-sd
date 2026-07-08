import { useEffect, useRef, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import { useDriver } from '@/store/DriverContext'
import { settleRide, getSettings, updateDriverLocation } from '@/lib/api'
import { getService } from '@/data/services'
import { money } from '@/lib/format'

// لا نبثّ الموقع أكثر من مرة كل هذه المدة (تقنين لتخفيف الكتابة — لا علاقة لقوقل).
const BROADCAST_MS = 4000

/** الرحلة الجارية للسائق — بيانات الرحلة، وإكمالها مع تسوية الأرباح (خصم العمولة). */
export default function DriverTrip() {
  const navigate = useNavigate()
  const { activeRide, setActiveRide } = useDriver()
  const [rate, setRate] = useState(0.15)
  const [busy, setBusy] = useState(false)
  const [myPos, setMyPos] = useState<google.maps.LatLngLiteral | null>(null)
  const lastSent = useRef(0)

  useEffect(() => {
    void getSettings().then((s) => setRate(s.commission_rate))
  }, [])

  // تتبع مباشر: نقرأ GPS الجهاز (مجاناً) ونبثّه للراكب عبر Supabase بمعدّل مُقنَّن.
  const rideId = activeRide?.id
  useEffect(() => {
    if (!rideId || !('geolocation' in navigator)) return
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        setMyPos(pos)
        const now = Date.now()
        if (now - lastSent.current >= BROADCAST_MS) {
          lastSent.current = now
          void updateDriverLocation(rideId, pos.lat, pos.lng)
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [rideId])

  if (!activeRide) return <Navigate to="/driver" replace />

  const service = getService(activeRide.service_id)
  const fare = activeRide.fare ?? 0
  const commission = Math.round(fare * rate)
  const net = fare - commission

  const complete = async () => {
    setBusy(true)
    const { error } = await settleRide(activeRide.id)
    setBusy(false)
    if (error) return alert(error)
    setActiveRide(null)
    navigate('/driver/wallet')
  }

  return (
    <Screen title="الرحلة الجارية" bare>
      <div className="flex h-full flex-col">
        <MapView
          center={myPos ?? { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng }}
          driver={myPos ?? undefined}
          marker={
            activeRide.dropoff_lat && activeRide.dropoff_lng
              ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng }
              : undefined
          }
          className="h-56 w-full"
        />

        <div className="flex-1 space-y-4 p-4">
          <div className="card p-4">
            <p className="font-bold">{service?.name ?? activeRide.service_id}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {activeRide.pickup_address} ← {activeRide.dropoff_address}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-green">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green" />
              {myPos ? 'يُشارَك موقعك مع الراكب مباشرة' : 'جارٍ تحديد موقعك…'}
            </p>
          </div>

          {/* تفصيل الأرباح */}
          <div className="card divide-y divide-hairline p-0">
            <Row label="الأجرة" value={money(fare)} />
            <Row
              label={`عمولة المنصة (${Math.round(rate * 100)}%)`}
              value={`− ${money(commission)}`}
              danger
            />
            <Row label="صافي أرباحك" value={money(net)} strong />
          </div>
        </div>

        <div className="border-t border-hairline p-4">
          <button className="btn-primary w-full" onClick={complete} disabled={busy}>
            {busy ? '…' : 'إنهاء وتسوية الرحلة'}
          </button>
        </div>
      </div>
    </Screen>
  )
}

function Row({
  label,
  value,
  strong,
  danger,
}: {
  label: string
  value: string
  strong?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-ink-soft">{label}</span>
      <span
        className={
          strong ? 'font-extrabold text-green' : danger ? 'font-medium text-danger' : 'font-medium'
        }
      >
        {value}
      </span>
    </div>
  )
}

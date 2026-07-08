import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJsApiLoader } from '@react-google-maps/api'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import { useRide } from '@/store/RideContext'
import { useAuth } from '@/store/AuthContext'
import { DEFAULT_SERVICE_ID, getService } from '@/data/services'
import { createRide, getServicePricing, getSettings } from '@/lib/api'
import { estimateFare, estimateRoute } from '@/lib/pricing'
import {
  fetchRoute,
  GOOGLE_MAPS_API_KEY,
  MAPS_LIBRARIES,
  MAPS_LOADER_ID,
  isMapsConfigured,
} from '@/lib/maps'
import { km, mins, money } from '@/lib/format'
import { KHARTOUM } from '@/theme'
import type { Settings, ServicePricing } from '@/lib/types'

interface Quote {
  distanceKm: number
  durationMin: number
  fare: number
  real: boolean
}

/** صفحة واحدة: الإقلاع (GPS) + الوجهة (بالدبوس على الخريطة) + المسافة/المدة/السعر. */
export default function SelectLocation() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { serviceId, setPickup, setDropoff, setFare, setRideId } = useRide()

  const sid = serviceId ?? DEFAULT_SERVICE_ID
  const service = getService(sid)

  const [pickupPos, setPickupPos] = useState<google.maps.LatLngLiteral | null>(null)
  const [dropoffPos, setDropoffPos] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [dropoffAddr, setDropoffAddr] = useState('')
  const [gpsBusy, setGpsBusy] = useState(false)
  const [gpsMsg, setGpsMsg] = useState('')

  const [pricing, setPricing] = useState<ServicePricing | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)

  const { isLoaded } = useJsApiLoader({
    id: MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  })

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsMsg('تحديد الموقع غير مدعوم في هذا المتصفح')
      return
    }
    setGpsBusy(true)
    setGpsMsg('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        setPickupPos(pos)
        setDropoffPos((d) => (d === KHARTOUM ? pos : d))
        setGpsBusy(false)
        setGpsMsg('تم تحديد موقعك ✓')
      },
      () => {
        setGpsBusy(false)
        setGpsMsg('تعذّر تحديد الموقع — فعّل صلاحية الموقع وأعد المحاولة')
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  // محاولة أولى تلقائية لتحديد الموقع.
  const tried = useRef(false)
  useEffect(() => {
    if (tried.current) return
    tried.current = true
    useMyLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void Promise.all([getServicePricing(sid), getSettings()]).then(([p, s]) => {
      setPricing(p)
      setSettings(s)
    })
  }, [sid])

  // معاينة الأجرة (تحتاج نقطة إقلاع + وجهة).
  useEffect(() => {
    if (!pricing || !settings || !pickupPos) return
    let alive = true
    const t = setTimeout(async () => {
      const real = isLoaded && isMapsConfigured ? await fetchRoute(pickupPos, dropoffPos) : null
      const route = real ?? estimateRoute(pickupPos, dropoffPos)
      if (!alive) return
      const fare = estimateFare({
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        pricing,
        settings,
      }).total
      setQuote({ ...route, fare, real: Boolean(real) })
    }, 500)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [pickupPos, dropoffPos, pricing, settings, isLoaded])

  const confirm = async () => {
    if (!pickupPos) {
      setGpsMsg('حدّد نقطة الإقلاع أولاً (استخدم موقعي)')
      return
    }
    setBusy(true)
    const pickup = { pos: pickupPos, address: 'موقعي الحالي' }
    const dropoff = { pos: dropoffPos, address: dropoffAddr || 'الوجهة' }
    setPickup(pickup)
    setDropoff(dropoff)
    setFare(quote?.fare ?? 0)

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
      fare: quote?.fare ?? 0,
    })
    setRideId(id ?? null)
    setBusy(false)
    navigate('/find-driver')
  }

  return (
    <Screen title="حدد رحلتك" back>
      {/* نقطة الإقلاع — GPS */}
      <div className="card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span>🟢</span>
          <p className="font-bold">نقطة الإقلاع</p>
        </div>
        <button
          onClick={useMyLocation}
          disabled={gpsBusy}
          className={`btn w-full ${pickupPos ? 'btn-ghost' : 'btn-primary'}`}
        >
          {gpsBusy ? 'جارٍ تحديد موقعك…' : pickupPos ? 'تحديث موقعي 🔄' : '📍 استخدم موقعي الحالي (GPS)'}
        </button>
        {gpsMsg && (
          <p className={`mt-2 text-center text-xs ${pickupPos ? 'text-green' : 'text-danger'}`}>
            {gpsMsg}
          </p>
        )}
      </div>

      {/* الوجهة — بالدبوس على الخريطة */}
      <div className="mt-4 flex items-center gap-2">
        <span>📍</span>
        <p className="font-bold">الوجهة</p>
        <span className="text-xs text-ink-muted">— حرّك الخريطة لوضع الدبوس</span>
      </div>
      <div className="relative mt-2 h-60 overflow-hidden rounded-2xl">
        <MapView center={dropoffPos} onCenterChanged={setDropoffPos} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="-mt-6 text-4xl drop-shadow">📍</div>
        </div>
      </div>
      <input
        className="field mt-2"
        value={dropoffAddr}
        onChange={(e) => setDropoffAddr(e.target.value)}
        placeholder="اسم الوجهة (اختياري)"
      />

      {/* المسافة · المدة · السعر */}
      <div className="card mt-4 grid grid-cols-3 divide-x divide-x-reverse divide-hairline text-center">
        <Stat label="المسافة" value={quote ? km(quote.distanceKm) : '—'} />
        <Stat label="المدة" value={quote ? mins(quote.durationMin) : '—'} />
        <Stat
          label="السعر"
          value={quote ? money(quote.fare) : '—'}
          strong
          note={quote && !quote.real ? 'تقديري' : undefined}
        />
      </div>
      <p className="mt-1 text-center text-xs text-ink-muted">{service?.name}</p>

      <button className="btn-primary mt-4 w-full" onClick={confirm} disabled={busy || !quote}>
        {busy ? '…' : 'تأكيد الرحلة'}
      </button>
    </Screen>
  )
}

function Stat({
  label,
  value,
  strong,
  note,
}: {
  label: string
  value: string
  strong?: boolean
  note?: string
}) {
  return (
    <div className="px-2 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={strong ? 'font-extrabold text-green' : 'font-bold'}>{value}</p>
      {note && <p className="text-[10px] text-ink-muted">{note}</p>}
    </div>
  )
}

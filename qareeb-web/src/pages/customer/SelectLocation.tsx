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
  real: boolean // true = من Directions API، false = تقدير Haversine
}

/** تحديد موقع الوجهة على الخريطة + معاينة أجرة حيّة (Directions API). */
export default function SelectLocation() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { serviceId, pickup, setPickup, setDropoff, setFare, setRideId } = useRide()

  const sid = serviceId ?? DEFAULT_SERVICE_ID
  const service = getService(sid)

  const [center, setCenter] = useState<google.maps.LatLngLiteral>(pickup.pos ?? KHARTOUM)
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [pricing, setPricing] = useState<ServicePricing | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoting, setQuoting] = useState(false)

  const { isLoaded } = useJsApiLoader({
    id: MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  })

  // موقع المستخدم الحالي كنقطة انطلاق (مرة واحدة).
  const gotLocation = useRef(false)
  useEffect(() => {
    if (gotLocation.current || !navigator.geolocation) return
    gotLocation.current = true
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setPickup({
          pos: { lat: p.coords.latitude, lng: p.coords.longitude },
          address: 'موقعي الحالي',
        }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [setPickup])

  // تحميل تسعيرة النوع + إعدادات المنصة.
  useEffect(() => {
    void Promise.all([getServicePricing(sid), getSettings()]).then(([p, s]) => {
      setPricing(p)
      setSettings(s)
    })
  }, [sid])

  // معاينة الأجرة الحيّة عند تحريك الخريطة (Directions API مع بديل Haversine).
  useEffect(() => {
    if (!pricing || !settings) return
    let alive = true
    setQuoting(true)
    const t = setTimeout(async () => {
      const real = isLoaded && isMapsConfigured ? await fetchRoute(pickup.pos, center) : null
      const route = real ?? estimateRoute(pickup.pos, center)
      if (!alive) return
      const fare = estimateFare({
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        pricing,
        settings,
      }).total
      setQuote({ ...route, fare, real: Boolean(real) })
      setQuoting(false)
    }, 500)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [center, pickup.pos, pricing, settings, isLoaded])

  const confirm = async () => {
    setBusy(true)
    const dropoff = { pos: center, address: address || 'وجهة على الخريطة' }
    setDropoff(dropoff)

    // استخدم الأجرة المعروضة، وإلا احسبها الآن.
    let fare = quote?.fare ?? 0
    if (!quote && pricing && settings) {
      const route = (await fetchRoute(pickup.pos, center)) ?? estimateRoute(pickup.pos, center)
      fare = estimateFare({ ...route, pricing, settings }).total
    }
    setFare(fare)

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
          {/* معاينة الأجرة */}
          <div className="card flex items-center justify-between p-3">
            <div className="text-sm">
              <p className="font-bold">{service?.name ?? 'الخدمة'}</p>
              {quote ? (
                <p className="text-ink-soft">
                  {km(quote.distanceKm)} · {mins(quote.durationMin)}
                  {!quote.real && ' · تقديري'}
                </p>
              ) : (
                <p className="text-ink-muted">{quoting ? 'نحسب الأجرة…' : '—'}</p>
              )}
            </div>
            <p className="text-lg font-extrabold text-green">
              {quote ? money(quote.fare) : quoting ? '…' : '—'}
            </p>
          </div>

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

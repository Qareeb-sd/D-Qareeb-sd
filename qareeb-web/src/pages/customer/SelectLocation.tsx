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

type Step = 'pickup' | 'dropoff'
interface Quote {
  distanceKm: number
  durationMin: number
  fare: number
  real: boolean
}

/** تحديد نقطة الإقلاع ثم الوجهة على الخريطة + معاينة أجرة حيّة. */
export default function SelectLocation() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { serviceId, setPickup, setDropoff, setFare, setRideId } = useRide()

  const sid = serviceId ?? DEFAULT_SERVICE_ID
  const service = getService(sid)

  const [step, setStep] = useState<Step>('pickup')
  const [pickupPos, setPickupPos] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [pickupAddr, setPickupAddr] = useState('')
  const [dropoffPos, setDropoffPos] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [dropoffAddr, setDropoffAddr] = useState('')

  const [pricing, setPricing] = useState<ServicePricing | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [busy, setBusy] = useState(false)

  const { isLoaded } = useJsApiLoader({
    id: MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  })

  // موقع المستخدم الحالي كنقطة إقلاع مبدئية (مرة واحدة).
  const located = useRef(false)
  useEffect(() => {
    if (located.current || !navigator.geolocation) return
    located.current = true
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        setPickupPos(pos)
        setDropoffPos(pos)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [])

  useEffect(() => {
    void Promise.all([getServicePricing(sid), getSettings()]).then(([p, s]) => {
      setPricing(p)
      setSettings(s)
    })
  }, [sid])

  // معاينة الأجرة على خطوة الوجهة (المسار من الإقلاع إلى الوجهة).
  useEffect(() => {
    if (step !== 'dropoff' || !pricing || !settings) return
    let alive = true
    setQuoting(true)
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
      setQuoting(false)
    }, 500)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [step, pickupPos, dropoffPos, pricing, settings, isLoaded])

  const activePos = step === 'pickup' ? pickupPos : dropoffPos
  const setActivePos = step === 'pickup' ? setPickupPos : setDropoffPos

  const confirm = async () => {
    setBusy(true)
    const pickup = { pos: pickupPos, address: pickupAddr || 'نقطة الإقلاع' }
    const dropoff = { pos: dropoffPos, address: dropoffAddr || 'الوجهة' }
    setPickup(pickup)
    setDropoff(dropoff)

    let fare = quote?.fare ?? 0
    if (!quote && pricing && settings) {
      const route = (await fetchRoute(pickupPos, dropoffPos)) ?? estimateRoute(pickupPos, dropoffPos)
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
    <Screen title={step === 'pickup' ? 'نقطة الإقلاع' : 'الوجهة'} back bare>
      <div className="relative flex h-full flex-col">
        {/* خطوات */}
        <div className="flex items-center justify-center gap-2 border-b border-hairline bg-bg py-2 text-xs">
          <span className={step === 'pickup' ? 'font-bold text-green' : 'text-ink-muted'}>
            ● الإقلاع
          </span>
          <span className="text-ink-muted">—</span>
          <span className={step === 'dropoff' ? 'font-bold text-green' : 'text-ink-muted'}>
            ● الوجهة
          </span>
        </div>

        <div className="relative flex-1">
          <MapView center={activePos} onCenterChanged={setActivePos} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="-mt-6 text-4xl">{step === 'pickup' ? '🟢' : '📍'}</div>
          </div>
        </div>

        <div className="space-y-3 border-t border-hairline bg-bg p-4">
          {step === 'dropoff' && (
            <button
              onClick={() => setStep('pickup')}
              className="flex w-full items-center gap-2 rounded-2xl bg-green-soft px-3 py-2 text-right text-sm"
            >
              <span className="text-green">🟢</span>
              <span className="flex-1 text-ink-soft">
                الإقلاع: {pickupAddr || 'نقطة على الخريطة'}
              </span>
              <span className="text-xs text-green">تعديل</span>
            </button>
          )}

          {step === 'dropoff' && (
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
          )}

          <input
            className="field"
            value={step === 'pickup' ? pickupAddr : dropoffAddr}
            onChange={(e) =>
              step === 'pickup' ? setPickupAddr(e.target.value) : setDropoffAddr(e.target.value)
            }
            placeholder={step === 'pickup' ? 'اسم نقطة الإقلاع (اختياري)' : 'اسم الوجهة (اختياري)'}
          />

          {step === 'pickup' ? (
            <button className="btn-primary w-full" onClick={() => setStep('dropoff')}>
              التالي: تحديد الوجهة
            </button>
          ) : (
            <button className="btn-primary w-full" onClick={confirm} disabled={busy}>
              {busy ? '…' : 'تأكيد الوجهة'}
            </button>
          )}
        </div>
      </div>
    </Screen>
  )
}

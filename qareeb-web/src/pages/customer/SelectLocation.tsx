import { useEffect, useState } from 'react'
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

type Field = 'pickup' | 'dropoff'
type PickupMode = 'current' | 'other'
interface Quote {
  distanceKm: number
  durationMin: number
  fare: number
  real: boolean
}

/** صفحة واحدة: اختيار الإقلاع (موقعي الحالي / موقع آخر) + الوجهة بالخريطة + الأجرة. */
export default function SelectLocation() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { serviceId, passengers, setPickup, setDropoff, setFare, setRideId } = useRide()

  const sid = serviceId ?? DEFAULT_SERVICE_ID
  const service = getService(sid)

  const [pickupMode, setPickupMode] = useState<PickupMode>('current')
  const [active, setActive] = useState<Field>('dropoff')
  const [pickupPos, setPickupPos] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [pickupAddr, setPickupAddr] = useState('')
  const [pickupSet, setPickupSet] = useState(false)
  const [dropoffPos, setDropoffPos] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [dropoffAddr, setDropoffAddr] = useState('')
  const [dropoffSet, setDropoffSet] = useState(false)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [gpsErr, setGpsErr] = useState('')

  const destOptional = Boolean(service?.destinationOptional)
  const destChosen = dropoffSet || dropoffAddr.trim() !== ''

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
      setGpsErr('تحديد الموقع غير مدعوم')
      return
    }
    setGpsBusy(true)
    setGpsErr('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        setPickupPos(pos)
        setDropoffPos((d) => (d === KHARTOUM ? pos : d))
        setPickupAddr('موقعي الحالي')
        setPickupSet(true)
        setActive('dropoff')
        setGpsBusy(false)
      },
      () => {
        setGpsBusy(false)
        setGpsErr('تعذّر تحديد الموقع — فعّل صلاحية الموقع')
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const chooseMode = (mode: PickupMode) => {
    setPickupMode(mode)
    setGpsErr('')
    if (mode === 'current') {
      useMyLocation()
    } else {
      // موقع آخر: يكتبه العميل أو يحدّده بالخريطة.
      setPickupAddr('')
      setPickupSet(false)
      setActive('pickup')
    }
  }

  useEffect(() => {
    void Promise.all([getServicePricing(sid), getSettings()]).then(([p, s]) => {
      setPricing(p)
      setSettings(s)
    })
  }, [sid])

  useEffect(() => {
    if (!pricing || !settings) return
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

  const activePos = active === 'pickup' ? pickupPos : dropoffPos
  const setActivePos = active === 'pickup' ? setPickupPos : setDropoffPos

  const confirm = async () => {
    setBusy(true)
    const pickup = { pos: pickupPos, address: pickupAddr || 'نقطة الإقلاع' }
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
      passengers,
    })
    setRideId(id ?? null)
    setBusy(false)
    navigate('/find-driver')
  }

  return (
    <Screen title="حدد رحلتك" back>
      {/* نقطة الإقلاع — اختيار واضح */}
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <span>🟢</span>
          <p className="font-bold">من أين ننقلك؟</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-hairline bg-white p-1">
          {(['current', 'other'] as PickupMode[]).map((m) => (
            <button
              key={m}
              onClick={() => chooseMode(m)}
              className={`rounded-xl py-2.5 text-sm font-bold transition ${
                pickupMode === m ? 'bg-green text-white' : 'text-ink-soft'
              }`}
            >
              {m === 'current' ? '📍 موقعي الحالي' : '✍️ موقع آخر'}
            </button>
          ))}
        </div>

        {pickupMode === 'current' ? (
          <div className="mt-3 text-center text-sm">
            {gpsBusy ? (
              <p className="text-ink-soft">جارٍ تحديد موقعك…</p>
            ) : gpsErr ? (
              <button onClick={useMyLocation} className="btn-ghost w-full">
                {gpsErr} · إعادة المحاولة
              </button>
            ) : pickupSet ? (
              <p className="text-green">تم تحديد موقعك ✓</p>
            ) : (
              <button onClick={useMyLocation} className="btn-primary w-full">
                تحديد موقعي الآن
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <input
              className="field"
              value={pickupAddr}
              onFocus={() => setActive('pickup')}
              onChange={(e) => {
                setPickupAddr(e.target.value)
                setPickupSet(true)
              }}
              placeholder="اكتب اسم نقطة الإقلاع"
            />
            <button
              onClick={() => setActive('pickup')}
              className={`btn mt-2 w-full ${active === 'pickup' ? 'btn-primary' : 'btn-outline'}`}
            >
              تحديد الإقلاع على الخريطة 🗺️
            </button>
          </div>
        )}
      </div>

      {/* الوجهة */}
      <div className="mt-4 flex items-center gap-2">
        <span>📍</span>
        <p className="font-bold">إلى أين؟</p>
        <span className="text-xs text-ink-muted">
          {destOptional ? '(اختياري)' : '(مطلوب)'}
        </span>
      </div>
      <input
        className="field mt-2"
        value={dropoffAddr}
        onFocus={() => setActive('dropoff')}
        onChange={(e) => {
          setDropoffAddr(e.target.value)
          setDropoffSet(true)
        }}
        placeholder={destOptional ? 'اكتب اسم الوجهة (اختياري)' : 'اكتب اسم الوجهة'}
      />

      {/* الخريطة تحدّد النقطة النشطة */}
      <p className="mb-2 mt-3 text-sm text-ink-soft">
        حرّك الخريطة لتحديد {active === 'pickup' ? 'الإقلاع 🟢' : 'الوجهة 📍'}
      </p>
      <div className="relative h-52 overflow-hidden rounded-2xl">
        <MapView
          center={activePos}
          onCenterChanged={setActivePos}
          onUserDrag={() => (active === 'pickup' ? setPickupSet(true) : setDropoffSet(true))}
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="-mt-6 text-4xl drop-shadow">{active === 'pickup' ? '🟢' : '📍'}</div>
        </div>
      </div>

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

      {!destOptional && !destChosen && (
        <p className="mt-3 text-center text-xs text-warning">حدّد وجهتك للمتابعة</p>
      )}
      <button
        className="btn-primary mt-2 w-full"
        onClick={confirm}
        disabled={busy || !quote || (!destOptional && !destChosen)}
      >
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

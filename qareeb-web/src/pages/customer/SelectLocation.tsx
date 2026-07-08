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

type Field = 'pickup' | 'dropoff'
interface Quote {
  distanceKm: number
  durationMin: number
  fare: number
  real: boolean
}

/** صفحة واحدة: نقطة الإقلاع + الوجهة + المسافة/المدة/السعر. */
export default function SelectLocation() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { serviceId, setPickup, setDropoff, setFare, setRideId } = useRide()

  const sid = serviceId ?? DEFAULT_SERVICE_ID
  const service = getService(sid)

  const [active, setActive] = useState<Field>('dropoff')
  const [pickupPos, setPickupPos] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [pickupAddr, setPickupAddr] = useState('موقعي الحالي')
  const [dropoffPos, setDropoffPos] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [dropoffAddr, setDropoffAddr] = useState('')

  const [pricing, setPricing] = useState<ServicePricing | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)

  const { isLoaded } = useJsApiLoader({
    id: MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  })

  // موقع المستخدم الحالي كنقطة إقلاع مبدئية.
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

  // معاينة الأجرة كلما تغيّرت النقطتان.
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
    })
    setRideId(id ?? null)
    setBusy(false)
    navigate('/find-driver')
  }

  return (
    <Screen title="حدد رحلتك" back>
      {/* من / إلى */}
      <div className="card divide-y divide-hairline p-0">
        <FieldRow
          icon="🟢"
          label="من"
          value={pickupAddr}
          active={active === 'pickup'}
          onFocus={() => setActive('pickup')}
          onChange={setPickupAddr}
          placeholder="نقطة الإقلاع"
        />
        <FieldRow
          icon="📍"
          label="إلى"
          value={dropoffAddr}
          active={active === 'dropoff'}
          onFocus={() => setActive('dropoff')}
          onChange={setDropoffAddr}
          placeholder="الوجهة"
        />
      </div>

      {/* الخريطة (تحدّد النقطة النشطة) */}
      <p className="mb-2 mt-4 text-sm text-ink-soft">
        حرّك الخريطة لتحديد {active === 'pickup' ? 'نقطة الإقلاع 🟢' : 'الوجهة 📍'}
      </p>
      <div className="relative h-56 overflow-hidden rounded-2xl">
        <MapView center={activePos} onCenterChanged={setActivePos} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="-mt-5 text-3xl drop-shadow">{active === 'pickup' ? '🟢' : '📍'}</div>
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

      <button className="btn-primary mt-4 w-full" onClick={confirm} disabled={busy || !quote}>
        {busy ? '…' : 'تأكيد الرحلة'}
      </button>
    </Screen>
  )
}

function FieldRow({
  icon,
  label,
  value,
  active,
  onFocus,
  onChange,
  placeholder,
}: {
  icon: string
  label: string
  value: string
  active: boolean
  onFocus: () => void
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-3 ${active ? 'bg-green-mint' : ''}`}
      onClick={onFocus}
    >
      <span>{icon}</span>
      <span className="w-8 text-sm font-bold text-ink-soft">{label}</span>
      <input
        className="flex-1 bg-transparent text-ink placeholder:text-ink-muted outline-none"
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import MapPin from '@/components/MapPin'
import { useRide } from '@/store/RideContext'
import { useAuth } from '@/store/AuthContext'
import { useMaps } from '@/store/MapsContext'
import { DEFAULT_SERVICE_ID, getService } from '@/data/services'
import { createRide, getServicePricing, getSettings } from '@/lib/api'
import { estimateFare, estimateRoute } from '@/lib/pricing'
import { fetchRoute, isMapsConfigured } from '@/lib/maps'
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
interface SavedPlace {
  lat: number
  lng: number
  address: string
}

const CHIPS: { key: string; label: string; icon: string }[] = [
  { key: 'favorite', label: 'المفضلة', icon: '⭐' },
  { key: 'work', label: 'العمل', icon: '💼' },
  { key: 'home', label: 'المنزل', icon: '🏠' },
]

/** تحديد الرحلة: نقطة الانطلاق + الوجهة على الخريطة + الأماكن المحفوظة + الأجرة. */
export default function SelectLocation() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { serviceId, setPickup, setDropoff, setFare, setRideId } = useRide()

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

  const { isLoaded } = useMaps()

  // الأماكن المحفوظة (منزل/عمل/مفضلة) — محلياً على الجهاز.
  const placesKey = `qareeb_places_${profile?.id ?? 'guest'}`
  const [places, setPlaces] = useState<Record<string, SavedPlace>>(() => {
    try {
      return JSON.parse(localStorage.getItem(placesKey) || '{}')
    } catch {
      return {}
    }
  })

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsErr('تحديد الموقع غير مدعوم')
      return
    }
    setGpsBusy(true)
    setGpsErr('')
    setPickupMode('current')
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

  // أول دخول: حاول تحديد الموقع تلقائياً.
  useEffect(() => {
    useMyLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changePickup = () => {
    setPickupMode('other')
    setPickupAddr('')
    setPickupSet(false)
    setActive('pickup')
  }

  const swap = () => {
    setPickupPos(dropoffPos)
    setDropoffPos(pickupPos)
    setPickupAddr(dropoffAddr)
    setDropoffAddr(pickupAddr)
    setPickupSet(dropoffSet)
    setDropoffSet(pickupSet)
    setPickupMode('other')
  }

  const useChip = (key: string, label: string) => {
    const p = places[key]
    if (p) {
      setDropoffPos({ lat: p.lat, lng: p.lng })
      setDropoffAddr(p.address)
      setDropoffSet(true)
      setActive('dropoff')
      return
    }
    if (dropoffSet || dropoffAddr.trim()) {
      const next = {
        ...places,
        [key]: { lat: dropoffPos.lat, lng: dropoffPos.lng, address: dropoffAddr.trim() || label },
      }
      setPlaces(next)
      try {
        localStorage.setItem(placesKey, JSON.stringify(next))
      } catch {
        /* تجاهل — الحفظ المحلي غير متاح */
      }
    } else {
      alert(`اختر وجهة أولاً ثم اضغط «${label}» لحفظها هنا.`)
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
    const bothPlaced = pickupSet && dropoffSet
    const t = setTimeout(async () => {
      const real =
        bothPlaced && isLoaded && isMapsConfigured ? await fetchRoute(pickupPos, dropoffPos) : null
      const route = real ?? estimateRoute(pickupPos, dropoffPos)
      if (!alive) return
      const fare = estimateFare({
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        pricing,
        settings,
      }).total
      setQuote({ ...route, fare, real: Boolean(real) })
    }, 700)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [pickupPos, dropoffPos, pickupSet, dropoffSet, pricing, settings, isLoaded])

  const activePos = active === 'pickup' ? pickupPos : dropoffPos
  const setActivePos = active === 'pickup' ? setPickupPos : setDropoffPos

  // علامة النقطة غير النشطة (لتظهر النقطتان معاً)، وخط الرحلة عند تحديدهما.
  const otherMarker =
    active === 'pickup'
      ? dropoffSet
        ? dropoffPos
        : null
      : pickupSet
        ? pickupPos
        : null

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

  const pickupLabel =
    pickupMode === 'current'
      ? gpsBusy
        ? 'جارٍ تحديد موقعك…'
        : 'موقعي الحالي'
      : pickupAddr.trim() || 'اختر نقطة الانطلاق على الخريطة'

  return (
    <Screen title="حدد رحلتك" back bare>
      <div className="flex h-full flex-col">
        {/* الخريطة تملأ الأعلى */}
        <div className="relative min-h-[220px] flex-1">
          <MapView
            center={activePos}
            onCenterChanged={setActivePos}
            onUserDrag={() => (active === 'pickup' ? setPickupSet(true) : setDropoffSet(true))}
            markers={otherMarker ? [otherMarker] : undefined}
            line={pickupSet && dropoffSet ? [pickupPos, dropoffPos] : undefined}
            className="h-full w-full"
          />
          <MapPin variant={active === 'pickup' ? 'pickup' : 'dropoff'} />
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
            <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white">
              حرّك الخريطة لتحديد {active === 'pickup' ? 'نقطة الانطلاق' : 'الوجهة'}
            </span>
          </div>
        </div>

        {/* اللوحة السفلية */}
        <div
          className="relative z-10 -mt-5 rounded-t-3xl border-t border-hairline bg-white px-4 pt-3 shadow-lift"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-hairline" />

          {/* نقطة الانطلاق */}
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full bg-green" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">نقطة الانطلاق</p>
              <p className="truncate font-bold">{pickupLabel}</p>
            </div>
            <button
              onClick={active === 'pickup' && pickupMode === 'other' ? useMyLocation : changePickup}
              className="shrink-0 rounded-xl border border-green/40 px-3 py-1.5 text-xs font-bold text-green"
            >
              {active === 'pickup' && pickupMode === 'other' ? '📍 موقعي' : 'تغيير'}
            </button>
          </div>

          {gpsErr && (
            <button onClick={useMyLocation} className="mt-1 text-xs text-danger">
              {gpsErr} · إعادة المحاولة
            </button>
          )}

          {/* زر التبديل */}
          <div className="relative my-2 flex items-center">
            <span className="h-px flex-1 bg-hairline" />
            <button
              onClick={swap}
              aria-label="تبديل الانطلاق والوجهة"
              className="mx-2 grid h-8 w-8 place-items-center rounded-full border border-hairline bg-white text-ink-soft shadow-sm"
            >
              ⇅
            </button>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          {/* الوجهة */}
          <div className="flex items-center gap-3">
            <span className="grid h-3 w-3 shrink-0 place-items-center text-danger">📍</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">
                الوجهة {destOptional && <span className="text-ink-muted/70">(اختياري)</span>}
              </p>
              <input
                className="w-full bg-transparent py-1 text-base font-bold outline-none placeholder:font-normal placeholder:text-ink-muted"
                value={dropoffAddr}
                onFocus={() => setActive('dropoff')}
                onChange={(e) => {
                  setDropoffAddr(e.target.value)
                  setDropoffSet(true)
                }}
                placeholder="إلى أين؟ 🔎"
              />
            </div>
          </div>

          {/* الأماكن المحفوظة */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CHIPS.map((c) => {
              const saved = Boolean(places[c.key])
              return (
                <button
                  key={c.key}
                  onClick={() => useChip(c.key, c.label)}
                  className={`rounded-2xl px-2 py-2.5 text-sm font-bold transition ${
                    saved
                      ? 'bg-green-soft text-green'
                      : 'bg-hairline/40 text-ink-soft'
                  }`}
                >
                  {c.icon} {c.label}
                </button>
              )
            })}
          </div>

          {/* المسافة · المدة · السعر التقديري */}
          <div className="mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-hairline text-center">
            <Stat label="المسافة" value={quote ? km(quote.distanceKm) : '—'} />
            <Stat label="المدة" value={quote ? mins(quote.durationMin) : '—'} />
            <Stat
              label="السعر التقديري"
              value={quote ? money(quote.fare) : '—'}
              strong
              note={quote && !quote.real ? 'تقديري' : undefined}
            />
          </div>

          {!destOptional && !destChosen && (
            <p className="mt-2 text-center text-xs text-warning">حدّد وجهتك للمتابعة</p>
          )}
          <button
            className="btn-primary mt-3 flex w-full items-center justify-center gap-2"
            onClick={confirm}
            disabled={busy || !quote || (!destOptional && !destChosen)}
          >
            <span>{busy ? '…' : 'تأكيد الرحلة'}</span>
            {!busy && <span>←</span>}
          </button>
        </div>
      </div>
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
    <div className="px-1 py-1">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className={strong ? 'font-extrabold text-green' : 'font-bold'}>{value}</p>
      {note && <p className="text-[10px] text-ink-muted">{note}</p>}
    </div>
  )
}

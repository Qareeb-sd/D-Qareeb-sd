import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ArrowUpDown,
  ArrowLeft,
  Crosshair,
  MapPin as MapPinIcon,
  Navigation,
  Keyboard,
  Map as MapIcon,
  House,
  Briefcase,
  Star,
  Route as RouteIcon,
  Clock4,
  Banknote,
  Landmark,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import MapView from '@/components/MapView'
import LocationSearchPanel, { type SavedEntry } from '@/components/LocationSearchPanel'
import { useRide } from '@/store/RideContext'
import { useAuth } from '@/store/AuthContext'
import { DEFAULT_SERVICE_ID, getService } from '@/data/services'
import {
  createRide,
  notifyDriversOfRide,
  prepayRide,
  cancelRide,
  getActiveCustomerRide,
  getServicePricing,
  getSettings,
  validatePromo,
  listServicePeriods,
  type PromoResult,
} from '@/lib/api'
import { estimateFare, estimateRoute, computeFare, currentPeriod, type PeriodRate } from '@/lib/pricing'
import { fetchRoute, GOOGLE_MAPS_API_KEY } from '@/lib/maps'
import { getCurrentPos } from '@/lib/geo'
import { reverseGeocode } from '@/lib/geocode'
import { km, mins, money } from '@/lib/format'
import { KHARTOUM } from '@/theme'
import type { Settings, ServicePricing, PaymentMethod } from '@/lib/types'

const PAYMENTS: { id: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { id: 'cash', label: 'كاش', icon: Banknote },
  { id: 'bank_transfer', label: 'تحويل بنكي', icon: Landmark },
  { id: 'wallet', label: 'محفظة قريب', icon: Wallet },
]

type Field = 'pickup' | 'dropoff'
/** طرق تحديد نقطة الانطلاق: تلقائي (GPS) · كتابة عنوان · تحديد من الخريطة. */
type PickupMode = 'current' | 'type' | 'map'
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

const SAVED = [
  { key: 'home', label: 'المنزل', icon: House },
  { key: 'work', label: 'العمل', icon: Briefcase },
  { key: 'favorite', label: 'المفضلة', icon: Star },
]

/**
 * تحديد الرحلة — أسلوب «الواحة الملكية»: خريطة + دبوس مركزي + بطاقة سفلية بمسار
 * عمودي منقّط (انطلاق ← وجهة). نقطة الانطلاق قابلة للتعديل بثلاث طرق، والوجهة
 * بالبحث أو الخريطة. صفّ المسافة/المدة/السعر يظهر فقط بعد اكتمال الطرفين.
 */
export default function SelectLocation() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { serviceId, payment, setPayment, setPickup, setDropoff, setFare, setRideId, restore } =
    useRide()

  const sid = serviceId ?? DEFAULT_SERVICE_ID
  const service = getService(sid)

  const [pickupMode, setPickupMode] = useState<PickupMode>('current')
  const [active, setActive] = useState<Field>('dropoff')
  const [searching, setSearching] = useState<Field | null>(null)
  const [pickupPos, setPickupPos] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [pickupAddr, setPickupAddr] = useState('')
  const [pickupSet, setPickupSet] = useState(false)
  const [dropoffPos, setDropoffPos] = useState<google.maps.LatLngLiteral>(KHARTOUM)
  const [dropoffAddr, setDropoffAddr] = useState('')
  const [dropoffSet, setDropoffSet] = useState(false)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [gpsErr, setGpsErr] = useState('')
  // وضع «تكبير الخريطة» أثناء وضع الدبوس — تكبر الخريطة وتصغر البطاقة السفلية.
  const [picking, setPicking] = useState(false)

  const destOptional = Boolean(service?.destinationOptional)
  const destChosen = dropoffSet || dropoffAddr.trim() !== ''

  const [pricing, setPricing] = useState<ServicePricing | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [periodRate, setPeriodRate] = useState<PeriodRate | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promo, setPromo] = useState<PromoResult | null>(null)
  const [promoBusy, setPromoBusy] = useState(false)

  // السعر الفعّال بعد الخصم (إن طُبّق كود صالح).
  const baseFare = quote?.fare ?? 0
  const effectiveFare = promo?.valid ? promo.final : baseFare

  const applyPromo = async () => {
    if (!promoCode.trim() || !quote) return
    setPromoBusy(true)
    const res = await validatePromo(promoCode.trim(), baseFare)
    setPromoBusy(false)
    setPromo(res)
  }

  const placesKey = `qareeb_places_${profile?.id ?? 'guest'}`
  const [places, setPlaces] = useState<Record<string, SavedPlace>>(() => {
    try {
      return JSON.parse(localStorage.getItem(placesKey) || '{}')
    } catch {
      return {}
    }
  })

  const useMyLocation = async () => {
    setGpsBusy(true)
    setGpsErr('')
    setPickupMode('current')
    const pos = await getCurrentPos()
    if (!pos) {
      setGpsBusy(false)
      setGpsErr('تعذّر تحديد الموقع — فعّل صلاحية الموقع')
      return
    }
    setPickupPos(pos)
    setDropoffPos((d) => (d === KHARTOUM ? pos : d))
    setPickupAddr('موقعي الحالي')
    setPickupSet(true)
    setActive('dropoff')
    setGpsBusy(false)
    // عنوان حقيقي لموقع العميل الحالي (يستبدل «موقعي الحالي»).
    if (GOOGLE_MAPS_API_KEY) void reverseGeocode(pos).then((a) => a && setPickupAddr(a))
  }

  // أول دخول: حاول تحديد الموقع تلقائياً.
  useEffect(() => {
    useMyLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // اختيار طريقة تحديد الانطلاق.
  const setPickupBy = (mode: PickupMode) => {
    if (mode === 'current') {
      setPickupMode('current')
      useMyLocation()
      return
    }
    if (mode === 'type') {
      setSearching('pickup') // شاشة بحث كاملة
      return
    }
    // الخريطة
    setPickupMode('map')
    setActive('pickup')
    setPicking(true)
  }

  // الأماكن المحفوظة بصيغة شاشة البحث.
  const savedEntries: SavedEntry[] = SAVED.map((s) => {
    const p = places[s.key]
    return {
      key: s.key,
      label: s.label,
      address: p?.address,
      pos: p ? { lat: p.lat, lng: p.lng } : undefined,
    }
  })

  // اختيار موقع من شاشة البحث.
  const applySearchPick = (pos: google.maps.LatLngLiteral, address: string) => {
    if (searching === 'pickup') {
      setPickupPos(pos)
      setPickupAddr(address)
      setPickupSet(true)
      setPickupMode('type')
    } else {
      setDropoffPos(pos)
      setDropoffAddr(address)
      setDropoffSet(true)
      setActive('dropoff')
    }
    setSearching(null)
  }

  const swap = () => {
    setPickupPos(dropoffPos)
    setDropoffPos(pickupPos)
    setPickupAddr(dropoffAddr)
    setDropoffAddr(pickupAddr)
    setPickupSet(dropoffSet)
    setDropoffSet(pickupSet)
    setPickupMode('type')
  }

  const useSaved = (key: string, label: string) => {
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
        /* الحفظ المحلي غير متاح */
      }
    } else {
      alert(`اختر وجهة أولاً ثم اضغط «${label}» لحفظها هنا.`)
    }
  }

  // حفظ سريع للوجهة الحالية في خانة (منزل/عمل/مفضّل) — لجعل الحفظ سهلاً.
  const [savedFlash, setSavedFlash] = useState('')
  const saveCurrentAs = (key: string, label: string) => {
    if (!dropoffSet && !dropoffAddr.trim()) return
    const next = {
      ...places,
      [key]: { lat: dropoffPos.lat, lng: dropoffPos.lng, address: dropoffAddr.trim() || label },
    }
    setPlaces(next)
    try {
      localStorage.setItem(placesKey, JSON.stringify(next))
    } catch {
      /* الحفظ المحلي غير متاح */
    }
    setSavedFlash(key)
    setTimeout(() => setSavedFlash(''), 1800)
  }

  useEffect(() => {
    void Promise.all([getServicePricing(sid), getSettings(), listServicePeriods()]).then(
      ([p, s, periods]) => {
        setPricing(p)
        setSettings(s)
        // تسعير الفترة الحالية للخدمة المختارة (النموذج الجديد)؛ إن غاب نعود للقديم.
        const row = periods.find((r) => r.service_id === sid && r.period === currentPeriod())
        setPeriodRate(
          row
            ? { base_fare: row.base_fare, per_km: row.per_km, per_min: row.per_min, min_fare: row.min_fare }
            : null,
        )
      },
    )
  }, [sid])

  useEffect(() => {
    if (!pricing || !settings) return
    let alive = true
    const bothPlaced = pickupSet && dropoffSet
    const t = setTimeout(async () => {
      const real = bothPlaced ? await fetchRoute(pickupPos, dropoffPos) : null
      const route = real ?? estimateRoute(pickupPos, dropoffPos)
      if (!alive) return
      // النموذج الجديد (فترات) إن توفّر، وإلا التسعير القديم (شرائح).
      const fare = periodRate
        ? computeFare(route.distanceKm, route.durationMin, periodRate)
        : estimateFare({
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
  }, [pickupPos, dropoffPos, pickupSet, dropoffSet, pricing, settings, periodRate])

  const activePos = active === 'pickup' ? pickupPos : dropoffPos
  const setActivePos = active === 'pickup' ? setPickupPos : setDropoffPos

  // عنوان حقيقي للنقطة النشطة عبر Google (بعد استقرار الدبوس) — يستبدل
  // «موقع محدّد من الخريطة». يعمل فقط بعد أن يُختار الحقل فعلاً (تجنّباً لتعيين
  // وجهة قبل اختيارها)، ولا يعمل أثناء الكتابة اليدوية للانطلاق. يحدّث النصّ فقط.
  const activeSet = active === 'pickup' ? pickupSet : dropoffSet
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !activeSet) return
    if (active === 'pickup' && pickupMode === 'type') return
    const t = setTimeout(() => {
      void reverseGeocode(activePos).then((addr) => {
        if (!addr) return
        if (active === 'pickup') setPickupAddr(addr)
        else setDropoffAddr(addr)
      })
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePos.lat, activePos.lng, active, pickupMode, activeSet])

  // علامة النقطة الأخرى — تُخفى إن تطابقت تقريباً مع مركز الدبوس الحالي (تفادي
  // دبوس أحمر تائه في المركز عندما تكون النقطتان على الموضع الافتراضي نفسه).
  const otherRaw =
    active === 'pickup' ? (dropoffSet ? dropoffPos : null) : pickupSet ? pickupPos : null
  const otherMarker =
    otherRaw &&
    (Math.abs(otherRaw.lat - activePos.lat) > 3e-4 || Math.abs(otherRaw.lng - activePos.lng) > 3e-4)
      ? otherRaw
      : null

  const confirm = async () => {
    setBusy(true)
    // منع طلب أكثر من رحلة في وقت واحد — إن وُجدت رحلة نشطة، عُد لمتابعتها.
    if (profile?.id) {
      const existing = await getActiveCustomerRide(profile.id)
      if (existing) {
        restore(existing)
        setBusy(false)
        alert('لديك رحلة جارية بالفعل — سنعيدك لمتابعتها.')
        navigate(
          existing.status === 'searching' || existing.status === 'requested'
            ? '/find-driver'
            : '/trip',
        )
        return
      }
    }
    const pickup = { pos: pickupPos, address: pickupAddr || 'نقطة الإقلاع' }
    const dropoff = { pos: dropoffPos, address: dropoffAddr || 'الوجهة' }
    setPickup(pickup)
    setDropoff(dropoff)
    setFare(effectiveFare)
    const { id, error } = await createRide({
      customer_id: profile?.id,
      service_id: sid,
      status: 'searching',
      payment_method: payment,
      pickup_lat: pickup.pos.lat,
      pickup_lng: pickup.pos.lng,
      pickup_address: pickup.address,
      dropoff_lat: dropoff.pos.lat,
      dropoff_lng: dropoff.pos.lng,
      dropoff_address: dropoff.address,
      fare: effectiveFare,
      // حقول الخصم تُرسَل فقط عند تطبيق كود صالح (حتى تعمل الرحلة العادية
      // قبل تنفيذ مخطّط قاعدة البيانات المحدّث).
      ...(promo?.valid ? { promo_code: promoCode.trim(), discount: promo.discount } : {}),
    })
    if (error || !id) {
      setBusy(false)
      return alert(error ?? 'تعذّر إنشاء الرحلة، حاول مجدداً.')
    }
    // الدفع بالمحفظة: خصم فوري قبل البحث؛ إن فشل (رصيد غير كافٍ) نُلغي الطلب.
    if (payment === 'wallet') {
      const pay = await prepayRide(id)
      if (pay.error) {
        await cancelRide(id)
        setBusy(false)
        return alert(pay.error === 'رصيد المحفظة غير كافٍ'
          ? 'رصيد محفظتك غير كافٍ — اشحن المحفظة أو اختر طريقة دفع أخرى.'
          : pay.error)
      }
    }
    // إشعار السائقين المتصلين بالطلب الجديد (أفضل جهد — لا يعطّل التدفّق).
    void notifyDriversOfRide(id)
    setRideId(id)
    setBusy(false)
    navigate('/find-driver')
  }

  const canConfirm = !busy && quote && (destOptional || destChosen)
  const pinLabel =
    active === 'pickup' ? 'حرّك الخريطة لتحديد الانطلاق' : 'حرّك الخريطة لتحديد الوجهة'

  return (
    <div className="flex h-full min-h-screen flex-col overflow-hidden bg-ivory font-plex">
      {/* الخريطة (المنطقة العلوية) */}
      <div className="relative min-h-[240px] flex-1">
        <MapView
          center={activePos}
          onCenterChanged={setActivePos}
          onUserDrag={() => {
            setPicking(true)
            if (active === 'pickup') {
              setPickupSet(true)
              setPickupMode('map')
              if (!pickupAddr.trim()) setPickupAddr('موقع محدّد من الخريطة')
            } else {
              setDropoffSet(true)
              if (!dropoffAddr.trim()) setDropoffAddr('موقع محدّد من الخريطة')
            }
          }}
          markers={otherMarker ? [otherMarker] : undefined}
          zoom={16}
          className="absolute inset-0"
        />

        {/* الدبوس المركزي — زمردي بقلب ذهبي */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <span className="mb-1.5 whitespace-nowrap rounded-full bg-royal px-3 py-1.5 text-[11px] font-semibold text-white shadow-float">
            {active === 'pickup' ? pickupAddr || 'نقطة الانطلاق' : dropoffAddr || 'الوجهة'}
          </span>
          <svg width="34" height="44" viewBox="0 0 34 44" fill="none">
            <path
              d="M17 2C9 2 2.5 8.5 2.5 16.5C2.5 27 17 42 17 42C17 42 31.5 27 31.5 16.5C31.5 8.5 25 2 17 2Z"
              fill="#0e3b2e"
              stroke="#c4a265"
              strokeWidth="1.5"
            />
            <circle cx="17" cy="16.5" r="5" fill={active === 'pickup' ? '#fff' : '#c4a265'} />
          </svg>
        </div>

        {/* الهيدر الشفاف */}
        <header
          className="absolute inset-x-0 top-0 z-[600] flex items-center justify-between px-5"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}
        >
          <button
            onClick={() => navigate('/home')}
            className="press-scale grid h-11 w-11 place-items-center rounded-full bg-white text-royal shadow-card"
            aria-label="رجوع"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="rounded-full bg-white/85 px-4 py-2 text-[16px] font-bold text-royal shadow-card backdrop-blur-md">
            حدّد رحلتك
          </h1>
          <button
            onClick={useMyLocation}
            className="press-scale grid h-11 w-11 place-items-center rounded-full bg-white text-royal shadow-card"
            aria-label="موقعي"
          >
            <Crosshair className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </header>

        {/* مفتاح تحديد الدبوس: انطلاق أم وجهة */}
        <div className="absolute inset-x-0 top-16 z-[600] flex justify-center">
          <div className="flex items-center gap-1 rounded-full bg-white/95 p-1 shadow-float">
            <button
              onClick={() => {
                setActive('pickup')
                setPickupMode('map')
                setPicking(true)
              }}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                active === 'pickup' ? 'bg-royal text-white' : 'text-ink-soft'
              }`}
            >
              الانطلاق
            </button>
            <button
              onClick={() => {
                setActive('dropoff')
                setPicking(true)
              }}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                active === 'dropoff' ? 'bg-sand text-white' : 'text-ink-soft'
              }`}
            >
              الوجهة
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[500] flex justify-center">
          <span className="rounded-full bg-royal/70 px-3 py-1 text-[11px] font-medium text-white">
            {pinLabel}
          </span>
        </div>
      </div>

      {/* شريط تأكيد مُصغّر أثناء وضع الدبوس — يترك الخريطة كبيرة لسهولة التحديد */}
      {picking && (
        <section className="relative z-[600] animate-sheet-up">
          <div
            className="rounded-t-[24px] bg-white px-5 pt-3 shadow-soft"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2.75rem)' }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-sand/60" />
            <p className="text-[11px] font-bold text-sand-ink">
              {active === 'pickup' ? 'نقطة الانطلاق' : 'الوجهة'}
            </p>
            <p className="mb-3 truncate text-[15px] font-semibold text-royal">
              {(active === 'pickup' ? pickupAddr : dropoffAddr) || 'حرّك الخريطة لتحديد الموقع'}
            </p>
            <button
              onClick={() => {
                if (active === 'pickup') setPickupSet(true)
                else setDropoffSet(true)
                setPicking(false)
              }}
              className="press-scale w-full rounded-2xl bg-royal py-3.5 text-[15px] font-bold text-white"
            >
              تأكيد الموقع
            </button>
          </div>
        </section>
      )}

      {/* البطاقة السفلية */}
      {!picking && (
      <section className="relative z-[600] -mt-6 animate-sheet-up">
        <div
          className="rounded-t-[28px] bg-white px-5 pt-3 shadow-soft"
          // حدّ أدنى كافٍ حتى لا يختفي زر التأكيد خلف شريط أزرار النظام
          // (بعض أجهزة أندرويد لا تُبلّغ env(safe-area-inset-bottom) لشريط الأزرار).
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2.75rem)' }}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-sand/60" />

          {/* بطاقة المسار: انطلاق ← وجهة مع الخط المنقّط */}
          <div className="relative rounded-2xl border border-hairline/70 bg-ivory/50 p-4">
            <div className="absolute bottom-[46px] right-[27px] top-[24px] w-px border-r-2 border-dotted border-sand/70" />

            {/* نقطة الانطلاق */}
            <div className="flex items-center gap-3">
              <span className="h-[22px] w-[22px] shrink-0 rounded-full border-[6px] border-royal bg-white" />
              <button
                onClick={() => setSearching('pickup')}
                className="min-w-0 flex-1 text-right"
              >
                <p className="text-[10px] font-medium text-ink-muted">نقطة الانطلاق</p>
                <p className="truncate text-[14px] font-semibold text-royal">
                  {gpsBusy && pickupMode === 'current' ? 'جارٍ تحديد موقعك…' : pickupAddr || 'موقعك الحالي'}
                </p>
              </button>
            </div>

            {/* طرق تحديد الانطلاق */}
            <div className="mr-[34px] mt-2 flex gap-1.5">
              <PickChip on={pickupMode === 'current'} icon={Navigation} label="موقعي" onClick={() => setPickupBy('current')} />
              <PickChip on={pickupMode === 'type'} icon={Keyboard} label="اكتب" onClick={() => setPickupBy('type')} />
              <PickChip on={pickupMode === 'map'} icon={MapIcon} label="الخريطة" onClick={() => setPickupBy('map')} />
            </div>

            {/* فاصل + تبديل */}
            <div className="my-3 flex items-center gap-3">
              <span className="w-[22px] shrink-0" />
              <div className="h-px flex-1 bg-hairline/70" />
              <button
                onClick={swap}
                aria-label="تبديل الانطلاق والوجهة"
                className="press-scale -my-1 grid h-8 w-8 place-items-center rounded-full border border-hairline bg-white text-royal shadow-card"
              >
                <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>

            {/* الوجهة */}
            <button onClick={() => setSearching('dropoff')} className="flex w-full items-center gap-3 text-right">
              <MapPinIcon className="h-[22px] w-[22px] shrink-0 text-sand-ink" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-ink-muted">
                  الوجهة {destOptional && <span className="text-ink-muted/70">(اختياري)</span>}
                </p>
                <p
                  className={`truncate text-[15px] font-semibold ${
                    dropoffAddr ? 'text-royal' : 'text-ink-muted/60'
                  }`}
                >
                  {dropoffAddr || 'إلى أين؟'}
                </p>
              </div>
            </button>
          </div>

          {gpsErr && (
            <button onClick={useMyLocation} className="mt-2 text-[12px] text-danger">
              {gpsErr} · إعادة المحاولة
            </button>
          )}

          {/* الأماكن المحفوظة — قبل اختيار الوجهة */}
          {!destChosen && (
            <div className="mt-2 animate-fade-up">
              {SAVED.map((p, i) => {
                const Icon = p.icon
                const saved = places[p.key]
                return (
                  <button
                    key={p.key}
                    onClick={() => useSaved(p.key, p.label)}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className="press-scale animate-fade-up flex w-full items-center gap-3 border-b border-hairline/50 py-3 text-right last:border-0"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ivory">
                      <Icon className="h-[18px] w-[18px] text-royal" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-royal">{p.label}</span>
                      <span className="block truncate text-[11px] text-ink-muted">
                        {saved ? saved.address : 'اضغط لحفظ وجهتك الحالية هنا'}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 rotate-180 text-ink-muted/50" />
                  </button>
                )
              })}
            </div>
          )}

          {/* حفظ سريع للوجهة — بعد اختيارها (يجعل تسجيل الأماكن المفضّلة سهلاً) */}
          {destChosen && (
            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 text-[11px] font-bold text-ink-muted">احفظ الوجهة:</span>
              {SAVED.map((p) => {
                const Icon = p.icon
                const isSaved = savedFlash === p.key
                return (
                  <button
                    key={p.key}
                    onClick={() => saveCurrentAs(p.key, p.label)}
                    className={`press-scale flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${
                      isSaved
                        ? 'border-green bg-green-soft text-green'
                        : 'border-sand/40 bg-ivory/70 text-sand-ink'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    {isSaved ? 'حُفظ ✓' : p.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* ملخّص الرحلة — بعد اكتمال الطرفين فقط */}
          {quote && destChosen && (
            <div className="mt-4 flex animate-fade-up items-center justify-around rounded-2xl border border-royal/10 bg-royal/[0.04] px-4 py-3">
              <div className="flex items-center gap-2">
                <RouteIcon className="h-4 w-4 text-sand-ink" strokeWidth={1.8} />
                <div>
                  <p className="text-[10px] text-ink-muted">المسافة</p>
                  <p className="text-[13px] font-bold text-royal">{km(quote.distanceKm)}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-hairline" />
              <div className="flex items-center gap-2">
                <Clock4 className="h-4 w-4 text-sand-ink" strokeWidth={1.8} />
                <div>
                  <p className="text-[10px] text-ink-muted">المدة</p>
                  <p className="text-[13px] font-bold text-royal">{mins(quote.durationMin)}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-hairline" />
              <div className="text-center">
                <p className="text-[10px] text-ink-muted">
                  السعر {!quote.real && <span className="text-ink-muted/70">تقديري</span>}
                </p>
                <p className="text-[13px] font-bold text-sand-ink">{money(quote.fare)}</p>
              </div>
            </div>
          )}

          {!destOptional && !destChosen && (
            <p className="mt-3 text-center text-[12px] text-warning">حدّد وجهتك للمتابعة</p>
          )}

          {/* كود الخصم — يظهر بعد حساب السعر */}
          {quote && destChosen && (
            <div className="mt-3">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-2xl border border-hairline bg-white px-4 py-2.5 text-[13px] text-ink outline-none focus:border-royal"
                  placeholder="كود خصم (إن وُجد)"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value)
                    setPromo(null)
                  }}
                />
                <button
                  onClick={applyPromo}
                  disabled={promoBusy || !promoCode.trim()}
                  className="rounded-2xl bg-royal px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  {promoBusy ? '…' : 'تطبيق'}
                </button>
              </div>
              {promo && (
                <p className={`mt-1.5 text-[12px] ${promo.valid ? 'text-green' : 'text-danger'}`}>
                  {promo.valid
                    ? `${promo.message} — خصم ${money(promo.discount)} · السعر ${money(promo.final)}`
                    : promo.message}
                </p>
              )}
            </div>
          )}

          {/* طريقة الدفع — تُختار قبل الطلب */}
          <div className="mt-4">
            <p className="mb-1.5 text-[13px] font-bold text-royal">طريقة الدفع</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENTS.map((p) => {
                const Icon = p.icon
                const on = payment === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setPayment(p.id)}
                    className={`press-scale flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-center text-[12px] transition ${
                      on
                        ? 'border-transparent bg-royal font-bold text-white ring-gold'
                        : 'border-hairline bg-white text-ink-soft'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                    {p.label}
                  </button>
                )
              })}
            </div>
            {payment === 'wallet' && (
              <p className="mt-1.5 text-[11px] text-ink-muted">
                سيُخصم المبلغ من محفظتك فور تأكيد الرحلة، ويُسترجَع إن أُلغيت.
              </p>
            )}
          </div>

          {/* زر التأكيد */}
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className={`press-scale mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold transition ${
              canConfirm ? 'bg-royal text-white shadow-float' : 'bg-ivory text-ink-muted/60'
            }`}
          >
            {busy ? 'جارٍ التأكيد…' : 'تأكيد الرحلة'}
            {!busy && <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />}
          </button>
        </div>
      </section>
      )}

      {/* شاشة البحث الكاملة — تُخفي الخريطة وتستغلّ المساحة (مثل أوبر) */}
      {searching && (
        <LocationSearchPanel
          field={searching}
          initial={
            searching === 'dropoff' ? dropoffAddr : pickupMode === 'type' ? pickupAddr : ''
          }
          saved={savedEntries}
          onPick={({ pos, address }) => applySearchPick(pos, address)}
          onUseCurrent={
            searching === 'pickup'
              ? () => {
                  setPickupMode('current')
                  useMyLocation()
                }
              : undefined
          }
          onChooseOnMap={() => {
            if (searching === 'pickup') {
              setPickupMode('map')
              setActive('pickup')
            } else {
              setActive('dropoff')
            }
            setPicking(true)
            setSearching(null)
          }}
          onClose={() => setSearching(null)}
        />
      )}
    </div>
  )
}

function PickChip({
  on,
  icon: Icon,
  label,
  onClick,
}: {
  on: boolean
  icon: typeof House
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`press-scale flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
        on ? 'border-sand bg-sand-soft text-sand-ink' : 'border-hairline bg-white text-ink-soft'
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {label}
    </button>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ChevronRight,
  ArrowUpDown,
  ArrowLeft,
  Crosshair,
  MapPin as MapPinIcon,
  Navigation,
  Keyboard,
  Map as MapIcon,
  Route as RouteIcon,
  Clock4,
  Banknote,
  Landmark,
  Wallet,
  Plus,
  X,
  type LucideIcon,
} from 'lucide-react'
import MapView from '@/components/MapView'
import LocationSearchPanel, { type SavedEntry } from '@/components/LocationSearchPanel'
import { useRide } from '@/store/RideContext'
import { useAuth } from '@/store/AuthContext'
import { useResumeActiveRide } from '@/hooks/useResumeActiveRide'
import { DEFAULT_SERVICE_ID, getService } from '@/data/services'
import {
  createRide,
  createScheduledRide,
  notifyDriversOfRide,
  prepayRide,
  cancelRide,
  getCancellationDebt,
  getActiveCustomerRide,
  getServicePricing,
  getSettings,
  validatePromo,
  listServicePeriods,
  nearbyOnlineDrivers,
  getWallet,
  getCurrentSurge,
  type PromoResult,
} from '@/lib/api'
import {
  estimateFare,
  estimateRoute,
  computeFare,
  currentPeriod,
  fareBreakdown,
  type PeriodRate,
} from '@/lib/pricing'
import FareReceipt from '@/components/FareReceipt'
import { fetchRoute } from '@/lib/maps'
import { getCurrentPos, loadLastPos } from '@/lib/geo'
import { reverseGeocode } from '@/lib/geocode'
import {
  SAVED_SLOTS,
  type SavedPlace,
  type SavedKey,
  loadPlaces,
  savePlace,
} from '@/lib/savedPlaces'
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
  // إن دخل العميل هذه الشاشة (عبر «رجوع» مثلاً) وله رحلة جارية، يُعاد إليها فوراً.
  useResumeActiveRide()

  const sid = serviceId ?? DEFAULT_SERVICE_ID
  const service = getService(sid)

  // إعادة الطلب: وجهة مُمرَّرة من «رحلاتي» لتعبئة الوجهة تلقائياً.
  const navState = useLocation().state as {
    rebook?: { dropoffPos: google.maps.LatLngLiteral | null; dropoffAddr: string }
    mode?: 'package' | 'intercity'
  } | null
  const rebook = navState?.rebook
  // وضع الخدمة: توصيل طرد أو رحلة بين المدن (يُغيّر التسميات والحقول).
  const mode = navState?.mode
  const isPackage = mode === 'package'
  const isIntercity = mode === 'intercity'
  const pickupLabel = isPackage ? 'موقع استلام الطرد' : 'نقطة الانطلاق'
  const dropoffLabel = isPackage ? 'موقع تسليم الطرد' : isIntercity ? 'المدينة / الوجهة' : 'الوجهة'

  const [pickupMode, setPickupMode] = useState<PickupMode>('current')
  const [active, setActive] = useState<Field>('dropoff')
  const [searching, setSearching] = useState<Field | null>(null)
  // المركز الافتراضي = آخر موقع ناجح (إن وُجد) بدل الخرطوم — فلا يعود «للسودان».
  const initialCenter = loadLastPos() ?? KHARTOUM
  const [pickupPos, setPickupPos] = useState<google.maps.LatLngLiteral>(initialCenter)
  const [pickupAddr, setPickupAddr] = useState('')
  const [pickupSet, setPickupSet] = useState(false)
  const [dropoffPos, setDropoffPos] = useState<google.maps.LatLngLiteral>(
    rebook?.dropoffPos ?? initialCenter,
  )
  const [dropoffAddr, setDropoffAddr] = useState(rebook?.dropoffAddr ?? '')
  const [dropoffSet, setDropoffSet] = useState(Boolean(rebook?.dropoffPos))
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
  // الرحلة لشخص آخر (اختياري).
  const [forOther, setForOther] = useState(false)
  const [riderName, setRiderName] = useState('')
  const [riderPhone, setRiderPhone] = useState('')
  // توصيل طرد: وصف الطرد + بيانات المستلِم.
  const [packageNote, setPackageNote] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  // نقاط توقّف متوسّطة (اختياري) — بين الانطلاق والوجهة.
  const [stops, setStops] = useState<{ pos: google.maps.LatLngLiteral; address: string }[]>([])
  const [stopSearch, setStopSearch] = useState<number | null>(null) // فهرس النقطة قيد البحث

  // دَيْن رسوم إلغاء سابق (يُضاف لأجرة هذه الرحلة).
  const [debt, setDebt] = useState(0)
  const [walletBal, setWalletBal] = useState<number | null>(null)
  const [surge, setSurge] = useState(1)
  useEffect(() => {
    void getCurrentSurge().then(setSurge)
  }, [])
  useEffect(() => {
    if (profile?.id) void getCancellationDebt(profile.id).then(setDebt)
    if (profile?.id) void getWallet(profile.id).then((w) => setWalletBal(w?.balance ?? 0))
  }, [profile?.id])

  // السيارات المتصلة القريبة (تُعبّأ أدناه بعد تعريف activePos).
  const [nearby, setNearby] = useState<{ lat: number; lng: number; icon?: string }[]>([])

  // السعر الفعّال بعد الخصم (إن طُبّق كود صالح).
  const baseFare = quote?.fare ?? 0
  const effectiveFare = promo?.valid ? promo.final : baseFare
  const [showFareDetails, setShowFareDetails] = useState(false)
  // تفصيل الأجرة للإيصال (يتوفّر مع تسعير الفترات).
  const breakdown =
    periodRate && quote
      ? fareBreakdown(
          quote.distanceKm,
          quote.durationMin,
          periodRate,
          promo?.valid ? promo.discount : 0,
        )
      : null

  // إذا تغيّرت الأجرة الأساسية (وجهة/توقّفات/ذروة) بعد تطبيق برومو، أبطِل الخصم —
  // فقيمته كانت محسوبة على أجرة مختلفة، ويجب إعادة التحقّق منه ضدّ الأجرة الجديدة.
  useEffect(() => {
    setPromo(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFare])

  const applyPromo = async () => {
    if (!promoCode.trim() || !quote) return
    setPromoBusy(true)
    const res = await validatePromo(promoCode.trim(), baseFare)
    setPromoBusy(false)
    setPromo(res)
  }

  const [places, setPlaces] = useState<Record<string, SavedPlace>>(() => loadPlaces(profile?.id))

  // معرّف الطلب — يمنع نتيجة محاولة قديمة/بطيئة من الكتابة فوق محاولة أحدث ناجحة
  // (تفادي رسالة خطأ حمراء عالقة رغم نجاح التحديد).
  const gpsReqId = useRef(0)
  const useMyLocation = async () => {
    const myId = ++gpsReqId.current
    setGpsBusy(true)
    setGpsErr('')
    setPickupMode('current')
    const pos = await getCurrentPos()
    if (myId !== gpsReqId.current) return // محاولة أحدث سبقتها — تجاهل هذه
    if (!pos) {
      setGpsBusy(false)
      setGpsErr('تعذّر تحديد موقعك تلقائياً — اكتب اسم المكان أو حدّده على الخريطة')
      // نُبقي البطاقة ظاهرة (فيها: اكتب/الخريطة/موقعي) بدل حبس المستخدم في الدبوس.
      setActive('pickup')
      return
    }
    setPickupPos(pos)
    setDropoffPos((d) => (d === KHARTOUM ? pos : d))
    setPickupAddr('موقعي الحالي')
    setPickupSet(true)
    setActive('dropoff')
    setGpsBusy(false)
    // عنوان حقيقي لموقع العميل الحالي (Google ثم Photon المجاني كبديل).
    void reverseGeocode(pos).then((a) => a && setPickupAddr(a))
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
  const savedEntries: SavedEntry[] = SAVED_SLOTS.map((s) => {
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

  const useSaved = (key: SavedKey, label: string) => {
    const p = places[key]
    if (p) {
      setDropoffPos({ lat: p.lat, lng: p.lng })
      setDropoffAddr(p.address)
      setDropoffSet(true)
      setActive('dropoff')
      return
    }
    if (dropoffSet || dropoffAddr.trim()) {
      setPlaces(
        savePlace(profile?.id, places, key, {
          lat: dropoffPos.lat,
          lng: dropoffPos.lng,
          address: dropoffAddr.trim() || label,
        }),
      )
    } else {
      alert(`اختر وجهة أولاً ثم اضغط «${label}» لحفظها هنا.`)
    }
  }

  // حفظ سريع للوجهة الحالية في خانة (منزل/عمل/مفضّل) — لجعل الحفظ سهلاً.
  const [savedFlash, setSavedFlash] = useState('')
  const saveCurrentAs = (key: SavedKey, label: string) => {
    if (!dropoffSet && !dropoffAddr.trim()) return
    setPlaces(
      savePlace(profile?.id, places, key, {
        lat: dropoffPos.lat,
        lng: dropoffPos.lng,
        address: dropoffAddr.trim() || label,
      }),
    )
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
      // المسار عبر نقاط التوقّف: انطلاق → توقّف₁ → … → وجهة (جمع المسافات والأزمنة).
      const pts = [pickupPos, ...stops.map((s) => s.pos), dropoffPos]
      let km = 0
      let min = 0
      let anyReal = false
      for (let i = 0; i < pts.length - 1; i++) {
        const real = bothPlaced ? await fetchRoute(pts[i], pts[i + 1]) : null
        const leg = real ?? estimateRoute(pts[i], pts[i + 1])
        km += leg.distanceKm
        min += leg.durationMin
        if (real) anyReal = true
      }
      if (!alive) return
      // النموذج الجديد (فترات) إن توفّر، وإلا التسعير القديم (شرائح).
      const rawFare = periodRate
        ? computeFare(km, min, periodRate)
        : estimateFare({ distanceKm: km, durationMin: min, pricing, settings }).total
      // مضاعف الرحلات بين المدن (يُطبَّق قبل الذروة).
      const interMult = isIntercity ? (settings?.intercity_multiplier ?? 1) : 1
      const baseFare = interMult > 1 ? Math.round((rawFare * interMult) / 100) * 100 : rawFare
      // مضاعف الذروة (تلقائي/يدوي) يُطبَّق على الأجرة ويُقرّب لأقرب 100.
      const fare = surge > 1 ? Math.round((baseFare * surge) / 100) * 100 : baseFare
      setQuote({ distanceKm: km, durationMin: min, fare, real: anyReal })
    }, 700)
    return () => {
      alive = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupPos, dropoffPos, pickupSet, dropoffSet, pricing, settings, periodRate, surge, isIntercity, JSON.stringify(stops)])

  const activePos = active === 'pickup' ? pickupPos : dropoffPos
  const setActivePos = active === 'pickup' ? setPickupPos : setDropoffPos

  // جلب السيارات المتصلة القريبة حول الدبوس (دوري، بلا إعادة تشغيل عند كل سحب).
  const activePosRef = useRef(activePos)
  useEffect(() => {
    activePosRef.current = activePos
  }, [activePos])
  useEffect(() => {
    let alive = true
    const iconFor = (vt: string) => getService(vt)?.imageUrl || getService(vt)?.image
    const load = () => {
      const c = activePosRef.current
      void nearbyOnlineDrivers(c.lat, c.lng).then((ds) => {
        if (alive)
          setNearby(ds.map((d) => ({ lat: d.lat, lng: d.lng, icon: iconFor(d.vehicle_type) })))
      })
    }
    load()
    const iv = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [])

  // عنوان حقيقي للنقطة النشطة عبر Google (بعد استقرار الدبوس) — يستبدل
  // «موقع محدّد من الخريطة». يعمل فقط بعد أن يُختار الحقل فعلاً (تجنّباً لتعيين
  // وجهة قبل اختيارها)، ولا يعمل أثناء الكتابة اليدوية للانطلاق. يحدّث النصّ فقط.
  const activeSet = active === 'pickup' ? pickupSet : dropoffSet
  useEffect(() => {
    if (!activeSet) return
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

  // علامات الخريطة الثابتة: النقطة الأخرى + نقاط التوقّف.
  const staticMarkers = [otherMarker, ...stops.map((s) => s.pos)].filter(
    Boolean,
  ) as google.maps.LatLngLiteral[]

  // جدولة لوقت لاحق
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const schedule = async () => {
    if (!scheduleAt || !quote) return
    setBusy(true)
    const { id, error } = await createScheduledRide({
      serviceId: sid,
      scheduledAt: new Date(scheduleAt).toISOString(),
      pickup: { lat: pickupPos.lat, lng: pickupPos.lng, address: pickupAddr || 'نقطة الإقلاع' },
      dropoff: { lat: dropoffPos.lat, lng: dropoffPos.lng, address: dropoffAddr || 'الوجهة' },
      payment,
      fare: effectiveFare,
    })
    setBusy(false)
    if (error || !id) return alert(error ?? 'تعذّر جدولة الرحلة، حاول مجدداً.')
    alert('تمت جدولة رحلتك — سنبحث لك عن سائق في الموعد ونُشعرك.')
    navigate('/scheduled')
  }

  const confirm = async () => {
    // توصيل طرد: اسم وهاتف المستلِم إلزاميان قبل الطلب.
    if (isPackage && (!recipientName.trim() || !recipientPhone.trim())) {
      return alert('أدخل اسم ورقم المستلِم لتوصيل الطرد.')
    }
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
    // الأجرة المعروضة تشمل دَيْن الإلغاء السابق (يضيفه الخادم فعلياً عند الإنشاء).
    setFare(effectiveFare + debt)
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
      // الرحلة لشخص آخر: اسم/رقم الراكب الفعلي (يراهما السائق ويتصل به).
      ...(forOther && riderName.trim()
        ? { rider_name: riderName.trim(), rider_phone: riderPhone.trim() || null }
        : {}),
      // نقاط التوقّف المتوسّطة (إن وُجدت).
      ...(stops.length
        ? { stops: stops.map((s) => ({ lat: s.pos.lat, lng: s.pos.lng, address: s.address })) }
        : {}),
      // توصيل طرد: وصف الطرد وبيانات المستلِم (يراها السائق ويتصل به).
      ...(isPackage
        ? {
            is_package: true,
            package_note: packageNote.trim() || null,
            recipient_name: recipientName.trim() || null,
            recipient_phone: recipientPhone.trim() || null,
          }
        : {}),
      // رحلة بين المدن.
      ...(isIntercity ? { intercity: true } : {}),
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
    // استبدال بدل الإضافة: بعد إنشاء الطلب لا يجوز الرجوع لتحديد الخريطة.
    navigate('/find-driver', { replace: true })
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
          markers={staticMarkers.length ? staticMarkers : undefined}
          driverMarkers={nearby}
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
            {/* بدائل: بحث بالاسم أو الموقع الحالي — كي لا يعلق المستخدم على الدبوس */}
            <div className="mb-2 flex gap-2">
              <button
                onClick={() => {
                  setPicking(false)
                  setSearching(active)
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-hairline py-2.5 text-[13px] font-bold text-royal"
              >
                <Keyboard className="h-4 w-4" strokeWidth={2} />
                بحث بالاسم
              </button>
              {active === 'pickup' && (
                <button
                  onClick={() => {
                    setPicking(false)
                    useMyLocation()
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-hairline py-2.5 text-[13px] font-bold text-royal"
                >
                  <Navigation className="h-4 w-4" strokeWidth={2} />
                  موقعي الحالي
                </button>
              )}
            </div>
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

          {/* لافتة الوضع: توصيل طرد / رحلة بين المدن */}
          {(isPackage || isIntercity) && (
            <div
              className={`mb-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-[13px] font-bold ${
                isPackage ? 'bg-sand-soft text-sand-ink' : 'bg-royal-soft text-royal'
              }`}
            >
              <span className="text-base">{isPackage ? '📦' : '🏙️'}</span>
              {isPackage ? 'توصيل طرد' : 'رحلة بين المدن'}
            </div>
          )}

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
                <p className="text-[10px] font-medium text-ink-muted">{pickupLabel}</p>
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

            {/* نقاط التوقّف المتوسّطة */}
            {stops.map((s, i) => (
              <div key={i} className="mb-1 flex items-center gap-3">
                <MapPinIcon className="h-[20px] w-[20px] shrink-0 text-royal/60" strokeWidth={2} />
                <button
                  onClick={() => setStopSearch(i)}
                  className="min-w-0 flex-1 truncate text-right text-[14px] font-semibold text-royal"
                >
                  {s.address || `توقّف ${i + 1}`}
                </button>
                <button
                  onClick={() => setStops((cur) => cur.filter((_, j) => j !== i))}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-danger"
                  aria-label="حذف التوقّف"
                >
                  <X className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </div>
            ))}
            {stops.length < 3 && (
              <button
                onClick={() => setStopSearch(stops.length)}
                className="mb-1 flex items-center gap-2 text-[12px] font-bold text-green"
              >
                <span className="grid h-[22px] w-[22px] place-items-center">
                  <Plus className="h-4 w-4" strokeWidth={2.4} />
                </span>
                إضافة نقطة توقّف
              </button>
            )}

            {/* الوجهة */}
            <button onClick={() => setSearching('dropoff')} className="flex w-full items-center gap-3 text-right">
              <MapPinIcon className="h-[22px] w-[22px] shrink-0 text-sand-ink" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-ink-muted">
                  {dropoffLabel} {destOptional && <span className="text-ink-muted/70">(اختياري)</span>}
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
              {SAVED_SLOTS.map((p, i) => {
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
              {SAVED_SLOTS.map((p) => {
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
                <p className="text-[13px] font-bold text-sand-ink">
                  {money(effectiveFare + debt)}
                </p>
              </div>
            </div>
          )}

          {/* شارة الذروة — يعرف العميل أن السعر أعلى بسبب ازدحام الطلب */}
          {quote && destChosen && surge > 1 && (
            <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-warning/10 px-3 py-2 text-[12px] font-bold text-warning">
              <RouteIcon className="h-4 w-4" strokeWidth={2.2} />
              تسعير ذروة ×{surge} — الطلب مرتفع حالياً.
            </div>
          )}

          {/* شارة الرحلة بين المدن — يعرف العميل أن التسعير أعلى للمسافات البعيدة */}
          {isIntercity && quote && destChosen && (settings?.intercity_multiplier ?? 1) > 1 && (
            <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-royal-soft px-3 py-2 text-[12px] font-bold text-royal">
              <span className="text-sm">🏙️</span>
              رحلة بين المدن — تسعير ×{settings?.intercity_multiplier} للمسافات البعيدة.
            </div>
          )}

          {/* دَيْن رسوم إلغاء سابق مُضاف لهذه الرحلة */}
          {quote && destChosen && debt > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-warning/10 px-3 py-2 text-[12px]">
              <span className="font-medium text-warning">رسوم إلغاء سابقة</span>
              <span className="font-bold text-warning">+ {money(debt)}</span>
            </div>
          )}

          {/* تفصيل الأجرة — قابل للطيّ */}
          {quote && destChosen && breakdown && (
            <div className="mt-2">
              <button
                onClick={() => setShowFareDetails((v) => !v)}
                className="press-scale flex w-full items-center justify-center gap-1 text-[12px] font-bold text-sand-ink"
              >
                {showFareDetails ? 'إخفاء تفاصيل السعر' : 'عرض تفاصيل السعر'}
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${showFareDetails ? '-rotate-90' : 'rotate-90'}`}
                />
              </button>
              {showFareDetails && (
                <div className="mt-2 animate-fade-up">
                  <FareReceipt
                    b={breakdown}
                    km={quote.distanceKm}
                    min={quote.durationMin}
                    estimate={!quote.real}
                  />
                </div>
              )}
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

          {/* توصيل طرد — وصف الطرد وبيانات المستلِم (إلزامية) */}
          {isPackage && quote && destChosen && (
            <div className="mt-3 space-y-2 rounded-2xl border border-sand/50 bg-sand-soft/40 p-3">
              <p className="text-[13px] font-bold text-sand-ink">بيانات الطرد والمستلِم</p>
              <input
                className="w-full rounded-2xl border border-hairline bg-white px-4 py-2.5 text-[13px] text-ink outline-none focus:border-royal"
                placeholder="وصف الطرد (مثال: مستندات، طعام…)"
                maxLength={120}
                value={packageNote}
                onChange={(e) => setPackageNote(e.target.value)}
              />
              <input
                className="w-full rounded-2xl border border-hairline bg-white px-4 py-2.5 text-[13px] text-ink outline-none focus:border-royal"
                placeholder="اسم المستلِم *"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
              <input
                className="w-full rounded-2xl border border-hairline bg-white px-4 py-2.5 text-left text-[13px] text-ink outline-none focus:border-royal"
                dir="ltr"
                inputMode="tel"
                placeholder="رقم هاتف المستلِم *"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
              <p className="text-[11px] text-ink-muted">
                يتواصل السائق مع المستلِم عند الوصول لنقطة التسليم.
              </p>
            </div>
          )}

          {/* الرحلة لشخص آخر — اسم ورقم الراكب الفعلي (اختياري) — يُخفى في وضع الطرد */}
          {!isPackage && quote && destChosen && (
            <div className="mt-3 rounded-2xl border border-hairline p-3">
              <label className="flex items-center gap-2 text-[13px] font-bold text-royal">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-green"
                  checked={forOther}
                  onChange={(e) => setForOther(e.target.checked)}
                />
                هذه الرحلة لشخص آخر
              </label>
              {forOther && (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] text-ink-muted">
                    يتواصل السائق مع الراكب الفعلي بهذه البيانات.
                  </p>
                  <input
                    className="w-full rounded-2xl border border-hairline bg-white px-4 py-2.5 text-[13px] text-ink outline-none focus:border-royal"
                    placeholder="اسم الراكب"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                  />
                  <input
                    className="w-full rounded-2xl border border-hairline bg-white px-4 py-2.5 text-left text-[13px] text-ink outline-none focus:border-royal"
                    dir="ltr"
                    inputMode="tel"
                    placeholder="رقم هاتف الراكب"
                    value={riderPhone}
                    onChange={(e) => setRiderPhone(e.target.value)}
                  />
                </div>
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
            {payment === 'wallet' &&
              (walletBal != null && quote && walletBal < effectiveFare + debt ? (
                <button
                  onClick={() => navigate('/wallet')}
                  className="mt-1.5 flex w-full items-center gap-1.5 rounded-xl bg-danger/5 px-3 py-2 text-right text-[12px] font-bold text-danger"
                >
                  <Wallet className="h-4 w-4 shrink-0" strokeWidth={2} />
                  رصيد محفظتك {money(walletBal)} لا يكفي لهذه الرحلة — اضغط لتعبئة المحفظة.
                </button>
              ) : (
                <p className="mt-1.5 text-[11px] text-ink-muted">
                  سيُخصم المبلغ من محفظتك فور تأكيد الرحلة، ويُسترجَع إن أُلغيت.
                  {walletBal != null && ` رصيدك: ${money(walletBal)}.`}
                </p>
              ))}
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

          {/* جدولة لوقت لاحق */}
          {canConfirm && (
            <div className="mt-2">
              {!showSchedule ? (
                <button
                  onClick={() => setShowSchedule(true)}
                  className="press-scale flex w-full items-center justify-center gap-1.5 text-[13px] font-bold text-sand-ink"
                >
                  <Clock4 className="h-4 w-4" strokeWidth={2} />
                  جدولة لوقت لاحق
                </button>
              ) : (
                <div className="animate-fade-up space-y-2 rounded-2xl border border-hairline bg-ivory/60 p-3">
                  <p className="text-[13px] font-bold text-royal">اختر موعد الرحلة</p>
                  <input
                    type="datetime-local"
                    className="field w-full text-left"
                    dir="ltr"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={schedule}
                      disabled={busy || !scheduleAt}
                      className="flex-1 rounded-xl bg-royal px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {busy ? '…' : 'أكّد الجدولة'}
                    </button>
                    <button
                      onClick={() => setShowSchedule(false)}
                      className="flex-1 rounded-xl border border-hairline bg-white px-3 py-2.5 text-sm font-bold text-ink-soft"
                    >
                      إلغاء
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    عند حلول الموعد نبحث لك عن سائق تلقائياً ونُشعرك.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      )}

      {/* بحث نقطة توقّف */}
      {stopSearch !== null && (
        <LocationSearchPanel
          field="dropoff"
          initial={stops[stopSearch]?.address ?? ''}
          saved={savedEntries}
          onPick={({ pos, address }) => {
            setStops((cur) => {
              const next = [...cur]
              if (stopSearch < next.length) next[stopSearch] = { pos, address }
              else next.push({ pos, address })
              return next
            })
            setStopSearch(null)
          }}
          onChooseOnMap={() => {
            const idx = stopSearch
            setStops((cur) => {
              const next = [...cur]
              const entry = { pos: activePos, address: 'موقع محدّد من الخريطة' }
              if (idx < next.length) next[idx] = entry
              else next.push(entry)
              return next
            })
            setStopSearch(null)
          }}
          onClose={() => setStopSearch(null)}
        />
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
  icon: LucideIcon
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
